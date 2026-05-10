import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

// GET /api/kosterina-billing/wwex-shipments?period_id=<id>&page=1&limit=100&search=&lob=&category=
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const admin = createAdminClient();

  // Single-shipment detail for the drawer (includes charge lines)
  const id = params.get("id");
  if (id) {
    const { data, error } = await admin
      .from("sb_kos_wwex_shipments")
      .select("*, sb_kos_wwex_charge_lines(charge_idx, charge_type, charge_amount)")
      .eq("id", Number(id))
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shipment: data });
  }

  const periodId = Number(params.get("period_id"));
  if (!periodId) return NextResponse.json({ error: "period_id is required" }, { status: 400 });

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 100)));
  const offset = (page - 1) * limit;
  const search = params.get("search") ?? "";
  const lob = params.get("lob") ?? "";
  const category = params.get("category") ?? "";

  let query = admin
    .from("sb_kos_wwex_shipments")
    .select(
      "id, order_key, ship_date, line_of_business, scac, charge_total, category_override, billing_reference_1_raw",
      { count: "exact" }
    )
    .eq("period_id", periodId)
    .order("ship_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(
      `order_key.ilike.%${search}%,billing_reference_1_raw.ilike.%${search}%,scac.ilike.%${search}%`
    );
  }
  if (lob) query = query.eq("line_of_business", lob);
  if (category) query = query.eq("category_override", category);

  const { data: shipments, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shopify match status
  const orderKeys = (shipments ?? [])
    .map((r: { order_key: string | null }) => r.order_key)
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

  const enriched = (shipments ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    shopify_match: s.order_key ? matchSet.has(s.order_key as string) : false,
  }));

  return NextResponse.json({ shipments: enriched, total: count ?? 0, page, limit });
}
