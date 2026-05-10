"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SpendChart from "./SpendChart";
import UploadPanel from "./UploadPanel";

type SpendRow = { category: string; total: number };
type SummaryRow = { id: number; label: string; quantity: number | null; amount: number | null; notes: string | null };

type SummaryData = {
  wwexByCategory: SpendRow[];
  pacfulByCategory: SpendRow[];
  billingSummary: SummaryRow[];
};

export default function SummaryDashboard() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/kosterina-billing/summary?period_id=${periodId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [periodId]);

  const fmt = (v: number | null) =>
    v == null
      ? "—"
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const fmtQty = (v: number | null) =>
    v == null ? "—" : new Intl.NumberFormat("en-US").format(v);

  return (
    <div>
      <UploadPanel />

      {!periodId && (
        <p className="text-slate-400 text-sm">Select or create a period above to view data.</p>
      )}

      {periodId && loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">Error loading summary: {error}</p>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Spend charts side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendChart data={data.wwexByCategory} title="WWEX Spend by Category" />
            <SpendChart data={data.pacfulByCategory} title="Pacful Spend by Category" />
          </div>

          {/* Pacful billing summary block */}
          {data.billingSummary.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">
                Pacful Billing Summary
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-2 py-1 text-xs uppercase tracking-wider text-slate-500 w-1/2">Item</th>
                    <th className="text-right px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Qty</th>
                    <th className="text-right px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Amount</th>
                    <th className="text-left px-2 py-1 text-xs uppercase tracking-wider text-slate-500 hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.billingSummary.map(row => (
                    <tr
                      key={row.id}
                      className={
                        "border-b border-slate-700/50 " +
                        (row.label?.toUpperCase().includes("TOTAL BILLING")
                          ? "bg-indigo-900/20 font-semibold"
                          : "")
                      }
                    >
                      <td className="px-2 py-2 text-slate-300">{row.label}</td>
                      <td className="px-2 py-2 text-right text-slate-400 font-mono">{fmtQty(row.quantity)}</td>
                      <td className="px-2 py-2 text-right text-white font-mono">{fmt(row.amount)}</td>
                      <td className="px-2 py-2 text-slate-500 text-xs hidden md:table-cell">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.billingSummary.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <p className="text-slate-500 text-sm">No Pacful billing summary for this period.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
