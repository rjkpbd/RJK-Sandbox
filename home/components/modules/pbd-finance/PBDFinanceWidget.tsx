"use client";

import { useEffect, useState } from "react";
import type { ProfitAndLossData } from "@/lib/quickbooks";

interface Summary {
  netIncome: number | null;
  revenue: number | null;
  lastMonth: string;
}

export default function PBDFinanceWidget() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/qbo/income-statement")
      .then((r) => r.json())
      .then((data: ProfitAndLossData & { error?: string }) => {
        if (data.error) {
          setConnected(false);
          return;
        }
        setConnected(true);
        const lastColIdx = data.columns.length - 1;
        const lastMonth = data.columns[lastColIdx] ?? "";
        const revenue =
          data.rows.find((r) => r.label === "Total Revenue")?.amounts[lastColIdx] ?? null;
        const netIncome =
          data.rows.find((r) => r.label === "Net Income")?.amounts[lastColIdx] ?? null;
        setSummary({ netIncome, revenue, lastMonth });
      })
      .catch(() => setError(true));
  }, []);

  const fmt = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  if (error) return <p className="text-sm text-slate-500">Unable to load finance data.</p>;

  if (connected === false) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-400">QuickBooks not connected.</p>
        <a href="/modules/pbd-finance" className="text-xs text-indigo-400 hover:text-indigo-300 underline">
          Connect →
        </a>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-8 bg-slate-700/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{summary.lastMonth}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-400">Revenue</p>
          <p className="text-lg font-semibold text-white tabular-nums">{fmt(summary.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Net Income</p>
          <p className={`text-lg font-semibold tabular-nums ${(summary.netIncome ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(summary.netIncome)}
          </p>
        </div>
      </div>
      <a href="/modules/pbd-finance" className="text-xs text-indigo-400 hover:text-indigo-300 underline">
        Full report →
      </a>
    </div>
  );
}
