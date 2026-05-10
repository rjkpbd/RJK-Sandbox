/**
 * Missive Email Downloader
 *
 * Downloads all emails sent to orders@kosterina.com from UNFI addresses
 * since 2025-01-01. Outputs JSON (full data including HTML body) and
 * CSV (summary) to ./output/. Attachment files saved to ./output/attachments/.
 *
 * Usage:
 *   node download.mjs                         # full run (body + attachments)
 *   node download.mjs --no-body               # skip HTML body fetch
 *   node download.mjs --no-attachments        # skip attachment file downloads
 *   node download.mjs --no-body --no-attachments  # metadata only (fastest)
 *
 * Re-runs are safe: already-downloaded attachment files are skipped.
 *
 * Requires .env file with:
 *   MISSIVE_API_KEY=missive_pat-...
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Config ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no external dep needed)
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key) process.env[key] = val;
  }
}

const API_KEY = process.env.MISSIVE_API_KEY;
if (!API_KEY) {
  console.error('Missing MISSIVE_API_KEY. Add it to .env or set the environment variable.');
  process.exit(1);
}

const FETCH_BODY = !process.argv.includes('--no-body');
const DOWNLOAD_ATTACHMENTS = !process.argv.includes('--no-attachments');

const BASE_URL = 'https://public.missiveapp.com/v1';
const SINCE_DATE = new Date('2025-01-01T00:00:00Z');
const SINCE_TS = Math.floor(SINCE_DATE.getTime() / 1000); // Unix seconds

const TARGET_INBOX = 'orders@kosterina.com';

const TARGET_SENDERS = [
  'SSRSServices@unfi.com',
  'MCBReports@unfi.com',
  'Overpull@unfi.com',
  'SupplierDeductionDisputeMgmt@unfi.com',
  'ACHPAYMENTEAST@unfi.com',
  'checkpaymenteast@unfi.com',
  'checkpaymentwest@unfi.com',
  'ACHPAYMENTWEST@unfi.com',
  'UNFI_Reclaim@unfi.com',
];

const AUTH_HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiFetch(url, retries = 4) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: AUTH_HEADERS });

    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After') || '10', 10) * 1000;
      console.warn(`  Rate limited — waiting ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} on ${url}: ${body}`);
    }

    return res.json();
  }
  throw new Error(`Exceeded retries for ${url}`);
}

// ── Attachment helpers ────────────────────────────────────────────────────────

/** Strip characters that are invalid in Windows/Mac/Linux filenames. */
function sanitizeFilename(name) {
  return (name ?? 'attachment')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment';
}

/**
 * Download a file from a presigned URL to destPath.
 * Returns the local path on success, null on failure.
 * Skips download and returns the path if the file already exists.
 */
async function downloadAttachment(url, destPath, retries = 3) {
  if (existsSync(destPath)) return destPath; // already downloaded — idempotent

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url); // presigned URL — no auth header needed
      if (res.status === 403 || res.status === 410) {
        // Signed URL expired or revoked
        console.warn(`    WARN: attachment URL expired (${res.status}) — skipping`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const buf = await res.arrayBuffer();
      writeFileSync(destPath, Buffer.from(buf));
      return destPath;
    } catch (err) {
      if (attempt === retries - 1) {
        console.warn(`    WARN: failed to download attachment: ${err.message}`);
        return null;
      }
      await sleep(500 * (attempt + 1));
    }
  }
  return null;
}

// ── Pagination helpers ────────────────────────────────────────────────────────

/**
 * Fetch all conversations involving a sender address, stopping once
 * we've paged past SINCE_TS (since API returns newest-first).
 */
async function fetchConversationsForSender(senderEmail) {
  const conversations = [];
  let until = null;
  let page = 0;

  while (true) {
    page++;
    const params = new URLSearchParams({
      all: 'true',        // required mailbox filter
      email: senderEmail,
      limit: '50',
    });
    if (until !== null) params.set('until', String(until));

    const url = `${BASE_URL}/conversations?${params}`;
    console.log(`    Page ${page}...`);

    const data = await apiFetch(url);
    const batch = data.conversations ?? [];

    if (batch.length === 0) break;

    for (const conv of batch) {
      if (conv.last_activity_at >= SINCE_TS) {
        conversations.push(conv);
      }
    }

    const oldest = batch[batch.length - 1];

    // Stop conditions:
    // 1. Oldest item on this page predates our cutoff
    // 2. Fewer results than limit (last page)
    // 3. Cursor hasn't advanced (infinite-loop guard)
    if (
      oldest.last_activity_at < SINCE_TS ||
      batch.length < 50 ||
      until === oldest.last_activity_at
    ) {
      break;
    }

    until = oldest.last_activity_at;
    await sleep(200);
  }

  return conversations;
}

