import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { createServerClient } from "@/lib/supabase-server";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  const user = await verifySessionToken(token);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("SB-users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, name } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("SB-users")
    .insert({ email: email.toLowerCase().trim(), name: name?.trim() ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from("SB-users").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
