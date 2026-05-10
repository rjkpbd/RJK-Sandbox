"use client";

import { getCachedApiKey } from "@/lib/claude-inbox/crypto/session";
import type { AnthropicBlock } from "@/lib/claude-inbox/attachments";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicBlock[];
}

export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  stopReason?: string;
}

export interface StreamUsageDelta {
  round: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (usage: StreamUsage) => void;
  onError: (message: string) => void;
  onPhase?: (phase: "plan" | "execute" | "verify", model: string) => void;
  onToolUse?: (name: string, serverName: string | null) => void;
  onToolInputDelta?: (partial: string) => void;
  onToolExecuting?: (name: string) => void;
  onToolResult?: (name: string, result: string, isError: boolean) => void;
  onThinking?: (text: string) => void;
  onRoundStart?: (round: number, maxRounds: number) => void;
  onUsageDelta?: (delta: StreamUsageDelta) => void;
  onRoundRequest?: (round: number, payload: unknown) => void;
  onRoundResponse?: (round: number, content: unknown, stopReason: string | null) => void;
  /** Called when Anthropic returns 429 — provides countdown and attempt info. */
  onRateLimited?: (retryAfterMs: number, attempt: number, maxAttempts: number) => void;
  /** Called when the backoff wait finishes and the retry is about to start. */
  onRetrying?: () => void;
}

export interface StreamHandle {
  abort: () => void;
}

const MAX_RETRIES = 3;

/** Returns true if the wait completed normally, false if aborted. */
function sleepAbortable(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(false); return; }
    const id = setTimeout(() => resolve(true), ms);
    signal.addEventListener("abort", () => { clearTimeout(id); resolve(false); }, { once: true });
  });
}

export interface McpServerConfig {
  name: string;
  url: string;
  authToken?: string;
  tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
}

export function streamMessage(
  messages: AnthropicMessage[],
  model: string,
  callbacks: StreamCallbacks,
  system?: string,
  maxTokens?: number,
  enableWebSearch?: boolean,
  mcpServers?: McpServerConfig[],
  enablePEV?: boolean
): StreamHandle {
  const controller = new AbortController();

  (async () => {
    const apiKey = getCachedApiKey();
    if (!apiKey) {
      callbacks.onError("No API key in session. Unlock your vault to start chatting.");
      return;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (controller.signal.aborted) return;

      let response: Response;
      try {
        response = await fetch("/api/claude-inbox/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey, messages, model, system, maxTokens, enableWebSearch, mcpServers, enablePEV }),
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        callbacks.onError(err instanceof Error ? err.message : "Unknown streaming error");
        return;
      }

      if (response.status === 429) {
        if (attempt === MAX_RETRIES) {
          callbacks.onError("Rate limit exceeded. Please wait and try again.");
          return;
        }
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : Math.pow(2, attempt + 1);
        const retryAfterMs = Math.min(Math.round(retryAfterSec * 1000), 60_000);
        callbacks.onRateLimited?.(retryAfterMs, attempt + 1, MAX_RETRIES + 1);
        const proceeded = await sleepAbortable(retryAfterMs, controller.signal);
        if (!proceeded) return;
        callbacks.onRetrying?.();
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        callbacks.onError(`API error ${response.status}: ${text}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError("No response body from server");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") return;

            try {
              const event = JSON.parse(payload) as Record<string, unknown>;
              if (event.type === "phase") {
                callbacks.onPhase?.(event.phase as "plan" | "execute" | "verify", event.model as string);
              } else if (event.type === "text") {
                callbacks.onChunk(event.text as string);
              } else if (event.type === "tool_call") {
                callbacks.onToolUse?.(event.name as string, (event.serverName as string | null) ?? null);
              } else if (event.type === "tool_input_delta") {
                callbacks.onToolInputDelta?.(event.partial as string);
              } else if (event.type === "tool_executing") {
                callbacks.onToolExecuting?.(event.name as string);
              } else if (event.type === "tool_result") {
                callbacks.onToolResult?.(event.name as string, event.result as string, event.isError as boolean);
              } else if (event.type === "thinking") {
                callbacks.onThinking?.(event.text as string);
              } else if (event.type === "round_start") {
                callbacks.onRoundStart?.(event.round as number, event.maxRounds as number);
              } else if (event.type === "round_request") {
                callbacks.onRoundRequest?.(event.round as number, event);
              } else if (event.type === "round_response") {
                callbacks.onRoundResponse?.(event.round as number, event.content, (event.stop_reason as string | null) ?? null);
              } else if (event.type === "usage_delta") {
                callbacks.onUsageDelta?.({
                  round: event.round as number,
                  inputTokens: event.inputTokens as number,
                  outputTokens: event.outputTokens as number,
                  costUsd: event.costUsd as number,
                  cacheCreationTokens: event.cacheCreationTokens as number | undefined,
                  cacheReadTokens: event.cacheReadTokens as number | undefined,
                });
              } else if (event.type === "usage") {
                callbacks.onDone({
                  inputTokens: event.inputTokens as number,
                  outputTokens: event.outputTokens as number,
                  costUsd: event.costUsd as number,
                  cacheCreationTokens: event.cacheCreationTokens as number | undefined,
                  cacheReadTokens: event.cacheReadTokens as number | undefined,
                  stopReason: event.stopReason as string | undefined,
                });
              } else if (event.type === "error") {
                callbacks.onError(event.message as string);
              }
            } catch {
              // malformed SSE line — skip
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        callbacks.onError(err instanceof Error ? err.message : "Unknown streaming error");
      }
      return; // success — exit retry loop
    }
  })();

  return { abort: () => controller.abort() };
}
