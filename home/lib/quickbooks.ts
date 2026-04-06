const QBO_BASE_URL =
  process.env.QUICKBOOKS_SANDBOX === "true"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";

const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_REVOKE_URL =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.QUICKBOOKS_CLIENT_ID!,
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    response_type: "code",
    state,
  });
  return `${QBO_AUTH_URL}?${params}`;
}

function basicAuthHeader(): string {
  return Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString("base64");
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}> {
  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}> {
  const response = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(QBO_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ token }),
  });
}

export async function fetchQBOReport(
  realmId: string,
  accessToken: string,
  reportType: string,
  params: Record<string, string> = {}
): Promise<QBOReport> {
  const url = new URL(
    `${QBO_BASE_URL}/v3/company/${realmId}/reports/${reportType}`
  );
  url.searchParams.set("minorversion", "65");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    // Disable caching so we always get fresh data
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new QBOAuthError("Access token invalid or expired");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`QBO API error (${response.status}): ${body}`);
  }

  return response.json();
}

export class QBOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QBOAuthError";
  }
}

// ─── QBO report types ────────────────────────────────────────────────────────

export interface QBOColValue {
  value: string;
  id?: string;
}

export interface QBODataRow {
  type: "Data";
  ColData: QBOColValue[];
}

export interface QBOSectionRow {
  type: "Section";
  group?: string;
  Header?: { ColData: QBOColValue[] };
  Rows?: { Row: QBORow[] };
  Summary?: { ColData: QBOColValue[] };
}

export type QBORow = QBODataRow | QBOSectionRow;

export interface QBOReport {
  Header: {
    ReportName: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Currency?: string;
    Columns?: {
      Column: { ColTitle: string; ColType: string }[];
    };
  };
  Rows: {
    Row: QBORow[];
  };
}

// ─── Parsed report shapes ─────────────────────────────────────────────────────

export interface ProfitAndLossRow {
  label: string;
  amounts: (number | null)[];
  isSummary?: boolean;
  isHighlighted?: boolean;
}

export interface ProfitAndLossData {
  columns: string[]; // month labels
  rows: ProfitAndLossRow[];
}

export interface ARCustomerRow {
  customer: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days91plus: number;
  total: number;
}

export interface AccountsReceivableData {
  asOf: string;
  customers: ARCustomerRow[];
  totals: Omit<ARCustomerRow, "customer">;
}

export type ARBucket = "current" | "days1_30" | "days31_60" | "days61_90" | "days91plus";

export interface ARDetailTransaction {
  type: string;       // e.g. "Invoice"
  date: string;
  num: string;
  dueDate: string;
  aging: number;      // days past due (0 = current, positive = overdue)
  openBalance: number;
  bucket: ARBucket;
}

