import type { UsageResponse } from '$lib/types';

export async function load({ fetch, url }) {
	const range = url.searchParams.get('range') ?? 'daily';
	const since = url.searchParams.get('since') ?? '';
	const until = url.searchParams.get('until') ?? '';

	const params = new URLSearchParams({ range });
	if (since) params.set('since', since);
	if (until) params.set('until', until);

	try {
		const res = await fetch(`/api/usage?${params}`);
		if (!res.ok) {
			console.error(`Usage API returned ${res.status}: ${res.statusText}`);
			return { usage: emptyResponse(), range, error: `Failed to fetch usage data (${res.status})` };
		}
		const usage: UsageResponse = await res.json();
		return { usage, range, error: null };
	} catch (err) {
		console.error('Failed to fetch usage data:', err);
		return { usage: emptyResponse(), range, error: 'Unable to connect to the usage API' };
	}
}

function emptyResponse(): UsageResponse {
	return { data: [], totals: { totalCost: 0, totalTokens: 0 } };
}
