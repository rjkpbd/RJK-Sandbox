"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, CheckCircle2, XCircle, HelpCircle, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MCPServer {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  server_type: string;
  url: string | null;
  bearer_token: string | null;
  credentials: Record<string, string>;
  enabled: boolean;
  last_health_check: string | null;
  last_health_status: "healthy" | "unhealthy" | null;
  created_at: string;
}

// Known credential field labels per server type
const CREDENTIAL_FIELDS: Record<string, Array<{ key: string; label: string; secret?: boolean }>> = {
  cin7: [
    { key: "cin7_account_id", label: "Account ID" },
    { key: "cin7_app_key", label: "App Key", secret: true },
  ],
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, checking }: { status: "healthy" | "unhealthy" | null; checking?: boolean }) {
  if (checking) return <Loader2 size={14} className="animate-spin text-slate-400" />;
  if (status === "healthy") return <CheckCircle2 size={15} className="text-emerald-400" />;
  if (status === "unhealthy") return <XCircle size={15} className="text-red-400" />;
  return <HelpCircle size={15} className="text-slate-500" />;
}

// ─── Secret field ─────────────────────────────────────────────────────────────

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 pr-9 font-mono"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Inline input ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${mono ? "font-mono" : ""}`}
    />
  );
}

// ─── Server row ───────────────────────────────────────────────────────────────

