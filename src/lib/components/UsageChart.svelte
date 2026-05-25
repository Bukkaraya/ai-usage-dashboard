<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend,
		type ChartConfiguration,
		type TooltipItem
	} from 'chart.js';
	import type { UsageRecord, ToolName, TimeRange } from '$lib/types';
	import { TOOL_COLORS } from '$lib/constants';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Props {
		data: UsageRecord[];
		range: TimeRange;
	}

	let { data, range }: Props = $props();

	type ViewMode = 'cost' | 'tokens' | 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'costPerMillion';
	let viewMode: ViewMode = $state('cost');

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let chart: Chart | null = null;
	let mounted = false;

	const TOOL_LABELS: Record<ToolName, string> = {
		claude: 'Claude Code',
		codex: 'Codex',
		opencode: 'OpenCode',
		amp: 'Amp',
		pi: 'Pi'
	};

	// Derive sorted unique dates
	let dates = $derived.by(() => {
		const dateSet = new Set(data.map((r) => r.date));
		return [...dateSet].sort((a, b) => a.localeCompare(b));
	});

	// Derive the set of tools that actually appear in the data
	let activeTools = $derived.by(() => {
		const toolSet = new Set(data.map((r) => r.tool));
		const order: ToolName[] = ['claude', 'codex', 'opencode', 'amp', 'pi'];
		return order.filter((t) => toolSet.has(t));
	});

	function formatDateLabel(dateStr: string): string {
		const [year, month, day] = dateStr.split('-').map(Number);
		const d = new Date(year, month - 1, day);

		if (range === 'monthly') {
			return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		}

		if (range === 'weekly') {
			const end = new Date(d);
			end.setDate(end.getDate() + 6);
			const startLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			const endLabel = end.getMonth() === d.getMonth()
				? end.getDate().toString()
				: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			return `${startLabel}–${endLabel}`;
		}

		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Format cost value for Y-axis
	function formatCostTick(value: number): string {
		if (value >= 100) return `$${Math.round(value)}`;
		if (value >= 10) return `$${value.toFixed(1)}`;
		return `$${value.toFixed(2)}`;
	}

	// Format token value with K/M/B suffix
	function formatTokenTick(value: number): string {
		if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
		return value.toString();
	}

	// Format cost value for tooltip
	function formatCostTooltip(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 4
		}).format(value);
	}

	// Format token value for tooltip
	function formatTokenTooltip(value: number): string {
		return new Intl.NumberFormat('en-US').format(value);
	}

	function formatCostPerMillionTick(value: number): string {
		if (value >= 100) return `$${Math.round(value)}`;
		if (value >= 10) return `$${value.toFixed(1)}`;
		return `$${value.toFixed(2)}`;
	}

	function formatCostPerMillionTooltip(value: number): string {
		return `${formatCostTooltip(value)} / 1M`;
	}

	// Detect dark mode
	function isDarkMode(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	function buildChartConfig(): ChartConfiguration<'bar', number[], string> {
		const dark = isDarkMode();
		const gridColor = dark ? 'rgba(161, 161, 170, 0.12)' : 'rgba(161, 161, 170, 0.2)';
		const tickColor = dark ? 'rgba(161, 161, 170, 0.7)' : 'rgba(113, 113, 122, 0.8)';
		const tooltipBg = dark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.97)';
		const tooltipTitleColor = dark ? '#f4f4f5' : '#18181b';
		const tooltipBodyColor = dark ? '#a1a1aa' : '#52525b';
		const tooltipBorderColor = dark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(228, 228, 231, 0.8)';

		const stacked = viewMode !== 'costPerMillion';
		const lookup = new Map<ToolName, Map<string, UsageRecord>>();
		for (const r of data) {
			if (!lookup.has(r.tool)) lookup.set(r.tool, new Map());
			const toolMap = lookup.get(r.tool)!;
			const existing =
				toolMap.get(r.date) ??
				{
					date: r.date,
					tool: r.tool,
					inputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
					cacheWriteTokens: 0,
					cacheTokens: 0,
					totalTokens: 0,
					cost: 0
				};
			toolMap.set(r.date, {
				...existing,
				inputTokens: existing.inputTokens + r.inputTokens,
				outputTokens: existing.outputTokens + r.outputTokens,
				cacheReadTokens: existing.cacheReadTokens + r.cacheReadTokens,
				cacheWriteTokens: existing.cacheWriteTokens + r.cacheWriteTokens,
				cacheTokens: existing.cacheTokens + r.cacheTokens,
				totalTokens: existing.totalTokens + r.totalTokens,
				cost: existing.cost + r.cost
			});
		}

		const datasets = activeTools.map((tool) => {
			const toolData = lookup.get(tool);
			return {
				label: TOOL_LABELS[tool],
				data: dates.map((d) => {
					const point = toolData?.get(d);
					if (!point) return 0;
					if (viewMode === 'cost') return point.cost;
					if (viewMode === 'tokens') return point.totalTokens;
					if (viewMode === 'input') return point.inputTokens;
					if (viewMode === 'output') return point.outputTokens;
					if (viewMode === 'cacheRead') return point.cacheReadTokens;
					if (viewMode === 'cacheWrite') return point.cacheWriteTokens;
					return point.totalTokens > 0 ? (point.cost / point.totalTokens) * 1_000_000 : 0;
				}),
				backgroundColor: TOOL_COLORS[tool],
				hoverBackgroundColor: TOOL_COLORS[tool],
				borderRadius: 3,
				borderSkipped: false as const,
				barPercentage: stacked ? 0.7 : 0.82,
				categoryPercentage: stacked ? 0.8 : 0.72
			};
		});

		return {
			type: 'bar' as const,
			data: {
				labels: dates.map(formatDateLabel),
				datasets
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index' as const,
					intersect: false
				},
				scales: {
					x: {
						stacked,
						grid: {
							display: false
						},
						ticks: {
							color: tickColor,
							font: {
								family: "'DM Sans', system-ui, sans-serif",
								size: 11,
								weight: 500 as const
							},
							maxRotation: 45,
							autoSkip: true,
							maxTicksLimit: 20
						},
						border: {
							display: false
						}
					},
					y: {
						stacked,
						beginAtZero: true,
						grid: {
							color: gridColor,
							lineWidth: 1
						},
						ticks: {
							color: tickColor,
							font: {
								family: "'DM Mono', monospace",
								size: 11,
								weight: 400 as const
							},
							callback: function (tickValue: string | number) {
								const v = typeof tickValue === 'string' ? parseFloat(tickValue) : tickValue;
								if (viewMode === 'cost') return formatCostTick(v);
								if (viewMode === 'tokens') return formatTokenTick(v);
								return formatCostPerMillionTick(v);
							},
							maxTicksLimit: 8
						},
						border: {
							display: false
						}
					}
				},
				plugins: {
					legend: {
						display: true,
						position: 'bottom' as const,
						labels: {
							usePointStyle: true,
							pointStyle: 'rectRounded',
							padding: 20,
							color: tickColor,
							font: {
								family: "'DM Sans', system-ui, sans-serif",
								size: 12,
								weight: 500 as const
							}
						}
					},
					tooltip: {
						backgroundColor: tooltipBg,
						titleColor: tooltipTitleColor,
						bodyColor: tooltipBodyColor,
						borderColor: tooltipBorderColor,
						borderWidth: 1,
						cornerRadius: 10,
						padding: 14,
						boxPadding: 6,
						usePointStyle: true,
						titleFont: {
							family: "'DM Sans', system-ui, sans-serif",
							size: 13,
							weight: 600 as const
						},
						bodyFont: {
							family: "'DM Mono', monospace",
							size: 12,
							weight: 400 as const
						},
						callbacks: {
							title: function (items: { label: string }[]) {
								return items[0]?.label ?? '';
							},
							label: function (context: TooltipItem<'bar'>) {
								const label = context.dataset.label ?? '';
								const value = context.parsed.y ?? 0;
								if (value === 0) return '';
								const formatted =
									viewMode === 'cost'
										? formatCostTooltip(value)
										: viewMode === 'costPerMillion'
											? formatCostPerMillionTooltip(value)
											: `${formatTokenTooltip(value)} tokens`;
								return ` ${label}: ${formatted}`;
							},
							footer: function (items: TooltipItem<'bar'>[]) {
								if (viewMode === 'costPerMillion') return '';
								const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
								if (total === 0) return '';
								const formatted =
									viewMode === 'cost'
										? formatCostTooltip(total)
										: `${formatTokenTooltip(total)} tokens`;
								return `Total: ${formatted}`;
							}
						}
					}
				},
				animation: {
					duration: 400,
					easing: 'easeOutQuart' as const
				}
			}
		};
	}

	function createChart() {
		if (!canvasEl || !mounted) return;

		if (chart) {
			chart.destroy();
			chart = null;
		}

		const config = buildChartConfig();
		chart = new Chart(canvasEl, config);
	}

	onMount(() => {
		mounted = true;
		createChart();

		// Listen for dark mode changes
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = () => createChart();
		mediaQuery.addEventListener('change', handler);

		return () => {
			mediaQuery.removeEventListener('change', handler);
		};
	});

	onDestroy(() => {
		mounted = false;
		if (chart) {
			chart.destroy();
			chart = null;
		}
	});

	function viewModeDescription(): string {
		const cadence = range === 'monthly' ? 'Monthly' : range === 'weekly' ? 'Weekly' : 'Daily';
		const descriptions: Record<ViewMode, string> = {
			cost: `${cadence} spend by tool`,
			tokens: `${cadence} total token consumption by tool`,
			input: `${cadence} input tokens by tool`,
			output: `${cadence} output tokens by tool`,
			cacheRead: `${cadence} cache read tokens by tool`,
			cacheWrite: `${cadence} cache write tokens by tool`,
			costPerMillion: `${cadence} cost per 1M tokens by tool`
		};
		return descriptions[viewMode];
	}

	const VIEW_MODE_LABELS: Record<ViewMode, string> = {
		cost: 'Cost ($)',
		tokens: 'Tokens',
		input: 'Input',
		output: 'Output',
		cacheRead: 'Cache Read',
		cacheWrite: 'Cache Write',
		costPerMillion: 'Cost / 1M'
	};

	const VIEW_MODE_OPTIONS: ViewMode[] = [
		'cost',
		'tokens',
		'input',
		'output',
		'cacheRead',
		'cacheWrite',
		'costPerMillion'
	];

	// Reactively update chart when data, viewMode, or range changes
	$effect(() => {
		// Access reactive dependencies
		data;
		viewMode;
		range;
		dates;
		activeTools;

		if (mounted && canvasEl) {
			createChart();
		}
	});
