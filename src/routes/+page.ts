import { dev } from '$app/environment';
import type { UsageResponse } from '$lib/types';

const CLIENT_CACHE_TTL_MS = 60_000;
const clientCache = new Map<string, { data: UsageResponse; timestamp: number }>();

export async function load({ fetch, url }) {
	const range = url.searchParams.get('range') ?? 'daily';
	const since = url.searchParams.get('since') ?? '';
	const until = url.searchParams.get('until') ?? '';

	const params = new URLSearchParams({ range });
	if (since) params.set('since', since);
	if (until) params.set('until', until);

	const cacheKey = params.toString();
	const cached = clientCache.get(cacheKey);
	if (!dev && cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
		return { usage: cached.data, range, error: null };
	}

	try {
		const res = await fetch(`/api/usage?${params}`);
		if (!res.ok) {
			console.error(`Usage API returned ${res.status}: ${res.statusText}`);
			return { usage: emptyResponse(), range, error: `Failed to fetch usage data (${res.status})` };
		}
		const usage: UsageResponse = await res.json();
		if (!dev) {
			clientCache.set(cacheKey, { data: usage, timestamp: Date.now() });
		}
		return { usage, range, error: null };
	} catch (err) {
		console.error('Failed to fetch usage data:', err);
		return { usage: emptyResponse(), range, error: 'Unable to connect to the usage API' };
	}
}

function emptyResponse(): UsageResponse {
	return { data: [], models: [], totals: { totalCost: 0, totalTokens: 0 } };
}