function ServerRow({
  server,
  onSave,
  onDelete,
  onHealthCheck,
}: {
  server: MCPServer;
  onSave: (id: string, patch: Partial<MCPServer>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onHealthCheck: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [displayName, setDisplayName] = useState(server.display_name);
  const [description, setDescription] = useState(server.description ?? "");
  const [url, setUrl] = useState(server.url ?? "");
  const [bearerToken, setBearerToken] = useState(server.bearer_token ?? "");
  const [credentials, setCredentials] = useState<Record<string, string>>(server.credentials ?? {});

  const knownFields = CREDENTIAL_FIELDS[server.server_type] ?? [];
  const knownKeys = new Set(knownFields.map((f) => f.key));
  const extraEntries = Object.entries(credentials).filter(([k]) => !knownKeys.has(k));
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  async function handleSave() {
    setSaving(true);
    await onSave(server.id, {
      display_name: displayName,
      description: description || null,
      url: url || null,
      bearer_token: bearerToken || null,
      credentials,
    });
    setSaving(false);
  }

  async function handleHealthCheck() {
    setChecking(true);
    await onHealthCheck(server.id);
    setChecking(false);
  }

  async function handleDelete() {
    if (!confirm(`Remove "${server.display_name}"?`)) return;
    setDeleting(true);
    await onDelete(server.id);
  }

  function setCredField(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  function addExtraField() {
    if (!newKey.trim()) return;
    setCredField(newKey.trim(), newVal);
    setNewKey("");
    setNewVal("");
  }

  function removeExtraField(key: string) {
    setCredentials((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const timeAgo = server.last_health_check
    ? new Date(server.last_health_check).toLocaleString()
    : null;

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800">
        <StatusBadge status={server.last_health_status} checking={checking} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{server.display_name}</span>
            <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded font-mono">{server.name}</span>
            {!server.enabled && (
              <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-500 rounded">disabled</span>
            )}
          </div>
          {server.url ? (
            <p className="text-xs text-slate-500 truncate mt-0.5">{server.url}</p>
          ) : (
            <p className="text-xs text-slate-600 mt-0.5 italic">No URL configured</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {timeAgo && (
            <span className="text-xs text-slate-600 hidden sm:block" title={timeAgo}>
              checked {timeAgo}
            </span>
          )}
          <button
            onClick={handleHealthCheck}
            disabled={checking || !server.url}
            title="Test connection"
            className="p-1.5 text-slate-500 hover:text-slate-200 disabled:opacity-30 transition-colors"
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => onSave(server.id, { enabled: !server.enabled })}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              server.enabled
                ? "border-slate-600 text-slate-400 hover:border-slate-400"
                : "border-indigo-700 text-indigo-400 hover:border-indigo-500"
            }`}
          >
            {server.enabled ? "Disable" : "Enable"}
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="px-4 py-4 bg-slate-800/50 border-t border-slate-700 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Display Name">
              <TextInput value={displayName} onChange={setDisplayName} />
            </Field>
            <Field label="Description">
              <TextInput value={description} onChange={setDescription} placeholder="Optional" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MCP Endpoint URL">
              <TextInput value={url} onChange={setUrl} placeholder="https://cin7-mcp.example.com/mcp" mono />
            </Field>
            <Field label="Bearer Token (home app → MCP)">
              <SecretInput value={bearerToken} onChange={setBearerToken} placeholder="Shared secret" />
            </Field>
          </div>

          {/* Credentials */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Upstream API Credentials
            </p>
            <div className="space-y-3">
              {knownFields.map((f) =>
                f.secret ? (
                  <Field key={f.key} label={f.label}>
                    <SecretInput
                      value={credentials[f.key] ?? ""}
                      onChange={(v) => setCredField(f.key, v)}
                    />
                  </Field>
                ) : (
                  <Field key={f.key} label={f.label}>
                    <TextInput
                      value={credentials[f.key] ?? ""}
                      onChange={(v) => setCredField(f.key, v)}
                      mono
                    />
                  </Field>
                )
              )}

              {extraEntries.map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TextInput value={k} onChange={() => {}} mono />
                  </div>
                  <div className="flex-1">
                    <SecretInput value={v} onChange={(nv) => setCredField(k, nv)} />
                  </div>
                  <button onClick={() => removeExtraField(k)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Add custom field */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="flex-1 bg-slate-700 border border-dashed border-slate-600 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  className="flex-1 bg-slate-700 border border-dashed border-slate-600 text-white placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={addExtraField}
                  disabled={!newKey.trim()}
                  className="p-2 text-slate-500 hover:text-indigo-400 disabled:opacity-30 transition-colors shrink-0"
                  title="Add credential field"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => { if (confirm(`Delete "${server.display_name}"?`)) { setDeleting(true); onDelete(server.id); } }}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add server form ──────────────────────────────────────────────────────────

function AddServerForm({ onAdd }: { onAdd: (s: MCPServer) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [serverType, setServerType] = useState("custom");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/admin/mcp-servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, display_name: displayName, server_type: serverType }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Failed to add server");
      return;
    }
    const server = await res.json();
    onAdd(server);
    setName("");
    setDisplayName("");
    setServerType("custom");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <Plus size={15} />
        Add MCP Server
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-dashed border-slate-600 rounded-xl px-4 py-4 space-y-3">
      <p className="text-sm font-medium text-slate-300">New MCP Server</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Slug</label>
          <TextInput value={name} onChange={setName} placeholder="cin7-core" mono />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Display Name</label>
          <TextInput value={displayName} onChange={setDisplayName} placeholder="Cin7 Core" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select
            value={serverType}
            onChange={(e) => setServerType(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="cin7">Cin7 Core</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name || !displayName}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-400 hover:text-white px-3 py-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MCPServersManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchServers() {
    const res = await fetch("/api/admin/mcp-servers");
    if (res.ok) setServers(await res.json());
    else setError("Failed to load MCP servers");
    setLoading(false);
  }

  useEffect(() => { fetchServers(); }, []);

  async function handleSave(id: string, patch: Partial<MCPServer>) {
    const res = await fetch(`/api/admin/mcp-servers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/mcp-servers/${id}`, { method: "DELETE" });
    if (res.ok) setServers((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleHealthCheck(id: string) {
    const res = await fetch(`/api/admin/mcp-servers/${id}/health`, { method: "POST" });
    if (res.ok) {
      const { status } = await res.json();
      setServers((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, last_health_status: status, last_health_check: new Date().toISOString() }
            : s
        )
      );
    }
  }

  const healthySummary = servers.filter((s) => s.last_health_status === "healthy").length;
  const unhealthySummary = servers.filter((s) => s.enabled && s.url && s.last_health_status === "unhealthy").length;

  return (
    <div className="mt-10">
      <div className="border-t border-slate-700 pt-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">MCP Servers</h2>
          {servers.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {healthySummary > 0 && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={12} /> {healthySummary} healthy
                </span>
              )}
              {unhealthySummary > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <XCircle size={12} /> {unhealthySummary} unhealthy
                </span>
              )}
            </div>
          )}
        </div>
        <p className="text-slate-400 text-sm mb-6">
          Register remote MCP servers, manage their credentials, and check connectivity.
        </p>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <ServerRow
                key={server.id}
                server={server}
                onSave={handleSave}
                onDelete={handleDelete}
                onHealthCheck={handleHealthCheck}
              />
            ))}
            <AddServerForm onAdd={(s) => setServers((prev) => [...prev, s])} />
          </div>
        )}
      </div>
    </div>
  );
}
