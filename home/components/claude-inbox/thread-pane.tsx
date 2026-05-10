"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import {
  MessageSquare,
  Send,
  Square,
  Copy,
  Pencil,
  RotateCcw,
  Trash2,
  Check,
  Paperclip,
  X,
  FileText,
  FileCode,
  GitFork,
  Globe,
  AlertTriangle,
  Wrench,
  Loader2,
  ChevronDown,
  ChevronUp,
  ListChecks,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  streamMessage,
  type AnthropicMessage,
  type StreamUsage,
  type StreamHandle,
  type McpServerConfig,
} from "@/lib/claude-inbox/api/stream";
import { DEFAULT_MODEL_ID, formatCost, getModel } from "@/lib/claude-inbox/config/models";
import { Markdown } from "./markdown";
import {
  createPendingAttachment,
  prepareAttachment,
  buildMessageContent,
  validateFile,
  type PendingAttachment,
  type PreparedAttachment,
} from "@/lib/claude-inbox/attachments";
import {
  loadMessages,
  saveMessage,
  deleteAllMessages,
  cloneMessages,
  messageTextContent,
} from "@/lib/claude-inbox/data/messages";
import {
  useConversation,
  updateConversation,
  createConversation,
  useTagList,
} from "@/lib/claude-inbox/data/conversations";
import { useProject, useProjects } from "@/lib/claude-inbox/data/projects";
import { useMcpServers, refreshMcpTools } from "@/lib/claude-inbox/data/mcp-servers";
import { useUserSettings } from "@/lib/claude-inbox/data/user-settings";
import { buildSystemPrompt } from "@/lib/claude-inbox/instructions";
import { summarizeMessages } from "@/lib/claude-inbox/api/summarize";
import { appendConversationSummary } from "@/lib/claude-inbox/api/project-context";
import { InstructionsPanel } from "./instructions-panel";
import { ContextBar } from "./context-bar";
import { SlashPicker } from "./slash-picker";
import { SkillsPanel } from "./skills-panel";
import { RateLimitBanner } from "./rate-limit-banner";
import { ExportMenu } from "./export-menu";
import { ConversationActionsPanel } from "./conversation-actions-panel";
import { McpPanel } from "./mcp-panel";
import { ModelPicker } from "./model-picker";
import { VaultUnlockModal } from "./vault-unlock-modal";
import { getCachedApiKey } from "@/lib/claude-inbox/crypto/session";
import { useTemplates, incrementTemplateUsage } from "@/lib/claude-inbox/data/templates";
import { useSkills } from "@/lib/claude-inbox/data/skills";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import { useDailySpendUsd, useMonthlySpendUsd } from "@/lib/claude-inbox/data/cost-tracking";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolCallRecord {
  name: string;
  serverName: string | null;
  result?: string;
  isError?: boolean;
}

interface DebugRound {
  round: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  request?: unknown;
  response?: unknown;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan?: string;
  verification?: string;
  currentStreamPhase?: "plan" | "execute" | "verify";
  preparedAttachments?: PreparedAttachment[];
  usage?: StreamUsage;
  error?: string;
  isStreaming?: boolean;
  isSearching?: boolean;
  toolCalls?: ToolCallRecord[];
  model?: string;
  debugRounds?: DebugRound[];
}

// ── Empty state ───────────────────────────────────────────────────────────────

function ThreadEmptyState() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 text-center px-8">
      <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
        <MessageSquare size={24} className="text-slate-600" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-300">No conversation selected</p>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
          Choose a conversation from the list, or start a new one.
        </p>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-2">
        <span><kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-500">⌘K</kbd> command palette</span>
        <span><kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-500">⌘N</kbd> new chat</span>
        <span><kbd className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-slate-500">⌘/</kbd> search</span>
      </div>
    </div>
  );
}

function MessageSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <div className={`flex items-end gap-2 animate-pulse ${align === "right" ? "flex-row-reverse" : ""}`}>
      {align === "left" && <div className="w-7 h-7 rounded-full bg-slate-700 shrink-0" />}
      <div className={`space-y-1.5 max-w-xs flex flex-col ${align === "right" ? "items-end" : "items-start"}`}>
        <div className={`h-3 bg-slate-700 rounded-full ${align === "right" ? "w-48" : "w-56"}`} />
        <div className={`h-3 bg-slate-700 rounded-full ${align === "right" ? "w-36" : "w-44"}`} />
        {align === "left" && <div className="h-3 bg-slate-700 rounded-full w-32" />}
      </div>
    </div>
  );
}

// ── Attachment display ────────────────────────────────────────────────────────

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment;
  onRemove?: () => void;
}) {
  if (attachment.type === "image" && attachment.previewUrl) {
    return (
      <div className="relative shrink-0 group/chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.previewUrl} alt={attachment.file.name} className="w-14 h-14 rounded-lg object-cover border border-slate-600" />
        {onRemove && (
          <button onClick={onRemove} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-slate-600 text-slate-300 flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity" aria-label={`Remove ${attachment.file.name}`}>
            <X size={9} />
          </button>
        )}
      </div>
    );
  }
  const Icon = attachment.type === "pdf" ? FileText : FileCode;
  const color = attachment.type === "pdf" ? "text-red-400 bg-red-950" : "text-sky-400 bg-sky-950";
  return (
    <div className="relative shrink-0 group/chip">
      <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-600 max-w-[140px]", color)}>
        <Icon size={13} className="shrink-0" />
        <span className="text-xs truncate text-slate-200">{attachment.file.name}</span>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-slate-600 text-slate-300 flex items-center justify-center opacity-0 group-hover/chip:opacity-100 transition-opacity" aria-label={`Remove ${attachment.file.name}`}>
          <X size={9} />
        </button>
      )}
    </div>
  );
}

