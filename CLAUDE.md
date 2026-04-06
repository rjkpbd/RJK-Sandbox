# RJK-Temp2

Personal sandbox site with a home/landing page and independently developed modules.

## Project Purpose

A home site for experimenting with self-contained modules. Each module is independently editable and deployable. The home site acts as a launchpad/dashboard linking to the modules.

## Tech Stack

- **Home site:** Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Auth:** Google OAuth via Supabase Auth (not yet wired up)
- **Database:** Supabase (Postgres) — client wired up, project: `vzwblrdtltsrdimrjutf`
- **Frontend per module:** TBD — document here as modules are added

## File Structure

```
/
├── home/                        # Home site (Next.js app)
│   ├── app/                     # Next.js App Router pages
│   ├── components/
│   │   ├── layout/              # AppShell, Sidebar, SidebarLink
│   │   └── dashboard/           # WidgetGrid, WidgetCard
│   ├── lib/
│   │   └── moduleRegistry.ts    # Single source of truth for all modules
│   └── types/
│       └── modules.ts           # ModuleEntry, WidgetDefinition types
├── modules/
│   └── <module-name>/           # Each module is fully self-contained here
│       └── home-widget/         # Optional: widget component for the dashboard
├── shared/
│   └── supabase/
│       └── client.ts            # Supabase client (createClient) — import from here
└── CLAUDE.md
```

## Home Site

Run locally:
```bash
cd home && npm run dev
```

### Module Registry

`home/lib/moduleRegistry.ts` is the **single file to edit** when adding a module. It drives both the sidebar navigation and the dashboard widget grid. No other files need to change.

Each entry shape:
```ts
{
  id: string           // unique slug
  label: string        // display name
  href: string         // route or URL
  icon: string         // Lucide icon name (e.g. "LayoutDashboard")
  description: string  // shown in widget subtitle
  widget?: {
    component: React.ComponentType  // imported from modules/<name>/home-widget/
    size: "small" | "medium" | "large"
  }
  tags?: string[]
}
```

### Dashboard Widgets

- Widget grid is 3 columns on desktop, 1 on mobile
- `size` maps to Tailwind `col-span`: small=1, medium=2, large=3
- Each widget owns its own data fetching — the dashboard page itself fetches nothing
- Shows an empty state when no widgets are registered

## Module Conventions

- Each module lives under `modules/<module-name>/`
- Modules should be **self-contained**: own components, styles, and logic
- Modules may import shared utilities from `shared/` but must not depend on each other
- If a module wants a dashboard widget, export a React component from `modules/<module-name>/home-widget/`

## Auth

- Google Authentication via Supabase Auth — not yet implemented
- When added, shared auth logic will live in `shared/auth`
- Modules should consume the shared auth client, not implement their own

## Supabase

- Client initialized in `shared/supabase/client.ts` — import `supabase` from there
- Project URL: `https://vzwblrdtltsrdimrjutf.supabase.co`
- Env vars (in `home/.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Adding a New Module

1. Create `modules/<module-name>/`
2. Optionally create `modules/<module-name>/home-widget/MyWidget.tsx`
3. Add one entry to `home/lib/moduleRegistry.ts`
4. Document the module's purpose and any new env vars in this file

## Existing Modules

### notion-tasks

Displays all tasks from a Notion database with client-side filtering by any column (Assignee, Client, Status, etc.).

- **Route:** `/modules/notion-tasks`
- **Widget:** Small dashboard widget showing total task count and per-status breakdown
- **API:** `GET /api/notion/tasks` — fetches all pages from the database, parses properties, and returns tasks + filter options
- **Key files:**
  - `home/app/api/notion/tasks/route.ts` — Notion API proxy (paginates, parses all property types)
  - `home/components/modules/notion-tasks/TasksView.tsx` — full page with search, filter dropdowns, sortable table
  - `home/components/modules/notion-tasks/NotionTasksWidget.tsx` — dashboard widget
- **Required env vars** (add to `home/.env.local`):
  - `NOTION_API_KEY` — internal integration token from notion.so/my-integrations
  - `NOTION_TASKS_DATABASE_ID` — ID of the Notion database (from the database URL)
