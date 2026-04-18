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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { display_name, description, server_type, url, bearer_token, credentials, enabled } = body;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("mcp_servers")
    .update({
      ...(display_name !== undefined && { display_name: display_name.trim() }),
      ...(description !== undefined && { description: description?.trim() ?? null }),
      ...(server_type !== undefined && { server_type }),
      ...(url !== undefined && { url: url?.trim() || null }),
      ...(bearer_token !== undefined && { bearer_token: bearer_token?.trim() || null }),
      ...(credentials !== undefined && { credentials }),
      ...(enabled !== undefined && { enabled }),
      updated_at: new Date().toISOString(),
    })
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
  const supabase = createServerClient();
  const { error } = await supabase.from("mcp_servers").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
