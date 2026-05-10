import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

// GET /api/kosterina-billing/orders?period_id=<id>&page=1&limit=100&search=&category=
// GET /api/kosterina-billing/orders?period_id=<id>&order_key=<key>  → returns line items for that order
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const periodId = Number(params.get("period_id"));
  if (!periodId) return NextResponse.json({ error: "period_id is required" }, { status: 400 });

  const admin = createAdminClient();

  // Line-item detail fetch
  const orderKey = params.get("order_key");
  if (orderKey) {
    const { data: order } = await admin
      .from("sb_kos_shopify_orders")
      .select("id")
      .eq("period_id", periodId)
      .eq("order_key", orderKey)
      .single();

    if (!order) return NextResponse.json({ lineItems: [] });

    const { data: lineItems, error } = await admin
      .from("sb_kos_shopify_line_items")
      .select("*")
      .eq("shopify_order_id", order.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ lineItems: lineItems ?? [] });
  }

  // Orders list
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(500, Math.max(1, Number(params.get("limit") ?? 100)));
  const offset = (page - 1) * limit;
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";

  let query = admin
    .from("sb_kos_shopify_orders")
    .select(
      "order_key, name_raw, email, fulfilled_at, total, category, " +
      "shipping_city, shipping_state, shipping_country, tags_raw",
      { count: "exact" }
    )
    .eq("period_id", periodId)
    .order("fulfilled_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`order_key.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, limit });
}
