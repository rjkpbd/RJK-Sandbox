"use client";

import { useEffect, useState, useMemo } from "react";
import { ExternalLink, X, ChevronUp, ChevronDown, Filter } from "lucide-react";
import type { NotionTask, FilterOption, TaskProperty, TasksApiResponse } from "@/app/api/notion/tasks/route";

// ─── Notion color → Tailwind badge classes ───────────────────────────────────
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

function colorClass(color: string | null) {
  return notionColorClass[color ?? "default"] ?? notionColorClass.default;
}

// ─── Cell renderers ──────────────────────────────────────────────────────────
function PropertyCell({ prop }: { prop: TaskProperty }) {
  if (prop.type === "status" || prop.type === "select") {
    if (!prop.value) return <span className="text-slate-600">—</span>;
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClass(prop.color)}`}>
        {prop.value}
      </span>
    );
  }

  if (prop.type === "multi_select") {
    if (!prop.values?.length) return <span className="text-slate-600">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {prop.values.map((v) => (
          <span key={v} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClass(prop.itemColors?.[v] ?? null)}`}>
            {v}
          </span>
        ))}
      </div>
    );
  }

  if (prop.type === "people") {
    if (!prop.values?.length) return <span className="text-slate-600">—</span>;
    return (
      <div className="flex flex-col gap-0.5">
        {prop.values.map((v) => (
          <span key={v} className="text-sm text-slate-300">{v}</span>
        ))}
      </div>
    );
  }

  if (prop.type === "date") {
    if (!prop.value) return <span className="text-slate-600">—</span>;
    try {
      const d = new Date(prop.value);
      const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const isPast = d < new Date() && prop.value;
      return <span className={`text-sm ${isPast ? "text-red-400" : "text-slate-300"}`}>{formatted}</span>;
    } catch {
      return <span className="text-sm text-slate-300">{prop.value}</span>;
    }
  }

  if (prop.type === "checkbox") {
    return (
      <span className={`text-sm ${prop.value === "true" ? "text-emerald-400" : "text-slate-600"}`}>
        {prop.value === "true" ? "✓" : "—"}
      </span>
    );
  }

  if (prop.type === "url") {
    if (!prop.value) return <span className="text-slate-600">—</span>;
    return (
      <a href={prop.value} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-sm underline truncate max-w-[180px] inline-block">
        {prop.value}
      </a>
    );
  }

  const text = prop.value;
  if (!text) return <span className="text-slate-600">—</span>;
  return <span className="text-sm text-slate-300">{text}</span>;
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
interface ActiveFilters {
  [propertyName: string]: string[];
}

