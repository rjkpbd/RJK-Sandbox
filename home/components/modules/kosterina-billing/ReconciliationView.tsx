"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

type ReconcData = {
  shopifyMissingFromPacful: ShopifyMissing[];
  wwexMissingFromPacful: WwexMissing[];
  needingCategory: NeedingCategory[];
};

type ShopifyMissing = {
  order_key: string;
  fulfilled_at: string | null;
  total: number | null;
  category: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
};

type WwexMissing = {
  id: number;
  order_key: string;
  ship_date: string | null;
  line_of_business: string | null;
  charge_total: number | null;
  scac: string | null;
};

type NeedingCategory = {
  id: number;
  source: "pacful" | "wwex";
  order_key: string;
  reference_raw?: string;
  billing_reference_1_raw?: string;
  line_total?: number | null;
  charge_total?: number | null;
  category_override: string | null;
};

type CategoryRule = { category: string };

export default function ReconciliationView() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [data, setData] = useState<ReconcData | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // `{source}-{id}` → category
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const fetchData = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const [reconcRes, rulesRes] = await Promise.all([
      fetch(`/api/kosterina-billing/reconciliation?period_id=${periodId}`),
      fetch("/api/kosterina-billing/category-rules"),
    ]);
    if (reconcRes.ok) setData(await reconcRes.json());
    if (rulesRes.ok) {
      const rules: CategoryRule[] = await rulesRes.json();
      const cats = [...new Set(rules.map(r => r.category))].sort();
      setCategories(["Inbound Freight", ...cats]);
    }
    setLoading(false);
  }, [periodId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function rowKey(row: NeedingCategory) { return `${row.source}-${row.id}`; }

  function toggleSelect(key: string) {
    setSelectedKeys(s => {
      const ns = new Set(s);
      ns.has(key) ? ns.delete(key) : ns.add(key);
      return ns;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    const all = data.needingCategory.map(rowKey);
    setSelectedKeys(s => s.size === all.length ? new Set() : new Set(all));
  }

  function applyBulk() {
    if (!bulkCategory || selectedKeys.size === 0) return;
    const next = { ...overrides };
    for (const k of selectedKeys) next[k] = bulkCategory;
    setOverrides(next);
  }

  async function saveChanges() {
    if (!data) return;
    setSaving(true);
    setSaveMsg("");

    const updates = data.needingCategory
      .filter(row => overrides[rowKey(row)] !== undefined)
      .map(row => ({
        table: row.source as "pacful" | "wwex",
        id: row.id,
        category_override: overrides[rowKey(row)] || null,
      }));

    if (updates.length === 0) { setSaving(false); setSaveMsg("Nothing to save."); return; }

    const res = await fetch("/api/kosterina-billing/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    const result = await res.json();
    setSaving(false);
    setSaveMsg(result.error ? `Error: ${result.error}` : `Saved ${updates.length} changes.`);
    if (!result.error) {
      setOverrides({});
      setSelectedKeys(new Set());
      fetchData();
    }
  }

  function downloadCSV(filename: string, rows: Record<string, unknown>[], headers: string[]) {
    const lines = [
      headers.join(","),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";
  const fmtMoney = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  if (!periodId) return <p className="text-slate-400 text-sm">Select a period to view reconciliation data.</p>;
  if (loading) return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="h-32 bg-slate-800 rounded-xl animate-pulse"/>)}</div>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Section 1: Shopify missing from Pacful */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">
            Shopify orders missing from Pacful
            <span className="ml-2 text-sm font-normal text-slate-400">({data.shopifyMissingFromPacful.length})</span>
          </h3>
          <button
            onClick={() => downloadCSV("shopify-missing-pacful.csv", data.shopifyMissingFromPacful as unknown as Record<string, unknown>[], ["order_key","fulfilled_at","total","category","shipping_city","shipping_state","shipping_country"])}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              {["Order Key","Fulfilled At","Total","Category","Destination"].map(h=>(
                <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.shopifyMissingFromPacful.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-sm">None — all Shopify orders matched.</td></tr>
              )}
              {data.shopifyMissingFromPacful.map(r => (
                <tr key={r.order_key} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-indigo-400 font-mono text-xs">{r.order_key}</td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtDate(r.fulfilled_at)}</td>
                  <td className="px-3 py-2 text-white font-mono">{fmtMoney(r.total)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.category ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">
                    {[r.shipping_city, r.shipping_state, r.shipping_country].filter(Boolean).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: WWEX missing from Pacful */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">
            WWEX rows missing from Pacful
            <span className="ml-2 text-sm font-normal text-slate-400">({data.wwexMissingFromPacful.length})</span>
          </h3>
          <button
            onClick={() => downloadCSV("wwex-missing-pacful.csv", data.wwexMissingFromPacful as unknown as Record<string, unknown>[], ["order_key","ship_date","line_of_business","charge_total","scac"])}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              {["Order Key","Ship Date","LOB","Charge Total","SCAC"].map(h=>(
                <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.wwexMissingFromPacful.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500 text-sm">None — all WWEX rows matched.</td></tr>
              )}
              {data.wwexMissingFromPacful.map(r => (
                <tr key={r.id} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-indigo-400 font-mono text-xs">{r.order_key}</td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtDate(r.ship_date)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{r.line_of_business ?? "—"}</td>
                  <td className="px-3 py-2 text-white font-mono">{fmtMoney(r.charge_total)}</td>
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{r.scac ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: Rows needing category */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-white">
            Rows needing category assignment
            <span className="ml-2 text-sm font-normal text-slate-400">({data.needingCategory.length})</span>
          </h3>
        </div>

        {data.needingCategory.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              value={bulkCategory}
              onChange={e => setBulkCategory(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Bulk assign…</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={applyBulk}
              disabled={!bulkCategory || selectedKeys.size === 0}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40"
            >
              Apply to {selectedKeys.size} selected
            </button>
            <button
              onClick={saveChanges}
              disabled={saving || Object.keys(overrides).length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saveMsg && (
              <span className={
                "text-sm " +
                (saveMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400")
              }>
                {saveMsg}
              </span>
            )}
          </div>
        )}

        <div className="overflow-x-auto bg-slate-800 border border-slate-700 rounded-xl">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  className="accent-indigo-500"
                  checked={data.needingCategory.length > 0 && selectedKeys.size === data.needingCategory.length}
                  onChange={toggleSelectAll}
                />
              </th>
              {["Source","Order Key","Ref","Amount","Category"].map(h=>(
                <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.needingCategory.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500 text-sm">No unassigned rows.</td></tr>
              )}
              {data.needingCategory.map(row => {
                const key = rowKey(row);
                const currentCat = overrides[key] ?? row.category_override ?? "";
                const amount = row.source === "pacful" ? row.line_total : row.charge_total;
                const ref = row.source === "pacful" ? row.reference_raw : row.billing_reference_1_raw;
                return (
                  <tr
                    key={key}
                    className={
                      "border-b border-slate-700/50 " +
                      (selectedKeys.has(key) ? "bg-indigo-900/10" : "")
                    }
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-indigo-500"
                        checked={selectedKeys.has(key)}
                        onChange={() => toggleSelect(key)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={
                        "inline-block px-2 py-0.5 rounded text-xs font-mono " +
                        (row.source === "pacful" ? "bg-blue-900/40 text-blue-300" : "bg-amber-900/40 text-amber-300")
                      }>
                        {row.source}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-indigo-400 font-mono text-xs">{row.order_key}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono text-xs">{ref ?? "—"}</td>
                    <td className="px-3 py-2 text-white font-mono">{fmtMoney(amount ?? null)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={currentCat}
                        onChange={e => setOverrides(o => ({ ...o, [key]: e.target.value }))}
                        className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-xs w-full min-w-32"
                      >
                        <option value="">— unassigned —</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
