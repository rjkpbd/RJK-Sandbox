import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { fetchAll } from "@/lib/kosterina-billing/db";

// GET /api/kosterina-billing/reconciliation?period_id=<id>
// Returns all three reconciliation reports for a period.
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number(request.nextUrl.searchParams.get("period_id"));
  if (!periodId) return NextResponse.json({ error: "period_id is required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch all three datasets in parallel, paginating past the 1000-row default limit
  const [shopifyRows, pacfulKeyRows, wwexRows] = await Promise.all([
    fetchAll<{ order_key: string; fulfilled_at: string | null; total: number | null; category: string | null; shipping_city: string | null; shipping_state: string | null; shipping_country: string | null }>(
      (from, to) => admin
        .from("sb_kos_shopify_orders")
        .select("order_key, fulfilled_at, total, category, shipping_city, shipping_state, shipping_country")
        .eq("period_id", periodId)
        .range(from, to)
    ),
    fetchAll<{ order_key: string }>(
      (from, to) => admin
        .from("sb_kos_pacful_line_items")
        .select("order_key")
        .eq("period_id", periodId)
        .not("order_key", "is", null)
        .range(from, to)
    ),
    fetchAll<{ id: number; order_key: string | null; ship_date: string | null; line_of_business: string | null; charge_total: number | null; scac: string | null; category_override: string | null; billing_reference_1_raw: string | null }>(
      (from, to) => admin
        .from("sb_kos_wwex_shipments")
        .select("id, order_key, ship_date, line_of_business, charge_total, scac, category_override, billing_reference_1_raw")
        .eq("period_id", periodId)
        .range(from, to)
    ),
  ]);

  const pacfulKeySet = new Set(pacfulKeyRows.map(r => r.order_key));
  const shopifyKeySet = new Set(shopifyRows.map(r => r.order_key));

  // 1. Shopify orders missing from Pacful
  const shopifyMissingFromPacful = shopifyRows.filter(r => !pacfulKeySet.has(r.order_key));

  // 2. WWEX rows missing from Pacful (non-LTL only, order_key must be non-null)
  const wwexMissingFromPacful = wwexRows.filter(
    r => r.order_key !== null &&
      r.line_of_business?.toUpperCase() !== "LTL" &&
      !pacfulKeySet.has(r.order_key!)
  );

  // 3. Pacful + WWEX rows needing category (have order_key, no category_override, not in Shopify)
  const [pacfulNeedRows, wwexNeedRows] = await Promise.all([
    fetchAll<{ id: number; order_key: string; reference_raw: string | null; line_total: number | null; category_override: string | null }>(
      (from, to) => admin
        .from("sb_kos_pacful_line_items")
        .select("id, order_key, reference_raw, line_total, category_override")
        .eq("period_id", periodId)
        .is("category_override", null)
        .not("order_key", "is", null)
        .range(from, to)
    ),
    fetchAll<{ id: number; order_key: string; billing_reference_1_raw: string | null; charge_total: number | null; category_override: string | null; line_of_business: string | null }>(
      (from, to) => admin
        .from("sb_kos_wwex_shipments")
        .select("id, order_key, billing_reference_1_raw, charge_total, category_override, line_of_business")
        .eq("period_id", periodId)
        .is("category_override", null)
        .not("order_key", "is", null)
        .range(from, to)
    ),
  ]);

  const pacfulNeedingCategory = pacfulNeedRows
    .filter(r => !shopifyKeySet.has(r.order_key))
    .map(r => ({ ...r, source: "pacful" as const }));

  const wwexNeedingCategory = wwexNeedRows
    .filter(r => !shopifyKeySet.has(r.order_key))
    .map(r => ({ ...r, source: "wwex" as const }));

  return NextResponse.json({
    shopifyMissingFromPacful,
    wwexMissingFromPacful,
    needingCategory: [...pacfulNeedingCategory, ...wwexNeedingCategory],
  });
}
