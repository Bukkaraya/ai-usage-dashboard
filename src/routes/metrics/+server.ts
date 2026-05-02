import { env } from '$env/dynamic/private';
import { getLocalUsageSnapshot } from '$lib/server/local-usage';
import { serializeUsageMetrics } from '$lib/server/prometheus';
import type { ToolName } from '$lib/types';
import type { RequestHandler } from './$types';
import { hostname } from 'node:os';

export const GET: RequestHandler = async ({ url }) => {
	const tool = (url.searchParams.get('tool') ?? 'all') as ToolName | 'all';
	const since = url.searchParams.get('since') ?? undefined;
	const until = url.searchParams.get('until') ?? undefined;

	const snapshot = await getLocalUsageSnapshot(tool, since, until);
	const body = serializeUsageMetrics(snapshot, env.USAGE_EXPORTER_INSTANCE ?? hostname());

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
			'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
		}
	});
};
