"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { TasksApiResponse } from "@/app/api/notion/tasks/route";

interface StatusSummary {
  name: string;
  color: string;
  count: number;
}

const notionColorClass: Record<string, string> = {
  default: "bg-slate-700 text-slate-300",
  gray: "bg-slate-700 text-slate-300",
  brown: "bg-amber-900/60 text-amber-300",
  orange: "bg-orange-900/60 text-orange-300",
  yellow: "bg-yellow-900/60 text-yellow-200",
  green: "bg-emerald-900/60 text-emerald-300",
  blue: "bg-blue-900/60 text-blue-300",
  purple: "bg-purple-900/60 text-purple-300",
  pink: "bg-pink-900/60 text-pink-300",
  red: "bg-red-900/60 text-red-300",
};

export default function NotionTasksWidget() {
  const [total, setTotal] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<StatusSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notion/tasks")
      .then((r) => r.json())
      .then((res: TasksApiResponse) => {
        if (res.error) { setError(res.error); return; }

        setTotal(res.tasks.length);

        // Find status/select property called "Status" or first status-type property
        const statusFilter = res.filters.find(
          (f) => f.type === "status" || (f.type === "select" && f.name.toLowerCase().includes("status"))
        ) ?? res.filters.find((f) => f.type === "status" || f.type === "select");

        if (!statusFilter) return;

        // Count per status value
        const counts: Record<string, { color: string; count: number }> = {};
        for (const task of res.tasks) {
          const prop = task.properties[statusFilter.name];
          if (!prop?.value) continue;
          if (!counts[prop.value]) counts[prop.value] = { color: prop.color ?? "default", count: 0 };
          counts[prop.value].count++;
        }

        const sorted = Object.entries(counts)
          .map(([name, { color, count }]) => ({ name, color, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setStatuses(sorted);
      })
      .catch(() => setError("fetch_failed"));
  }, []);

  if (error === "not_configured") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-400">Notion API not configured.</p>
        <p className="text-xs text-slate-500">Set NOTION_API_KEY and NOTION_TASKS_DATABASE_ID.</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-slate-500">Unable to load tasks.</p>;
  }

  if (total === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-slate-700/50 rounded animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-3xl font-bold text-white tabular-nums">{total}</p>
        <p className="text-xs text-slate-500 mt-0.5">total tasks</p>
      </div>

      {statuses.length > 0 && (
        <div className="space-y-2">
          {statuses.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${notionColorClass[s.color] ?? notionColorClass.default}`}>
                {s.name}
              </span>
              <span className="text-sm text-slate-400 tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      )}

      <a
        href="/modules/notion-tasks"
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-auto"
      >
        View all tasks <ArrowRight size={12} />
      </a>
    </div>
  );
}
