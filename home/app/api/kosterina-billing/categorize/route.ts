import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";
import { deriveCategoriesForPeriod, inheritCategoriesForPeriod } from "@/lib/kosterina-billing/categorize";

// POST /api/kosterina-billing/categorize
// Body: { periodId: number }
// Recategorizes all Shopify orders in the period, then re-inherits into Pacful + WWEX.
export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { periodId } = await request.json();
  if (!periodId) return NextResponse.json({ error: "periodId is required" }, { status: 400 });

  await deriveCategoriesForPeriod(Number(periodId));
  await inheritCategoriesForPeriod(Number(periodId), "sb_kos_pacful_line_items");
  await inheritCategoriesForPeriod(Number(periodId), "sb_kos_wwex_shipments");

  return NextResponse.json({ success: true });
}
