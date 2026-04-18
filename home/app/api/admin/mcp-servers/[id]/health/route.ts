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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerClient();

  const { data: server, error: fetchError } = await supabase
    .from("mcp_servers")
    .select("url, bearer_token")
    .eq("id", id)
    .single();

  if (fetchError || !server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  if (!server.url) {
    return NextResponse.json({ status: "unconfigured", message: "No URL set" });
  }

  const healthUrl = server.url.replace(/\/mcp\/?$/, "") + "/health";
  let status: "healthy" | "unhealthy" = "unhealthy";
  let detail: Record<string, unknown> = {};

  try {
    const headers: Record<string, string> = {};
    if (server.bearer_token) {
      headers["Authorization"] = `Bearer ${server.bearer_token}`;
    }
    const res = await fetch(healthUrl, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      status = "healthy";
      detail = await res.json().catch(() => ({}));
    } else {
      detail = { httpStatus: res.status };
    }
  } catch (e) {
    detail = { error: e instanceof Error ? e.message : "unreachable" };
  }

  // Persist health status
  await supabase
    .from("mcp_servers")
    .update({
      last_health_check: new Date().toISOString(),
      last_health_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ status, detail });
}
