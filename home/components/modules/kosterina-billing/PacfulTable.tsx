"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type PacfulItem = {
  id: number;
  transaction_id: string | null;
  reference_raw: string | null;
  order_key: string | null;
  order_processing_fee: number | null;
  kitting_minutes: number | null;
  kitting_charge: number | null;
  items_picked: number | null;
  item_pick_charge: number | null;
  addl_pick_charge: number | null;
  cartons_btb: number | null;
  pallets_btb: number | null;
  carton_pull_total: number | null;
  pallet_pull_total: number | null;
  pick_item_total: number | null;
  materials: number | null;
  freight_postage_fees: number | null;
  ship_prep_minutes: number | null;
  ship_prep_charge: number | null;
  line_total: number | null;
  category_override: string | null;
  shopify_match: boolean;
};

type SortKey = keyof PacfulItem;

const CHARGE_FIELDS: { key: keyof PacfulItem; label: string; qty?: boolean }[] = [
  { key: "order_processing_fee", label: "Order Processing" },
  { key: "kitting_minutes",      label: "Kitting Minutes", qty: true },
  { key: "kitting_charge",       label: "Kitting Charge" },
  { key: "items_picked",         label: "Items Picked",   qty: true },
  { key: "item_pick_charge",     label: "Item Pick Charge" },
  { key: "addl_pick_charge",     label: "Addl Pick Charge" },
  { key: "cartons_btb",          label: "Cartons BTB",    qty: true },
  { key: "pallets_btb",          label: "Pallets BTB",    qty: true },
  { key: "carton_pull_total",    label: "Carton Pull" },
  { key: "pallet_pull_total",    label: "Pallet Pull" },
  { key: "pick_item_total",      label: "Pick Item Total" },
  { key: "materials",            label: "Materials" },
  { key: "freight_postage_fees", label: "Freight / Postage" },
  { key: "ship_prep_minutes",    label: "Ship Prep Minutes", qty: true },
  { key: "ship_prep_charge",     label: "Ship Prep Charge" },
];

export default function PacfulTable() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [items, setItems] = useState<PacfulItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [limit, setLimit] = useState(100);
  const [selectedItem, setSelectedItem] = useState<PacfulItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchItems = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const params = new URLSearchParams({
      period_id: periodId,
      page: String(page),
      limit: String(limit),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(category && { category }),
    });
    const res = await fetch(`/api/kosterina-billing/pacful-items?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [periodId, page, limit, debouncedSearch, category]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Close drawer when page/filter changes
  useEffect(() => { setSelectedItem(null); }, [periodId, page, debouncedSearch, category]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...items].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const fmtMoney = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const totalPages = Math.ceil(total / limit);

  if (!periodId) return <p className="text-slate-400 text-sm">Select a period to view Pacful data.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search reference # or order key…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
        />
        <input
          type="text"
          placeholder="Filter by category…"
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-48"
        />
        <select
          value={limit}
          onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          {[100, 250, 500].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <span className="text-slate-400 text-sm py-2">{total} rows</span>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 overflow-x-auto min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {([
                  ["reference_raw", "Reference #"],
                  ["transaction_id", "Transaction ID"],
                  ["order_key", "Order Key"],
                  ["items_picked", "Items Picked"],
                  ["line_total", "Line Total"],
                  ["category_override", "Category"],
                ] as [SortKey, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon col={col} />
                    </span>
                  </th>
                ))}
                <th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500">Shopify</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No data found.</td></tr>
              )}
              {!loading && sorted.map(item => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(s => s?.id === item.id ? null : item)}
                  className={
                    "border-b border-slate-700/50 cursor-pointer transition-colors " +
                    (selectedItem?.id === item.id ? "bg-indigo-900/20" : "hover:bg-slate-800/30")
                  }
                >
                  <td className="px-3 py-2 font-mono text-xs text-indigo-400 underline decoration-dotted underline-offset-2">
                    {item.reference_raw ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs">{item.transaction_id ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-xs">{item.order_key ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400 text-right">{item.items_picked ?? "—"}</td>
                  <td className="px-3 py-2 text-white font-mono text-right">{fmtMoney(item.line_total)}</td>
                  <td className="px-3 py-2">
                    {item.category_override
                      ? <span className="text-slate-300 text-xs">{item.category_override}</span>
                      : <span className="text-slate-600 text-xs italic">unassigned</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={
                      "inline-block px-2 py-0.5 rounded text-xs " +
                      (item.shopify_match ? "bg-emerald-900/40 text-emerald-300" : "bg-slate-700 text-slate-400")
                    }>
                      {item.shopify_match ? "✓" : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-3 text-sm text-slate-400">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40">← Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {/* Detail drawer */}
        {selectedItem && (
          <div className="w-72 flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 self-start sticky top-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-mono font-semibold text-indigo-400 break-all">
                  {selectedItem.reference_raw ?? "—"}
                </p>
                {selectedItem.order_key && (
                  <p className="text-xs text-slate-500 mt-0.5">Order: {selectedItem.order_key}</p>
                )}
                {selectedItem.transaction_id && (
                  <p className="text-xs text-slate-600 mt-0.5">TXN: {selectedItem.transaction_id}</p>
                )}
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-white flex-shrink-0">
                <X size={14} />
              </button>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-1">
              {CHARGE_FIELDS.map(({ key, label, qty }) => {
                const v = selectedItem[key] as number | null;
                if (v == null || v === 0) return null;
                return (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-300 font-mono">
                      {qty ? v.toLocaleString() : fmtMoney(v)}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between text-xs pt-2 border-t border-slate-700 mt-1">
                <span className="text-slate-400 font-semibold">Line Total</span>
                <span className="text-white font-mono font-semibold">{fmtMoney(selectedItem.line_total)}</span>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-2 text-xs">
              <span className="text-slate-500">Category: </span>
              <span className={selectedItem.category_override ? "text-slate-300" : "text-slate-600 italic"}>
                {selectedItem.category_override ?? "unassigned"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
