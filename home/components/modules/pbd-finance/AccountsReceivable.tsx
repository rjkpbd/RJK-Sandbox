"use client";

import type { AccountsReceivableData } from "@/lib/quickbooks";

const fmt = (n: number) =>
  n === 0
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const BUCKETS: { key: keyof Omit<AccountsReceivableData["totals"], never>; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "days1_30", label: "1–30 days" },
  { key: "days31_60", label: "31–60 days" },
  { key: "days61_90", label: "61–90 days" },
  { key: "days91plus", label: "91+ days" },
  { key: "total", label: "Total" },
];

export function AccountsReceivable({ data }: { data: AccountsReceivableData }) {
  return (
    <div className="overflow-x-auto">
      {data.asOf && (
        <p className="text-xs text-slate-500 mb-3">As of {data.asOf}</p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="py-2 pr-4 text-left font-medium text-slate-400">
              Customer
            </th>
            {BUCKETS.map((b) => (
              <th
                key={b.key}
                className="py-2 px-3 text-right font-medium text-slate-400 min-w-24"
              >
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
              {BUCKETS.map((b) => (
                <td
                  key={b.key}
                  className={`py-2 px-3 text-right tabular-nums ${
                    b.key !== "current" && b.key !== "total" && row[b.key] > 0
                      ? "text-amber-400"
                      : ""
                  } ${b.key === "total" ? "font-medium text-white" : ""}`}
                >
                  {fmt(row[b.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-600 bg-slate-700/30 font-semibold text-white">
            <td className="py-2 pr-4">Total</td>
            {BUCKETS.map((b) => (
              <td key={b.key} className="py-2 px-3 text-right tabular-nums">
                {fmt(data.totals[b.key])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {data.customers.length === 0 && (
        <p className="text-slate-500 text-sm py-4 text-center">
          No outstanding receivables.
        </p>
      )}
    </div>
  );
}
