import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { z } from "zod";
import { computeCost } from "@/lib/claude-inbox/config/models";
import { parseBody } from "@/lib/api-validate";

export const dynamic = "force-dynamic";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// ── Request schema ────────────────────────────────────────────────────────────

const McpToolDefSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
});

const McpServerConfigSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  authToken: z.string().optional(),
  tools: z.array(McpToolDefSchema).optional(),
});

const ContentBlockSchema = z.object({ type: z.string() }).passthrough();

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
});

const ChatBodySchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
  messages: z.array(MessageSchema).min(1, "messages must not be empty"),
  model: z.string().min(1, "model is required"),
  system: z.string().optional(),
  maxTokens: z.number().int().positive().default(8192),
  enableWebSearch: z.boolean().default(false),
  mcpServers: z.array(McpServerConfigSchema).optional(),
  enablePEV: z.boolean().default(false),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractLastUserText(msgs: Anthropic.MessageParam[]): string {
  const last = msgs[msgs.length - 1];
  if (!last) return "";
  const content = last.content;
  if (typeof content === "string") return content;
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

async function callMcpTool(
  serverUrl: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  authToken?: string
): Promise<{ content: string; isError: boolean }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(serverUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: toolInput },
        id: 1,
      }),
    });
  } catch (err) {
    return {
      content: err instanceof Error ? err.message : "MCP network error",
      isError: true,
    };
  }

  if (!res.ok) {
    return {
      content: `MCP server error: ${res.status} ${res.statusText}`,
      isError: true,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { content: "MCP server returned non-JSON response", isError: true };
  }

  const d = data as {
    error?: { message?: string };
    result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  };
  if (d.error) {
    return { content: d.error.message ?? "MCP tool error", isError: true };
  }

  const textParts = (d.result?.content ?? [])
    .map((c) => c.text ?? "")
    .filter(Boolean)
    .join("\n");
  const content = textParts || JSON.stringify(d.result ?? {});
  return { content, isError: d.result?.isError ?? false };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, ChatBodySchema);
  if (!parsed.ok) return parsed.response;

  const { apiKey, messages, model, system, maxTokens, enableWebSearch, mcpServers, enablePEV } = parsed.data;

  const anthropic = new Anthropic({ apiKey });
  const enc = new TextEncoder();

  const systemParam = system
    ? [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }]
    : undefined;

  function addCacheBreakpoint(content: string | Array<{ type: string; [key: string]: unknown }>) {
    if (typeof content === "string") {
      return [{ type: "text", text: content, cache_control: { type: "ephemeral" } }];
    }
    if (!Array.isArray(content) || content.length === 0) return content;
    const last = { ...content[content.length - 1] as object, cache_control: { type: "ephemeral" } };
    return [...content.slice(0, -1), last];
  }

  const initialMessages = messages.map((msg, i, arr) => {
    if (arr.length >= 2 && i === arr.length - 2) {
      return { ...msg, content: addCacheBreakpoint(msg.content as string | Array<{ type: string; [key: string]: unknown }>) };
    }
    return msg;
  }) as Anthropic.MessageParam[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSearchTool = enableWebSearch ? ({ type: "web_search_20250305", name: "web_search" } as any) : null;

  type ToolServerEntry = { serverName: string; serverUrl: string; authToken?: string };
  const toolServerMap = new Map<string, ToolServerEntry>();
  const mcpAnthropicTools: Anthropic.Tool[] = [];

  for (const server of mcpServers ?? []) {
    for (const tool of server.tools ?? []) {
      toolServerMap.set(tool.name, {
        serverName: server.name,
        serverUrl: server.url,
        authToken: server.authToken,
      });
      mcpAnthropicTools.push({
        name: tool.name,
        description: tool.description,
        input_schema: (tool.inputSchema ?? {
          type: "object",
          properties: {},
        }) as unknown as Anthropic.Tool.InputSchema,
      });
    }
  }

  const allTools: unknown[] = [
    ...(webSearchTool ? [webSearchTool] : []),
    ...mcpAnthropicTools,
  ];

  const readable = new ReadableStream({
    async start(controller) {
      let currentSdkStream: ReturnType<typeof anthropic.messages.stream> | null = null;
      req.signal.addEventListener("abort", () => currentSdkStream?.abort(), { once: true });

      let currentMessages: Anthropic.MessageParam[] = initialMessages;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCacheCreationTokens = 0;
      let totalCacheReadTokens = 0;

      const MAX_TOOL_ROUNDS = 10;

      function emit(payload: unknown) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      function emitUsageAndDone(stopReason: string) {
        const costUsd = computeCost(
          totalInputTokens, totalOutputTokens, model,
          totalCacheCreationTokens, totalCacheReadTokens
        );
        emit({
          type: "usage",
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          costUsd,
          cacheCreationTokens: totalCacheCreationTokens,
          cacheReadTokens: totalCacheReadTokens,
          stopReason,
        });
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      }

      try {
        // ── Plan phase ────────────────────────────────────────────────────────
        let planText = "";

        if (enablePEV) {
          emit({ type: "phase", phase: "plan", model: HAIKU_MODEL });

          const lastUserText = extractLastUserText(initialMessages);
          const planStream = anthropic.messages.stream({
            model: HAIKU_MODEL,
            max_tokens: 1024,
            system: "You are a planning assistant. Given the user's request, output a concise numbered plan (3–5 steps) that another AI will follow to craft its response. Focus on structure and the key points to address. Output only the numbered list — no preamble, no commentary.",
            messages: [{ role: "user", content: lastUserText }],
          });
          currentSdkStream = planStream;

          planStream.on("text", (text) => {
            planText += text;
            emit({ type: "text", text });
          });

          let planFinalMsg: Anthropic.Message;
          try {
            planFinalMsg = await planStream.finalMessage();
          } catch (err) {
            if (err instanceof Anthropic.APIUserAbortError) {
              controller.enqueue(enc.encode("data: [DONE]\n\n"));
              return;
            }
            throw err;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const planUsage = planFinalMsg.usage as any;
          totalInputTokens += planUsage.input_tokens ?? 0;
          totalOutputTokens += planUsage.output_tokens ?? 0;
          totalCacheCreationTokens += planUsage.cache_creation_input_tokens ?? 0;
          totalCacheReadTokens += planUsage.cache_read_input_tokens ?? 0;
        }

        // ── Execute phase ─────────────────────────────────────────────────────
        if (enablePEV) {
          emit({ type: "phase", phase: "execute", model });
        }

        // Inject plan into system prompt for the execute phase
        const executeSystemParam = enablePEV && planText.trim()
          ? [
              ...(systemParam ?? []),
              {
                type: "text" as const,
                text: `\n\nPlanning guidance for your response:\n${planText}`,
              },
            ]
          : systemParam;

        let executeContent = "";
        let executeFinalStopReason = "tool_rounds_exceeded";
        let aborted = false;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          emit({ type: "round_start", round: round + 1, maxRounds: MAX_TOOL_ROUNDS });

          if (req.signal.aborted) {
            aborted = true;
            break;
          }

          emit({
            type: "round_request",
            round: round + 1,
            model,
            messages: currentMessages,
            system: executeSystemParam ?? null,
            tools: allTools.length > 0 ? allTools : null,
            mcpServers: (mcpServers ?? []).map((s) => ({
              name: s.name,
              url: s.url,
              toolCount: (s.tools ?? []).length,
              hasAuth: !!s.authToken,
            })),
          });

          const sdkStream = anthropic.messages.stream({
            model,
            max_tokens: maxTokens,
            messages: currentMessages,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(executeSystemParam ? { system: executeSystemParam as any } : {}),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(allTools.length > 0 ? { tools: allTools as any } : {}),
          });

          currentSdkStream = sdkStream;

          sdkStream.on("streamEvent", (event) => {
            if (event.type === "content_block_start") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const block = (event as any).content_block;
              if (block?.type === "tool_use") {
                const serverEntry = toolServerMap.get(block.name as string);
                emit({
                  type: "tool_call",
                  name: block.name as string,
                  serverName: serverEntry?.serverName ?? null,
                });
              }
            } else if (event.type === "content_block_delta") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const delta = (event as any).delta;
              if (delta?.type === "input_json_delta") {
                emit({ type: "tool_input_delta", partial: delta.partial_json });
              } else if (delta?.type === "thinking_delta") {
                emit({ type: "thinking", text: delta.thinking });
              }
            }
          });

          sdkStream.on("text", (text) => {
            executeContent += text;
            emit({ type: "text", text });
          });

          let finalMsg: Anthropic.Message;
          try {
            finalMsg = await sdkStream.finalMessage();
          } catch (err) {
            if (err instanceof Anthropic.APIUserAbortError) {
              aborted = true;
              break;
            }
            throw err;
          }

          emit({
            type: "round_response",
            round: round + 1,
            content: finalMsg.content,
            stop_reason: finalMsg.stop_reason,
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const usage = finalMsg.usage as any;
          const roundInput = usage.input_tokens ?? 0;
          const roundOutput = usage.output_tokens ?? 0;
          const roundCacheCreation = usage.cache_creation_input_tokens ?? 0;
          const roundCacheRead = usage.cache_read_input_tokens ?? 0;
          const roundCost = computeCost(roundInput, roundOutput, model, roundCacheCreation, roundCacheRead);

          emit({
            type: "usage_delta",
            round: round + 1,
            inputTokens: roundInput,
            outputTokens: roundOutput,
            costUsd: roundCost,
            cacheCreationTokens: roundCacheCreation,
            cacheReadTokens: roundCacheRead,
          });

          totalInputTokens += roundInput;
          totalOutputTokens += roundOutput;
          totalCacheCreationTokens += roundCacheCreation;
          totalCacheReadTokens += roundCacheRead;

          if (finalMsg.stop_reason !== "tool_use") {
            executeFinalStopReason = finalMsg.stop_reason ?? "end_turn";
            break;
          }

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: finalMsg.content },
          ];

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of finalMsg.content) {
            if (block.type !== "tool_use") continue;

            const serverEntry = toolServerMap.get(block.name);
            if (!serverEntry) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: `Unknown tool: ${block.name}`,
                is_error: true,
              });
              continue;
            }

            emit({ type: "tool_executing", name: block.name });

            const { content: result, isError } = await callMcpTool(
              serverEntry.serverUrl,
              block.name,
              block.input as Record<string, unknown>,
              serverEntry.authToken
            );

            emit({ type: "tool_result", name: block.name, result, isError });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
              is_error: isError,
            });
          }

          currentMessages = [
            ...currentMessages,
            { role: "user", content: toolResults },
          ];
        }

        if (aborted) {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          return;
        }

        // ── Verify phase ──────────────────────────────────────────────────────
        if (enablePEV && executeContent.trim()) {
          emit({ type: "phase", phase: "verify", model: HAIKU_MODEL });

          const lastUserText = extractLastUserText(initialMessages);
          const verifyStream = anthropic.messages.stream({
            model: HAIKU_MODEL,
            max_tokens: 512,
            system: "You are a concise quality reviewer. Given an original request, a plan, and an AI's response, write a 1–2 sentence assessment of whether the response fully addresses the request and follows the plan. Start with ✓ if the response is complete and accurate, or ⚠ if there are notable gaps or issues.",
            messages: [{
              role: "user",
              content: `Original request:\n${lastUserText}\n\nPlan:\n${planText}\n\nResponse:\n${executeContent}\n\nProvide your brief assessment.`,
            }],
          });
          currentSdkStream = verifyStream;

          verifyStream.on("text", (text) => {
            emit({ type: "text", text });
          });

          try {
            const verifyFinalMsg = await verifyStream.finalMessage();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const verifyUsage = verifyFinalMsg.usage as any;
            totalInputTokens += verifyUsage.input_tokens ?? 0;
            totalOutputTokens += verifyUsage.output_tokens ?? 0;
            totalCacheCreationTokens += verifyUsage.cache_creation_input_tokens ?? 0;
            totalCacheReadTokens += verifyUsage.cache_read_input_tokens ?? 0;
          } catch (verifyErr) {
            if (verifyErr instanceof Anthropic.APIUserAbortError) {
              controller.enqueue(enc.encode("data: [DONE]\n\n"));
              return;
            }
            // Non-fatal: skip verification but still emit usage and done
          }
        }

        emitUsageAndDone(executeFinalStopReason);

      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError) {
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
        } else {
          let message: string;
          if (err instanceof Anthropic.APIError) {
            const body = err.error as { error?: { message?: string }; message?: string } | undefined;
            message = body?.error?.message ?? body?.message ?? err.message;
          } else {
            message = err instanceof Error ? err.message : "Unknown error";
          }
          emit({ type: "error", message });
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
