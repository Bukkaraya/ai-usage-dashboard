# Usage Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use superpowers:frontend-design for all UI/component tasks (Tasks 4-7).

**Goal:** Build a single-page SvelteKit dashboard that visualizes daily token usage and costs across AI coding tools using ccusage CLI data.

**Architecture:** SvelteKit server routes run ccusage CLI commands with `--json` and cache results in-memory with 1-min TTL. Chart.js renders stacked bar charts. TailwindCSS for styling. No database.

**Tech Stack:** SvelteKit, Chart.js (via svelte-chartjs), TailwindCSS v4, TypeScript

**Design doc:** `docs/plans/2026-02-27-usage-dashboard-design.md`

---

### Task 1: Scaffold SvelteKit project

**Files:**
- Create: project root scaffolding via `sv create`

**Step 1: Initialize SvelteKit project**

Run: `npx sv create . --template minimal --types ts --no-install`

**Step 2: Add TailwindCSS**

Run: `npx sv add tailwindcss`

**Step 3: Install dependencies**

Run: `npm install chart.js svelte-chartjs`

**Step 4: Verify project runs**

Run: `npm run dev -- --port 5173`
Expected: Dev server starts at localhost:5173

**Step 5: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold SvelteKit project with TailwindCSS and Chart.js"
```

---

### Task 2: Define shared types and constants

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/constants.ts`

**Step 1: Create types**

```typescript
// src/lib/types.ts
export interface UsageRecord {
  date: string;
  tool: ToolName;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  cost: number;
  models: string[];
}

export interface UsageTotals {
  totalTokens: number;
  totalCost: number;
}

export interface UsageResponse {
  data: UsageRecord[];
  totals: UsageTotals;
}

export type ToolName = 'claude' | 'codex' | 'opencode' | 'amp' | 'pi';
export type TimeRange = 'daily' | 'weekly' | 'monthly';
```

**Step 2: Create constants**

```typescript
// src/lib/constants.ts
import type { ToolName } from './types';

export const TOOL_COLORS: Record<ToolName, string> = {
  claude: '#6366f1',   // indigo
  codex: '#22c55e',    // green
  opencode: '#f97316', // orange
  amp: '#ec4899',      // pink
  pi: '#8b5cf6',       // violet
};

export const TOOL_COMMANDS: Record<ToolName, string> = {
  claude: 'npx ccusage@latest',
  codex: 'npx @ccusage/codex@latest',
  opencode: 'npx @ccusage/opencode@latest',
  amp: 'npx @ccusage/amp@latest',
  pi: 'npx @ccusage/pi@latest',
};

export const CACHE_TTL_MS = 60_000; // 1 minute
```

**Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add shared types and constants"
```

---

### Task 3: Build the data fetching and caching layer

**Files:**
- Create: `src/lib/server/cache.ts`
- Create: `src/lib/server/ccusage.ts`
- Create: `src/lib/server/normalizer.ts`
- Create: `src/routes/api/usage/+server.ts`

**Step 1: Build the in-memory cache**

```typescript
// src/lib/server/cache.ts
import { CACHE_TTL_MS } from '$lib/constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}
```

**Step 2: Build the ccusage CLI runner**

```typescript
// src/lib/server/ccusage.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOL_COMMANDS } from '$lib/constants';
import type { ToolName } from '$lib/types';

const execAsync = promisify(exec);
const TIMEOUT_MS = 30_000;

