# Usage Dashboard Design

A single-page SvelteKit dashboard that visualizes daily token usage and costs across AI coding tools (Claude Code, Codex, OpenCode, Amp, Pi-agent) using data from the ccusage CLI family.

## Architecture

**Stack:** SvelteKit + Chart.js + TailwindCSS

**Approach:** SvelteKit server routes run ccusage CLI commands with `--json` and cache results in-memory with a 1-minute TTL. No database, no file cache — the JSONL files ccusage reads from are the persistent store.

## API

Single endpoint: `GET /api/usage`

Query params:
- `tool` — `claude | codex | opencode | amp | pi | all` (default: `all`)
- `range` — `daily | weekly | monthly` (default: `daily`)
- `since` / `until` — date strings (YYYYMMDD)

Response: normalized array of records with unified schema across all tools:

```json
{
  "data": [
    {
      "date": "2026-02-27",
      "tool": "claude",
      "inputTokens": 19,
      "outputTokens": 1288,
      "cacheTokens": 453461,
      "totalTokens": 454768,
      "cost": 0.49,
      "models": ["claude-opus-4-6"]
    }
  ],
  "totals": {
    "totalTokens": 95091293,
    "totalCost": 58.67
  }
}
```

Weekly view: server aggregates daily data into ISO weeks. Monthly view: uses ccusage `monthly` command.

## UI Layout

### Header
- Title: "Usage Dashboard"
- Time-range toggle: Daily / Weekly / Monthly
- Date range picker

### Summary Cards
Four cards showing totals for the selected period:
- Total cost (USD)
- Total tokens
- Most used tool
- Number of active days

### Main Chart
Stacked bar chart (Chart.js):
- X-axis: dates (days, weeks, or months)
- Y-axis: cost in USD, with toggle to switch to token count
- Bars stacked by tool (claude=blue, codex=green, opencode=orange)
- Tooltip on hover shows per-tool breakdown

### Tool Breakdown Table
Below the chart:
- One row per tool: name, total tokens, total cost, % of total
- Clickable rows to filter the chart to a single tool

## Theming
Dark/light theme following system preference. Minimal design — no sidebar, no navigation, just the dashboard.

## Error Handling
- Missing tools or empty data: show "No data" gracefully
- Command timeout (10s): return cached data if available, otherwise error message
- Empty date range: "No usage data for this period" message

## Data Sources (ccusage CLI)

| Tool | Command | Key differences |
|------|---------|-----------------|
| Claude Code | `npx ccusage@latest daily --json` | Has `cacheCreationTokens`, `cacheReadTokens` |
| Codex | `npx @ccusage/codex@latest daily --json` | Has `cachedInputTokens`, `reasoningOutputTokens`, no cost field uses `costUSD` |
| OpenCode | `npx @ccusage/opencode@latest daily --json` | Same schema as Claude |
| Amp | `npx @ccusage/amp@latest daily --json` | Same schema as Claude |
| Pi-agent | `npx @ccusage/pi@latest daily --json` | Array format, no wrapper |
