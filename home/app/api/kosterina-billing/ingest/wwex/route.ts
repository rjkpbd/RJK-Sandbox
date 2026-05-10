import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { inheritCategoriesForPeriod } from "@/lib/kosterina-billing/categorize";

export const maxDuration = 60;

// Normalized header → field name
const COL_MAP: Record<string, string> = {
  "customer_#": "customer_num",
  "customer_no": "customer_num",
  "customer_num": "customer_num",
  "invoice_#": "invoice_num",
  "invoice_no": "invoice_num",
  "invoice_num": "invoice_num",
  "line_of_business": "line_of_business",
  "lob": "line_of_business",
  "airbill_#": "airbill_num",
  "airbill_no": "airbill_num",
  "airbill_num": "airbill_num",
  "tracking_#": "airbill_num",
  "ship_date": "ship_date",
  "ship_dt": "ship_date",
  "pro_#": "pro_num",
  "pro_no": "pro_num",
  "pro_num": "pro_num",
  "bol_#": "bol_num",
  "bol_no": "bol_num",
  "bol_num": "bol_num",
  "scac": "scac",
  "carrier_code": "scac",
  "bill_type": "bill_type",
  "billing_type": "bill_type",
  "shipper_s_name": "shippers_name",
  "shippers_name": "shippers_name",
  "shipper_name": "shippers_name",
  "shipper_s_city": "shippers_city",
  "shippers_city": "shippers_city",
  "shipper_city": "shippers_city",
  "shipper_s_state": "shippers_state",
  "shippers_state": "shippers_state",
  "shipper_state": "shippers_state",
  "shipper_s_zip": "shippers_zip",
  "shippers_zip": "shippers_zip",
  "shipper_zip": "shippers_zip",
  "receiver_name": "receiver_name",
  "consignee_name": "receiver_name",
  "receiver_city": "receiver_city",
  "consignee_city": "receiver_city",
  "receiver_state": "receiver_state",
  "consignee_state": "receiver_state",
  "receiver_zip": "receiver_zip",
  "consignee_zip": "receiver_zip",
  "pieces": "pieces",
  "pcs": "pieces",
  "original_weight": "original_weight",
  "orig_weight": "original_weight",
  "billed_weight": "charged_weight",
  "charged_weight": "charged_weight",
  "charge_total": "charge_total",
  "total_charges": "charge_total",
  "total_charge": "charge_total",
  "invoice_date": "invoice_date",
  "invoice_dt": "invoice_date",
  "billing_reference_1": "billing_reference_1_raw",
  "billing_reference_#_1": "billing_reference_1_raw",
  "billing_ref_1": "billing_reference_1_raw",
  "reference_1": "billing_reference_1_raw",
  "vendor_reference_1": "vendor_reference_1",
  "vend_ref_1": "vendor_reference_1",
  "service_level": "service_level",
  "service": "service_level",
  "zone": "zone",
};

function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}

