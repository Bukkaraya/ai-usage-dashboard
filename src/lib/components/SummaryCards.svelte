<script lang="ts">
	import type { UsageRecord, ToolName } from '$lib/types';
	import { TOOL_COLORS } from '$lib/constants';

	interface Props {
		totalCost: number;
		totalTokens: number;
		data: UsageRecord[];
		loading?: boolean;
	}

	let { totalCost, totalTokens, data, loading = false }: Props = $props();

	let mostUsedTool = $derived.by(() => {
		if (!data.length) return null;
		const toolCosts = new Map<ToolName, number>();
		for (const r of data) {
			toolCosts.set(r.tool, (toolCosts.get(r.tool) ?? 0) + r.cost);
		}
		let maxTool: ToolName = 'claude';
		let maxCost = 0;
		for (const [tool, cost] of toolCosts) {
			if (cost > maxCost) {
				maxTool = tool;
				maxCost = cost;
			}
		}
		return maxTool;
	});

	let activeDays = $derived.by(() => {
		const uniqueDates = new Set(data.map((r) => r.date));
		return uniqueDates.size;
	});

	function formatCost(cost: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(cost);
	}

	function formatTokens(tokens: number): string {
		if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
		if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
		if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
		return tokens.toLocaleString();
	}

	function toolDisplayName(tool: ToolName): string {
		const names: Record<ToolName, string> = {
			claude: 'Claude Code',
			codex: 'Codex',
			opencode: 'OpenCode',
			amp: 'Amp',
			pi: 'Pi'
		};
		return names[tool] ?? tool;
	}
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<!-- Total Cost -->
	<div class="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
		<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">Total Cost</p>
				{#if loading}
					<div class="mt-2 h-8 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700"></div>
				{:else}
					<p class="mt-2 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
						{formatCost(totalCost)}
					</p>
				{/if}
			</div>
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
				<svg class="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
				</svg>
			</div>
		</div>
	</div>

	<!-- Total Tokens -->
	<div class="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
		<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">Total Tokens</p>
				{#if loading}
					<div class="mt-2 h-8 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700"></div>
				{:else}
					<p class="mt-2 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
						{formatTokens(totalTokens)}
					</p>
				{/if}
			</div>
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
				<svg class="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
				</svg>
			</div>
		</div>
	</div>

	<!-- Most Used Tool -->
	<div class="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
		<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-400 to-purple-500"></div>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">Most Used Tool</p>
				{#if loading}
					<div class="mt-2 h-8 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700"></div>
				{:else if mostUsedTool}
					<div class="mt-2 flex items-center gap-2">
						<span
							class="inline-block h-2.5 w-2.5 rounded-full"
							style="background-color: {TOOL_COLORS[mostUsedTool]}"
						></span>
						<p class="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
							{toolDisplayName(mostUsedTool)}
						</p>
					</div>
				{:else}
					<p class="mt-2 text-2xl font-bold tracking-tight text-zinc-400 dark:text-zinc-600">&mdash;</p>
				{/if}
			</div>
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
				<svg class="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
				</svg>
			</div>
		</div>
	</div>

	<!-- Active Days -->
	<div class="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
		<div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500"></div>
		<div class="flex items-start justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">Active Days</p>
				{#if loading}
					<div class="mt-2 h-8 w-16 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700"></div>
				{:else}
					<p class="mt-2 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
						{activeDays}
					</p>
				{/if}
			</div>
			<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
				<svg class="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
				</svg>
			</div>
		</div>
	</div>
</div>
