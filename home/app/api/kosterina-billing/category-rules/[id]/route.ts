import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/kosterina-billing/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.tag !== undefined) updates.tag = String(body.tag).trim();
  if (body.category !== undefined) updates.category = String(body.category).trim();
  if (body.priority !== undefined) updates.priority = Number(body.priority);
  updates.updated_at = new Date().toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sb_kos_category_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("sb_kos_category_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