function SentAttachments({ attachments }: { attachments: PreparedAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((att) => {
        if (att.type === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={att.id} src={`data:${att.mimeType};base64,${att.base64}`} alt={att.filename} className="max-w-[200px] max-h-[200px] rounded-lg object-contain border border-slate-600" />
          );
        }
        const Icon = att.type === "pdf" ? FileText : FileCode;
        return (
          <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 border border-slate-600">
            <Icon size={13} className={att.type === "pdf" ? "text-red-400 shrink-0" : "text-sky-400 shrink-0"} />
            <span className="text-xs text-slate-200 max-w-[120px] truncate">{att.filename}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tool call badge ───────────────────────────────────────────────────────────

function ToolCallBadge({ tc }: { tc: ToolCallRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = tc.result === undefined;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={isPending ? undefined : () => setExpanded((v) => !v)}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md w-full text-left transition-colors",
          isPending
            ? "bg-slate-700/40 text-slate-400 cursor-default"
            : tc.isError
            ? "bg-red-950/60 text-red-400 hover:bg-red-950 cursor-pointer"
            : "bg-slate-700/40 text-slate-300 hover:bg-slate-700/70 cursor-pointer"
        )}
      >
        {isPending ? (
          <Loader2 size={10} className="animate-spin shrink-0" />
        ) : tc.isError ? (
          <AlertTriangle size={10} className="shrink-0" />
        ) : (
          <Wrench size={10} className="text-indigo-400 shrink-0" />
        )}
        <span className="font-mono truncate flex-1">{tc.name}</span>
        {tc.serverName && (
          <span className="text-slate-500 shrink-0 hidden sm:inline">({tc.serverName})</span>
        )}
        {!isPending && (
          <span className="shrink-0 ml-1">
            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
          </span>
        )}
      </button>
      {expanded && tc.result && (
        <pre className="text-[10px] text-slate-400 bg-slate-900/80 rounded-md px-2.5 py-2 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">
          {tc.result}
        </pre>
      )}
    </div>
  );
}

// ── PEV phase sections ────────────────────────────────────────────────────────

function PlanSection({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    if (!isStreaming && text) setExpanded(false);
  }, [isStreaming, text]);

  return (
    <div className="mb-2 rounded-lg border border-indigo-800/50 bg-indigo-950/30 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <ListChecks size={11} />
        <span className="font-medium">Plan</span>
        <span className="ml-auto opacity-60">{expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 text-xs text-slate-300 leading-relaxed">
          <Markdown>{text}</Markdown>
          {isStreaming && <span className="opacity-40 animate-pulse ml-0.5">▍</span>}
        </div>
      )}
    </div>
  );
}