function FilterBar({
  filters,
  activeFilters,
  search,
  onSearchChange,
  onFilterChange,
  onClearAll,
}: {
  filters: FilterOption[];
  activeFilters: ActiveFilters;
  search: string;
  onSearchChange: (s: string) => void;
  onFilterChange: (name: string, values: string[]) => void;
  onClearAll: () => void;
}) {
  const hasActive = search.length > 0 || Object.values(activeFilters).some((v) => v.length > 0);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {/* Search */}
      <input
        type="text"
        placeholder="Search tasks…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
      />

      {/* Filter dropdowns */}
      {filters.map((f) => {
        const selected = activeFilters[f.name] ?? [];
        return (
          <div key={f.name} className="relative">
            <select
              multiple={false}
              value={selected[0] ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                onFilterChange(f.name, val ? [val] : []);
              }}
              className={`appearance-none bg-slate-700 border rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-indigo-500 cursor-pointer ${
                selected.length > 0
                  ? "border-indigo-500 text-indigo-300"
                  : "border-slate-600 text-slate-300"
              }`}
            >
              <option value="">{f.name}</option>
              {f.values.map((opt) => (
                <option key={opt.name} value={opt.name}>{opt.name}</option>
              ))}
            </select>
            <Filter size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        );
      })}

      {/* Clear all */}
      {hasActive && (
        <button
          onClick={onClearAll}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <X size={14} />
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Sort state ───────────────────────────────────────────────────────────────
type SortDir = "asc" | "desc";

function applySortAndFilter(
  tasks: NotionTask[],
  search: string,
  activeFilters: ActiveFilters,
  sortCol: string | null,
  sortDir: SortDir
): NotionTask[] {
  let result = tasks;

  // Search by name
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((t) => t.name.toLowerCase().includes(q));
  }

  // Apply active filters
  for (const [propName, values] of Object.entries(activeFilters)) {
    if (!values.length) continue;
    result = result.filter((t) => {
      const prop = t.properties[propName];
      if (!prop) return false;
      if (prop.values) return prop.values.some((v) => values.includes(v));
      if (prop.value) return values.includes(prop.value);
      return false;
    });
  }

  // Sort
  if (sortCol) {
    result = [...result].sort((a, b) => {
      let aVal = "", bVal = "";
      if (sortCol === "_name") {
        aVal = a.name;
        bVal = b.name;
      } else {
        const ap = a.properties[sortCol];
        const bp = b.properties[sortCol];
        aVal = ap?.value ?? ap?.values?.[0] ?? "";
        bVal = bp?.value ?? bp?.values?.[0] ?? "";
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return result;
}

// ─── Table header cell ────────────────────────────────────────────────────────
function TH({
  label,
  colKey,
  sortCol,
  sortDir,
  onClick,
}: {
  label: string;
  colKey: string;
  sortCol: string | null;
  sortDir: SortDir;
  onClick: (k: string) => void;
}) {
  const active = sortCol === colKey;
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-slate-200 transition-colors"
      onClick={() => onClick(colKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ChevronUp size={12} className="opacity-20" />
        )}
      </span>
    </th>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TasksView() {
  const [data, setData] = useState<{ tasks: NotionTask[]; columns: string[]; filters: FilterOption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetch("/api/notion/tasks")
      .then((r) => r.json())
      .then((res: TasksApiResponse) => {
        if (res.error) {
          setError(res.error);
        } else {
          setData({ tasks: res.tasks, columns: res.columns, filters: res.filters });
        }
      })
      .catch(() => setError("fetch_failed"))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function handleFilterChange(name: string, values: string[]) {
    setActiveFilters((prev) => ({ ...prev, [name]: values }));
  }

  function handleClearAll() {
    setSearch("");
    setActiveFilters({});
  }

  const visibleTasks = useMemo(() => {
    if (!data) return [];
    return applySortAndFilter(data.tasks, search, activeFilters, sortCol, sortDir);
  }, [data, search, activeFilters, sortCol, sortDir]);

  // ── Error states ──
  const errorMessages: Record<string, string> = {
    not_configured: "Notion API is not configured. Set NOTION_API_KEY and NOTION_TASKS_DATABASE_ID in your environment.",
    notion_error: "Failed to fetch data from the Notion API. Check that your integration has access to the Tasks database.",
    fetch_failed: "Network error — could not reach the Notion API.",
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-slate-700/50 rounded-lg animate-pulse w-64" />
        <div className="h-64 bg-slate-800 border border-slate-700 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl px-5 py-4">
        <p className="text-sm text-red-300">{errorMessages[error] ?? `Unexpected error: ${error}`}</p>
      </div>
    );
  }

  if (!data) return null;

  const columns = data.columns;

  return (
    <div>
      {/* Filter bar */}
      <FilterBar
        filters={data.filters}
        activeFilters={activeFilters}
        search={search}
        onSearchChange={setSearch}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
      />

      {/* Count */}
      <p className="text-xs text-slate-500 mb-3">
        {visibleTasks.length} of {data.tasks.length} tasks
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-slate-800/80 border-b border-slate-700">
            <tr>
              <TH label="Task" colKey="_name" sortCol={sortCol} sortDir={sortDir} onClick={handleSort} />
              {columns.map((col) => (
                <TH key={col} label={col} colKey={col} sortCol={sortCol} sortDir={sortDir} onClick={handleSort} />
              ))}
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {visibleTasks.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-slate-500 text-sm">
                  No tasks match your filters.
                </td>
              </tr>
            ) : (
              visibleTasks.map((task) => (
                <tr key={task.id} className="bg-slate-800 hover:bg-slate-750 transition-colors group">
                  {/* Task name */}
                  <td className="px-4 py-3 font-medium text-slate-200 max-w-[280px]">
                    <span className="line-clamp-2">{task.name || <span className="text-slate-600 italic">Untitled</span>}</span>
                  </td>

                  {/* Dynamic property columns */}
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-3 whitespace-nowrap">
                      {task.properties[col] ? (
                        <PropertyCell prop={task.properties[col]} />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  ))}

                  {/* Open in Notion */}
                  <td className="px-4 py-3">
                    <a
                      href={task.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
                      title="Open in Notion"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
