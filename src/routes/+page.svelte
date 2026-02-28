<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { TimeRange, ToolName, UsageResponse } from '$lib/types';
	import SummaryCards from '$lib/components/SummaryCards.svelte';
	import TimeRangeToggle from '$lib/components/TimeRangeToggle.svelte';
	import DateRangePicker from '$lib/components/DateRangePicker.svelte';
	import UsageChart from '$lib/components/UsageChart.svelte';
	import ToolBreakdownTable from '$lib/components/ToolBreakdownTable.svelte';

	let { data } = $props();

	let loading = $state(false);
	let selectedTool: ToolName | null = $state(null);

	let chartData = $derived(
		selectedTool ? usage.data.filter((r) => r.tool === selectedTool) : usage.data
	);

	let range: TimeRange = $derived((data.range as TimeRange) ?? 'daily');
	let since = $derived($page.url.searchParams.get('since') ?? '');
	let until = $derived($page.url.searchParams.get('until') ?? '');
	let usage: UsageResponse = $derived(data.usage);

	async function navigate(newRange: TimeRange, newSince: string, newUntil: string) {
		loading = true;
		const params = new URLSearchParams();
		params.set('range', newRange);
		if (newSince) params.set('since', newSince);
		if (newUntil) params.set('until', newUntil);
		await goto(`?${params}`, { replaceState: true, invalidateAll: true });
		loading = false;
	}

	function handleRangeChange(newRange: TimeRange) {
		navigate(newRange, since, until);
	}

	function handleDateChange(newSince: string, newUntil: string) {
		navigate(range, newSince, newUntil);
	}
</script>

<svelte:head>
	<title>Usage Dashboard</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100" style="font-family: 'DM Sans', system-ui, sans-serif;">
	<!-- Header -->
	<header class="border-b border-zinc-200/80 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
		<div class="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style="font-family: 'DM Sans', system-ui, sans-serif;">
						Usage Dashboard
					</h1>
					<p class="mt-0.5 text-sm text-zinc-400 dark:text-zinc-500">
						Token usage and cost tracking across your AI coding tools
					</p>
				</div>
				<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
					<TimeRangeToggle value={range} onchange={handleRangeChange} />
				</div>
			</div>
			<div class="mt-4">
				<DateRangePicker {since} {until} onchange={handleDateChange} />
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Summary Cards -->
		<section aria-label="Summary statistics">
			<SummaryCards
				totalCost={usage.totals.totalCost}
				totalTokens={usage.totals.totalTokens}
				data={usage.data}
				{loading}
			/>
		</section>

		<!-- Chart Area -->
		<section class="mt-8" aria-label="Usage chart">
			<UsageChart data={chartData} />
		</section>

		<!-- Tool Breakdown Table -->
		<section class="mt-8 mb-12" aria-label="Usage breakdown table">
			<ToolBreakdownTable
				data={usage.data}
				{selectedTool}
				onfilter={(tool) => { selectedTool = tool; }}
			/>
		</section>
	</main>
</div>
