/**
 * Web Crawler → Markdown
 *
 * Usage:
 *   node crawl.mjs <start-url> [options]
 *
 * Options:
 *   --out <dir>          Output directory (default: ./output)
 *   --prefix <path>      Only crawl URLs matching this path prefix (default: path of start URL)
 *   --delay <ms>         Delay between requests in ms (default: 300)
 *   --max <n>            Max pages to crawl (default: unlimited)
 *   --combine            Also write a single combined.md file
 *   --selector <css>     CSS selector for main content (default: auto-detect)
 *   --no-split           Don't write individual files, only combined
 *
 * Examples:
 *   node crawl.mjs https://help.core.cin7.com/hc/en-us --combine --delay 500
 *   node crawl.mjs https://docs.example.com --out ./docs --max 200
 */

import { createWriteStream, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { URL } from "url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  if (i === -1) return defaultVal;
  return args[i + 1];
}

function hasFlag(flag) {
  return args.includes(flag);
}

const startUrl = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
if (!startUrl) {
  console.error("Usage: node crawl.mjs <start-url> [options]");
  process.exit(1);
}

const startParsed = new URL(startUrl);
const defaultPrefix = startParsed.pathname.replace(/\/$/, "") || "/";

const config = {
  startUrl,
  outDir: getArg("--out", "./output"),
  prefix: getArg("--prefix", defaultPrefix),
  delay: parseInt(getArg("--delay", "300"), 10),
  max: parseInt(getArg("--max", "0"), 10), // 0 = unlimited
  combine: hasFlag("--combine"),
  noSplit: hasFlag("--no-split"),
  selector: getArg("--selector", null),
};

console.log("Config:", { ...config, startUrl: config.startUrl });

// ─── Turndown setup ───────────────────────────────────────────────────────────

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Keep tables as-is (turndown has a GFM tables plugin but we'll keep simple)
td.addRule("removeEmpty", {
  filter: (node) => {
    return (
      ["script", "style", "noscript", "iframe", "svg"].includes(
        node.nodeName.toLowerCase()
      )
    );
  },
  replacement: () => "",
});

// ─── Content selector heuristics ─────────────────────────────────────────────

const CONTENT_SELECTORS = [
  // Zendesk Help Center
  "article.article",
  ".article-body",
  // Generic docs
  "main article",
  "article[role='main']",
  "main",
  '[role="main"]',
  ".content",
  ".post-content",
  ".entry-content",
  "#content",
  // Fallback
  "body",
];

function extractContent($, customSelector) {
  const selectors = customSelector
    ? [customSelector, ...CONTENT_SELECTORS]
    : CONTENT_SELECTORS;

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 100) {
      // Remove nav/header/footer/breadcrumbs inside the content block
      el.find("nav, header, footer, .breadcrumbs, .navigation, .toc, [aria-label='breadcrumb']").remove();
      return el.html() || "";
    }
  }
  return $("body").html() || "";
}

function extractTitle($) {
  return (
    $("h1").first().text().trim() ||
    $("title").text().trim().split("|")[0].trim() ||
    $("title").text().trim()
  );
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

function normaliseUrl(href, base) {
  try {
    const u = new URL(href, base);
    u.hash = "";
    u.search = ""; // strip query strings — tweak if needed
    return u.href;
  } catch {
    return null;
  }
}

function shouldCrawl(href) {
  try {
    const u = new URL(href);
    return (
      u.hostname === startParsed.hostname &&
      u.pathname.startsWith(config.prefix)
    );
  } catch {
    return false;
  }
}

function urlToFilename(href) {
  const u = new URL(href);
  const slug = u.pathname
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replace(/[^a-zA-Z0-9_\-\/]/g, "-")
    .replace(/\//g, "__");
  return (slug || "index") + ".md";
}

// ─── Crawler ─────────────────────────────────────────────────────────────────

const visited = new Set();
const queue = [config.startUrl];
const results = []; // { url, title, markdown }

mkdirSync(config.outDir, { recursive: true });

// Cookie jar — persist cookies across requests (needed for Zendesk and similar)
const cookieJar = new Map(); // domain -> "key=val; key2=val2"

function storeCookies(hostname, setCookieHeaders) {
  if (!setCookieHeaders) return;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const existing = cookieJar.get(hostname) ? Object.fromEntries(
    cookieJar.get(hostname).split("; ").map((p) => p.split("="))
  ) : {};
  for (const raw of headers) {
    const [pair] = raw.split(";");
    const [k, ...vParts] = pair.trim().split("=");
    existing[k.trim()] = vParts.join("=").trim();
  }
  cookieJar.set(hostname, Object.entries(existing).map(([k, v]) => `${k}=${v}`).join("; "));
}

function getCookies(hostname) {
  return cookieJar.get(hostname) || "";
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

async function fetchPage(url) {
  const hostname = new URL(url).hostname;
  const cookies = getCookies(hostname);

  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      ...(cookies ? { Cookie: cookies } : {}),
      Referer: config.startUrl,
    },
    redirect: "follow",
  });

  // Store any cookies the server sets
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  storeCookies(hostname, setCookie);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) throw new Error(`Non-HTML content: ${ct}`);
  return res.text();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function crawl() {
  let count = 0;

  while (queue.length > 0) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    if (config.max > 0 && count >= config.max) {
      console.log(`Reached max page limit (${config.max}). Stopping.`);
      break;
    }

    process.stdout.write(`[${count + 1}] Fetching: ${url} ... `);

    let html;
    try {
      html = await fetchPage(url);
      console.log("OK");
    } catch (err) {
      console.log(`SKIP (${err.message})`);
      continue;
    }

    const $ = cheerio.load(html);

    // Collect links before stripping content
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const normalised = normaliseUrl(href, url);
      if (normalised && shouldCrawl(normalised) && !visited.has(normalised)) {
        queue.push(normalised);
      }
    });

    // Extract & convert
    const title = extractTitle($);
    const contentHtml = extractContent($, config.selector);
    let markdown = td.turndown(contentHtml);

    // Clean up excessive blank lines
    markdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

    const frontmatter = `---\nurl: ${url}\ntitle: ${title.replace(/:/g, " -")}\n---\n\n`;
    const fullMd = `${frontmatter}# ${title}\n\n${markdown}\n`;

    results.push({ url, title, markdown: fullMd });

    if (!config.noSplit) {
      const filename = urlToFilename(url);
      const filepath = join(config.outDir, filename);
      mkdirSync(dirname(filepath), { recursive: true });
      writeFileSync(filepath, fullMd, "utf8");
    }

    count++;
    if (queue.length > 0) await sleep(config.delay);
  }

  console.log(`\nCrawled ${count} pages.`);

  if (config.combine || config.noSplit) {
    const combinedPath = join(config.outDir, "combined.md");
    const combined = results.map((r) => r.markdown).join("\n\n---\n\n");
    writeFileSync(combinedPath, combined, "utf8");
    console.log(`Combined file: ${combinedPath} (${(combined.length / 1024).toFixed(1)} KB)`);
  }

  if (!config.noSplit) {
    console.log(`Individual files saved to: ${config.outDir}/`);
  }
}

crawl().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
