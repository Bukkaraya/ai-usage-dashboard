<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	} from 'chart.js';
	import type { UsageRecord, ToolName } from '$lib/types';
	import { TOOL_COLORS } from '$lib/constants';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Props {
		data: UsageRecord[];
	}

	let { data }: Props = $props();

	type ViewMode = 'cost' | 'tokens';
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

	// Format a date string like "2025-02-21" to "Feb 21"
	function formatDateLabel(dateStr: string): string {
		const [year, month, day] = dateStr.split('-').map(Number);
		const d = new Date(year, month - 1, day);
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

	// Detect dark mode
	function isDarkMode(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}

	function buildChartConfig() {
		const dark = isDarkMode();
		const gridColor = dark ? 'rgba(161, 161, 170, 0.12)' : 'rgba(161, 161, 170, 0.2)';
		const tickColor = dark ? 'rgba(161, 161, 170, 0.7)' : 'rgba(113, 113, 122, 0.8)';
		const tooltipBg = dark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.97)';
		const tooltipTitleColor = dark ? '#f4f4f5' : '#18181b';
		const tooltipBodyColor = dark ? '#a1a1aa' : '#52525b';
		const tooltipBorderColor = dark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(228, 228, 231, 0.8)';

		// Build a lookup: tool -> date -> value
		const lookup = new Map<ToolName, Map<string, number>>();
		for (const r of data) {
			if (!lookup.has(r.tool)) lookup.set(r.tool, new Map());
			const toolMap = lookup.get(r.tool)!;
			const existing = toolMap.get(r.date) ?? 0;
			toolMap.set(r.date, existing + (viewMode === 'cost' ? r.cost : r.totalTokens));
		}

		const datasets = activeTools.map((tool) => {
			const toolData = lookup.get(tool);
			return {
				label: TOOL_LABELS[tool],
				data: dates.map((d) => toolData?.get(d) ?? 0),
				backgroundColor: TOOL_COLORS[tool],
				hoverBackgroundColor: TOOL_COLORS[tool],
				borderRadius: 3,
				borderSkipped: false as const,
				barPercentage: 0.7,
				categoryPercentage: 0.8
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
						stacked: true,
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
						stacked: true,
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
								return viewMode === 'cost' ? formatCostTick(v) : formatTokenTick(v);
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
						pointStyle: 'rectRounded',
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
							label: function (context: { dataset: { label?: string }; parsed: { y: number } }) {
								const label = context.dataset.label ?? '';
								const value = context.parsed.y;
								if (value === 0) return '';
								const formatted =
									viewMode === 'cost'
										? formatCostTooltip(value)
										: `${formatTokenTooltip(value)} tokens`;
								return ` ${label}: ${formatted}`;
							},
							footer: function (items: { parsed: { y: number } }[]) {
								const total = items.reduce((sum, item) => sum + item.parsed.y, 0);
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

	// Reactively update chart when data or viewMode changes
	$effect(() => {
		// Access reactive dependencies
		data;
		viewMode;
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
				{viewMode === 'cost' ? 'Daily spend by tool' : 'Token consumption by tool'}
			</p>
		</div>

		<!-- Segmented Toggle -->
		<div
			class="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800"
			role="radiogroup"
			aria-label="Chart metric"
		>
			<button
				role="radio"
				aria-checked={viewMode === 'cost'}
				class="rounded-md px-3 py-1.5 text-xs font-medium tracking-tight transition-all duration-200
					{viewMode === 'cost'
					? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
				onclick={() => (viewMode = 'cost')}
			>
				Cost ($)
			</button>
			<button
				role="radio"
				aria-checked={viewMode === 'tokens'}
				class="rounded-md px-3 py-1.5 text-xs font-medium tracking-tight transition-all duration-200
					{viewMode === 'tokens'
					? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
				onclick={() => (viewMode = 'tokens')}
			>
				Tokens
			</button>
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