</script>

<div
	class="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
>
	<!-- Card Header -->
	<div class="flex items-center justify-between px-6 pt-5 pb-1">
		<div>
			<h2
				class="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
				style="font-family: 'DM Sans', system-ui, sans-serif;"
			>
				Usage Over Time
			</h2>
			<p class="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
				{viewModeDescription()}
			</p>
		</div>

		<div class="relative">
			<label class="sr-only" for="chart-metric">Chart metric</label>
			<select
				id="chart-metric"
				aria-label="Chart metric"
				bind:value={viewMode}
				class="h-9 min-w-40 appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pr-9 pl-3 text-sm font-medium text-zinc-900 shadow-sm transition-colors hover:border-zinc-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600"
			>
				{#each VIEW_MODE_OPTIONS as option}
					<option value={option}>{VIEW_MODE_LABELS[option]}</option>
				{/each}
			</select>
			<svg
				class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="2"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
			</svg>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="px-6 pt-2 pb-5">
		{#if data.length === 0}
			<div class="flex h-72 items-center justify-center">
				<div class="text-center">
					<svg
						class="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
						/>
					</svg>
					<p
						class="mt-2 text-sm text-zinc-400 dark:text-zinc-500"
						style="font-family: 'DM Sans', system-ui, sans-serif;"
					>
						No usage data available
					</p>
				</div>
			</div>
		{:else}
			<div class="relative h-72 w-full">
				<canvas bind:this={canvasEl}></canvas>
			</div>
		{/if}
	</div>
</div>
