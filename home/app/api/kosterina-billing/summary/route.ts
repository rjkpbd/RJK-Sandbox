import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { fetchAll } from "@/lib/kosterina-billing/db";

// GET /api/kosterina-billing/summary?period_id=<id>
export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodId = Number(request.nextUrl.searchParams.get("period_id"));
  if (!periodId) return NextResponse.json({ error: "period_id is required" }, { status: 400 });

  const admin = createAdminClient();

  // Paginate the large tables; billing summary is always small so a direct query is fine
  const [wwexRows, pacfulRows, summaryRes] = await Promise.all([
    fetchAll<{ category_override: string | null; charge_total: number | null }>(
      (from, to) => admin
        .from("sb_kos_wwex_shipments")
        .select("category_override, charge_total")
        .eq("period_id", periodId)
        .range(from, to)
    ),
    fetchAll<{ category_override: string | null; line_total: number | null }>(
      (from, to) => admin
        .from("sb_kos_pacful_line_items")
        .select("category_override, line_total")
        .eq("period_id", periodId)
        .range(from, to)
    ),
    admin
      .from("sb_kos_pacful_billing_summary")
      .select("*")
      .eq("period_id", periodId)
      .order("sort_order", { ascending: true }),
  ]);

  if (summaryRes.error) return NextResponse.json({ error: summaryRes.error.message }, { status: 500 });

  const wwexByCategory = groupByCategory(wwexRows, "category_override", "charge_total");
  const pacfulByCategory = groupByCategory(pacfulRows, "category_override", "line_total");

  return NextResponse.json({
    wwexByCategory,
    pacfulByCategory,
    billingSummary: summaryRes.data ?? [],
  });
}

function groupByCategory(
  rows: Array<Record<string, unknown>>,
  catKey: string,
  amtKey: string
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const cat = String(row[catKey] ?? "Unassigned");
    const amt = Number(row[amtKey] ?? 0);
    map.set(cat, (map.get(cat) ?? 0) + (isNaN(amt) ? 0 : amt));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}
