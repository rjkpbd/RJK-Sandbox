import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { inheritCategoriesForPeriod } from "@/lib/kosterina-billing/categorize";

export const maxDuration = 60;

// Columns that contribute to line_total (charge columns, not quantity columns)
const CHARGE_COLS = [
  "order_processing_fee", "kitting_charge", "item_pick_charge",
  "addl_pick_charge", "carton_pull_total", "pallet_pull_total",
  "pick_item_total", "materials", "freight_postage_fees", "ship_prep_charge",
] as const;

// Normalized-header → field name mapping
const COL_MAP: Record<string, string> = {
  "transaction_id": "transaction_id",
  "transaction_id_#": "transaction_id",
  "reference_#": "reference_raw",
  "reference": "reference_raw",
  "order_processing_fee": "order_processing_fee",
  "kitting_minutes": "kitting_minutes",
  "kitting_charge": "kitting_charge",
  "items_picked": "items_picked",
  "item_pick_charge": "item_pick_charge",
  "addl_pick_charge": "addl_pick_charge",
  "additional_pick_charge": "addl_pick_charge",
  "cartons_btb": "cartons_btb",
  "carton_btb": "cartons_btb",
  "pallets_btb": "pallets_btb",
  "pallet_btb": "pallets_btb",
  "carton_pull_total": "carton_pull_total",
  "pallet_pull_total": "pallet_pull_total",
  "pick_item_total": "pick_item_total",
  "materials": "materials",
  "freight_postage_fees": "freight_postage_fees",
  "freight/postage_fees": "freight_postage_fees",
  "freight_postage": "freight_postage_fees",
  "ship_prep_minutes": "ship_prep_minutes",
  "ship_prep_charge": "ship_prep_charge",
};

function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function isNumericCell(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "number") return !isNaN(v);
  return /^\d+(\.\d+)?$/.test(String(v).trim());
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const period = formData.get("period") as string | null;

  if (!file || !period) {
    return NextResponse.json({ error: "file and period are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }

  const [year, month] = period.split("-").map(Number);
  const periodDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  const admin = createAdminClient();

  const { data: periodRow, error: periodError } = await admin
    .from("sb_kos_periods")
    .upsert({ period: periodDate, label }, { onConflict: "period" })
    .select("id")
    .single();
  if (periodError || !periodRow) {
    return NextResponse.json({ error: periodError?.message ?? "Failed to upsert period" }, { status: 500 });
  }
  const periodId = periodRow.id as number;

  // Parse XLSX
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (raw.length < 2) {
    return NextResponse.json({ error: "File appears empty" }, { status: 400 });
  }

  // Build column-index map from header row
  const headerRow = raw[0] as unknown[];
  const colIdx: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const norm = normHeader(h);
    const field = COL_MAP[norm];
    if (field && !(field in colIdx)) colIdx[field] = i;
  });

  // Find line items end: first data row where col 0 is non-numeric
  let lineItemEnd = 1;
  for (let r = 1; r < raw.length; r++) {
    if (!isNumericCell(raw[r][0])) {
      lineItemEnd = r;
      break;
    }
    lineItemEnd = r + 1;
  }

  // Parse line items
  const lineItems: Record<string, unknown>[] = [];
  for (let r = 1; r < lineItemEnd; r++) {
    const row = raw[r];
    const refRaw = row[colIdx["reference_raw"] ?? -1];
    const refStr = String(refRaw ?? "").trim();
    const orderKey = refStr.startsWith("#") ? refStr.slice(1) : refStr;

    const item: Record<string, unknown> = {
      period_id: periodId,
      transaction_id: String(row[colIdx["transaction_id"] ?? -1] ?? "").trim() || null,
      reference_raw: refStr || null,
      order_key: orderKey || null,
      order_processing_fee: numOrNull(row[colIdx["order_processing_fee"] ?? -1]),
      kitting_minutes: numOrNull(row[colIdx["kitting_minutes"] ?? -1]),
      kitting_charge: numOrNull(row[colIdx["kitting_charge"] ?? -1]),
      items_picked: numOrNull(row[colIdx["items_picked"] ?? -1]),
      item_pick_charge: numOrNull(row[colIdx["item_pick_charge"] ?? -1]),
      addl_pick_charge: numOrNull(row[colIdx["addl_pick_charge"] ?? -1]),
      cartons_btb: numOrNull(row[colIdx["cartons_btb"] ?? -1]),
      pallets_btb: numOrNull(row[colIdx["pallets_btb"] ?? -1]),
      carton_pull_total: numOrNull(row[colIdx["carton_pull_total"] ?? -1]),
      pallet_pull_total: numOrNull(row[colIdx["pallet_pull_total"] ?? -1]),
      pick_item_total: numOrNull(row[colIdx["pick_item_total"] ?? -1]),
      materials: numOrNull(row[colIdx["materials"] ?? -1]),
      freight_postage_fees: numOrNull(row[colIdx["freight_postage_fees"] ?? -1]),
      ship_prep_minutes: numOrNull(row[colIdx["ship_prep_minutes"] ?? -1]),
      ship_prep_charge: numOrNull(row[colIdx["ship_prep_charge"] ?? -1]),
    };

    // Compute line_total
    item.line_total = CHARGE_COLS.reduce((sum, col) => {
      const v = item[col];
      return sum + (typeof v === "number" ? v : 0);
    }, 0);

    lineItems.push(item);
  }

  // Find billing summary block marker
  let summaryStartRow = -1;
  for (let r = lineItemEnd; r < raw.length; r++) {
    const cell = String(raw[r][0] ?? "").trim();
    if (cell.toLowerCase().includes("kosterina billing summary") ||
        cell.toLowerCase().includes("billing summary")) {
      summaryStartRow = r + 1; // rows after the marker
      break;
    }
  }

  const summaryItems: Record<string, unknown>[] = [];
  if (summaryStartRow > -1) {
    let sortOrder = 0;
    for (let r = summaryStartRow; r < raw.length; r++) {
      const row = raw[r];
      const label = String(row[0] ?? "").trim();
      if (!label) continue;
      summaryItems.push({
        period_id: periodId,
        label,
        quantity: numOrNull(row[3]),
        amount: numOrNull(row[4]),
        notes: String(row[6] ?? "").trim() || null,
        sort_order: sortOrder++,
      });
    }
  }

  // Delete existing rows for this period, then insert fresh
  await admin.from("sb_kos_pacful_line_items").delete().eq("period_id", periodId);
  await admin.from("sb_kos_pacful_billing_summary").delete().eq("period_id", periodId);

  for (let i = 0; i < lineItems.length; i += 500) {
    const { error } = await admin
      .from("sb_kos_pacful_line_items")
      .insert(lineItems.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (let i = 0; i < summaryItems.length; i += 200) {
    const { error } = await admin
      .from("sb_kos_pacful_billing_summary")
      .insert(summaryItems.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Inherit categories from Shopify
  await inheritCategoriesForPeriod(periodId, "sb_kos_pacful_line_items");

  return NextResponse.json({
    success: true,
    lineItemsIngested: lineItems.length,
    summaryRowsIngested: summaryItems.length,
    periodId,
  });
}