export async function runCcusage(
  tool: ToolName,
  subcommand: 'daily' | 'monthly',
  since?: string,
  until?: string
): Promise<unknown> {
  const cmd = TOOL_COMMANDS[tool];
  const args = [subcommand, '--json'];
  if (since) args.push('--since', since);
  if (until) args.push('--until', until);

  const fullCmd = `${cmd} ${args.join(' ')}`;

  try {
    const { stdout } = await execAsync(fullCmd, { timeout: TIMEOUT_MS });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}
```

**Step 3: Build the normalizer**

This normalizes the different JSON schemas from each tool into our unified `UsageRecord` format.

```typescript
// src/lib/server/normalizer.ts
import type { UsageRecord, ToolName } from '$lib/types';

// Claude/OpenCode/Amp schema
interface ClaudeDaily {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
}

// Codex schema
interface CodexDaily {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  costUSD: number;
  models: Record<string, unknown>;
}

export function normalizeClaude(data: { daily: ClaudeDaily[] }, tool: ToolName): UsageRecord[] {
  return (data.daily ?? []).map((d) => ({
    date: d.date,
    tool,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    cacheTokens: (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0),
    totalTokens: d.totalTokens,
    cost: d.totalCost ?? 0,
    models: d.modelsUsed ?? [],
  }));
}

export function normalizeCodex(data: { daily: CodexDaily[] }): UsageRecord[] {
  return (data.daily ?? []).map((d) => ({
    date: d.date,
    tool: 'codex' as ToolName,
    inputTokens: d.inputTokens,
    outputTokens: d.outputTokens,
    cacheTokens: d.cachedInputTokens ?? 0,
    totalTokens: d.totalTokens,
    cost: d.costUSD ?? 0,
    models: Object.keys(d.models ?? {}),
  }));
}

export function normalizePi(data: unknown[]): UsageRecord[] {
  // Pi returns a raw array — adapt as needed when data is available
  return (data ?? []).map((d: any) => ({
    date: d.date ?? '',
    tool: 'pi' as ToolName,
    inputTokens: d.inputTokens ?? 0,
    outputTokens: d.outputTokens ?? 0,
    cacheTokens: 0,
    totalTokens: d.totalTokens ?? 0,
    cost: d.totalCost ?? d.costUSD ?? 0,
    models: d.modelsUsed ?? [],
  }));
}
```

**Step 4: Build the API endpoint**

```typescript
// src/routes/api/usage/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ToolName, TimeRange, UsageRecord } from '$lib/types';
import { runCcusage } from '$lib/server/ccusage';
import { normalizeClaude, normalizeCodex, normalizePi } from '$lib/server/normalizer';
import { getCached, setCache } from '$lib/server/cache';

const ALL_TOOLS: ToolName[] = ['claude', 'codex', 'opencode', 'amp', 'pi'];

export const GET: RequestHandler = async ({ url }) => {
  const toolParam = (url.searchParams.get('tool') ?? 'all') as ToolName | 'all';
  const range = (url.searchParams.get('range') ?? 'daily') as TimeRange;
  const since = url.searchParams.get('since') ?? undefined;
  const until = url.searchParams.get('until') ?? undefined;

  const tools: ToolName[] = toolParam === 'all' ? ALL_TOOLS : [toolParam];
  const subcommand = range === 'monthly' ? 'monthly' : 'daily';

  let allRecords: UsageRecord[] = [];

  for (const tool of tools) {
    const cacheKey = `${tool}:${subcommand}:${since ?? ''}:${until ?? ''}`;
    let records = getCached<UsageRecord[]>(cacheKey);

    if (!records) {
      const raw = await runCcusage(tool, subcommand, since, until);
      if (!raw) continue;

      if (tool === 'codex') {
        records = normalizeCodex(raw as any);
      } else if (tool === 'pi') {
        records = normalizePi(raw as any);
      } else {
        records = normalizeClaude(raw as any, tool);
      }
      setCache(cacheKey, records);
    }

    allRecords = allRecords.concat(records);
  }

  // Weekly aggregation
  if (range === 'weekly') {
    allRecords = aggregateWeekly(allRecords);
  }

  const totalCost = allRecords.reduce((s, r) => s + r.cost, 0);
  const totalTokens = allRecords.reduce((s, r) => s + r.totalTokens, 0);

  return json({
    data: allRecords,
    totals: { totalCost, totalTokens },
  });
};

function aggregateWeekly(records: UsageRecord[]): UsageRecord[] {
  const weekMap = new Map<string, UsageRecord>();

  for (const r of records) {
    const d = new Date(r.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const weekStart = new Date(d.setDate(diff));
    const weekKey = `${weekStart.toISOString().slice(0, 10)}|${r.tool}`;

    const existing = weekMap.get(weekKey);
    if (existing) {
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.cacheTokens += r.cacheTokens;
      existing.totalTokens += r.totalTokens;
      existing.cost += r.cost;
      for (const m of r.models) {
        if (!existing.models.includes(m)) existing.models.push(m);
      }
    } else {
      weekMap.set(weekKey, { ...r, date: weekStart.toISOString().slice(0, 10) });
    }
  }

  return Array.from(weekMap.values());
}
```

**Step 5: Test the API manually**

Run: `npm run dev`
Then: `curl "http://localhost:5173/api/usage?range=daily&since=20260220"`
Expected: JSON response with normalized data from all available tools

**Step 6: Commit**

```bash
git add src/lib/server/ src/routes/api/
git commit -m "feat: add ccusage data layer with caching and normalization"
```

---

### Task 4: Build the dashboard page layout and summary cards

> **REQUIRED SUB-SKILL:** Use superpowers:frontend-design for this task.

**Files:**
- Modify: `src/routes/+page.svelte`
- Create: `src/routes/+page.ts` (client-side data loader)
- Create: `src/lib/components/SummaryCards.svelte`
- Create: `src/lib/components/TimeRangeToggle.svelte`
- Create: `src/lib/components/DateRangePicker.svelte`

**Requirements for frontend-design:**
- Header with "Usage Dashboard" title, TimeRangeToggle (Daily/Weekly/Monthly buttons), and DateRangePicker
- Four SummaryCards: Total Cost, Total Tokens, Most Used Tool, Active Days
- Dark/light theme following system preference
- Minimal, clean design with good spacing
- Use TailwindCSS v4 for all styling
- Data is fetched from `/api/usage` with query params based on selected range/dates
- Cards should show loading skeleton while data is fetching

**Step 1: Create the page data loader**

```typescript
// src/routes/+page.ts
import type { UsageResponse } from '$lib/types';

export async function load({ fetch, url }) {
  const range = url.searchParams.get('range') ?? 'daily';
  const since = url.searchParams.get('since') ?? '';
  const until = url.searchParams.get('until') ?? '';

  const params = new URLSearchParams({ range });
  if (since) params.set('since', since);
  if (until) params.set('until', until);

  const res = await fetch(`/api/usage?${params}`);
  const usage: UsageResponse = await res.json();
  return { usage, range };
}
```

**Step 2: Build components using frontend-design skill**

Use the frontend-design skill to implement:
- `TimeRangeToggle.svelte` — three buttons (Daily/Weekly/Monthly), active state styling
- `DateRangePicker.svelte` — two date inputs for since/until
- `SummaryCards.svelte` — four stat cards in a grid

**Step 3: Wire up +page.svelte**

The page layout should be: header (title + controls) at top, summary cards below, then chart area (Task 5), then table (Task 6).

**Step 4: Commit**

```bash
git add src/routes/ src/lib/components/
git commit -m "feat: add dashboard layout with summary cards and controls"
```

---

### Task 5: Build the stacked bar chart

> **REQUIRED SUB-SKILL:** Use superpowers:frontend-design for this task.

**Files:**
- Create: `src/lib/components/UsageChart.svelte`
- Modify: `src/routes/+page.svelte` (integrate chart)

**Requirements for frontend-design:**
- Stacked bar chart using `svelte-chartjs` `Bar` component
- X-axis: dates, Y-axis: cost (USD) by default
- Toggle button to switch Y-axis between cost and token count
- Bars stacked by tool using colors from `TOOL_COLORS` constant
- Tooltip on hover showing per-tool breakdown for that date
- Chart must be responsive, filling available width
- Smooth transitions when data changes
- Reference: `import { Bar } from 'svelte-chartjs'` and register needed Chart.js components

**Step 1: Build UsageChart.svelte using frontend-design skill**

The component receives `UsageRecord[]` as a prop and transforms it into Chart.js datasets:
- Group records by date
- Create one dataset per tool (stacked)
- Support toggling between cost and token views

**Step 2: Integrate into +page.svelte**

**Step 3: Verify chart renders with real data**

Run: `npm run dev`
Expected: Stacked bar chart with real ccusage data, hoverable tooltips

**Step 4: Commit**

```bash
git add src/lib/components/UsageChart.svelte src/routes/+page.svelte
git commit -m "feat: add stacked bar chart with cost/token toggle"
```

---

### Task 6: Build the tool breakdown table

> **REQUIRED SUB-SKILL:** Use superpowers:frontend-design for this task.

**Files:**
- Create: `src/lib/components/ToolBreakdownTable.svelte`
- Modify: `src/routes/+page.svelte` (integrate table)

**Requirements for frontend-design:**
- Table with columns: Tool (with color dot), Total Tokens, Total Cost, % of Total
- One row per tool that has data
- Clickable rows — clicking filters the chart to show only that tool
- Active/selected row highlight
- "Show All" button to reset filter
- Responsive — horizontal scroll on small screens if needed

**Step 1: Build ToolBreakdownTable.svelte using frontend-design skill**

The component receives `UsageRecord[]` and emits a `filterTool` event when a row is clicked.

**Step 2: Wire up filtering**

In `+page.svelte`, maintain a `selectedTool` state. When set, filter the chart data to only that tool. Table click sets it, "Show All" clears it.

**Step 3: Commit**

```bash
git add src/lib/components/ToolBreakdownTable.svelte src/routes/+page.svelte
git commit -m "feat: add tool breakdown table with click-to-filter"
```

---

### Task 7: Polish, theming, and final integration

> **REQUIRED SUB-SKILL:** Use superpowers:frontend-design for this task.

**Files:**
- Modify: `src/app.html` (meta tags, title)
- Modify: `src/routes/+layout.svelte` (global styles, theme)
- Modify: `src/routes/+page.svelte` (final wiring)
- Modify: `src/app.css` (if needed for Chart.js dark mode)

**Requirements for frontend-design:**
- Dark/light theme using Tailwind `dark:` classes and `prefers-color-scheme`
- Chart.js colors adapt to dark/light mode (grid lines, text, tooltips)
- Loading state: skeleton placeholders while API fetches
- Empty state: "No usage data for this period" message with icon
- Error state: friendly error message if API fails
- Page title: "Usage Dashboard"
- Ensure responsive layout works on mobile

**Step 1: Implement theming and states using frontend-design skill**

**Step 2: End-to-end verification**

Run: `npm run dev`
Verify:
- Dashboard loads with real data
- Daily/Weekly/Monthly toggle works
- Date range picker filters data
- Chart shows stacked bars by tool
- Cost/Token toggle works on chart
- Table rows are clickable and filter chart
- Dark mode works (toggle system preference)
- Empty states show when no data

**Step 3: Build for production**

Run: `npm run build && npm run preview`
Expected: Production build works at localhost:4173

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish dashboard with theming, loading states, and responsive layout"
```

---

## Summary

| Task | Description | Depends on |
|------|-------------|------------|
| 1 | Scaffold SvelteKit project | — |
| 2 | Shared types and constants | 1 |
| 3 | Data layer (cache, CLI runner, normalizer, API) | 2 |
| 4 | Dashboard layout + summary cards (frontend-design) | 3 |
| 5 | Stacked bar chart (frontend-design) | 4 |
| 6 | Tool breakdown table (frontend-design) | 4 |
| 7 | Polish, theming, final integration (frontend-design) | 5, 6 |
