/**
 * Zendesk Help Center → Markdown
 *
 * Uses the public Zendesk Help Center REST API (no auth needed for public sites).
 *
 * Usage:
 *   node crawl-zendesk.mjs <base-url> [options]
 *
 * Options:
 *   --out <dir>      Output directory (default: ./output)
 *   --locale <loc>   Locale (default: en-us)
 *   --delay <ms>     Delay between requests in ms (default: 200)
 *   --combine        Also write a single combined.md
 *   --no-split       Only write combined.md, skip individual files
 *
 * Examples:
 *   node crawl-zendesk.mjs https://help.core.cin7.com --combine --no-split
 *   node crawl-zendesk.mjs https://support.example.com --out ./docs --locale en-gb
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { URL } from "url";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

// ─── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i === -1 ? def : args[i + 1];
}
function hasFlag(f) { return args.includes(f); }

const inputUrl = args.find((a) => a.startsWith("http"));
if (!inputUrl) {
  console.error("Usage: node crawl-zendesk.mjs <base-url> [options]");
  process.exit(1);
}

const baseUrl = inputUrl.replace(/\/$/, "");
const config = {
  baseUrl,
  locale: getArg("--locale", "en-us"),
  outDir: getArg("--out", "./output"),
  delay: parseInt(getArg("--delay", "200"), 10),
  combine: hasFlag("--combine"),
  noSplit: hasFlag("--no-split"),
};

const apiBase = `${baseUrl}/api/v2/help_center/${config.locale}`;
console.log("Zendesk API base:", apiBase);
console.log("Output:", config.outDir);
console.log();

// ─── Markdown converter ───────────────────────────────────────────────────────

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
td.addRule("removeJunk", {
  filter: ["script", "style", "noscript", "iframe"],
  replacement: () => "",
});

function htmlToMarkdown(html) {
  if (!html) return "";
  // Cheerio pass to clean up before turndown
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe").remove();
  const cleaned = $("body").html() || html;
  return td.turndown(cleaned).replace(/\n{3,}/g, "\n\n").trim();
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function apiGet(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

async function fetchAllPages(endpoint) {
  const items = [];
  let url = `${apiBase}/${endpoint}.json?per_page=100`;
  while (url) {
    process.stdout.write(`  GET ${url} ... `);
    const data = await apiGet(url);
    const key = Object.keys(data).find((k) => Array.isArray(data[k]) && k !== "meta");
    if (!key) break;
    items.push(...data[key]);
    console.log(`${data[key].length} items (total so far: ${items.length})`);
    url = data.next_page || null;
    if (url) await sleep(config.delay);
  }
  return items;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(config.outDir, { recursive: true });

async function run() {
  // 1. Fetch all categories and sections for context
  console.log("Fetching categories...");
  const categories = await fetchAllPages("categories");
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  console.log("\nFetching sections...");
  const sections = await fetchAllPages("sections");
  const secMap = Object.fromEntries(sections.map((s) => [s.id, { name: s.name, catId: s.category_id }]));

  // 2. Fetch all articles
  console.log("\nFetching articles...");
  const articles = await fetchAllPages("articles");
  console.log(`\nTotal articles: ${articles.length}`);

  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const art = articles[i];
    const section = secMap[art.section_id];
    const category = section ? catMap[section.catId] : "Uncategorised";
    const sectionName = section?.name || "General";

    const bodyMd = htmlToMarkdown(art.body || "");

    const frontmatter = [
      "---",
      `url: ${art.html_url}`,
      `title: "${art.title.replace(/"/g, "'")}"`,
      `category: "${category}"`,
      `section: "${sectionName}"`,
      `id: ${art.id}`,
      `updated: ${art.updated_at?.slice(0, 10) || ""}`,
      "---",
    ].join("\n");

    const fullMd = `${frontmatter}\n\n# ${art.title}\n\n${bodyMd}\n`;
    results.push({ category, section: sectionName, title: art.title, markdown: fullMd });

    if (!config.noSplit) {
      // Organise into category/section subdirectories
      const safeDir = join(
        config.outDir,
        slugify(category),
        slugify(sectionName)
      );
      mkdirSync(safeDir, { recursive: true });
      const filename = `${slugify(art.title)}.md`;
      writeFileSync(join(safeDir, filename), fullMd, "utf8");
    }

    process.stdout.write(`\r[${i + 1}/${articles.length}] ${art.title.slice(0, 60).padEnd(60)}`);
  }

  console.log();

  if (config.combine || config.noSplit) {
    // Group by category > section for a well-structured combined file
    const grouped = {};
    for (const r of results) {
      grouped[r.category] ??= {};
      grouped[r.category][r.section] ??= [];
      grouped[r.category][r.section].push(r.markdown);
    }

    const parts = [];
    for (const [cat, sections] of Object.entries(grouped)) {
      parts.push(`# ${cat}\n`);
      for (const [sec, articles] of Object.entries(sections)) {
        parts.push(`## ${sec}\n`);
        parts.push(articles.join("\n\n---\n\n"));
      }
    }

    const combined = parts.join("\n\n");
    const combinedPath = join(config.outDir, "combined.md");
    writeFileSync(combinedPath, combined, "utf8");
    const kb = (combined.length / 1024).toFixed(1);
    console.log(`\nCombined file: ${combinedPath} (${kb} KB)`);
  }

  if (!config.noSplit) {
    console.log(`Individual files saved to: ${config.outDir}/`);
  }

  console.log("Done.");
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

run().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
