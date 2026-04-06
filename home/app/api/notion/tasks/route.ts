import { NextResponse } from "next/server";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function notionFetch(path: string, options: RequestInit = {}) {
  return fetch(`${NOTION_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export interface NotionSelectOption {
  name: string;
  color: string;
}

export interface TaskProperty {
  type: string;
  // For title, rich_text, url, email, phone, number, date, checkbox
  value: string | null;
  // For multi-value properties (multi_select, people)
  values: string[] | null;
  // Color metadata for select / status
  color: string | null;
  // Colors for each item in multi_select
  itemColors: Record<string, string> | null;
}

export interface NotionTask {
  id: string;
  url: string;
  name: string;
  lastEdited: string;
  properties: Record<string, TaskProperty>;
}

export interface FilterOption {
  name: string;
  type: string;
  values: NotionSelectOption[];
}

export interface TasksApiResponse {
  tasks: NotionTask[];
  // Columns to display (in order: name first, then by priority)
  columns: string[];
  // Filter options per filterable property
  filters: FilterOption[];
  error?: string;
}

type RawProperty = Record<string, unknown>;

function parseProperty(prop: RawProperty): TaskProperty {
  const type = prop.type as string;

  switch (type) {
    case "title": {
      const arr = (prop.title as Array<{ plain_text: string }>) ?? [];
      return { type, value: arr.map((t) => t.plain_text).join("") || null, values: null, color: null, itemColors: null };
    }
    case "rich_text": {
      const arr = (prop.rich_text as Array<{ plain_text: string }>) ?? [];
      return { type, value: arr.map((t) => t.plain_text).join("") || null, values: null, color: null, itemColors: null };
    }
    case "select": {
      const sel = prop.select as { name: string; color: string } | null;
      return { type, value: sel?.name ?? null, values: null, color: sel?.color ?? null, itemColors: null };
    }
    case "status": {
      const sel = prop.status as { name: string; color: string } | null;
      return { type, value: sel?.name ?? null, values: null, color: sel?.color ?? null, itemColors: null };
    }
    case "multi_select": {
      const arr = (prop.multi_select as Array<{ name: string; color: string }>) ?? [];
      const itemColors: Record<string, string> = {};
      arr.forEach((s) => { itemColors[s.name] = s.color; });
      return { type, value: null, values: arr.map((s) => s.name), color: null, itemColors };
    }
    case "people": {
      const arr = (prop.people as Array<{ name?: string; id: string }>) ?? [];
      return { type, value: null, values: arr.map((p) => p.name ?? p.id), color: null, itemColors: null };
    }
    case "date": {
      const d = prop.date as { start: string; end?: string | null } | null;
      return { type, value: d?.start ?? null, values: null, color: null, itemColors: null };
    }
    case "checkbox": {
      return { type, value: (prop.checkbox as boolean) ? "true" : "false", values: null, color: null, itemColors: null };
    }
    case "number": {
      const n = prop.number as number | null;
      return { type, value: n !== null && n !== undefined ? String(n) : null, values: null, color: null, itemColors: null };
    }
    case "url":
    case "email":
    case "phone_number": {
      return { type, value: (prop[type] as string | null) ?? null, values: null, color: null, itemColors: null };
    }
    case "formula": {
      const f = prop.formula as { type: string; string?: string; number?: number; boolean?: boolean; date?: { start: string } } | null;
      if (!f) return { type, value: null, values: null, color: null, itemColors: null };
      const fVal = f.string ?? (f.number !== undefined ? String(f.number) : null) ?? (f.boolean !== undefined ? String(f.boolean) : null) ?? f.date?.start ?? null;
      return { type, value: fVal, values: null, color: null, itemColors: null };
    }
    default:
      return { type, value: null, values: null, color: null, itemColors: null };
  }
}

// Priority order for columns — match common property names case-insensitively
const COLUMN_PRIORITY = ["name", "status", "assignee", "assigned to", "owner", "client", "company", "project", "priority", "due date", "due", "date"];

function columnSortKey(name: string): number {
  const lower = name.toLowerCase();
  const idx = COLUMN_PRIORITY.findIndex((p) => lower.includes(p));
  return idx === -1 ? COLUMN_PRIORITY.length : idx;
}

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return NextResponse.json<TasksApiResponse>(
      { tasks: [], columns: [], filters: [], error: "not_configured" },
      { status: 200 }
    );
  }

  // Paginate through all tasks
  const tasks: NotionTask[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    };
    if (cursor) body.start_cursor = cursor;

    let res: Response;
    try {
      res = await notionFetch(`/databases/${databaseId}/query`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch {
      return NextResponse.json<TasksApiResponse>(
        { tasks: [], columns: [], filters: [], error: "fetch_failed" },
        { status: 200 }
      );
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("Notion API error:", errBody);
      return NextResponse.json<TasksApiResponse>(
        { tasks: [], columns: [], filters: [], error: "notion_error" },
        { status: 200 }
      );
    }

    const data = await res.json();

    for (const page of data.results as Array<{ id: string; url: string; last_edited_time: string; properties: Record<string, RawProperty> }>) {
      const props: Record<string, TaskProperty> = {};
      let name = "";

      for (const [key, raw] of Object.entries(page.properties)) {
        const parsed = parseProperty(raw);
        props[key] = parsed;
        if (raw.type === "title") {
          name = parsed.value ?? "";
        }
      }

      tasks.push({
        id: page.id,
        url: page.url,
        name,
        lastEdited: page.last_edited_time,
        properties: props,
      });
    }

    cursor = data.has_more ? (data.next_cursor as string) : undefined;
  } while (cursor);

  // Determine visible columns (excluding title — shown separately as name)
  const filterableTypes = new Set(["select", "multi_select", "people", "status"]);
  const displayableTypes = new Set(["select", "multi_select", "people", "status", "date", "rich_text", "checkbox", "number", "url", "formula"]);

  const allColumns = new Set<string>();
  const filterMap = new Map<string, { type: string; valueMap: Map<string, string> }>();

  for (const task of tasks) {
    for (const [key, prop] of Object.entries(task.properties)) {
      if (prop.type === "title") continue; // name shown separately
      if (displayableTypes.has(prop.type)) allColumns.add(key);

      if (filterableTypes.has(prop.type)) {
        if (!filterMap.has(key)) filterMap.set(key, { type: prop.type, valueMap: new Map() });
        const entry = filterMap.get(key)!;

        if (prop.values) {
          prop.values.forEach((v) => {
            const color = prop.itemColors?.[v] ?? "default";
            if (!entry.valueMap.has(v)) entry.valueMap.set(v, color);
          });
        } else if (prop.value) {
          if (!entry.valueMap.has(prop.value)) entry.valueMap.set(prop.value, prop.color ?? "default");
        }
      }
    }
  }

  const columns = Array.from(allColumns).sort((a, b) => columnSortKey(a) - columnSortKey(b));

  const filters: FilterOption[] = Array.from(filterMap.entries())
    .sort(([a], [b]) => columnSortKey(a) - columnSortKey(b))
    .map(([name, { type, valueMap }]) => ({
      name,
      type,
      values: Array.from(valueMap.entries())
        .map(([n, color]) => ({ name: n, color }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

  return NextResponse.json<TasksApiResponse>({ tasks, columns, filters });
}
