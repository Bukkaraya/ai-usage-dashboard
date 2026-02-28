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

	if (range === 'weekly') {
		allRecords = aggregateWeekly(allRecords);
	}

	const totalCost = allRecords.reduce((s, r) => s + r.cost, 0);
	const totalTokens = allRecords.reduce((s, r) => s + r.totalTokens, 0);

	return json({
		data: allRecords,
		totals: { totalCost, totalTokens }
	});
};

function aggregateWeekly(records: UsageRecord[]): UsageRecord[] {
	const weekMap = new Map<string, UsageRecord>();

	for (const r of records) {
		const d = new Date(r.date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
