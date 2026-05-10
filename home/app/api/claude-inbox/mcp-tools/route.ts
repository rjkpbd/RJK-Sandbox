import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api-validate";

export const dynamic = "force-dynamic";

const ToolsBodySchema = z.object({
  serverUrl: z.string().url(),
  authToken: z.string().optional(),
});

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };

/** Parse tools out of a JSON-RPC response body (already parsed). */
function extractTools(data: unknown): McpTool[] | null {
  const d = data as { error?: { message?: string }; result?: { tools?: McpTool[] } };
  if (d.error) return null;
  return d.result?.tools ?? [];
}

/** Read an SSE stream and return the first `message` event data parsed as JSON. */
async function readFirstSseMessage(body: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    for (const line of buf.split("\n")) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload && payload !== "[DONE]") {
          try {
            reader.cancel();
            return JSON.parse(payload);
          } catch {
            // ignore malformed line
          }
        }
      }
    }
  }
  return null;
}

/** POST a JSON-RPC request to the MCP server and return the parsed response plus session ID. */
async function mcpPost(
  serverUrl: string,
  headers: Record<string, string>,
  body: unknown
): Promise<{ data: unknown; sessionId: string | null }> {
  const res = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }

  const sessionId = res.headers.get("Mcp-Session-Id");
  const ct = res.headers.get("Content-Type") ?? "";

  let data: unknown;
  if (ct.includes("text/event-stream") && res.body) {
    data = await readFirstSseMessage(res.body);
  } else {
    data = await res.json();
  }

  return { data, sessionId };
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, ToolsBodySchema);
  if (!parsed.ok) return parsed.response;

  const { serverUrl, authToken } = parsed.data;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  // Step 1: MCP initialize handshake.
  // Auth errors (401/403) mean bad credentials — bail immediately.
  // Other HTTP errors (400/404) likely mean the server predates the handshake — proceed to tools/list.
  let sessionId: string | null = null;
  try {
    const initResult = await mcpPost(serverUrl, headers, {
      jsonrpc: "2.0",
      method: "initialize",
      id: 1,
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "Claude Inbox", version: "1.0.0" },
      },
    });
    sessionId = initResult.sessionId;

    // Send initialized notification (fire-and-forget, no response expected)
    if (sessionId) headers["Mcp-Session-Id"] = sessionId;
    fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const status = parseInt(msg.slice(0, 3), 10);
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: `MCP auth failed: ${msg}` }, { status: 502 });
    }
    // Any other failure (400, 404, network) — server may not require init, continue.
  }

  // Step 2: tools/list
  let data: unknown;
  try {
    const result = await mcpPost(serverUrl, headers, {
      jsonrpc: "2.0",
      method: "tools/list",
      id: 2,
    });
    data = result.data;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error reaching MCP server" },
      { status: 502 }
    );
  }

  const tools = extractTools(data);
  if (tools === null) {
    const d = data as { error?: { message?: string } };
    return NextResponse.json(
      { error: d.error?.message ?? "MCP tool list error" },
      { status: 502 }
    );
  }

  const normalized = tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: t.inputSchema ?? { type: "object", properties: {} },
  }));

  return NextResponse.json({ tools: normalized });
}
