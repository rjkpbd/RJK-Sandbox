import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

// GET /api/kosterina-billing/pacful-items?period_id=<id>&page=1&limit=100&search=&category=
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const periodId = Number(params.get("period_id"));
  if (!periodId) return NextResponse.json({ error: "period_id is required" }, { status: 400 });

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 100)));
  const offset = (page - 1) * limit;
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";

  const admin = createAdminClient();

  // Fetch Pacful line items
  let query = admin
    .from("sb_kos_pacful_line_items")
    .select(
      "id, transaction_id, reference_raw, order_key, " +
      "order_processing_fee, kitting_minutes, kitting_charge, " +
      "items_picked, item_pick_charge, addl_pick_charge, " +
      "cartons_btb, pallets_btb, carton_pull_total, pallet_pull_total, pick_item_total, " +
      "materials, freight_postage_fees, ship_prep_minutes, ship_prep_charge, " +
      "line_total, category_override",
      { count: "exact" }
    )
    .eq("period_id", periodId)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`reference_raw.ilike.%${search}%,order_key.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq("category_override", category);
  }

  const { data: items, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Determine Shopify match status for each item
  const rows = (items ?? []) as Array<{ order_key: string | null; [key: string]: unknown }>;
  const orderKeys = rows
    .map((r) => r.order_key)
    .filter(Boolean) as string[];

  const matchSet = new Set<string>();
  if (orderKeys.length > 0) {
    const { data: matches } = await admin
      .from("sb_kos_shopify_orders")
      .select("order_key")
      .eq("period_id", periodId)
      .in("order_key", orderKeys);
    for (const m of (matches ?? [])) matchSet.add(m.order_key);
  }

  const enriched = rows.map((item) => ({
    ...item,
    shopify_match: item.order_key ? matchSet.has(item.order_key as string) : false,
  }));

  return NextResponse.json({ items: enriched, total: count ?? 0, page, limit });
}
