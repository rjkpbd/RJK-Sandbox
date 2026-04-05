"use client";

import type { ProfitAndLossData } from "@/lib/quickbooks";

const fmt = (n: number | null) =>
  n === null
    ? "—"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function IncomeStatement({ data }: { data: ProfitAndLossData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="py-2 pr-4 text-left font-medium text-slate-400 w-48">
              Category
            </th>
            {data.columns.map((col) => (
              <th
                key={col}
                className="py-2 px-3 text-right font-medium text-slate-400 min-w-28"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr
              key={row.label}
              className={`border-b border-slate-700/50 ${
                row.isHighlighted
                  ? "bg-slate-700/30 font-semibold text-white"
                  : "text-slate-300"
              }`}
            >
              <td className="py-2 pr-4">{row.label}</td>
              {row.amounts.map((amt, i) => (
                <td
                  key={i}
                  className={`py-2 px-3 text-right tabular-nums ${
                    amt !== null && amt < 0 ? "text-red-400" : ""
                  }`}
                >
                  {fmt(amt)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
