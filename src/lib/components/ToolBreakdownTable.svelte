<script lang="ts">
	import type { UsageRecord, ToolName } from '$lib/types';
	import { TOOL_COLORS } from '$lib/constants';

	interface Props {
		data: UsageRecord[];
		selectedTool: ToolName | null;
		onfilter: (tool: ToolName | null) => void;
	}

	let { data, selectedTool, onfilter }: Props = $props();

	const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
		claude: 'Claude Code',
		codex: 'Codex',
		opencode: 'OpenCode',
		amp: 'Amp',
		pi: 'Pi'
	};

	interface ToolAggregate {
		tool: ToolName;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		totalTokens: number;
		cost: number;
		pctOfTotal: number;
	}

	let aggregated: ToolAggregate[] = $derived.by(() => {
		const toolMap = new Map<
			ToolName,
			{
				inputTokens: number;
				outputTokens: number;
				cacheReadTokens: number;
				cacheWriteTokens: number;
				totalTokens: number;
				cost: number;
			}
		>();

		for (const record of data) {
			const existing = toolMap.get(record.tool);
			if (existing) {
				existing.inputTokens += record.inputTokens;
				existing.outputTokens += record.outputTokens;
				existing.cacheReadTokens += record.cacheReadTokens;
				existing.cacheWriteTokens += record.cacheWriteTokens;
				existing.totalTokens += record.totalTokens;
				existing.cost += record.cost;
			} else {
				toolMap.set(record.tool, {
					inputTokens: record.inputTokens,
					outputTokens: record.outputTokens,
					cacheReadTokens: record.cacheReadTokens,
					cacheWriteTokens: record.cacheWriteTokens,
					totalTokens: record.totalTokens,
					cost: record.cost
				});
			}
		}

		const grandTotalCost = Array.from(toolMap.values()).reduce((sum, v) => sum + v.cost, 0);

		const result: ToolAggregate[] = [];
		for (const [tool, values] of toolMap) {
			result.push({
				tool,
				inputTokens: values.inputTokens,
				outputTokens: values.outputTokens,
				cacheReadTokens: values.cacheReadTokens,
				cacheWriteTokens: values.cacheWriteTokens,
				totalTokens: values.totalTokens,
				cost: values.cost,
				pctOfTotal: grandTotalCost > 0 ? (values.cost / grandTotalCost) * 100 : 0
			});
		}

		result.sort((a, b) => b.cost - a.cost);
		return result;
	});

	let grandTotalCost = $derived(aggregated.reduce((sum, row) => sum + row.cost, 0));
	let grandInputTokens = $derived(aggregated.reduce((sum, row) => sum + row.inputTokens, 0));
	let grandOutputTokens = $derived(aggregated.reduce((sum, row) => sum + row.outputTokens, 0));
	let grandCacheReadTokens = $derived(aggregated.reduce((sum, row) => sum + row.cacheReadTokens, 0));
	let grandCacheWriteTokens = $derived(aggregated.reduce((sum, row) => sum + row.cacheWriteTokens, 0));
	let grandTotalTokens = $derived(aggregated.reduce((sum, row) => sum + row.totalTokens, 0));

	function formatTokens(tokens: number): string {
		if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`;
		if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
		if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
		return tokens.toLocaleString();
	}

	function formatCost(cost: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(cost);
	}

	function formatPct(pct: number): string {
		return `${pct.toFixed(1)}%`;
	}

	function handleRowClick(tool: ToolName) {
		if (selectedTool === tool) {
			onfilter(null);
		} else {
			onfilter(tool);
		}
	}
</script>

<div class="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
	<!-- Header bar -->
	<div class="flex items-center justify-between px-6 pt-6 pb-4">
		<h3 class="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
			Tool Breakdown
		</h3>
		{#if selectedTool}
			<button
				onclick={() => onfilter(null)}
				class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors duration-150 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
			>
				<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
				</svg>
				Show All
			</button>
		{/if}
	</div>

	<!-- Responsive wrapper -->
	<div class="overflow-x-auto">
		<table class="w-full min-w-[880px] text-sm">
			<thead>
				<tr class="border-t border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
					<th class="px-6 py-2.5 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Tool
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Input
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Output
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Cache Read
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Cache Write
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Total
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						Total Cost
					</th>
					<th class="px-6 py-2.5 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
						% of Total
					</th>
				</tr>
			</thead>
			<tbody>
				{#each aggregated as row (row.tool)}
					<tr
						role="button"
						tabindex="0"
						onclick={() => handleRowClick(row.tool)}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(row.tool); } }}
						class="group cursor-pointer border-b border-zinc-50 transition-colors duration-100 last:border-b-0
							{selectedTool === row.tool
								? 'bg-indigo-50/70 dark:bg-indigo-950/30'
								: selectedTool !== null
									? 'opacity-50 hover:bg-zinc-50 hover:opacity-80 dark:hover:bg-zinc-800/50'
									: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}"
					>
						<!-- Tool name with color dot -->
						<td class="px-6 py-3">
							<div class="flex items-center gap-2.5">
								<span
									class="inline-block h-2 w-2 shrink-0 rounded-full"
									style="background-color: {TOOL_COLORS[row.tool]}"
								></span>
								<span class="font-medium text-zinc-900 dark:text-zinc-100">
									{TOOL_DISPLAY_NAMES[row.tool] ?? row.tool}
								</span>
							</div>
						</td>

						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{formatTokens(row.inputTokens)}
							</span>
						</td>

						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{formatTokens(row.outputTokens)}
							</span>
						</td>

						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{formatTokens(row.cacheReadTokens)}
							</span>
						</td>

						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{formatTokens(row.cacheWriteTokens)}
							</span>
						</td>

						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
								{formatTokens(row.totalTokens)}
							</span>
						</td>

						<!-- Total cost -->
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatCost(row.cost)}
							</span>
						</td>

						<!-- Percentage of total -->
						<td class="px-6 py-3 text-right">
							<div class="flex items-center justify-end gap-2.5">
								<!-- Inline bar visualization -->
								<div class="hidden h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 sm:block dark:bg-zinc-800">
									<div
										class="h-full rounded-full transition-all duration-300"
										style="width: {row.pctOfTotal}%; background-color: {TOOL_COLORS[row.tool]}"
									></div>
								</div>
								<span class="font-mono text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
									{formatPct(row.pctOfTotal)}
								</span>
							</div>
						</td>
					</tr>
				{/each}

				<!-- Empty state -->
				{#if aggregated.length === 0}
					<tr>
						<td colspan="8" class="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
							No usage data available
						</td>
					</tr>
				{/if}
			</tbody>

			<!-- Footer totals row -->
			{#if aggregated.length > 0}
				<tfoot>
					<tr class="border-t border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/30">
						<td class="px-6 py-3">
							<span class="text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
								Total
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(grandInputTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(grandOutputTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(grandCacheReadTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(grandCacheWriteTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatTokens(grandTotalTokens)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
								{formatCost(grandTotalCost)}
							</span>
						</td>
						<td class="px-6 py-3 text-right">
							<span class="font-mono text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
								100.0%
							</span>
						</td>
					</tr>
				</tfoot>
			{/if}
		</table>
	</div>
</div>
