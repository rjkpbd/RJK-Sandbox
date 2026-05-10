"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Download, ExternalLink, Lock, Unlock, Eye, EyeOff, KeyRound, ShieldCheck, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";
import { useUserSettings, updateUserSettings, getOrCreateUserSettings } from "@/lib/claude-inbox/data/user-settings";
import { MODELS, DEFAULT_MODEL_ID } from "@/lib/claude-inbox/config/models";
import { createVault, unlockVault, recoverVault } from "@/lib/claude-inbox/crypto/vault";
import { cacheApiKey, getCachedApiKey, clearCachedApiKey } from "@/lib/claude-inbox/crypto/session";
import { DEFAULT_SHORTCUTS } from "@/components/claude-inbox/keyboard-shortcuts-modal";

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

const SHORTCUTS_STORAGE_KEY = "claude-inbox-shortcut-overrides";

function loadOverrides(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SHORTCUTS_STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("⌘");
  if (e.shiftKey) parts.push("⇧");
  if (e.altKey) parts.push("⌥");
  const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!["Meta", "Control", "Shift", "Alt"].includes(key)) parts.push(key);
  return parts.join("");
}

function KeyboardShortcutsSection() {
  const [overrides, setOverrides] = useState<Record<string, string>>(loadOverrides);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const captureRef = useRef<string | null>(null);
  captureRef.current = capturingId;

  useEffect(() => {
    if (!capturingId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { setCapturingId(null); return; }
      if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) return;
      e.preventDefault();
      const combo = formatKeyEvent(e);
      setOverrides((prev) => {
        const next = { ...prev, [captureRef.current!]: combo };
        localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setCapturingId(null);
    }
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturingId]);

  function resetShortcut(id: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section>
      <SectionHeading>Keyboard shortcuts</SectionHeading>
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 divide-y divide-slate-700/50">
        {DEFAULT_SHORTCUTS.map(({ id, label, key: defaultKey }) => {
          const current = overrides[id] ?? defaultKey;
          const isCapturing = capturingId === id;
          const isOverridden = !!overrides[id];
          return (
            <SettingRow key={id} label={label}>
              <div className="flex items-center gap-2">
                {isCapturing ? (
                  <span className="text-xs text-indigo-400 animate-pulse">Press a key…</span>
                ) : (
                  <kbd className={`text-xs px-2 py-0.5 rounded font-mono border ${isOverridden ? "bg-indigo-900/30 border-indigo-700 text-indigo-300" : "bg-slate-700 border-slate-600 text-slate-400"}`}>
                    {current}
                  </kbd>
                )}
                <button
                  onClick={() => setCapturingId(isCapturing ? null : id)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {isCapturing ? "Cancel" : "Change"}
                </button>
                {isOverridden && !isCapturing && (
                  <button
                    onClick={() => resetShortcut(id)}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </SettingRow>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-600 mt-2">Shortcut overrides are stored locally in this browser.</p>
    </section>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nullableFloat(value: string): number | null {
  const n = parseFloat(value);
  return isNaN(n) || n <= 0 ? null : n;
}

function nullableInt(value: string): number | null {
  const n = parseInt(value, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// ── Layout primitives ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-700/50 last:border-none">
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
        checked ? "bg-indigo-600" : "bg-slate-600"
      )}
    >
      <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-1")} />
    </button>
  );
}

function NumberInput({ value, placeholder, prefix, onBlur }: {
  value: string; placeholder: string; prefix?: string; onBlur: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-xs text-slate-500">{prefix}</span>}
      <input
        type="number" value={local} min={0} placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)} onBlur={() => onBlur(local)}
        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors text-right"
      />
    </div>
  );
}

// ── Vault section ─────────────────────────────────────────────────────────────

type VaultMode = "setup" | "unlock" | "recovery" | "unlocked" | "recovery-phrase";

function VaultSection({
  userId,
  vaultExists,
  onSave,
}: {
  userId: string;
  vaultExists: boolean;
  onSave: (patch: Parameters<typeof updateUserSettings>[1]) => void;
}) {
  const [mode, setMode] = useState<VaultMode>(
    !vaultExists ? "setup" : getCachedApiKey() ? "unlocked" : "unlock"
  );
  const [apiKey, setApiKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-sync if vaultExists changes (e.g. after first save)
  useEffect(() => {
    if (!vaultExists) setMode("setup");
    else if (!getCachedApiKey()) setMode("unlock");
    else setMode("unlocked");
  }, [vaultExists]);

  async function handleSetup() {
    if (!apiKey.trim() || !passphrase) return;
    if (passphrase !== confirmPassphrase) { setError("Passphrases do not match."); return; }
    setError(null); setBusy(true);
    try {
      const { saveData, recoveryPhrase: phrase } = await createVault(apiKey.trim(), passphrase);
      onSave(saveData);
      cacheApiKey(apiKey.trim());
      setRecoveryPhrase(phrase);
      setMode("recovery-phrase");
      setApiKey(""); setPassphrase(""); setConfirmPassphrase("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create vault.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(settings: NonNullable<ReturnType<typeof useUserSettings>>) {
    if (!passphrase) return;
    setError(null); setBusy(true);
    try {
      const { apiKey: key } = await unlockVault(
        settings.encrypted_api_key!,
        settings.kdf_salt!,
        settings.kdf_iterations,
        passphrase
      );
      cacheApiKey(key);
      setPassphrase("");
      setMode("unlocked");
    } catch {
      setError("Wrong passphrase.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecover(settings: NonNullable<ReturnType<typeof useUserSettings>>) {
    if (!recoveryInput.trim()) return;
    setError(null); setBusy(true);
    try {
      const { apiKey: key } = await recoverVault(
        settings.encrypted_api_key!,
        settings.kdf_salt!,
        settings.recovery_key_wrap!,
        recoveryInput.trim()
      );
      cacheApiKey(key);
      setRecoveryInput("");
      setMode("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed.");
    } finally {
      setBusy(false);
    }
  }

  // Unlocked state
  if (mode === "unlocked") {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Unlock size={13} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-200">API key loaded</p>
            <p className="text-xs text-slate-500">Cleared on page refresh.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { clearCachedApiKey(); setMode("unlock"); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Lock size={11} /> Lock
          </button>
          <button
            onClick={() => { clearCachedApiKey(); setMode("setup"); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            Change key
          </button>
        </div>
      </div>
    );
  }

  // Recovery phrase acknowledgement
  if (mode === "recovery-phrase") {
    return (
      <div className="flex flex-col gap-3 py-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck size={14} />
          <p className="text-sm font-medium">Vault created — save your recovery phrase</p>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          This 12-word phrase lets you recover your API key if you forget your passphrase.
          Write it down and store it somewhere safe. <span className="text-amber-400">It won&apos;t be shown again.</span>
        </p>
        <div className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 font-mono text-sm text-slate-200 leading-relaxed select-all">
          {recoveryPhrase}
        </div>
        <button
          onClick={() => { setRecoveryPhrase(""); setMode("unlocked"); }}
          className="self-end text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          I&apos;ve saved my recovery phrase
        </button>
      </div>
    );
  }

  // Setup / unlock / recovery forms
  return (
    <div className="flex flex-col gap-3 py-3">
      {mode === "setup" && (
        <>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your key is encrypted locally with a passphrase — never sent to any server except Anthropic.
          </p>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-api03-…"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 pr-9 text-xs text-slate-100 placeholder:text-slate-600 font-mono outline-none focus:border-indigo-500 transition-colors"
              />
              <button onClick={() => setShowKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <input
              type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Vault passphrase"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
            <input
              type="password" value={confirmPassphrase} onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Confirm passphrase"
              onKeyDown={(e) => e.key === "Enter" && handleSetup()}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </>
      )}

      {mode === "unlock" && (
        <UnlockForm
          passphrase={passphrase}
          setPassphrase={setPassphrase}
          onUnlock={handleUnlock}
          onRecovery={() => { setPassphrase(""); setError(null); setMode("recovery"); }}
          busy={busy}
        />
      )}

      {mode === "recovery" && (
        <RecoveryForm
          value={recoveryInput}
          onChange={setRecoveryInput}
          onRecover={handleRecover}
          onBack={() => { setRecoveryInput(""); setError(null); setMode("unlock"); }}
          busy={busy}
        />
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {(mode === "setup") && (
        <button
          onClick={handleSetup}
          disabled={busy || !apiKey.trim() || !passphrase || passphrase !== confirmPassphrase}
          className="self-end text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          {busy && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          <KeyRound size={11} />
          Set up vault
        </button>
      )}
    </div>
  );
}

function UnlockForm({ passphrase, setPassphrase, onUnlock, onRecovery, busy }: {
  passphrase: string;
  setPassphrase: (v: string) => void;
  onUnlock: (s: NonNullable<ReturnType<typeof useUserSettings>>) => void;
  onRecovery: () => void;
  busy: boolean;
}) {
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);
  return (
    <div className="flex flex-col gap-2">
      <input
        type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
        placeholder="Vault passphrase"
        onKeyDown={(e) => e.key === "Enter" && settings && onUnlock(settings)}
        autoFocus
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
      />
      <div className="flex items-center justify-between">
        <button onClick={onRecovery} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          Use recovery phrase
        </button>
        <button
          onClick={() => settings && onUnlock(settings)}
          disabled={busy || !passphrase}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          {busy && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          <Unlock size={11} /> Unlock
        </button>
      </div>
    </div>
  );
}

function RecoveryForm({ value, onChange, onRecover, onBack, busy }: {
  value: string;
  onChange: (v: string) => void;
  onRecover: (s: NonNullable<ReturnType<typeof useUserSettings>>) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">Enter your 12-word recovery phrase.</p>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="word1 word2 word3 … word12"
        rows={2}
        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 font-mono outline-none focus:border-indigo-500 transition-colors resize-none"
      />
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Back
        </button>
        <button
          onClick={() => settings && onRecover(settings)}
          disabled={busy || !value.trim()}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          {busy && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
          Recover
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);

  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL_ID);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [webSearchMax, setWebSearchMax] = useState("3");
  const [dailyCap, setDailyCap] = useState("");
  const [monthlyCap, setMonthlyCap] = useState("");
  const [convCap, setConvCap] = useState("");
  const [autoArchiveDays, setAutoArchiveDays] = useState("");
  const [auditRetention, setAuditRetention] = useState("30");
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    getOrCreateUserSettings(userId).catch(() => {});
  }, [userId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.push("/claude-inbox/inbox");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    if (!settings) return;
    setDefaultModel(settings.default_model ?? DEFAULT_MODEL_ID);
    setWebSearchEnabled(settings.web_search_enabled);
    setWebSearchMax(String(settings.web_search_max_per_turn ?? 3));
    setDailyCap(settings.daily_cost_cap_usd != null ? String(settings.daily_cost_cap_usd) : "");
    setMonthlyCap(settings.monthly_cost_cap_usd != null ? String(settings.monthly_cost_cap_usd) : "");
    setConvCap(settings.per_conversation_cap_usd != null ? String(settings.per_conversation_cap_usd) : "");
    setAutoArchiveDays(settings.auto_archive_days != null ? String(settings.auto_archive_days) : "");
    setAuditRetention(String(settings.mcp_audit_retention_days ?? 30));
    setDebugMode(settings.debug_mode ?? false);
  }, [settings]);

  const save = useCallback(
    (patch: Parameters<typeof updateUserSettings>[1]) => updateUserSettings(userId, patch),
    [userId]
  );

  if (!settings) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
        <div className="flex items-center px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="h-5 w-32 bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="flex-1 px-6 py-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-semibold text-white">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Preferences and limits for Claude Inbox.</p>
        </div>
        <button
          onClick={() => router.push("/claude-inbox/inbox")}
          aria-label="Close settings"
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-xl flex flex-col gap-8">

        {/* ── API Key ───────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>API Key</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <VaultSection
              userId={userId}
              vaultExists={!!settings.encrypted_api_key}
              onSave={save}
            />
          </div>
        </section>

        {/* ── Chat defaults ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Chat defaults</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 divide-y divide-slate-700/50">
            <SettingRow label="Default model" description="Used for new conversations without a project override.">
              <select
                value={defaultModel}
                onChange={(e) => { setDefaultModel(e.target.value); save({ default_model: e.target.value }); }}
                className="bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
              >
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
              </select>
            </SettingRow>
            <SettingRow label="Web search enabled by default" description="Can be toggled per-conversation in the thread header.">
              <Toggle checked={webSearchEnabled} onChange={(v) => { setWebSearchEnabled(v); save({ web_search_enabled: v }); }} />
            </SettingRow>
            <SettingRow label="Max web searches per turn" description="Limits how many searches Claude can run in one response.">
              <NumberInput value={webSearchMax} placeholder="3" onBlur={(v) => { setWebSearchMax(v); const n = parseInt(v, 10); save({ web_search_max_per_turn: isNaN(n) || n < 1 ? 3 : n }); }} />
            </SettingRow>
          </div>
        </section>

        {/* ── Cost controls ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Cost controls</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 divide-y divide-slate-700/50">
            <SettingRow label="Daily spending limit" description="Blocks new messages once this amount is spent today. Leave blank for unlimited.">
              <NumberInput value={dailyCap} placeholder="unlimited" prefix="$" onBlur={(v) => { setDailyCap(v); save({ daily_cost_cap_usd: nullableFloat(v) }); }} />
            </SettingRow>
            <SettingRow label="Monthly spending limit" description="Resets on the 1st of each month. Leave blank for unlimited.">
              <NumberInput value={monthlyCap} placeholder="unlimited" prefix="$" onBlur={(v) => { setMonthlyCap(v); save({ monthly_cost_cap_usd: nullableFloat(v) }); }} />
            </SettingRow>
            <SettingRow label="Per-conversation limit" description="Disables the compose bar once a conversation exceeds this cost.">
              <NumberInput value={convCap} placeholder="unlimited" prefix="$" onBlur={(v) => { setConvCap(v); save({ per_conversation_cap_usd: nullableFloat(v) }); }} />
            </SettingRow>
          </div>
        </section>

        {/* ── Conversation management ───────────────────────────────────────── */}
        <section>
          <SectionHeading>Conversation management</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <SettingRow label="Auto-archive after" description="Inbox conversations not updated in this many days are automatically archived. Pinned conversations are never archived. Leave blank to disable.">
              <NumberInput value={autoArchiveDays} placeholder="disabled" onBlur={(v) => { setAutoArchiveDays(v); save({ auto_archive_days: nullableInt(v) }); }} />
            </SettingRow>
          </div>
        </section>

        {/* ── MCP ───────────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>MCP</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <SettingRow label="Audit log retention" description="Number of days to keep tool invocation records.">
              <NumberInput value={auditRetention} placeholder="30" onBlur={(v) => { setAuditRetention(v); const n = parseInt(v, 10); save({ mcp_audit_retention_days: isNaN(n) || n < 1 ? 30 : n }); }} />
            </SettingRow>
          </div>
        </section>

        {/* ── Keyboard shortcuts ───────────────────────────────────────────── */}
        <KeyboardShortcutsSection />

        {/* ── Developer ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Developer</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <SettingRow
              label="Debug mode"
              description="Shows per-round API call details (tokens, cost, cache usage) below each assistant response."
            >
              <Toggle
                checked={debugMode}
                onChange={(v) => { setDebugMode(v); save({ debug_mode: v }); }}
              />
            </SettingRow>
          </div>
        </section>

        {/* ── Data & export ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Data &amp; export</SectionHeading>
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-4">
            <SettingRow label="Export all data" description="Download conversations, messages, skills, and templates as JSON.">
              <Link href="/claude-inbox/export" className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                <Download size={12} /> Export <ExternalLink size={10} className="text-slate-500" />
              </Link>
            </SettingRow>
          </div>
        </section>

      </div>
    </div>
  );
}