/**
 * Fetch all message stubs for a conversation (lightweight — no body).
 */
async function fetchMessageStubsForConversation(conversationId) {
  const messages = [];
  let until = null;

  while (true) {
    const params = new URLSearchParams({ limit: '10' });
    if (until !== null) params.set('until', String(until));

    const url = `${BASE_URL}/conversations/${conversationId}/messages?${params}`;
    const data = await apiFetch(url);
    const batch = data.messages ?? [];

    if (batch.length === 0) break;
    messages.push(...batch);
    if (batch.length < 10) break;

    const oldest = batch[batch.length - 1];
    const oldestTs = oldest.delivered_at ?? oldest.created_at;
    if (until === oldestTs) break; // infinite-loop guard
    until = oldestTs;
    await sleep(100);
  }

  return messages;
}

/**
 * Fetch full message data (including HTML body) for a single message ID.
 * Returns the enriched message object or null on error.
 */
async function fetchFullMessage(messageId) {
  const url = `${BASE_URL}/messages/${messageId}`;
  const data = await apiFetch(url);
  // API returns { messages: <single-object> }
  return data.messages ?? null;
}

// ── Filtering ─────────────────────────────────────────────────────────────────

function isTargetMessage(msg, senderEmail) {
  // Must be delivered at or after our cutoff
  const ts = msg.delivered_at ?? msg.created_at;
  if (!ts || ts < SINCE_TS) return false;

  // Sender must match (case-insensitive)
  const fromAddr = (msg.from_field?.address ?? '').toLowerCase();
  if (fromAddr !== senderEmail.toLowerCase()) return false;

  // orders@kosterina.com must be in To, CC, or BCC
  const allRecipients = [
    ...(msg.to_fields ?? []),
    ...(msg.cc_fields ?? []),
    ...(msg.bcc_fields ?? []),
  ];
  return allRecipients.some(
    (r) => (r.address ?? '').toLowerCase() === TARGET_INBOX.toLowerCase()
  );
}

// ── Output formatters ─────────────────────────────────────────────────────────

function buildRecord(stub, fullMsg, conv) {
  const source = fullMsg ?? stub;
  const ts = source.delivered_at ?? source.created_at;
  return {
    messageId: source.id,
    conversationId: conv.id,
    conversationSubject: conv.subject ?? conv.latest_message_subject ?? '',
    subject: source.subject ?? '',
    from: source.from_field?.address ?? '',
    fromName: source.from_field?.name ?? '',
    to: (source.to_fields ?? []).map((r) => r.address).join('; '),
    cc: (source.cc_fields ?? []).map((r) => r.address).join('; '),
    deliveredAt: ts ? new Date(ts * 1000).toISOString() : '',
    preview: source.preview ?? '',
    body: fullMsg?.body ?? '',  // only present when FETCH_BODY=true
    attachments: (source.attachments ?? []).map((a) => ({
      filename: a.filename ?? '',
      contentType: `${a.media_type ?? ''}/${a.sub_type ?? ''}`,
      size: a.size ?? 0,
      url: a.url ?? '',       // signed URL — expires after ~12h
      localPath: null,        // populated after download
    })),
    attachmentCount: (source.attachments ?? []).length,
    webUrl: conv.web_url ?? '',
  };
}

