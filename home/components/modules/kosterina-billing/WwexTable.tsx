"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type Shipment = {
  id: number;
  order_key: string | null;
  billing_reference_1_raw: string | null;
  ship_date: string | null;
  line_of_business: string | null;
  scac: string | null;
  charge_total: number | null;
  category_override: string | null;
  shopify_match: boolean;
};

type ChargeLineRow = {
  charge_idx: number;
  charge_type: string | null;
  charge_amount: number | null;
};

type ShipmentDetail = {
  id: number;
  order_key: string | null;
  billing_reference_1_raw: string | null;
  vendor_reference_1: string | null;
  airbill_num: string | null;
  pro_num: string | null;
  bol_num: string | null;
  invoice_num: string | null;
  invoice_date: string | null;
  ship_date: string | null;
  line_of_business: string | null;
  scac: string | null;
  bill_type: string | null;
  service_level: string | null;
  zone: string | null;
  shippers_name: string | null;
  shippers_city: string | null;
  shippers_state: string | null;
  shippers_zip: string | null;
  receiver_name: string | null;
  receiver_city: string | null;
  receiver_state: string | null;
  receiver_zip: string | null;
  pieces: number | null;
  original_weight: number | null;
  charged_weight: number | null;
  charge_total: number | null;
  category_override: string | null;
  sb_kos_wwex_charge_lines: ChargeLineRow[];
};

type SortKey = keyof Shipment;
const LOBS = ["", "SMALLPACK", "LTL", "FTL"];

