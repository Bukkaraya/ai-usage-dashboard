import type { ToolName } from './types';

export const TOOL_COLORS: Record<ToolName, string> = {
	claude: '#6366f1',
	codex: '#22c55e',
	opencode: '#f97316',
	amp: '#ec4899',
	pi: '#8b5cf6'
};

export const TOOL_COMMANDS: Record<ToolName, string> = {
	claude: 'pnpm exec ccusage',
	codex: 'pnpm exec ccusage-codex',
	opencode: 'pnpm exec ccusage-opencode',
	amp: 'pnpm exec ccusage-amp',
	pi: 'pnpm exec pi'
};

export const CACHE_TTL_MS = 60_000;
