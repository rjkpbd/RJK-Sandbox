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
  // Column headers — skip the first (label) column, keep only Money columns
  const rawCols = report.Header.Columns?.Column ?? [];
  const moneyCols = rawCols.filter((c) => c.ColType === "Money");
  const columns = moneyCols.map((c) => c.ColTitle);
  const numCols = columns.length || 1;

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
    // First element is label, rest are amounts
    const amounts = Array.from({ length: numCols }, (_, i) =>
      parseAmount(summaryData[i + 1]?.value)
    );

    rows.push({ label, amounts, isSummary: true, isHighlighted: highlighted });
  }

  return { columns, rows };
}

export function parseAccountsReceivable(
  report: QBOReport
): AccountsReceivableData {
  const asOf = report.Header.EndPeriod ?? "";
  const customers: ARCustomerRow[] = [];

  for (const row of report.Rows?.Row ?? []) {
    if (row.type !== "Section") continue;

    const section = row as QBOSectionRow;
    // Each customer is a Section; summary row has their totals by bucket
    const summaryData = section.Summary?.ColData ?? [];
    if (summaryData.length < 7) continue;

    const customer = summaryData[0]?.value ?? "";
    if (!customer || customer.toLowerCase() === "total") continue;

    customers.push({
      customer,
      current: parseAmount(summaryData[1]?.value) ?? 0,
      days1_30: parseAmount(summaryData[2]?.value) ?? 0,
      days31_60: parseAmount(summaryData[3]?.value) ?? 0,
      days61_90: parseAmount(summaryData[4]?.value) ?? 0,
      days91plus: parseAmount(summaryData[5]?.value) ?? 0,
      total: parseAmount(summaryData[6]?.value) ?? 0,
    });
  }

  // Find the overall totals row (last Section with "TOTAL" in label, or last row)
  const lastRow = report.Rows?.Row?.findLast(
    (r) =>
      r.type === "Section" &&
      (r as QBOSectionRow).Summary?.ColData?.[0]?.value
        ?.toLowerCase()
        .includes("total")
  ) as QBOSectionRow | undefined;

  const totalsData = lastRow?.Summary?.ColData ?? [];
  const totals = {
    current: parseAmount(totalsData[1]?.value) ?? 0,
    days1_30: parseAmount(totalsData[2]?.value) ?? 0,
    days31_60: parseAmount(totalsData[3]?.value) ?? 0,
    days61_90: parseAmount(totalsData[4]?.value) ?? 0,
    days91plus: parseAmount(totalsData[5]?.value) ?? 0,
    total: parseAmount(totalsData[6]?.value) ?? 0,
  };

  return { asOf, customers, totals };
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