function VerifySection({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const isOk = text.trimStart().startsWith("✓");
  return (
    <div className={cn(
      "mt-2 px-2.5 py-1.5 rounded-lg text-[11px] flex items-start gap-1.5 leading-relaxed",
      isOk
        ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40"
        : "bg-amber-950/40 text-amber-300 border border-amber-800/40"
    )}>
      {isOk
        ? <Check size={10} className="mt-0.5 shrink-0 text-emerald-400" />
        : <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-400" />}
      <span>{text}</span>
      {isStreaming && <span className="opacity-40 animate-pulse">▍</span>}
    </div>
  );
}

// ── Debug panel ───────────────────────────────────────────────────────────────

function DebugJsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group/json">
      <button
        onClick={copy}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover/json:opacity-100 transition-opacity text-[9px] text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded"
      >
        {copied ? "copied" : "copy"}
      </button>
      <pre className="text-[10px] text-slate-300 bg-slate-950/70 rounded px-2.5 py-2 overflow-y-auto max-h-72 whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

function DebugRoundRow({ r }: { r: DebugRound }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"request" | "response">("request");
  return (
    <div className="border-t border-slate-700/30 first:border-t-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/30 transition-colors text-left"
      >
        <span className="text-slate-600 w-5 shrink-0">#{r.round}</span>
        <span className="text-sky-600">{r.inputTokens.toLocaleString()} in</span>
        <span className="text-slate-600">/</span>
        <span className="text-emerald-600">{r.outputTokens.toLocaleString()} out</span>
        <span className="text-slate-600 mx-0.5">·</span>
        <span className="text-slate-500">{formatCost(r.costUsd)}</span>
        {(r.cacheReadTokens > 0 || r.cacheCreationTokens > 0) && (
          <span className="text-violet-500/70 ml-1">
            cache:{r.cacheReadTokens > 0 ? ` ${r.cacheReadTokens.toLocaleString()}r` : ""}
            {r.cacheCreationTokens > 0 ? ` ${r.cacheCreationTokens.toLocaleString()}w` : ""}
          </span>
        )}
        <span className="ml-auto text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          <div className="flex gap-0 mb-1.5 border-b border-slate-700/40">
            {(["request", "response"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-2.5 py-1 text-[10px] border-b-2 -mb-px transition-colors",
                  tab === t
                    ? "border-indigo-500 text-indigo-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "request" && (
            r.request ? <DebugJsonBlock data={r.request} /> : <p className="text-slate-600 text-[10px] italic px-1">Not yet received</p>
          )}
          {tab === "response" && (
            r.response ? <DebugJsonBlock data={r.response} /> : <p className="text-slate-600 text-[10px] italic px-1">Not yet received</p>
          )}
        </div>
      )}
    </div>
  );
}

function DebugPanel({ msg }: { msg: LocalMessage }) {
  const [expanded, setExpanded] = useState(false);
  const rounds = msg.debugRounds ?? [];
  if (rounds.length === 0) return null;

  const totalIn = rounds.reduce((s, r) => s + r.inputTokens, 0);
  const totalOut = rounds.reduce((s, r) => s + r.outputTokens, 0);
  const totalCost = rounds.reduce((s, r) => s + r.costUsd, 0);

  return (
    <div className="mt-1.5 rounded-md border border-slate-700/60 bg-slate-900/60 text-[10px] font-mono overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-800/40 transition-colors text-left"
      >
        <span className="text-amber-500/80">⬡</span>
        <span className="text-slate-400">debug</span>
        <span className="text-slate-600 mx-1">·</span>
        <span>{rounds.length} call{rounds.length !== 1 ? "s" : ""}</span>
        {msg.model && <><span className="text-slate-600 mx-1">·</span><span className="text-slate-500">{msg.model}</span></>}
        <span className="text-slate-600 mx-1">·</span>
        <span className="text-sky-600">{totalIn.toLocaleString()} in</span>
        <span className="text-slate-600 mx-0.5">/</span>
        <span className="text-emerald-600">{totalOut.toLocaleString()} out</span>
        <span className="text-slate-600 mx-1">·</span>
        <span className="text-slate-500">{formatCost(totalCost)}</span>
        {msg.isStreaming && <span className="ml-auto animate-pulse text-amber-500/60">●</span>}
        {!msg.isStreaming && <span className="ml-auto text-slate-600">{expanded ? "▲" : "▼"}</span>}
      </button>
      {expanded && (
        <div className="border-t border-slate-700/50">
          {rounds.map((r) => <DebugRoundRow key={r.round} r={r} />)}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: LocalMessage;
  isStreaming: boolean;
  isLastAssistant: boolean;
  editingId: string | null;
  debugMode: boolean;
  onCopy: (text: string) => void;
  onEditStart: (id: string) => void;
  onEditSave: (id: string, newContent: string) => void;
  onEditCancel: () => void;
  onRegenerate: () => void;
  onDelete: (id: string) => void;
  onFork: (id: string) => void;
}

function MessageBubble({ msg, isStreaming, isLastAssistant, editingId, debugMode, onCopy, onEditStart, onEditSave, onEditCancel, onRegenerate, onDelete, onFork }: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const isEditing = editingId === msg.id;
  const [editValue, setEditValue] = useState(msg.content);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const streaming = msg.isStreaming;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const handleCopy = useCallback(() => {
    onCopy(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [msg.content, onCopy]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onEditSave(msg.id, editValue.trim()); }
    if (e.key === "Escape") onEditCancel();
  }, [msg.id, editValue, onEditSave, onEditCancel]);

  return (
    <div className={cn("group/msg flex items-end gap-2", isUser ? "flex-row-reverse" : "")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 text-[10px] font-bold text-white self-start mt-1">C</div>
      )}
      <div className={cn("flex flex-col gap-1 max-w-[72%]", isUser ? "items-end" : "items-start")}>
        {isEditing ? (
          <div className="w-full flex flex-col gap-2">
            <textarea ref={editRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={handleEditKeyDown} rows={3} className="w-full bg-slate-700 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 outline-none resize-none leading-relaxed border border-indigo-500" />
            <div className="flex gap-2 justify-end">
              <button onClick={onEditCancel} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1">Cancel</button>
              <button onClick={() => onEditSave(msg.id, editValue.trim())} disabled={!editValue.trim()} className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors">Save &amp; resend</button>
            </div>
          </div>
        ) : (
          <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed", isUser ? "bg-indigo-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm")}>
            {msg.error ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-red-400 text-sm">{msg.error}</p>
                {msg.error.toLowerCase().includes("mcp") && (
                  <a href="/claude-inbox/mcp" className="text-xs text-slate-400 hover:text-slate-200 underline">
                    Check MCP server settings →
                  </a>
                )}
              </div>
            ) : (
              <>
                {msg.preparedAttachments?.length ? <SentAttachments attachments={msg.preparedAttachments} /> : null}
                {/* Plan section — shown when PEV is active */}
                {(msg.plan || msg.currentStreamPhase === "plan") && (
                  <PlanSection
                    text={msg.plan ?? ""}
                    isStreaming={msg.currentStreamPhase === "plan"}
                  />
                )}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {msg.toolCalls.map((tc, i) => (
                      <ToolCallBadge key={i} tc={tc} />
                    ))}
                  </div>
                )}
                {msg.isSearching && !msg.content && (
                  <span className="flex items-center gap-1.5 text-sky-400 text-xs animate-pulse">
                    <Globe size={12} />
                    Searching the web…
                  </span>
                )}
                {/* Execute phase cursor when plan is streaming and content not yet started */}
                {msg.currentStreamPhase === "plan" && !msg.plan && (
                  <span className="opacity-40 animate-pulse text-base">▍</span>
                )}
                {!isUser && msg.content ? <Markdown>{msg.content}</Markdown>
                  : msg.content ? <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  : streaming && !msg.isSearching && msg.currentStreamPhase !== "plan" ? <span className="opacity-40 animate-pulse text-base">▍</span>
                  : null}
                {/* Verify section — shown when PEV is active */}
                {(msg.verification || msg.currentStreamPhase === "verify") && (
                  <VerifySection
                    text={msg.verification ?? ""}
                    isStreaming={msg.currentStreamPhase === "verify"}
                  />
                )}
              </>
            )}
          </div>
        )}
        {msg.usage && (
          <p className="text-[10px] text-slate-600 px-1">
            {msg.usage.inputTokens.toLocaleString()} in · {msg.usage.outputTokens.toLocaleString()} out · {formatCost(msg.usage.costUsd)}
          </p>
        )}
        {debugMode && !isUser && <DebugPanel msg={msg} />}
        {!isEditing && !streaming && (
          <div className={cn("flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity", isUser ? "flex-row-reverse" : "")}>
            <ActionBtn label={copied ? "Copied" : "Copy"} onClick={handleCopy}>{copied ? <Check size={11} /> : <Copy size={11} />}</ActionBtn>
            {isUser && <ActionBtn label="Edit" onClick={() => onEditStart(msg.id)}><Pencil size={11} /></ActionBtn>}
            {!isUser && isLastAssistant && !isStreaming && <ActionBtn label="Regenerate" onClick={onRegenerate}><RotateCcw size={11} /></ActionBtn>}
            <ActionBtn label="Fork from here" onClick={() => onFork(msg.id)}><GitFork size={11} /></ActionBtn>
            <ActionBtn label="Delete" onClick={() => onDelete(msg.id)} danger><Trash2 size={11} /></ActionBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={cn("p-1.5 rounded-md transition-colors", danger ? "text-slate-600 hover:text-red-400 hover:bg-slate-800" : "text-slate-600 hover:text-slate-300 hover:bg-slate-800")}>
      {children}
    </button>
  );
}

// ── Compose bar ───────────────────────────────────────────────────────────────

interface ComposeBarProps {
  isStreaming: boolean;
  model: string;
  lastUserMessage?: string;
  pevEnabled: boolean;
  onTogglePEV: () => void;
  onSend: (text: string, attachments: PreparedAttachment[]) => void;
  onStop: () => void;
}

function ComposeBar({ isStreaming, model, lastUserMessage, pevEnabled, onTogglePEV, onSend, onStop }: ComposeBarProps) {
  const { userId } = useSyncContext();
  const allTemplates = useTemplates(userId) ?? [];

  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = (value.trim() || pending.length > 0) && !isStreaming && !isPreparing;

  // Detect slash-command mode: value starts with "/"
  const slashQuery = value.startsWith("/") ? value.slice(1) : null;
  const slashActive = slashQuery !== null;
  const slashFiltered = slashActive
    ? allTemplates.filter((t) =>
        t.name.toLowerCase().startsWith(slashQuery.toLowerCase())
      )
    : [];

  // Reset index when query changes
  useEffect(() => { setSlashIndex(0); }, [slashQuery]);

  const applyTemplate = useCallback(
    (t: typeof allTemplates[number]) => {
      setValue(t.body);
      incrementTemplateUsage(t.id);
      // Focus textarea and position cursor at first {{variable}} if present
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        const start = t.body.indexOf("{{");
        const end = start !== -1 ? t.body.indexOf("}}", start) + 2 : t.body.length;
        el.setSelectionRange(start !== -1 ? start : t.body.length, end !== -1 ? end : t.body.length);
      });
    },
    []
  );

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const text = value.trim();
    setValue("");
    const snapshot = pending;
    setPending([]);
    setAttachError(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsPreparing(true);
    try {
      const prepared = await Promise.all(snapshot.map((p) => prepareAttachment(p)));
      snapshot.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      onSend(text, prepared);
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : "Failed to prepare attachments");
    } finally {
      setIsPreparing(false);
    }
  }, [canSend, value, pending, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashActive && slashFiltered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % slashFiltered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => (i - 1 + slashFiltered.length) % slashFiltered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyTemplate(slashFiltered[slashIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
    if (e.key === "ArrowUp" && !value && lastUserMessage) {
      e.preventDefault();
      setValue(lastUserMessage);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        el.selectionStart = el.selectionEnd = lastUserMessage.length;
      });
    }
  }, [slashActive, slashFiltered, slashIndex, applyTemplate, handleSend, value, lastUserMessage]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleFilesChosen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachError(null);
    const files = Array.from(e.target.files ?? []);
    const errors: string[] = [];
    const newAtts: PendingAttachment[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) { errors.push(err); continue; }
      const att = createPendingAttachment(file);
      if (att) newAtts.push(att);
    }
    if (errors.length > 0) setAttachError(errors.join("; "));
    if (newAtts.length > 0) setPending((prev) => [...prev, ...newAtts]);
    e.target.value = "";
  }, []);

  return (
    <div className="px-4 py-3 border-t border-slate-700 shrink-0 relative">
      {/* Slash picker — positioned above the compose area */}
      {slashActive && slashFiltered.length > 0 && (
        <SlashPicker
          templates={allTemplates}
          query={slashQuery ?? ""}
          activeIndex={slashIndex}
          onSelect={applyTemplate}
          onDismiss={() => setValue("")}
        />
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {pending.map((att) => (
            <AttachmentChip key={att.id} attachment={att} onRemove={() => { att.previewUrl && URL.revokeObjectURL(att.previewUrl); setPending((prev) => prev.filter((a) => a.id !== att.id)); }} />
          ))}
        </div>
      )}
      {attachError && <p className="text-xs text-red-400 mb-1.5 px-1">{attachError}</p>}
      <div className="flex items-end gap-2 bg-slate-800 rounded-xl px-3 py-2">
        <button onClick={() => fileInputRef.current?.click()} disabled={isStreaming || isPreparing} title="Attach file" aria-label="Attach file" className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30 transition-colors shrink-0">
          <Paperclip size={15} />
        </button>
        <textarea ref={textareaRef} rows={1} value={value} onChange={handleInput} onKeyDown={handleKeyDown} placeholder="Message Claude… (/ for templates, ⌘↵ to send)" disabled={isStreaming || isPreparing} className="flex-1 bg-transparent resize-none text-sm text-slate-100 placeholder:text-slate-500 outline-none leading-relaxed max-h-40 overflow-y-auto" />
        {isStreaming ? (
          <button onClick={onStop} title="Stop" aria-label="Stop" className="p-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors shrink-0"><Square size={14} fill="currentColor" /></button>
        ) : (
          <button onClick={handleSend} disabled={!canSend} title="Send" aria-label="Send" className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0">
            {isPreparing ? <span className="w-[14px] h-[14px] border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : <Send size={14} />}
          </button>
        )}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <button
          onClick={onTogglePEV}
          title={pevEnabled ? "Plan→Execute→Verify on — click to disable" : "Enable Plan→Execute→Verify mode"}
          aria-label="Toggle Plan-Execute-Verify"
          className={cn(
            "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors",
            pevEnabled
              ? "text-indigo-400 bg-indigo-950/60 border border-indigo-800/50"
              : "text-slate-600 hover:text-slate-400"
          )}
        >
          <ListChecks size={10} />
          PEV
        </button>
        <p className="text-[10px] text-slate-600">{model}</p>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown,text/csv,application/json" onChange={handleFilesChosen} className="hidden" aria-hidden />
    </div>
  );
}

