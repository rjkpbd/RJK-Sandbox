import * as XLSX from "xlsx";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { deriveCategoriesForPeriod } from "@/lib/kosterina-billing/categorize";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const period = formData.get("period") as string | null; // "YYYY-MM"

  if (!file || !period) {
    return NextResponse.json({ error: "file and period are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }

  const [year, month] = period.split("-").map(Number);
  const periodDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const admin = createAdminClient();

  // Upsert period
  const { data: periodRow, error: periodError } = await admin
    .from("sb_kos_periods")
    .upsert({ period: periodDate, label }, { onConflict: "period" })
    .select("id")
    .single();
  if (periodError || !periodRow) {
    return NextResponse.json({ error: periodError?.message ?? "Failed to upsert period" }, { status: 500 });
  }
  const periodId = periodRow.id as number;

  // Parse CSV with SheetJS
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  // Filter to fulfilled rows only
  const fulfilled = rows.filter(r => {
    const v = r["Fulfilled at"];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });

  // Group by order key (one row per order; CSV has one row per line item)
  const orderMap = new Map<
    string,
    { firstRow: Record<string, unknown>; lineItems: Record<string, unknown>[] }
  >();
  for (const row of fulfilled) {
    const name = String(row["Name"] ?? "").trim();
    if (!name) continue;
    const orderKey = name.replace(/^#/, "");
    if (!orderMap.has(orderKey)) {
      orderMap.set(orderKey, { firstRow: row, lineItems: [] });
    }
    orderMap.get(orderKey)!.lineItems.push(row);
  }

  if (orderMap.size === 0) {
    return NextResponse.json({ success: true, ordersIngested: 0, lineItemsIngested: 0, periodId });
  }

  // Upsert orders (update all cols on conflict except ingested_at which keeps original)
  const orderRecords = [...orderMap.entries()].map(([orderKey, { firstRow: r }]) => ({
    period_id: periodId,
    order_key: orderKey,
    name_raw: String(r["Name"] ?? ""),
    email: strOrNull(r["Email"]),
    fulfilled_at: dateOrNull(r["Fulfilled at"]),
    created_at_shopify: dateOrNull(r["Created at"]),
    subtotal: numOrNull(r["Subtotal"]),
    shipping: numOrNull(r["Shipping"]),
    total: numOrNull(r["Total"]),
    discount_code: strOrNull(r["Discount Code"]),
    discount_amount: numOrNull(r["Discount Amount"]),
    shipping_method: strOrNull(r["Shipping Method"]),
    shipping_city: strOrNull(r["Shipping City"]),
    shipping_state: strOrNull(r["Shipping Province"]),
    shipping_zip: strOrNull(r["Shipping Zip"]),
    shipping_country: strOrNull(r["Shipping Country"]),
    tags_raw: strOrNull(r["Tags"]),
    source: strOrNull(r["Source"]),
    vendor: strOrNull(r["Vendor"]),
  }));

  for (let i = 0; i < orderRecords.length; i += 500) {
    const { error } = await admin
      .from("sb_kos_shopify_orders")
      .upsert(orderRecords.slice(i, i + 500), { onConflict: "period_id,order_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch inserted order IDs
  const { data: insertedOrders } = await admin
    .from("sb_kos_shopify_orders")
    .select("id, order_key")
    .eq("period_id", periodId);

  const orderIdMap = new Map<string, number>();
  for (const o of (insertedOrders ?? [])) orderIdMap.set(o.order_key, o.id);

  // Delete existing line items for this period's orders, then re-insert
  const orderIds = [...orderIdMap.values()];
  if (orderIds.length > 0) {
    await admin.from("sb_kos_shopify_line_items").delete().in("shopify_order_id", orderIds);
  }

  const lineItemRecords: Record<string, unknown>[] = [];
  for (const [orderKey, { lineItems }] of orderMap.entries()) {
    const shopifyOrderId = orderIdMap.get(orderKey);
    if (!shopifyOrderId) continue;
    for (const li of lineItems) {
      lineItemRecords.push({
        shopify_order_id: shopifyOrderId,
        lineitem_sku: strOrNull(li["Lineitem sku"]),
        lineitem_name: strOrNull(li["Lineitem name"]),
        lineitem_quantity: intOrNull(li["Lineitem quantity"]),
        lineitem_price: numOrNull(li["Lineitem price"]),
      });
    }
  }

  for (let i = 0; i < lineItemRecords.length; i += 500) {
    const { error } = await admin
      .from("sb_kos_shopify_line_items")
      .insert(lineItemRecords.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Derive categories for the period
  await deriveCategoriesForPeriod(periodId);

  return NextResponse.json({
    success: true,
    ordersIngested: orderMap.size,
    lineItemsIngested: lineItemRecords.length,
    periodId,
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function strOrNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

function dateOrNull(v: unknown): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
