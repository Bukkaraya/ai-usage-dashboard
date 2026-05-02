import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { getCached, setCache } from '$lib/server/cache';
import { getLocalUsageSnapshot } from '$lib/server/local-usage';
import {
	aggregateModelUsageForRange,
	aggregateUsageForRange,
	parseUsageMetrics,
	type UsageSnapshot
} from '$lib/server/prometheus';
import type { TimeRange, ToolName, UsageResponse } from '$lib/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const tool = (url.searchParams.get('tool') ?? 'all') as ToolName | 'all';
	const range = (url.searchParams.get('range') ?? 'daily') as TimeRange;
	const since = url.searchParams.get('since') ?? undefined;
	const until = url.searchParams.get('until') ?? undefined;

	const snapshots = await loadSnapshots(fetch, tool, since, until);
	const usage = aggregateUsageForRange(snapshots.usage, range);
	const models = aggregateModelUsageForRange(snapshots.models, range);

	const filteredUsage = tool === 'all' ? usage : usage.filter((record) => record.tool === tool);
	const filteredModels = tool === 'all' ? models : models.filter((record) => record.tool === tool);
	const totalCost = filteredUsage.reduce((sum, record) => sum + record.cost, 0);
	const totalTokens = filteredUsage.reduce((sum, record) => sum + record.totalTokens, 0);

	const response: UsageResponse = {
		data: filteredUsage,
		models: filteredModels,
		totals: { totalCost, totalTokens }
	};

	return json(response, {
		headers: {
			'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
		}
	});
};

async function loadSnapshots(
	fetchImpl: typeof fetch,
	tool: ToolName | 'all',
	since?: string,
	until?: string
): Promise<UsageSnapshot> {
	const targets = getScrapeTargets();
	const includeLocal = shouldIncludeLocal();
	let combined: UsageSnapshot = { usage: [], models: [] };

	if (includeLocal || targets.length === 0) {
		const local = await getLocalUsageSnapshot(tool, since, until);
		combined = mergeSnapshots(combined, local);
	}

	for (const target of targets) {
		const cacheKey = `remote-metrics:${target}:${tool}:${since ?? ''}:${until ?? ''}`;
		let snapshot = getCached<UsageSnapshot>(cacheKey);

		if (!snapshot) {
			try {
				const response = await fetchImpl(buildMetricsUrl(target, tool, since, until));
				if (!response.ok) continue;
				snapshot = parseUsageMetrics(await response.text());
				setCache(cacheKey, snapshot);
			} catch {
				continue;
			}
		}

		combined = mergeSnapshots(combined, snapshot);
	}

	return combined;
}

function mergeSnapshots(left: UsageSnapshot, right: UsageSnapshot): UsageSnapshot {
	return {
		usage: left.usage.concat(right.usage),
		models: left.models.concat(right.models)
	};
}

function getScrapeTargets(): string[] {
	return (env.USAGE_SCRAPE_TARGETS ?? '')
		.split(/[\n,]/)
		.map((value) => value.trim())
		.filter(Boolean);
}

function shouldIncludeLocal(): boolean {
	return (env.USAGE_INCLUDE_LOCAL_METRICS ?? 'true').toLowerCase() !== 'false';
}

function buildMetricsUrl(
	target: string,
	tool: ToolName | 'all',
	since?: string,
	until?: string
): string {
	const base = target.endsWith('/metrics') ? new URL(target) : new URL('/metrics', withTrailingSlash(target));
	if (tool !== 'all') base.searchParams.set('tool', tool);
	if (since) base.searchParams.set('since', since);
	if (until) base.searchParams.set('until', until);
	return base.toString();
}

function withTrailingSlash(target: string): string {
	return target.endsWith('/') ? target : `${target}/`;
}
