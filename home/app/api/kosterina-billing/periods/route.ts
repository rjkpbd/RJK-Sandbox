import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sb_kos_periods")
    .select("*")
    .order("period", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { period } = await request.json(); // "YYYY-MM"
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }
  const [year, month] = period.split("-").map(Number);
  const periodDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sb_kos_periods")
    .upsert({ period: periodDate, label }, { onConflict: "period" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