export interface ARDetailData {
  asOf: string;
  byCustomer: Record<string, ARDetailTransaction[]>;
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseAmount(value: string | undefined): number | null {
  if (!value || value === "") return null;
  const n = parseFloat(value.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

const SECTION_ORDER: { group: string; label: string; highlighted?: boolean }[] =
  [
    { group: "Income", label: "Total Revenue" },
    { group: "COGS", label: "Cost of Goods Sold" },
    { group: "GrossProfit", label: "Gross Profit", highlighted: true },
    { group: "Expenses", label: "Total Expenses" },
    { group: "NetIncome", label: "Net Income", highlighted: true },
  ];

export function parseProfitAndLoss(report: QBOReport): ProfitAndLossData {
  // Column headers — skip Account column, keep Money columns.
  // QBO adds a "Total" or "TOTAL" column at the end when summarizing by Month;
  // we strip it so we only show per-month columns.
  const rawCols = report.Header.Columns?.Column ?? [];
  const moneyCols = rawCols.filter((c) => c.ColType === "Money");
  const TOTAL_TITLES = new Set(["total", "totals"]);
  const monthCols = moneyCols.filter(
    (c) => !TOTAL_TITLES.has(c.ColTitle.trim().toLowerCase())
  );
  // Fall back to all money cols if filtering removed everything
  const activeCols = monthCols.length > 0 ? monthCols : moneyCols;
  const columns = activeCols.map((c) => c.ColTitle);

  // Map each active column to its index within all money cols (1-based in ColData)
  const moneyColIndices = activeCols.map((col) => moneyCols.indexOf(col) + 1);
  const numCols = Math.max(columns.length, 1);

  const rows: ProfitAndLossRow[] = [];
  const sectionMap = new Map<string, QBOSectionRow>();

  for (const row of report.Rows?.Row ?? []) {
    if (row.type === "Section" && row.group) {
      sectionMap.set(row.group, row);
    }
  }

  for (const { group, label, highlighted } of SECTION_ORDER) {
    const section = sectionMap.get(group);
    if (!section) continue;

    const summaryData = section.Summary?.ColData ?? [];
    const amounts =
      moneyColIndices.length > 0
        ? moneyColIndices.map((idx) => parseAmount(summaryData[idx]?.value))
        : Array.from({ length: numCols }, (_, i) =>
            parseAmount(summaryData[i + 1]?.value)
          );

    rows.push({ label, amounts, isSummary: true, isHighlighted: highlighted });
  }

  return { columns, rows };
}

// AgedReceivableSummary — one Data row per customer, columns:
// [0] Customer  [1] Current  [2] 1-30  [3] 31-60  [4] 61-90  [5] >90  [6] TOTAL
export function parseAccountsReceivable(
  report: QBOReport
): AccountsReceivableData {
  const asOf = report.Header.EndPeriod ?? "";
  const customers: ARCustomerRow[] = [];
  let totals: AccountsReceivableData["totals"] = {
    current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days91plus: 0, total: 0,
  };

  for (const row of report.Rows?.Row ?? []) {
    if (row.type === "Data") {
      const cols = (row as QBODataRow).ColData;
      const customer = cols[0]?.value ?? "";
      if (!customer) continue;
      customers.push({
        customer,
        current:    parseAmount(cols[1]?.value) ?? 0,
        days1_30:   parseAmount(cols[2]?.value) ?? 0,
        days31_60:  parseAmount(cols[3]?.value) ?? 0,
        days61_90:  parseAmount(cols[4]?.value) ?? 0,
        days91plus: parseAmount(cols[5]?.value) ?? 0,
        total:      parseAmount(cols[6]?.value) ?? 0,
      });
    } else if (row.type === "Section") {
      // GrandTotal section — summary holds the footer row
      const cols = (row as QBOSectionRow).Summary?.ColData ?? [];
      if (cols.length >= 7) {
        totals = {
          current:    parseAmount(cols[1]?.value) ?? 0,
          days1_30:   parseAmount(cols[2]?.value) ?? 0,
          days31_60:  parseAmount(cols[3]?.value) ?? 0,
          days61_90:  parseAmount(cols[4]?.value) ?? 0,
          days91plus: parseAmount(cols[5]?.value) ?? 0,
          total:      parseAmount(cols[6]?.value) ?? 0,
        };
      }
    }
  }

  // If QBO didn't include a grand-total section, sum from customer rows
  if (totals.total === 0 && customers.length > 0) {
    for (const c of customers) {
      totals.current    += c.current;
      totals.days1_30   += c.days1_30;
      totals.days31_60  += c.days31_60;
      totals.days61_90  += c.days61_90;
      totals.days91plus += c.days91plus;
      totals.total      += c.total;
    }
  }

  return { asOf, customers, totals };
}

function agingToBucket(days: number): ARBucket {
  if (days <= 0)  return "current";
  if (days <= 30) return "days1_30";
  if (days <= 60) return "days31_60";
  if (days <= 90) return "days61_90";
  return "days91plus";
}

// AgedReceivableDetail — sections per customer, Data rows per transaction.
// Columns: [0] Type  [1] Date  [2] Num  [3] Due Date  [4] Aging  [5] Amount  [6] Open Balance
export function parseARDetail(report: QBOReport): ARDetailData {
  const asOf = report.Header.EndPeriod ?? "";
  const byCustomer: Record<string, ARDetailTransaction[]> = {};

  for (const row of report.Rows?.Row ?? []) {
    if (row.type !== "Section") continue;
    const section = row as QBOSectionRow;
    const customer = section.Header?.ColData?.[0]?.value ?? "";
    if (!customer) continue;

    const txns: ARDetailTransaction[] = [];
    for (const txnRow of section.Rows?.Row ?? []) {
      if (txnRow.type !== "Data") continue;
      const cols = (txnRow as QBODataRow).ColData;
      const agingDays = parseInt(cols[4]?.value ?? "0", 10);
      const openBalance = parseAmount(cols[6]?.value) ?? 0;
      if (openBalance === 0) continue; // skip fully paid
      txns.push({
        type:        cols[0]?.value ?? "",
        date:        cols[1]?.value ?? "",
        num:         cols[2]?.value ?? "",
        dueDate:     cols[3]?.value ?? "",
        aging:       isNaN(agingDays) ? 0 : agingDays,
        openBalance,
        bucket:      agingToBucket(isNaN(agingDays) ? 0 : agingDays),
      });
    }
    if (txns.length > 0) byCustomer[customer] = txns;
  }

  return { asOf, byCustomer };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns start/end covering the last N complete calendar months. */
export function lastNMonthsRange(n: number): {
  start_date: string;
  end_date: string;
} {
  const now = new Date();
  // End = last day of previous month
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  // Start = first day of (n-1) months before `end`
  const start = new Date(end.getFullYear(), end.getMonth() - (n - 1), 1);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start_date: fmt(start), end_date: fmt(end) };
}