function toCSV(rows) {
  const COLS = [
    'deliveredAt',
    'from',
    'fromName',
    'subject',
    'to',
    'cc',
    'attachmentCount',
    'attachmentFiles',
    'preview',
    'messageId',
    'conversationId',
    'webUrl',
  ];

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  return [
    COLS.join(','),
    ...rows.map((r) => {
      const row = { ...r };
      // Flatten attachment filenames into a semicolon-separated string
      row.attachmentFiles = (r.attachments ?? [])
        .map((a) => a.filename)
        .filter(Boolean)
        .join('; ');
      return COLS.map((c) => escape(row[c])).join(',');
    }),
  ].join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const outputDir = join(__dirname, 'output');
  const attachmentsDir = join(outputDir, 'attachments');
  mkdirSync(outputDir, { recursive: true });
  if (DOWNLOAD_ATTACHMENTS) mkdirSync(attachmentsDir, { recursive: true });

  console.log(`Downloading emails to ${TARGET_INBOX} since ${SINCE_DATE.toDateString()}`);
  console.log(`Checking ${TARGET_SENDERS.length} sender addresses...`);
  console.log(`Full body fetch:      ${FETCH_BODY ? 'yes' : 'no (--no-body)'}`);
  console.log(`Download attachments: ${DOWNLOAD_ATTACHMENTS ? 'yes' : 'no (--no-attachments)'}\n`);

  const allRecords = [];
  const seenIds = new Set();
  const stats = {};
  let attachmentsDownloaded = 0;
  let attachmentsSkipped = 0;
  let attachmentsFailed = 0;

  for (const sender of TARGET_SENDERS) {
    const idx = TARGET_SENDERS.indexOf(sender) + 1;
    console.log(`[${idx}/${TARGET_SENDERS.length}] ${sender}`);
    stats[sender] = 0;

    let conversations;
    try {
      conversations = await fetchConversationsForSender(sender);
    } catch (err) {
      console.error(`  ERROR fetching conversations: ${err.message}`);
      continue;
    }

    console.log(`  ${conversations.length} conversation(s) found since ${SINCE_DATE.toDateString()}`);

    for (const conv of conversations) {
      let stubs;
      try {
        stubs = await fetchMessageStubsForConversation(conv.id);
      } catch (err) {
        console.error(`  ERROR fetching messages for conversation ${conv.id}: ${err.message}`);
        continue;
      }

      for (const stub of stubs) {
        if (seenIds.has(stub.id)) continue;
        if (!isTargetMessage(stub, sender)) continue;

        seenIds.add(stub.id);

        let fullMsg = null;
        if (FETCH_BODY) {
          try {
            fullMsg = await fetchFullMessage(stub.id);
            await sleep(120);
          } catch (err) {
            console.warn(`  WARN: could not fetch body for message ${stub.id}: ${err.message}`);
          }
        }

        const record = buildRecord(stub, fullMsg, conv);

        // Download attachment files immediately while signed URLs are fresh
        if (DOWNLOAD_ATTACHMENTS && record.attachments.length > 0) {
          const msgDir = join(attachmentsDir, stub.id);
          mkdirSync(msgDir, { recursive: true });

          for (const att of record.attachments) {
            if (!att.url) continue;
            const destPath = join(msgDir, sanitizeFilename(att.filename));
            const alreadyExisted = existsSync(destPath);
            const result = await downloadAttachment(att.url, destPath);
            if (result) {
              att.localPath = result;
              if (alreadyExisted) attachmentsSkipped++;
              else attachmentsDownloaded++;
            } else {
              attachmentsFailed++;
            }
            await sleep(80);
          }
        }

        allRecords.push(record);
        stats[sender]++;
      }

      await sleep(200);
    }

    console.log(`  ${stats[sender]} matching email(s) collected`);
  }

  // Sort by date ascending
  allRecords.sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt));

  // Write JSON (full data including HTML body and attachment signed URLs)
  const jsonPath = join(outputDir, 'emails.json');
  writeFileSync(jsonPath, JSON.stringify(allRecords, null, 2), 'utf8');

  // Write CSV (summary — no body)
  const csvPath = join(outputDir, 'emails.csv');
  writeFileSync(csvPath, toCSV(allRecords), 'utf8');

  // ── Summary ──
  console.log('\n═══════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total emails collected: ${allRecords.length}`);
  console.log('');
  console.log('By sender:');
  for (const [sender, count] of Object.entries(stats)) {
    console.log(`  ${String(count).padStart(4)}  ${sender}`);
  }
  console.log('');
  console.log('Output files:');
  console.log(`  ${jsonPath}  (full data)`);
  console.log(`  ${csvPath}  (summary)`);
  if (DOWNLOAD_ATTACHMENTS) {
    console.log(`  ${attachmentsDir}/  (attachment files)`);
    console.log('');
    console.log('Attachments:');
    console.log(`  Downloaded: ${attachmentsDownloaded}`);
    console.log(`  Skipped (already existed): ${attachmentsSkipped}`);
    if (attachmentsFailed > 0) {
      console.log(`  Failed: ${attachmentsFailed}  ← re-run to retry`);
    }
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
