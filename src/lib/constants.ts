import type { ToolName } from './types';

export const TOOL_COLORS: Record<ToolName, string> = {
	claude: '#6366f1',
	codex: '#22c55e',
	opencode: '#f97316',
	amp: '#ec4899',
	pi: '#8b5cf6'
};

export const TOOL_COMMANDS: Record<ToolName, string> = {
	claude: 'npx ccusage@latest',
	codex: 'npx @ccusage/codex@latest',
	opencode: 'npx @ccusage/opencode@latest',
	amp: 'npx @ccusage/amp@latest',
	pi: 'npx @ccusage/pi@latest'
};

export const CACHE_TTL_MS = 60_000;
