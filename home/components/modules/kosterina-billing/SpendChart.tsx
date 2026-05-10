"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const COLORS = [
  "#6366f1", "#22d3ee", "#a78bfa", "#34d399", "#f59e0b",
  "#f87171", "#818cf8", "#2dd4bf", "#c084fc", "#fb923c",
];

type DataRow = { category: string; total: number };

export default function SpendChart({ data, title }: { data: DataRow[]; title: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>
        <p className="text-slate-500 text-sm">No data for this period.</p>
      </div>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="category"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
            formatter={(value: number) => [fmt(value), "Spend"]}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Category</th>
            <th className="text-right px-2 py-1 text-xs uppercase tracking-wider text-slate-500">Spend</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-slate-700/50">
              <td className="px-2 py-2 text-slate-300 flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {row.category}
              </td>
              <td className="px-2 py-2 text-right text-white font-mono">{fmt(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-2 py-2 text-xs text-slate-500 font-semibold uppercase">Total</td>
            <td className="px-2 py-2 text-right text-white font-mono font-semibold">
              {fmt(data.reduce((s, r) => s + r.total, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
