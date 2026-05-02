<script lang="ts">
	import type { ModelFilter, ModelUsageRecord, ToolName } from '$lib/types';
	import { TOOL_COLORS } from '$lib/constants';

	interface Props {
		data: ModelUsageRecord[];
		selectedTool: ToolName | null;
		selectedModel: ModelFilter | null;
		onfilter: (model: ModelFilter | null) => void;
	}

	let { data, selectedTool, selectedModel, onfilter }: Props = $props();

	const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
		claude: 'Claude Code',
		codex: 'Codex',
		opencode: 'OpenCode',
		amp: 'Amp',
		pi: 'Pi'
	};

	interface ModelAggregate {
		tool: ToolName;
		model: string;
		totalTokens: number;
		activePeriods: number;
	}

	let rows = $derived.by(() => {
		const filtered = selectedTool ? data.filter((record) => record.tool === selectedTool) : data;
		const map = new Map<string, ModelAggregate>();

		for (const record of filtered) {
			const key = `${record.tool}|${record.model}`;
			const existing = map.get(key);
			if (existing) {
				existing.totalTokens += record.totalTokens;
				existing.activePeriods += 1;
			} else {
				map.set(key, {
					tool: record.tool,
					model: record.model,
					totalTokens: record.totalTokens,
					activePeriods: 1
				});
			}
		}

		return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens);
	});

	function formatTokens(tokens: number): string {
		if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
		if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
		if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
		return tokens.toLocaleString();
	}

	function isSelected(row: ModelAggregate): boolean {
		return selectedModel?.tool === row.tool && selectedModel?.model === row.model;
	}

	function handleRowClick(row: ModelAggregate) {
		if (isSelected(row)) {
			onfilter(null);
			return;
		}

		onfilter({ tool: row.tool, model: row.model });
	}
</script>

<div class="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
	<div class="flex items-center justify-between px-6 pt-6 pb-4">
		<div>
			<h3 class="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
				Model Breakdown
			</h3>
			<p class="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
				Aggregated from scraped Prometheus usage metrics
			</p>
		</div>
		{#if selectedModel}
			<button
				onclick={() => onfilter(null)}
				class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors duration-150 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
			>
				<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
				</svg>
				Show All Models
			</button>
		{/if}
	</div>

	<div class="overflow-x-auto">
		<table class="w-full min-w-[560px] text-sm">
			<thead>
				<tr class="border-t border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
					<th class="px-6 py-2.5 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Tool
					</th>
					<th class="px-6 py-2.5 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Model
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Total Tokens
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Active Periods
					</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (`${row.tool}-${row.model}`)}
					<tr
						role="button"
						tabindex="0"
						onclick={() => handleRowClick(row)}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(row); } }}
						class="group cursor-pointer border-b border-zinc-50 transition-colors duration-100 last:border-b-0
							{isSelected(row)
								? 'bg-indigo-50/70 dark:bg-indigo-950/30'
								: selectedModel !== null
									? 'opacity-50 hover:bg-zinc-50 hover:opacity-80 dark:hover:bg-zinc-800/50'
									: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}"
					>
						<td class="px-6 py-3">
							<div class="flex items-center gap-2.5">
								<span
									class="inline-block h-2 w-2 shrink-0 rounded-full"
									style="background-color: {TOOL_COLORS[row.tool]}"
								></span>
								<span class="font-medium text-zinc-900 dark:text-zinc-100">
									{TOOL_DISPLAY_NAMES[row.tool]}
								</span>
							</div>
						</td>
						<td class="px-6 py-3">
							<span class="font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.model}</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(row.totalTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{row.activePeriods}
							</span>
						</td>
					</tr>
				{/each}

				{#if rows.length === 0}
					<tr>
						<td colspan="4" class="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
							No model metrics available
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>