export default function WwexTable() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lob, setLob] = useState("");
  const [category, setCategory] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ship_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(100);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchShipments = useCallback(async () => {
    if (!periodId) return;
    setLoading(true);
    const params = new URLSearchParams({
      period_id: periodId,
      page: String(page),
      limit: String(limit),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(lob && { lob }),
      ...(category && { category }),
    });
    const res = await fetch(`/api/kosterina-billing/wwex-shipments?${params}`);
    if (res.ok) {
      const data = await res.json();
      setShipments(data.shipments ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [periodId, page, limit, debouncedSearch, lob, category]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  // Close drawer when page/filter changes
  useEffect(() => { setSelectedId(null); setDetail(null); }, [periodId, page, debouncedSearch, lob, category]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`/api/kosterina-billing/wwex-shipments?id=${selectedId}`)
      .then(r => r.json())
      .then(d => setDetail(d.shipment ?? null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...shipments].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null;

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";
  const fmtMoney = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const totalPages = Math.ceil(total / limit);

  if (!periodId) return <p className="text-slate-400 text-sm">Select a period to view WWEX data.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search order key or SCAC…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
        />
        <select
          value={lob}
          onChange={e => { setLob(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          {LOBS.map(l => <option key={l} value={l}>{l || "All LOBs"}</option>)}
        </select>
        <input
          type="text"
          placeholder="Filter by category…"
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-44"
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
                  ["order_key", "Order Key"],
                  ["ship_date", "Ship Date"],
                  ["line_of_business", "LOB"],
                  ["scac", "SCAC"],
                  ["charge_total", "Charge Total"],
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
              {!loading && sorted.map(s => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(id => id === s.id ? null : s.id)}
                  className={
                    "border-b border-slate-700/50 cursor-pointer transition-colors " +
                    (selectedId === s.id ? "bg-indigo-900/20" : "hover:bg-slate-800/30")
                  }
                >
                  <td className="px-3 py-2 text-indigo-400 font-mono text-xs underline decoration-dotted underline-offset-2">
                    {s.order_key ?? s.billing_reference_1_raw ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{fmtDate(s.ship_date)}</td>
                  <td className="px-3 py-2">
                    <span className={
                      "inline-block px-2 py-0.5 rounded text-xs font-mono " +
                      (s.line_of_business === "LTL" ? "bg-amber-900/40 text-amber-300"
                       : s.line_of_business === "FTL" ? "bg-purple-900/40 text-purple-300"
                       : "bg-blue-900/40 text-blue-300")
                    }>
                      {s.line_of_business ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{s.scac ?? "—"}</td>
                  <td className="px-3 py-2 text-white font-mono text-right">{fmtMoney(s.charge_total)}</td>
                  <td className="px-3 py-2">
                    {s.category_override
                      ? <span className="text-slate-300 text-xs">{s.category_override}</span>
                      : <span className="text-slate-600 text-xs italic">unassigned</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={
                      "inline-block px-2 py-0.5 rounded text-xs " +
                      (s.shopify_match ? "bg-emerald-900/40 text-emerald-300" : "bg-slate-700 text-slate-400")
                    }>
                      {s.shopify_match ? "✓" : "—"}
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
        {selectedId && (
          <div className="w-72 flex-shrink-0 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 self-start sticky top-4">
            {detailLoading && <p className="text-slate-500 text-sm">Loading…</p>}
            {!detailLoading && detail && <WwexDetailPanel detail={detail} onClose={() => setSelectedId(null)} fmtDate={fmtDate} fmtMoney={fmtMoney} />}
          </div>
        )}
      </div>
    </div>
  );
}

function WwexDetailPanel({ detail, onClose, fmtDate, fmtMoney }: {
  detail: ShipmentDetail;
  onClose: () => void;
  fmtDate: (s: string | null) => string;
  fmtMoney: (v: number | null) => string;
}) {
  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div key={label} className="flex justify-between text-xs gap-2">
        <span className="text-slate-500 flex-shrink-0">{label}</span>
        <span className="text-slate-300 text-right break-all">{value}</span>
      </div>
    ) : null;

  const chargeLines = [...(detail.sb_kos_wwex_charge_lines ?? [])].sort((a, b) => a.charge_idx - b.charge_idx);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-mono font-semibold text-indigo-400 break-all">
            {detail.order_key ?? detail.billing_reference_1_raw ?? `ID ${detail.id}`}
          </p>
          {detail.billing_reference_1_raw && detail.order_key && (
            <p className="text-xs text-slate-500 mt-0.5">Ref: {detail.billing_reference_1_raw}</p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white flex-shrink-0"><X size={14} /></button>
      </div>

      {/* Shipment info */}
      <div className="border-t border-slate-700 pt-3 space-y-1">
        {row("Ship Date", fmtDate(detail.ship_date))}
        {row("Invoice Date", fmtDate(detail.invoice_date))}
        {row("LOB", detail.line_of_business)}
        {row("SCAC", detail.scac)}
        {row("Service Level", detail.service_level)}
        {row("Zone", detail.zone)}
        {row("Bill Type", detail.bill_type)}
        {row("Airbill #", detail.airbill_num)}
        {row("PRO #", detail.pro_num)}
        {row("BOL #", detail.bol_num)}
        {row("Invoice #", detail.invoice_num)}
        {row("Vendor Ref", detail.vendor_reference_1)}
      </div>

      {/* Shipper → Receiver */}
      {(detail.shippers_name || detail.receiver_name) && (
        <div className="border-t border-slate-700 pt-3 space-y-1">
          {detail.shippers_name && (
            <div className="text-xs">
              <p className="text-slate-500 mb-0.5">From</p>
              <p className="text-slate-300">{detail.shippers_name}</p>
              <p className="text-slate-500">
                {[detail.shippers_city, detail.shippers_state, detail.shippers_zip].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
          {detail.receiver_name && (
            <div className="text-xs mt-1">
              <p className="text-slate-500 mb-0.5">To</p>
              <p className="text-slate-300">{detail.receiver_name}</p>
              <p className="text-slate-500">
                {[detail.receiver_city, detail.receiver_state, detail.receiver_zip].filter(Boolean).join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Weight */}
      {(detail.pieces != null || detail.charged_weight != null) && (
        <div className="border-t border-slate-700 pt-3 space-y-1">
          {row("Pieces", detail.pieces != null ? String(detail.pieces) : null)}
          {row("Orig Weight", detail.original_weight != null ? `${detail.original_weight} lbs` : null)}
          {row("Charged Weight", detail.charged_weight != null ? `${detail.charged_weight} lbs` : null)}
        </div>
      )}

      {/* Charge lines */}
      {chargeLines.length > 0 && (
        <div className="border-t border-slate-700 pt-3 space-y-1">
          {chargeLines.map(cl => (
            <div key={cl.charge_idx} className="flex justify-between text-xs">
              <span className="text-slate-500">{cl.charge_type ?? `Charge ${cl.charge_idx}`}</span>
              <span className="text-slate-300 font-mono">{fmtMoney(cl.charge_amount)}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-2 border-t border-slate-700 mt-1">
            <span className="text-slate-400 font-semibold">Total</span>
            <span className="text-white font-mono font-semibold">{fmtMoney(detail.charge_total)}</span>
          </div>
        </div>
      )}

      <div className="border-t border-slate-700 pt-2 text-xs">
        <span className="text-slate-500">Category: </span>
        <span className={detail.category_override ? "text-slate-300" : "text-slate-600 italic"}>
          {detail.category_override ?? "unassigned"}
        </span>
      </div>
    </>
  );
}
