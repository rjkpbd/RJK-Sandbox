import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

type OverrideItem = {
  table: "pacful" | "wwex";
  id: number;
  category_override: string | null;
};

// POST /api/kosterina-billing/override
// Body: { updates: OverrideItem[] }
export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { updates } = await request.json() as { updates: OverrideItem[] };
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const errors: string[] = [];

  await Promise.all(
    updates.map(async ({ table, id, category_override }) => {
      const tableName =
        table === "pacful" ? "sb_kos_pacful_line_items" : "sb_kos_wwex_shipments";
      const { error } = await admin
        .from(tableName)
        .update({ category_override })
        .eq("id", id);
      if (error) errors.push(error.message);
    })
  );

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }
  return NextResponse.json({ success: true, updated: updates.length });
}
