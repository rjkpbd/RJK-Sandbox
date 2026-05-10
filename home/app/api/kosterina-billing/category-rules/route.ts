import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sb_kos_category_rules")
    .select("*")
    .order("priority", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tag, category, priority } = await request.json();
  if (!tag || !category) {
    return NextResponse.json({ error: "tag and category are required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sb_kos_category_rules")
    .insert({ tag: tag.trim(), category: category.trim(), priority: priority ?? 99 })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
