# Usage Dashboard

A single-page dashboard that visualizes daily token usage and costs across AI coding tools — Claude Code, Codex, OpenCode, Amp, and Pi-agent — using data from the [ccusage](https://github.com/ryoppippi/ccusage) CLI family.

## Prerequisites

- Node.js 18+
- npm
- One or more ccusage-compatible tools with local JSONL data:
  - `ccusage` (Claude Code)
  - `@ccusage/codex` (OpenAI Codex)
  - `@ccusage/opencode` (OpenCode)
  - `@ccusage/amp` (Amp)
  - `@ccusage/pi` (Pi-agent)

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173).

## Features

- **Stacked bar chart** — daily/weekly/monthly cost and token usage, broken down by tool
- **Cost/Token toggle** — switch the chart between USD spend and token count views
- **Daily/Weekly/Monthly** — time range aggregation toggle
- **Date range picker** — filter to specific date ranges
- **Tool breakdown table** — per-tool totals with clickable rows to filter the chart
- **Dark/light theme** — auto-detects system preference
- **In-memory cache** — 1-minute TTL to avoid re-running CLI commands on every page load

## Stack

- SvelteKit
- Chart.js
- TailwindCSS v4
- TypeScript

## How it works

The backend runs ccusage CLI commands (`npx ccusage@latest daily --json`, etc.) via server routes and normalizes the different JSON schemas into a unified format. Results are cached in-memory for 60 seconds. The frontend renders the data with Chart.js stacked bar charts.

## Production build

```bash
npm run build
npm run preview
```
