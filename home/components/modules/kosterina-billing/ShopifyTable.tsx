"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type Order = {
  order_key: string;
  name_raw: string;
  email: string | null;
  fulfilled_at: string | null;
  total: number | null;
  category: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_country: string | null;
  tags_raw: string | null;
};

type LineItem = {
  id: number;
  lineitem_sku: string | null;
  lineitem_name: string | null;
  lineitem_quantity: number | null;
  lineitem_price: number | null;
};

type SortKey = keyof Order;

export default function ShopifyTable() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fulfilled_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [limit, setLimit] = useState(100);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const params = new URLSearchParams({
      period_id: periodId,
      page: String(page),
      limit: String(limit),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(category && { category }),
    });
    const res = await fetch(`/api/kosterina-billing/orders?${params}`);
    if (res.ok) {
      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [periodId, page, limit, debouncedSearch, category]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!selectedOrder || !periodId) { setLineItems([]); return; }
    setLineItemsLoading(true);
    fetch(`/api/kosterina-billing/orders?period_id=${periodId}&order_key=${selectedOrder}`)
      .then(r => r.json())
      .then(d => setLineItems(d.lineItems ?? []))
      .finally(() => setLineItemsLoading(false));
  }, [selectedOrder, periodId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...orders].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : null;

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";
  const fmtMoney = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const totalPages = Math.ceil(total / limit);

  if (!periodId) return <p className="text-slate-400 text-sm">Select a period to view orders.</p>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search order # or email…"
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
        <span className="text-slate-400 text-sm py-2">{total} orders</span>
      </div>

      <div className="flex gap-4">
        {/* Orders table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {(["order_key","fulfilled_at","total","category","shipping_city","tags_raw"] as SortKey[]).map(col => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className="text-left px-3 py-2 text-xs uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.replace(/_/g," ")} <SortIcon col={col} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No orders found.</td></tr>
              )}
              {!loading && sorted.map(order => (
                <tr
                  key={order.order_key}
                  onClick={() => setSelectedOrder(s => s === order.order_key ? null : order.order_key)}
                  className={
                    "border-b border-slate-700/50 cursor-pointer transition-colors " +
                    (selectedOrder === order.order_key
                      ? "bg-indigo-900/20"
                      : "hover:bg-slate-800/50")
                  }
                >
                  <td className="px-3 py-2 text-indigo-400 font-mono underline decoration-dotted underline-offset-2">{order.order_key}</td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtDate(order.fulfilled_at)}</td>
                  <td className="px-3 py-2 text-white font-mono">{fmtMoney(order.total)}</td>
                  <td className="px-3 py-2">
                    <CategoryBadge category={order.category} />
                  </td>
                  <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                    {[order.shipping_city, order.shipping_state].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs max-w-xs truncate">{order.tags_raw}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-3 mt-3 text-sm text-slate-400">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-slate-800 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Line items drawer */}
        {selectedOrder && (
          <div className="w-80 flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">Order {selectedOrder}</h4>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            {lineItemsLoading && <p className="text-slate-500 text-sm">Loading…</p>}
            {!lineItemsLoading && lineItems.length === 0 && (
              <p className="text-slate-500 text-sm">No line items.</p>
            )}
            {!lineItemsLoading && lineItems.map(li => (
              <div key={li.id} className="border-b border-slate-700/50 py-2 text-sm">
                <p className="text-slate-200">{li.lineitem_name ?? "—"}</p>
                <p className="text-slate-500 text-xs">SKU: {li.lineitem_sku ?? "—"}</p>
                <p className="text-slate-400 text-xs">
                  Qty: {li.lineitem_quantity ?? "—"} × {li.lineitem_price != null
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(li.lineitem_price)
                    : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  const colors: Record<string, string> = {
    DTC: "bg-blue-900/40 text-blue-300",
    Wholesale: "bg-amber-900/40 text-amber-300",
    Subscription: "bg-emerald-900/40 text-emerald-300",
    Replacement: "bg-red-900/40 text-red-300",
    Gifted: "bg-purple-900/40 text-purple-300",
    Test: "bg-slate-700 text-slate-400",
  };
  const cat = category ?? "—";
  const base = Object.entries(colors).find(([k]) => cat.startsWith(k));
  return (
    <span className={
      "inline-block px-2 py-0.5 rounded text-xs font-medium " +
      (base ? base[1] : "bg-slate-700 text-slate-400")
    }>
      {cat}
    </span>
  );
}
