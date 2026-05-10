"use client";

import { useState, useEffect, useRef } from "react";
import { X, Link, ShieldCheck, Key, Sparkles, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { McpServer } from "@/lib/claude-inbox/sync/types";
import type { DiscoverResult } from "@/app/api/claude-inbox/mcp-discover/route";

interface McpServerFormProps {
  initial?: McpServer;
  onSave: (data: {
    name: string;
    url: string;
    transport: McpServer["transport"];
    auth_type: McpServer["auth_type"];
    bearer_token?: string;
    oauth_metadata?: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
}

export function McpServerForm({ initial, onSave, onCancel }: McpServerFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [transport, setTransport] = useState<McpServer["transport"]>(initial?.transport ?? "http");
  const [authType, setAuthType] = useState<McpServer["auth_type"]>(initial?.auth_type ?? "bearer");
  const [bearerToken, setBearerToken] = useState(initial?.encrypted_token ?? "");

  // OAuth fields
  const [clientId, setClientId] = useState((initial?.oauth_metadata?.client_id as string) ?? "");
  const [authUrl, setAuthUrl] = useState((initial?.oauth_metadata?.authorization_url as string) ?? "");
  const [tokenUrl, setTokenUrl] = useState((initial?.oauth_metadata?.token_url as string) ?? "");
  const [scope, setScope] = useState((initial?.oauth_metadata?.scope as string) ?? "");

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [scopeOptions, setScopeOptions] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  // If editing an existing server that already has oauth metadata, show as discovered
  useEffect(() => {
    if (initial?.oauth_metadata?.authorization_url) {
      setDiscovered(true);
    }
  }, [initial]);

  const canSave = name.trim().length > 0 && url.trim().length > 0 &&
    (authType !== "oauth" || (authUrl.trim().length > 0 && tokenUrl.trim().length > 0 && clientId.trim().length > 0));

  async function handleDiscover() {
    if (!url.trim()) { setDiscoverError("Enter the server URL first."); return; }
    setDiscovering(true);
    setDiscoverError(null);
    setDiscovered(false);
    try {
      const redirectUri = `${window.location.origin}/claude-inbox/mcp/callback`;
      const res = await fetch("/api/claude-inbox/mcp-discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: url.trim(), redirectUri }),
      });
      const data = await res.json() as DiscoverResult & { error?: string };
      if (!res.ok) { setDiscoverError(data.error ?? "Discovery failed."); return; }

      setAuthUrl(data.authorization_url);
      setTokenUrl(data.token_url);
      if (data.client_id) setClientId(data.client_id);
      if (data.scopes_supported.length > 0) {
        setScopeOptions(data.scopes_supported);
        // Auto-select common scopes
        const common = data.scopes_supported.filter((s) => ["openid", "profile", "email"].includes(s));
        if (!scope && common.length > 0) setScope(common.join(" "));
      }
      setDiscovered(true);
      setShowManual(false);
    } catch {
      setDiscoverError("Could not reach the server. Check the URL and try again.");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      url: url.trim(),
      transport,
      auth_type: authType,
      bearer_token: authType === "bearer" ? bearerToken.trim() || undefined : undefined,
      oauth_metadata: authType === "oauth"
        ? { client_id: clientId.trim(), authorization_url: authUrl.trim(), token_url: tokenUrl.trim(), scope: scope.trim() }
        : undefined,
    });
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg mx-4 flex flex-col shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">
            {initial ? "Edit MCP server" : "Add MCP server"}
          </h2>
          <button onClick={onCancel} aria-label="Close" className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Server name</label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="My MCP server"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors" />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><Link size={11} />Server URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono" />
          </div>

          {/* Transport */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Transport</label>
            <div className="flex gap-2">
              {(["http", "sse"] as McpServer["transport"][]).map((t) => (
                <button key={t} onClick={() => setTransport(t)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${transport === t ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Auth type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Authentication</label>
            <div className="flex gap-2">
              {(["bearer", "oauth"] as McpServer["auth_type"][]).map((a) => (
                <button key={a} onClick={() => setAuthType(a)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${authType === a ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
                  {a === "bearer" ? "Bearer token" : "OAuth 2.1 PKCE"}
                </button>
              ))}
            </div>
          </div>

          {/* Bearer token */}
          {authType === "bearer" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5"><Key size={11} />Bearer token</label>
              <input value={bearerToken} onChange={(e) => setBearerToken(e.target.value)} type="password" placeholder="sk-…"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono" />
            </div>
          )}

          {/* OAuth */}
          {authType === "oauth" && (
            <div className="flex flex-col gap-3 p-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">

              {/* Discovery button */}
              {!discovered ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-indigo-400" />
                    OAuth 2.1 PKCE — compliant servers configure themselves automatically.
                  </p>
                  <button
                    onClick={handleDiscover}
                    disabled={discovering || !url.trim()}
                    className="flex items-center justify-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors"
                  >
                    {discovering
                      ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Discovering…</>
                      : <><Sparkles size={12} />Auto-discover from server</>}
                  </button>
                  {discoverError && <p className="text-[11px] text-red-400">{discoverError}</p>}

                  {/* Manual fallback toggle */}
                  <button onClick={() => setShowManual((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors self-start">
                    {showManual ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    Enter metadata manually
                  </button>
                  {showManual && <OAuthManualFields {...{ clientId, setClientId, authUrl, setAuthUrl, tokenUrl, setTokenUrl, scope, setScope, scopeOptions }} />}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle size={11} />OAuth metadata discovered
                    </p>
                    <button onClick={() => { setDiscovered(false); setDiscoverError(null); }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                      Re-discover
                    </button>
                  </div>

                  {/* Scope selector — the only field the user might want to adjust */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-slate-500">Scope {scopeOptions.length > 0 && <span className="text-slate-600">(detected {scopeOptions.length} options)</span>}</label>
                    {scopeOptions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {scopeOptions.map((s) => {
                          const active = scope.split(" ").filter(Boolean).includes(s);
                          return (
                            <button key={s} onClick={() => {
                              const parts = scope.split(" ").filter(Boolean);
                              const next = active ? parts.filter((p) => p !== s) : [...parts, s];
                              setScope(next.join(" "));
                            }}
                              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${active ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200"}`}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="openid profile"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono" />
                    )}
                  </div>

                  {/* Show/edit underlying fields */}
                  <button onClick={() => setShowManual((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors self-start">
                    {showManual ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {showManual ? "Hide details" : "View / edit details"}
                  </button>
                  {showManual && <OAuthManualFields {...{ clientId, setClientId, authUrl, setAuthUrl, tokenUrl, setTokenUrl, scope, setScope, scopeOptions: [] }} />}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700 shrink-0">
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!canSave || saving}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors">
            {saving ? "Saving…" : initial ? "Save changes" : "Add server"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OAuthManualFields({ clientId, setClientId, authUrl, setAuthUrl, tokenUrl, setTokenUrl, scope, setScope, scopeOptions }: {
  clientId: string; setClientId: (v: string) => void;
  authUrl: string; setAuthUrl: (v: string) => void;
  tokenUrl: string; setTokenUrl: (v: string) => void;
  scope: string; setScope: (v: string) => void;
  scopeOptions: string[];
}) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {[
        { label: "Client ID", value: clientId, set: setClientId, placeholder: "client_id" },
        { label: "Authorization URL", value: authUrl, set: setAuthUrl, placeholder: "https://…/authorize" },
        { label: "Token URL", value: tokenUrl, set: setTokenUrl, placeholder: "https://…/token" },
      ].map(({ label, value, set, placeholder }) => (
        <div key={label} className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500">{label}</label>
          <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono" />
        </div>
      ))}
      {scopeOptions.length === 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500">Scope</label>
          <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="openid profile"
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors font-mono" />
        </div>
      )}
    </div>
  );
}
