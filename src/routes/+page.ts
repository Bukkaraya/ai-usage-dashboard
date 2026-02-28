import type { UsageResponse } from '$lib/types';

export async function load({ fetch, url }) {
	const range = url.searchParams.get('range') ?? 'daily';
	const since = url.searchParams.get('since') ?? '';
	const until = url.searchParams.get('until') ?? '';

	const params = new URLSearchParams({ range });
	if (since) params.set('since', since);
	if (until) params.set('until', until);

	const res = await fetch(`/api/usage?${params}`);
	const usage: UsageResponse = await res.json();
	return { usage, range };
}
