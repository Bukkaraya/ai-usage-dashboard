# Usage Dashboard

A single-page dashboard that visualizes daily token usage and costs across AI coding tools — Claude Code, Codex, OpenCode, Amp, and Pi-agent — using data from the [ccusage](https://github.com/ryoppippi/ccusage) CLI family.

## Prerequisites

- Node.js 18+
- pnpm
- One or more ccusage-compatible tools with local JSONL data:
  - `ccusage` (Claude Code)
  - `@ccusage/codex` (OpenAI Codex)
  - `@ccusage/opencode` (OpenCode)
  - `@ccusage/amp` (Amp)
  - `@ccusage/pi` (Pi-agent)

## Quickstart

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The dashboard reads local usage data from installed ccusage-compatible tools and exposes the same data as Prometheus metrics at `/metrics`.

## Features

- **Stacked bar chart** — daily/weekly/monthly cost and token usage, broken down by tool
- **Model breakdown table** — aggregated per-model token usage sourced from Prometheus metrics
- **Cost/Token toggle** — switch the chart between USD spend and token count views
- **Daily/Weekly/Monthly** — time range aggregation toggle
- **Date range picker** — filter to specific date ranges
- **Tool breakdown table** — per-tool totals with clickable rows to filter the chart
- **Prometheus exporter** — each node can expose its local usage at `/metrics`
- **Multi-server aggregation** — one dashboard node can scrape peer exporters and combine them
- **Dark/light theme** — auto-detects system preference
- **In-memory cache** — 1-minute TTL to avoid re-running CLI commands on every page load

## Stack

- SvelteKit
- Chart.js
- TailwindCSS v4
- TypeScript

## How it works

Each server can expose its local usage data as Prometheus text at [`/metrics`](http://localhost:5173/metrics). The dashboard API scrapes one or more of those exporters, parses the metric series, aggregates them by day/week/month, and returns the combined result to the UI.

Local usage still comes from the ccusage CLI family (and the OpenCode SQLite DB), but the dashboard-facing source of truth is now the Prometheus metric stream rather than the raw CLI JSON.

## Multi-server setup

Set these environment variables on the dashboard node:

- `USAGE_SCRAPE_TARGETS` — comma-separated or newline-separated list of peer base URLs or `/metrics` URLs, for example `http://server-a:5173,http://server-b:5173`
- `USAGE_INCLUDE_LOCAL_METRICS` — set to `false` if the dashboard node should only show remote peers
- `USAGE_EXPORTER_INSTANCE` — optional label value for the local exporter instance name

Example:

```bash
export USAGE_SCRAPE_TARGETS="http://server-a:5173,http://server-b:5173"
export USAGE_INCLUDE_LOCAL_METRICS=true
pnpm dev
```

## Production build

```bash
pnpm build
pnpm preview
```