// ── Thread pane ───────────────────────────────────────────────────────────────

interface ThreadPaneProps {
  conversationId: string | null;
  userId: string;
  onFork?: (newConversationId: string) => void;
  onArchived?: () => void;
  mobileHidden?: boolean;
  onBack?: () => void;
}

export function ThreadPane({ conversationId, userId, onFork, onArchived, mobileHidden, onBack }: ThreadPaneProps) {
  const conversation = useConversation(conversationId);
  const project = useProject(conversation?.project_id ?? null);
  const settings = useUserSettings(userId);
  const allSkills = useSkills(userId) ?? [];
  const allTags = useTagList(userId) ?? [];
  const allProjects = useProjects(userId) ?? [];
  const allMcpServers = useMcpServers(userId) ?? [];

  // Auto-discover tools for enabled servers whose tools_cache is still empty.
  // Runs whenever allMcpServers changes; stops triggering once tools are cached.
  useEffect(() => {
    const stale = allMcpServers.filter((s) => s.enabled && s.tools_cache.length === 0);
    stale.forEach((s) => refreshMcpTools(s.id).catch(() => {}));
  }, [allMcpServers]);

  const dailySpend = useDailySpendUsd(userId);
  const monthlySpend = useMonthlySpendUsd(userId);
  const model = project?.default_model ?? conversation?.model ?? settings?.default_model ?? DEFAULT_MODEL_ID;

  // Resolve which skills are active for this conversation
  const pinnedSkillIds = conversation?.pinned_skills ?? [];
  const excludedSkillIds = conversation?.excluded_skills ?? [];
  const activeSkillBodies = allSkills
    .filter((s) => {
      if (excludedSkillIds.includes(s.id)) return false;
      return s.enabled || pinnedSkillIds.includes(s.id);
    })
    .map((s) => s.body);

  // Resolve which MCP servers are active for this conversation
  const activeMcpServers: McpServerConfig[] = useMemo(() => {
    const pinned = conversation?.pinned_mcp_servers ?? [];
    const excluded = conversation?.excluded_mcp_servers ?? [];
    return allMcpServers
      .filter((s) => {
        if (excluded.includes(s.id)) return false;
        return s.enabled || pinned.includes(s.id);
      })
      .map((s) => ({
        name: s.name,
        url: s.url,
        authToken: s.encrypted_token ?? undefined,
        tools: s.tools_cache.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMcpServers, conversation?.pinned_mcp_servers, conversation?.excluded_mcp_servers]);

  const systemPrompt = buildSystemPrompt(
    settings?.custom_instructions,
    project?.system_prompt,
    conversation?.system_prompt,
    activeSkillBodies,
    project?.project_context
  );

  const cappedReason = useMemo(() => {
    if (!settings) return null;
    if (
      settings.per_conversation_cap_usd != null &&
      (conversation?.total_cost_usd ?? 0) >= settings.per_conversation_cap_usd
    ) {
      return `Per-conversation limit of ${formatCost(settings.per_conversation_cap_usd)} reached. Start a new conversation to continue.`;
    }
    if (
      settings.daily_cost_cap_usd != null &&
      dailySpend != null &&
      dailySpend >= settings.daily_cost_cap_usd
    ) {
      return `Daily spending limit of ${formatCost(settings.daily_cost_cap_usd)} reached. Resets tomorrow.`;
    }
    if (
      settings.monthly_cost_cap_usd != null &&
      monthlySpend != null &&
      monthlySpend >= settings.monthly_cost_cap_usd
    ) {
      return `Monthly spending limit of ${formatCost(settings.monthly_cost_cap_usd)} reached. Resets next month.`;
    }
    return null;
  }, [settings, conversation?.total_cost_usd, dailySpend, monthlySpend]);

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [pendingSend, setPendingSend] = useState<{ text: string; history: LocalMessage[]; attachments: PreparedAttachment[] } | null>(null);
  const [rateLimitState, setRateLimitState] = useState<{
    retryAfterMs: number;
    attempt: number;
    maxAttempts: number;
  } | null>(null);
  const [webSearchOn, setWebSearchOn] = useState(false);
  const [pevEnabled, setPevEnabled] = useState(false);
  const contextTokensUsed = conversation?.context_tokens_used ?? 0;

  // Sync initial web search state from user settings
  const webSearchSupported = !!(getModel(model)?.supportsWebSearch);
  useEffect(() => {
    if (settings !== undefined) {
      setWebSearchOn(settings.web_search_enabled && webSearchSupported);
    }
  }, [settings, webSearchSupported]);
  const streamHandleRef = useRef<StreamHandle | null>(null);
  const autoCompactRef = useRef(false);
  const msgRef = useRef(messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef(conversationId);

  msgRef.current = messages;

  // Load messages when conversation changes
  useEffect(() => {
    activeConvRef.current = conversationId;
    if (!conversationId) { setMessages([]); return; }
    setLoadingMessages(true);
    loadMessages(conversationId)
      .then((dbMsgs) => {
        if (activeConvRef.current !== conversationId) return; // stale
        setMessages(dbMsgs.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: messageTextContent(m),
          usage: m.usage
            ? { inputTokens: m.usage.input_tokens, outputTokens: m.usage.output_tokens, costUsd: m.usage.cost_usd }
            : undefined,
        })));
      })
      .finally(() => setLoadingMessages(false));
    // Stop any in-progress stream
    streamHandleRef.current?.abort();
    streamHandleRef.current = null;
    setIsStreaming(false);
    setEditingId(null);
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendCore = useCallback(
    async (text: string, history: LocalMessage[], attachments: PreparedAttachment[] = []) => {
      if (!conversationId || !userId) return;
      if (!getCachedApiKey()) {
        setPendingSend({ text, history, attachments });
        setShowVaultUnlock(true);
        return;
      }

      const userMsgId = await saveMessage(userId, conversationId, "user", text);
      const assistantId = crypto.randomUUID(); // temp ID for streaming state

      const userMsg: LocalMessage = { id: userMsgId, role: "user", content: text, preparedAttachments: attachments.length ? attachments : undefined };
      const assistantMsg: LocalMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true, model };

      setMessages([...history, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Update conversation title from first user message
      if (history.length === 0 && !conversation?.title) {
        updateConversation(conversationId, { title: text.slice(0, 80) });
      }

      const apiHistory: AnthropicMessage[] = history.map((m) => ({
        role: m.role,
        content: m.preparedAttachments?.length ? buildMessageContent(m.content, m.preparedAttachments) : m.content,
      }));
      apiHistory.push({ role: "user", content: attachments.length ? buildMessageContent(text, attachments) : text });

      let finalContent = "";
      // Tracks which PEV phase is currently streaming so onChunk routes correctly
      let currentPhase: "plan" | "execute" | "verify" = "execute";

      const handle = streamMessage(
        apiHistory,
        model,
        {
          onPhase: (phase) => {
            currentPhase = phase;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, currentStreamPhase: phase } : m)
            );
          },
          onToolUse: (name, serverName) => {
            if (name === "web_search") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, isSearching: true } : m)
              );
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name, serverName }] }
                    : m
                )
              );
            }
          },
          onToolResult: (name, result, isError) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const toolCalls = [...(m.toolCalls ?? [])];
                const idx = toolCalls.findIndex((tc) => tc.name === name && tc.result === undefined);
                if (idx === -1) return m;
                toolCalls[idx] = { ...toolCalls[idx], result, isError };
                return { ...m, toolCalls };
              })
            );
          },
          onChunk: (chunk) => {
            if (currentPhase === "plan") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, plan: (m.plan ?? "") + chunk } : m)
              );
            } else if (currentPhase === "verify") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, verification: (m.verification ?? "") + chunk } : m)
              );
            } else {
              finalContent += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk, isSearching: false } : m
                )
              );
            }
          },
          onRoundRequest: (round, payload) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const rounds = [...(m.debugRounds ?? [])];
                const idx = rounds.findIndex((r) => r.round === round);
                if (idx >= 0) {
                  rounds[idx] = { ...rounds[idx], request: payload };
                } else {
                  rounds.push({ round, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, costUsd: 0, request: payload });
                }
                return { ...m, debugRounds: rounds };
              })
            );
          },
          onRoundResponse: (round, content, stopReason) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const rounds = [...(m.debugRounds ?? [])];
                const idx = rounds.findIndex((r) => r.round === round);
                if (idx >= 0) {
                  rounds[idx] = { ...rounds[idx], response: { content, stop_reason: stopReason } };
                }
                return { ...m, debugRounds: rounds };
              })
            );
          },
          onUsageDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const rounds = [...(m.debugRounds ?? [])];
                const idx = rounds.findIndex((r) => r.round === delta.round);
                const patch = {
                  round: delta.round,
                  inputTokens: delta.inputTokens,
                  outputTokens: delta.outputTokens,
                  cacheCreationTokens: delta.cacheCreationTokens ?? 0,
                  cacheReadTokens: delta.cacheReadTokens ?? 0,
                  costUsd: delta.costUsd,
                };
                if (idx >= 0) {
                  rounds[idx] = { ...rounds[idx], ...patch };
                } else {
                  rounds.push(patch);
                }
                return { ...m, debugRounds: rounds };
              })
            );
          },
          onRateLimited: (retryAfterMs, attempt, maxAttempts) => {
            setRateLimitState({ retryAfterMs, attempt, maxAttempts });
          },
          onRetrying: () => {
            setRateLimitState(null);
          },
          onDone: async (usage) => {
            setRateLimitState(null);
            // Persist execute content only (plan/verify are ephemeral display)
            const dbUsage = { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, cost_usd: usage.costUsd };
            const persistedId = await saveMessage(userId, conversationId, "assistant", finalContent, dbUsage, model);
            // Update conversation cost totals and context usage
            updateConversation(conversationId, {
              total_input_tokens: (conversation?.total_input_tokens ?? 0) + usage.inputTokens,
              total_output_tokens: (conversation?.total_output_tokens ?? 0) + usage.outputTokens,
              total_cost_usd: (conversation?.total_cost_usd ?? 0) + usage.costUsd,
              context_tokens_used: usage.inputTokens,
            });
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, id: persistedId, usage, isStreaming: false, currentStreamPhase: undefined }
                : m
            ));
            setIsStreaming(false);
            streamHandleRef.current = null;
            // Flag auto-compact if context is ≥ 85% full
            const contextLimit = getModel(model)?.contextWindow ?? 200_000;
            if (usage.inputTokens / contextLimit >= 0.85) {
              autoCompactRef.current = true;
            }
            // Fire-and-forget: append conversation summary to project context
            if (conversation?.project_id) {
              const apiKey = getCachedApiKey();
              if (apiKey) {
                appendConversationSummary(conversation.project_id, conversationId, apiKey, model).catch(() => {});
              }
            }
          },
          onError: (message) => {
            setRateLimitState(null);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, error: message, content: "", isStreaming: false, currentStreamPhase: undefined }
                : m
            ));
            setIsStreaming(false);
            streamHandleRef.current = null;
          },
        },
        systemPrompt,
        undefined,
        webSearchOn,
        activeMcpServers.length > 0 ? activeMcpServers : undefined,
        pevEnabled
      );

      streamHandleRef.current = handle;
    },
    [conversationId, userId, model, conversation, systemPrompt, webSearchOn, activeMcpServers, pevEnabled]
  );

  const handleSend = useCallback(
    (text: string, attachments: PreparedAttachment[]) => sendCore(text, msgRef.current, attachments),
    [sendCore]
  );

  const handleStop = useCallback(() => {
    streamHandleRef.current?.abort();
    streamHandleRef.current = null;
    setIsStreaming(false);
    setRateLimitState(null);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.content && !last.error) return prev.slice(0, -1);
      return prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m);
    });
  }, []);

  const handleRegenerate = useCallback(() => {
    const msgs = msgRef.current;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === "user") { lastUserIdx = i; break; } }
    if (lastUserIdx === -1) return;
    const m = msgs[lastUserIdx];
    sendCore(m.content, msgs.slice(0, lastUserIdx), m.preparedAttachments ?? []);
  }, [sendCore]);

  const handleEditSave = useCallback((msgId: string, newContent: string) => {
    const msgs = msgRef.current;
    const idx = msgs.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    setEditingId(null);
    sendCore(newContent, msgs.slice(0, idx));
  }, [sendCore]);

  const handleDelete = useCallback((msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, []);

  const handleCopy = useCallback((text: string) => navigator.clipboard.writeText(text).catch(() => {}), []);

  const handleCompact = useCallback(async () => {
    if (!conversationId || !userId || isCompacting || isStreaming) return;
    setIsCompacting(true);
    try {
      const apiHistory: AnthropicMessage[] = msgRef.current.map((m) => ({
        role: m.role,
        content: m.preparedAttachments?.length
          ? buildMessageContent(m.content, m.preparedAttachments)
          : m.content,
      }));
      const summary = await summarizeMessages(apiHistory, model);
      if (!summary) throw new Error("Empty summary returned");
      await deleteAllMessages(conversationId);
      const summaryMsgId = await saveMessage(
        userId,
        conversationId,
        "assistant",
        `**[Conversation compacted]**\n\n${summary}`
      );
      await updateConversation(conversationId, { context_tokens_used: 0 });
      setMessages([
        {
          id: summaryMsgId,
          role: "assistant",
          content: `**[Conversation compacted]**\n\n${summary}`,
        },
      ]);
    } catch (err) {
      console.error("Compact failed:", err);
    } finally {
      setIsCompacting(false);
    }
  }, [conversationId, userId, model, isCompacting, isStreaming]);

  // Auto-compact when context usage hits 85% — flag is set in onDone, triggered after stream ends
  useEffect(() => {
    if (!isStreaming && autoCompactRef.current) {
      autoCompactRef.current = false;
      handleCompact();
    }
  }, [isStreaming, handleCompact]);

  const handleFork = useCallback(async (msgId: string) => {
    if (!conversationId || !userId) return;
    const msgs = msgRef.current;
    const idx = msgs.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const msgsToClone = msgs.slice(0, idx + 1);

    // Load full DB messages for these IDs so we have complete content
    const dbMsgs = await loadMessages(conversationId);
    const dbMsgMap = new Map(dbMsgs.map((m) => [m.id, m]));
    const dbMsgsToClone = msgsToClone
      .map((m) => dbMsgMap.get(m.id))
      .filter((m): m is NonNullable<typeof m> => m != null);

    const newConvId = await createConversation(userId, model, {
      forked_from: conversationId,
      project_id: conversation?.project_id ?? undefined,
    });
    await cloneMessages(dbMsgsToClone, newConvId, userId);
    // Set a title on the fork
    await updateConversation(newConvId, {
      title: `Fork: ${conversation?.title ?? "Untitled"}`,
      system_prompt: conversation?.system_prompt ?? null,
    });
    onFork?.(newConvId);
  }, [conversationId, userId, model, conversation, onFork]);

  // ── Derived values (must stay before early returns — Rules of Hooks) ──────────

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id ?? null;
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user")?.content,
    [messages]
  );
  const pinnedMcpIds = conversation?.pinned_mcp_servers ?? [];
  const excludedMcpIds = conversation?.excluded_mcp_servers ?? [];

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!conversationId) {
    return (
      <div className={cn("flex flex-col flex-1 overflow-hidden", mobileHidden && "hidden md:flex")}>
        <ThreadEmptyState />
      </div>
    );
  }

  if (loadingMessages) {
    return (
      <div className={cn("flex flex-col flex-1 overflow-hidden", mobileHidden && "hidden md:flex")}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-700 shrink-0 animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-48" />
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto px-6 py-5 gap-5">
          <MessageSkeleton align="left" />
          <MessageSkeleton align="right" />
          <MessageSkeleton align="left" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-row flex-1 overflow-hidden", mobileHidden && "hidden md:flex")}>
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <p className="text-sm font-medium text-slate-200 truncate flex-1">
          {conversation?.title ?? "New conversation"}
        </p>
        {conversationId && (
          <ModelPicker conversationId={conversationId} currentModel={model} />
        )}
        {conversationId && (
          <SkillsPanel
            conversationId={conversationId}
            allSkills={allSkills}
            pinnedSkillIds={pinnedSkillIds}
            excludedSkillIds={excludedSkillIds}
          />
        )}
        {conversationId && (
          <McpPanel
            conversationId={conversationId}
            allServers={allMcpServers}
            pinnedMcpIds={pinnedMcpIds}
            excludedMcpIds={excludedMcpIds}
          />
        )}
        {conversation && <ExportMenu conversation={conversation} />}
        {webSearchSupported && (
          <button
            onClick={() => setWebSearchOn((v) => !v)}
            title={webSearchOn ? "Web search on — click to disable" : "Enable web search"}
            aria-label="Toggle web search"
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors shrink-0",
              webSearchOn
                ? "text-sky-400 bg-slate-700 hover:bg-slate-600"
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
            )}
          >
            <Globe size={13} />
            {webSearchOn && <span className="hidden sm:inline">Web</span>}
          </button>
        )}
      </div>
      <InstructionsPanel
        conversationId={conversationId}
        userId={userId}
        globalInstructions={settings?.custom_instructions}
        project={project}
        conversationInstructions={conversation?.system_prompt}
      />
      <ContextBar
        tokensUsed={contextTokensUsed}
        model={model}
        isCompacting={isCompacting}
        onCompact={handleCompact}
      />
      {rateLimitState && (
        <RateLimitBanner
          retryAfterMs={rateLimitState.retryAfterMs}
          attempt={rateLimitState.attempt}
          maxAttempts={rateLimitState.maxAttempts}
          onCancel={handleStop}
        />
      )}

      <div ref={scrollRef} className="flex flex-col flex-1 overflow-y-auto px-6 py-5 gap-5">
        {messages.length === 0 ? (
          <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
            <p className="text-sm text-slate-400">What would you like to ask?</p>
            <p className="text-xs text-slate-600">⌘↵ or Ctrl↵ to send</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isStreaming={isStreaming}
              isLastAssistant={msg.id === lastAssistantId}
              editingId={editingId}
              debugMode={settings?.debug_mode === true}
              onCopy={handleCopy}
              onEditStart={(id) => setEditingId(id)}
              onEditSave={handleEditSave}
              onEditCancel={() => setEditingId(null)}
              onRegenerate={handleRegenerate}
              onDelete={handleDelete}
              onFork={handleFork}
            />
          ))
        )}
      </div>

      {cappedReason ? (
        <div className="px-4 py-3 border-t border-slate-700 shrink-0 flex items-center justify-center gap-2">
          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 text-center">{cappedReason}</p>
        </div>
      ) : (
        <ComposeBar isStreaming={isStreaming} model={model} lastUserMessage={lastUserMessage} pevEnabled={pevEnabled} onTogglePEV={() => setPevEnabled((v) => !v)} onSend={handleSend} onStop={handleStop} />
      )}
    </div>
    {showVaultUnlock && (
      <VaultUnlockModal
        onUnlocked={() => {
          setShowVaultUnlock(false);
          if (pendingSend) {
            const { text, history, attachments } = pendingSend;
            setPendingSend(null);
            sendCore(text, history, attachments);
          }
        }}
        onCancel={() => { setShowVaultUnlock(false); setPendingSend(null); }}
      />
    )}
    {conversation && (
      <ConversationActionsPanel
        conversation={conversation}
        userId={userId}
        allTags={allTags}
        allProjects={allProjects}
        onDeleted={() => { /* parent handles clearing via useConversation going undefined */ }}
        onArchived={onArchived}
      />
    )}
    </div>
  );
}
