"use client";

import { useEffect, useState } from "react";
import type {
  AccountsReceivableData,
  ARDetailData,
  ARDetailTransaction,
  ARBucket,
} from "@/lib/quickbooks";

const fmtCurrency = (n: number) =>
  n === 0
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });

const fmtCurrencyFull = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const BUCKETS: { key: ARBucket | "total"; label: string }[] = [
  { key: "current",    label: "Current" },
  { key: "days1_30",   label: "1–30 days" },
  { key: "days31_60",  label: "31–60 days" },
  { key: "days61_90",  label: "61–90 days" },
  { key: "days91plus", label: "91+ days" },
  { key: "total",      label: "Total" },
];

interface DrillDown {
  customer: string;
  bucket: ARBucket | "total";
  bucketLabel: string;
}

function DrillDownModal({
  drill,
  detail,
  onClose,
}: {
  drill: DrillDown;
  detail: ARDetailData | null;
  onClose: () => void;
}) {
  const txns: ARDetailTransaction[] = (() => {
    if (!detail) return [];
    const all = detail.byCustomer[drill.customer] ?? [];
    if (drill.bucket === "total") return all;
    return all.filter((t) => t.bucket === drill.bucket);
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <p className="font-semibold text-white">{drill.customer}</p>
            <p className="text-xs text-slate-400 mt-0.5">{drill.bucketLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {detail === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-slate-700/50 rounded animate-pulse" />
              ))}
            </div>
          ) : txns.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">No transactions found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs">
                  <th className="pb-2 text-left">Type</th>
                  <th className="pb-2 text-left">Num</th>
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-left">Due</th>
                  <th className="pb-2 text-right">Days</th>
                  <th className="pb-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) => (
                  <tr key={i} className="border-b border-slate-700/40 text-slate-300">
                    <td className="py-1.5 pr-3">{t.type}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{t.num || "—"}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{t.date}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{t.dueDate || "—"}</td>
                    <td className={`py-1.5 text-right tabular-nums ${t.aging > 90 ? "text-red-400" : t.aging > 0 ? "text-amber-400" : ""}`}>
                      {t.aging > 0 ? `+${t.aging}` : t.aging === 0 ? "0" : t.aging}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-white">
                      {fmtCurrencyFull(t.openBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600 text-white font-semibold">
                  <td colSpan={5} className="pt-2 text-slate-400 text-xs">Total</td>
                  <td className="pt-2 text-right tabular-nums">
                    {fmtCurrencyFull(txns.reduce((s, t) => s + t.openBalance, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export function AccountsReceivable({ data }: { data: AccountsReceivableData }) {
  const [drill, setDrill] = useState<DrillDown | null>(null);
  const [detail, setDetail] = useState<ARDetailData | null>(null);
  const [detailError, setDetailError] = useState(false);

  // Fetch detail data once on mount so clicks are instant
  useEffect(() => {
    fetch("/api/qbo/ar-detail")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setDetailError(true); return; }
        setDetail(d as ARDetailData);
      })
      .catch(() => setDetailError(true));
  }, []);

  function openDrill(customer: string, bucket: ARBucket | "total", bucketLabel: string) {
    setDrill({ customer, bucket, bucketLabel });
  }

  const clickable = !detailError;

  return (
    <>
      <div className="overflow-x-auto">
        {data.asOf && (
          <p className="text-xs text-slate-500 mb-3">As of {data.asOf}</p>
        )}
        {clickable && (
          <p className="text-xs text-slate-600 mb-2">Click any amount to see detail.</p>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="py-2 pr-4 text-left font-medium text-slate-400">Customer</th>
              {BUCKETS.map((b) => (
                <th key={b.key} className="py-2 px-3 text-right font-medium text-slate-400 min-w-24">
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.customers.map((row) => (
              <tr
                key={row.customer}
                className="border-b border-slate-700/50 text-slate-300 hover:bg-slate-700/20"
              >
                <td className="py-2 pr-4 text-slate-200">{row.customer}</td>
                {BUCKETS.map((b) => {
                  const val = b.key === "total" ? row.total : row[b.key];
                  const isOverdue = b.key !== "current" && b.key !== "total" && val > 0;
                  return (
                    <td
                      key={b.key}
                      onClick={() =>
                        val > 0 && clickable
                          ? openDrill(row.customer, b.key, b.label)
                          : undefined
                      }
                      className={[
                        "py-2 px-3 text-right tabular-nums",
                        isOverdue ? "text-amber-400" : "",
                        b.key === "total" ? "font-medium text-white" : "",
                        val > 0 && clickable
                          ? "cursor-pointer hover:underline hover:brightness-125"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {fmtCurrency(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-600 bg-slate-700/30 font-semibold text-white">
              <td className="py-2 pr-4">Total</td>
              {BUCKETS.map((b) => (
                <td key={b.key} className="py-2 px-3 text-right tabular-nums">
                  {fmtCurrency(data.totals[b.key === "total" ? "total" : b.key])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        {data.customers.length === 0 && (
          <p className="text-slate-500 text-sm py-4 text-center">No outstanding receivables.</p>
        )}
      </div>

      {drill && (
        <DrillDownModal
          drill={drill}
          detail={detail}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