function dateColOrNull(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function strOrNull(v: unknown): string | null {
  if (v instanceof Date) return null;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
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

  // Parse XLSX - use "Page 1" sheet only; ignore "Dynamic" sheet
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const targetSheet = workbook.SheetNames.find(n => /page.?1/i.test(n));
  if (!targetSheet) {
    // File might be empty (FTL with no data) — treat as no-op
    return NextResponse.json({ success: true, rowsIngested: 0, periodId, note: "No Page 1 sheet found" });
  }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(
    workbook.Sheets[targetSheet],
    { header: 1, defval: null }
  );

  if (raw.length < 2) {
    return NextResponse.json({ success: true, rowsIngested: 0, periodId, note: "Sheet is empty" });
  }

  // Build column index map
  const headerRow = raw[0] as unknown[];
  const colIdx: Record<string, number> = {};
  const chargeTypeCols: number[] = [];
  const chargeAmountCols: number[] = [];

  headerRow.forEach((h, i) => {
    const norm = normHeader(h);
    // Named field mapping
    const field = COL_MAP[norm];
    if (field && !(field in colIdx)) colIdx[field] = i;

    // Charge type/amount pair detection
    if (/charge[_ ]?type[_ ]?\d+/.test(norm) || /chrg[_ ]?type[_ ]?\d+/.test(norm)) {
      chargeTypeCols.push(i);
    }
    if (/charge[_ ]?amount[_ ]?\d+/.test(norm) || /chrg[_ ]?amt[_ ]?\d+/.test(norm)) {
      chargeAmountCols.push(i);
    }
  });

  chargeTypeCols.sort((a, b) => a - b);
  chargeAmountCols.sort((a, b) => a - b);

  // Parse shipment rows (skip header row 0)
  const shipmentRecords: Record<string, unknown>[] = [];
  const chargeLinesBatch: Record<string, unknown>[] = []; // collected after insert to get IDs

  // Determine line-of-business values in this file for idempotency
  const lobsInFile = new Set<string>();
  for (let r = 1; r < raw.length; r++) {
    const lob = strOrNull(raw[r][colIdx["line_of_business"] ?? -1]);
    if (lob) lobsInFile.add(lob);
  }

  // Delete existing rows for this period + lob combination
  if (lobsInFile.size > 0) {
    await admin
      .from("sb_kos_wwex_shipments")
      .delete()
      .eq("period_id", periodId)
      .in("line_of_business", [...lobsInFile]);
  }

  // Build shipment records with their charge line data
  const shipmentsWithCharges: Array<{
    shipment: Record<string, unknown>;
    charges: Array<{ charge_idx: number; charge_type: string | null; charge_amount: number | null }>;
  }> = [];

  for (let r = 1; r < raw.length; r++) {
    const row = raw[r];
    const billingRef1Raw = strOrNull(row[colIdx["billing_reference_1_raw"] ?? -1]);
    const orderKey = billingRef1Raw ? billingRef1Raw.replace(/^#/, "") || null : null;
    const lob = strOrNull(row[colIdx["line_of_business"] ?? -1]) ?? "";
    const isLtl = lob.toUpperCase() === "LTL";

    const shipment: Record<string, unknown> = {
      period_id: periodId,
      customer_num: strOrNull(row[colIdx["customer_num"] ?? -1]),
      invoice_num: strOrNull(row[colIdx["invoice_num"] ?? -1]),
      line_of_business: lob || null,
      airbill_num: strOrNull(row[colIdx["airbill_num"] ?? -1]),
      ship_date: dateColOrNull(row[colIdx["ship_date"] ?? -1]),
      pro_num: strOrNull(row[colIdx["pro_num"] ?? -1]),
      bol_num: strOrNull(row[colIdx["bol_num"] ?? -1]),
      scac: strOrNull(row[colIdx["scac"] ?? -1]),
      bill_type: strOrNull(row[colIdx["bill_type"] ?? -1]),
      shippers_name: strOrNull(row[colIdx["shippers_name"] ?? -1]),
      shippers_city: strOrNull(row[colIdx["shippers_city"] ?? -1]),
      shippers_state: strOrNull(row[colIdx["shippers_state"] ?? -1]),
      shippers_zip: strOrNull(row[colIdx["shippers_zip"] ?? -1]),
      receiver_name: strOrNull(row[colIdx["receiver_name"] ?? -1]),
      receiver_city: strOrNull(row[colIdx["receiver_city"] ?? -1]),
      receiver_state: strOrNull(row[colIdx["receiver_state"] ?? -1]),
      receiver_zip: strOrNull(row[colIdx["receiver_zip"] ?? -1]),
      pieces: numOrNull(row[colIdx["pieces"] ?? -1]),
      original_weight: numOrNull(row[colIdx["original_weight"] ?? -1]),
      charged_weight: numOrNull(row[colIdx["charged_weight"] ?? -1]),
      charge_total: numOrNull(row[colIdx["charge_total"] ?? -1]),
      invoice_date: dateColOrNull(row[colIdx["invoice_date"] ?? -1]),
      billing_reference_1_raw: billingRef1Raw,
      order_key: isLtl ? null : (orderKey || null),
      vendor_reference_1: strOrNull(row[colIdx["vendor_reference_1"] ?? -1]),
      service_level: strOrNull(row[colIdx["service_level"] ?? -1]),
      zone: strOrNull(row[colIdx["zone"] ?? -1]),
      // LTL rows auto-categorized as Inbound Freight
      category_override: isLtl ? "Inbound Freight" : null,
    };

    // Collect charge pairs
    const charges: Array<{ charge_idx: number; charge_type: string | null; charge_amount: number | null }> = [];
    const pairCount = Math.min(chargeTypeCols.length, chargeAmountCols.length);
    for (let ci = 0; ci < pairCount; ci++) {
      const ct = strOrNull(row[chargeTypeCols[ci]]);
      const ca = numOrNull(row[chargeAmountCols[ci]]);
      if (ct || ca !== null) {
        charges.push({ charge_idx: ci, charge_type: ct, charge_amount: ca });
      }
    }

    shipmentsWithCharges.push({ shipment, charges });
    shipmentRecords.push(shipment);
  }

  if (shipmentRecords.length === 0) {
    return NextResponse.json({ success: true, rowsIngested: 0, periodId });
  }

  // Insert shipments in batches and collect IDs
  let insertedIds: number[] = [];
  for (let i = 0; i < shipmentRecords.length; i += 200) {
    const { data, error } = await admin
      .from("sb_kos_wwex_shipments")
      .insert(shipmentRecords.slice(i, i + 200))
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    insertedIds = insertedIds.concat((data ?? []).map((r: { id: number }) => r.id));
  }

  // Insert charge lines
  const allChargeLines: Record<string, unknown>[] = [];
  shipmentsWithCharges.forEach(({ charges }, idx) => {
    const shipmentId = insertedIds[idx];
    if (!shipmentId) return;
    for (const c of charges) {
      allChargeLines.push({
        wwex_shipment_id: shipmentId,
        charge_idx: c.charge_idx,
        charge_type: c.charge_type,
        charge_amount: c.charge_amount,
      });
    }
  });

  for (let i = 0; i < allChargeLines.length; i += 500) {
    const { error } = await admin
      .from("sb_kos_wwex_charge_lines")
      .insert(allChargeLines.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Inherit categories from Shopify (skips LTL rows which already have Inbound Freight)
  await inheritCategoriesForPeriod(periodId, "sb_kos_wwex_shipments");

  return NextResponse.json({
    success: true,
    rowsIngested: shipmentRecords.length,
    chargeLinesIngested: allChargeLines.length,
    periodId,
  });
}
