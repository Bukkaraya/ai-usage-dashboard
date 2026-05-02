import { getCached, setCache } from '$lib/server/cache';
import { runCcusage } from '$lib/server/ccusage';
import {
	normalizeClaudeUsage,
	normalizeCodexUsage,
	normalizePiUsage,
	type UsageSnapshot
} from '$lib/server/normalizer';
import { queryOpenCodeUsage } from '$lib/server/opencode-db';
import type { ToolName } from '$lib/types';

const ALL_TOOLS: ToolName[] = ['claude', 'codex', 'opencode', 'amp', 'pi'];

export async function getLocalUsageSnapshot(
	tool: ToolName | 'all' = 'all',
	since?: string,
	until?: string
): Promise<UsageSnapshot> {
	const tools = tool === 'all' ? ALL_TOOLS : [tool];
	let combined: UsageSnapshot = { usage: [], models: [] };

	for (const toolName of tools) {
		const cacheKey = `local-usage:${toolName}:${since ?? ''}:${until ?? ''}`;
		let snapshot = getCached<UsageSnapshot>(cacheKey);

		if (!snapshot) {
			snapshot = await fetchToolUsageSnapshot(toolName, since, until);
			setCache(cacheKey, snapshot);
		}

		combined = {
			usage: combined.usage.concat(snapshot.usage),
			models: combined.models.concat(snapshot.models)
		};
	}

	return combined;
}

async function fetchToolUsageSnapshot(
	tool: ToolName,
	since?: string,
	until?: string
): Promise<UsageSnapshot> {
	if (tool === 'opencode') {
		return (await queryOpenCodeUsage(since, until)) ?? { usage: [], models: [] };
	}

	const raw = await runCcusage(tool, 'daily', since, until);
	if (!raw) return { usage: [], models: [] };

	if (tool === 'codex') {
		return normalizeCodexUsage(raw as any);
	}

	if (tool === 'pi') {
		return normalizePiUsage(raw as any[]);
	}

	return normalizeClaudeUsage(raw as any, tool);
}
