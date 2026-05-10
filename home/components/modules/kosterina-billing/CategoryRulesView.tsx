"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

type Rule = { id: number; tag: string; category: string; priority: number };

export default function CategoryRulesView() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Rule>>({});
  const [newForm, setNewForm] = useState({ tag: "", category: "", priority: "99" });
  const [showAdd, setShowAdd] = useState(false);
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatMsg, setRecatMsg] = useState("");
  const [error, setError] = useState("");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/kosterina-billing/category-rules");
    if (res.ok) setRules(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function saveEdit(id: number) {
    setError("");
    const res = await fetch(`/api/kosterina-billing/category-rules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setEditingId(null);
    fetchRules();
  }

  async function deleteRule(id: number) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/kosterina-billing/category-rules/${id}`, { method: "DELETE" });
    fetchRules();
  }

  async function addRule() {
    setError("");
    if (!newForm.tag || !newForm.category) { setError("Tag and category are required."); return; }
    const res = await fetch("/api/kosterina-billing/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: newForm.tag, category: newForm.category, priority: Number(newForm.priority) }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setShowAdd(false);
    setNewForm({ tag: "", category: "", priority: "99" });
    fetchRules();
  }

  async function recategorize() {
    if (!periodId) { setRecatMsg("No period selected."); return; }
    setRecatLoading(true);
    setRecatMsg("");
    const res = await fetch("/api/kosterina-billing/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: Number(periodId) }),
    });
    const data = await res.json();
    setRecatLoading(false);
    setRecatMsg(data.error ? `Error: ${data.error}` : "Recategorization complete.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { setShowAdd(a => !a); setError(""); }}
          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm"
        >
          <Plus size={14} /> Add rule
        </button>

        <button
          onClick={recategorize}
          disabled={recatLoading || !periodId}
          title={!periodId ? "Select a period first" : undefined}
          className="bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40"
        >
          {recatLoading ? "Recategorizing…" : "Recategorize all orders in this period"}
        </button>

        {recatMsg && (
          <span className={
            "text-sm " + (recatMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400")
          }>
            {recatMsg}
          </span>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Add form */}
      {showAdd && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Tag</span>
            <input
              value={newForm.tag}
              onChange={e => setNewForm(f => ({ ...f, tag: e.target.value }))}
              placeholder="e.g. Wholesale"
              className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Category</span>
            <input
              value={newForm.category}
              onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Wholesale"
              className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider">Priority</span>
            <input
              type="number"
              value={newForm.priority}
              onChange={e => setNewForm(f => ({ ...f, priority: e.target.value }))}
              className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-20"
            />
          </label>
          <button
            onClick={addRule}
            className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm"
          >
            <Check size={14} /> Save
          </button>
          <button
            onClick={() => { setShowAdd(false); setError(""); }}
            className="text-slate-400 hover:text-white text-sm px-2 py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Rules table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500">Priority</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500">Tag</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-slate-500">Category</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && rules.map(rule => (
              <tr key={rule.id} className="border-b border-slate-700/50">
                {editingId === rule.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editForm.priority ?? rule.priority}
                        onChange={e => setEditForm(f => ({ ...f, priority: Number(e.target.value) }))}
                        className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm w-16"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.tag ?? rule.tag}
                        onChange={e => setEditForm(f => ({ ...f, tag: e.target.value }))}
                        className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm w-40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editForm.category ?? rule.category}
                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                        className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm w-40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(rule.id)} className="text-emerald-400 hover:text-emerald-300">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-slate-400 font-mono">{rule.priority}</td>
                    <td className="px-4 py-3 text-slate-200">{rule.tag}</td>
                    <td className="px-4 py-3 text-indigo-300">{rule.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditingId(rule.id); setEditForm({ tag: rule.tag, category: rule.category, priority: rule.priority }); setError(""); }}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
