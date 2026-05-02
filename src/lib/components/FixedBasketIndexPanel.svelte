<script lang="ts">
	import type { ModelFilter, ModelUsageRecord, TimeRange, ToolName, UsageRecord } from '$lib/types';

	interface Props {
		models: ModelUsageRecord[];
		usage: UsageRecord[];
		range: TimeRange;
		selectedTool: ToolName | null;
		selectedModel: ModelFilter | null;
	}

	interface BaselineSegment {
		key: string;
		tool: ToolName;
		model: string | null;
		basketTokens: number;
		referenceRate: number;
	}

	interface IndexPoint {
		date: string;
		index: number | null;
		coverage: number;
	}

	let { models, usage, range, selectedTool, selectedModel }: Props = $props();

	const SVG_WIDTH = 960;
	const SVG_HEIGHT = 220;
	const PADDING_X = 24;
	const PADDING_Y = 20;

	let activeTool = $derived(selectedModel?.tool ?? selectedTool);

	let filteredUsage = $derived(
		activeTool ? usage.filter((record) => record.tool === activeTool) : usage
	);
	let filteredModels = $derived.by(() => {
		let records = activeTool ? models.filter((record) => record.tool === activeTool) : models;
		if (selectedModel) {
			records = records.filter(
				(record) =>
					record.tool === selectedModel.tool &&
					record.model === selectedModel.model
			);
		}
		return records;
	});

	let dates = $derived.by(() => {
		const source = selectedModel ? filteredModels : filteredUsage;
		const dateSet = new Set(source.map((record) => record.date));
		return [...dateSet].sort((a, b) => a.localeCompare(b));
	});

	let basket = $derived.by(() => {
		const toolMap = groupToolRecords(filteredUsage);
		const segments = buildAverageBasketSegments(dates, toolMap, selectedModel);

		if (segments.length === 0) return null;

		return {
			segments,
			totalBasketTokens: segments.reduce((sum, segment) => sum + segment.basketTokens, 0)
		};
	});

	let series = $derived.by(() => {
		if (!basket) return [] as IndexPoint[];

		const modelMap = groupModelRecords(filteredModels);
		const toolMap = groupToolRecords(filteredUsage);

		return dates.map((date) => {
			let referenceBasketCost = 0;
			let currentBasketCost = 0;
			let coveredBasketTokens = 0;

			for (const segment of basket.segments) {
				const currentRate = lookupSegmentRate(segment, date, toolMap, modelMap);
				if (currentRate === null) continue;

				referenceBasketCost += segment.basketTokens * segment.referenceRate;
				currentBasketCost += segment.basketTokens * currentRate;
				coveredBasketTokens += segment.basketTokens;
			}

			return {
				date,
				index: referenceBasketCost > 0 ? (currentBasketCost / referenceBasketCost) * 100 : null,
				coverage:
					basket.totalBasketTokens > 0
						? coveredBasketTokens / basket.totalBasketTokens
						: 0
			};
		});
	});

	let latestPoint = $derived.by(() => {
		const points = [...series].reverse();
		return points.find((point) => point.index !== null) ?? null;
	});

	let chartPoints = $derived.by(() => {
		const plotted = series
			.map((point, index) => ({ ...point, position: index }))
			.filter((point) => point.index !== null) as Array<IndexPoint & { position: number }>;

		if (plotted.length === 0) return [];

		const values = plotted.map((point) => point.index as number);
		const minValue = Math.min(100, ...values);
		const maxValue = Math.max(100, ...values);
		const span = Math.max(maxValue - minValue, 1);
		const paddedMin = minValue - span * 0.1;
		const paddedMax = maxValue + span * 0.1;
		const innerWidth = SVG_WIDTH - PADDING_X * 2;
		const innerHeight = SVG_HEIGHT - PADDING_Y * 2;
		const denominator = Math.max(dates.length - 1, 1);

		return plotted.map((point) => {
			const x = PADDING_X + (point.position / denominator) * innerWidth;
			const value = point.index as number;
			const y =
				PADDING_Y + ((paddedMax - value) / Math.max(paddedMax - paddedMin, 1)) * innerHeight;

			return {
				...point,
				x,
				y
			};
		});
	});

	let polyline = $derived(chartPoints.map((point) => `${point.x},${point.y}`).join(' '));
	let baselineY = $derived.by(() => {
		if (chartPoints.length === 0) return SVG_HEIGHT / 2;

		const values = chartPoints.map((point) => point.index as number);
		const minValue = Math.min(100, ...values);
		const maxValue = Math.max(100, ...values);
		const span = Math.max(maxValue - minValue, 1);
		const paddedMin = minValue - span * 0.1;
		const paddedMax = maxValue + span * 0.1;
		const innerHeight = SVG_HEIGHT - PADDING_Y * 2;

		return PADDING_Y + ((paddedMax - 100) / Math.max(paddedMax - paddedMin, 1)) * innerHeight;
	});

	let recentPoints = $derived([...series].filter((point) => point.index !== null).slice(-6).reverse());

	function groupToolRecords(records: UsageRecord[]): Map<string, UsageRecord> {
		const map = new Map<string, UsageRecord>();
		for (const record of records) {
			map.set(`${record.date}|${record.tool}`, record);
		}
		return map;
	}

	function groupModelRecords(records: ModelUsageRecord[]): Map<string, ModelUsageRecord> {
		const map = new Map<string, ModelUsageRecord>();
		for (const record of records) {
			map.set(`${record.date}|${record.tool}|${record.model}`, record);
		}
		return map;
	}

	function buildAverageBasketSegments(
		visibleDates: string[],
		toolMap: Map<string, UsageRecord>,
		modelFilter: ModelFilter | null
	): BaselineSegment[] {
		if (visibleDates.length === 0) return [];

		const visibleDateCount = visibleDates.length;
		const tools = new Set(filteredUsage.map((record) => record.tool));
		const segments: BaselineSegment[] = [];

		for (const tool of tools) {
			const pricedModelGroups = new Map<string, { totalTokens: number; totalCost: number }>();

			for (const record of filteredModels) {
				if (
					record.tool !== tool ||
					record.cost === null ||
					record.totalTokens <= 0 ||
					record.cost <= 0
				) {
					continue;
				}

				const existing = pricedModelGroups.get(record.model);
				if (existing) {
					existing.totalTokens += record.totalTokens;
					existing.totalCost += record.cost;
				} else {
					pricedModelGroups.set(record.model, {
						totalTokens: record.totalTokens,
						totalCost: record.cost
					});
				}
			}

			if (pricedModelGroups.size > 0) {
				for (const [modelName, values] of pricedModelGroups) {
					if (values.totalTokens <= 0 || values.totalCost <= 0) continue;
					segments.push({
						key: `${tool}|${modelName}`,
						tool,
						model: modelName,
						basketTokens: values.totalTokens / visibleDateCount,
						referenceRate: values.totalCost / values.totalTokens
					});
				}
				continue;
			}

			if (modelFilter) {
				continue;
			}

			let totalTokens = 0;
			let totalCost = 0;
			for (const date of visibleDates) {
				const toolRecord = toolMap.get(`${date}|${tool}`);
				if (!toolRecord || toolRecord.totalTokens <= 0 || toolRecord.cost <= 0) continue;
				totalTokens += toolRecord.totalTokens;
				totalCost += toolRecord.cost;
			}

			if (totalTokens <= 0 || totalCost <= 0) continue;

			segments.push({
				key: `${tool}|__tool__`,
				tool,
				model: null,
				basketTokens: totalTokens / visibleDateCount,
				referenceRate: totalCost / totalTokens
			});
		}

		return segments;
	}

	function lookupSegmentRate(
		segment: BaselineSegment,
		date: string,
		toolMap: Map<string, UsageRecord>,
		modelMap: Map<string, ModelUsageRecord>
	): number | null {
		if (segment.model !== null) {
			const modelRecord = modelMap.get(`${date}|${segment.tool}|${segment.model}`);
			if (!modelRecord || modelRecord.cost === null || modelRecord.totalTokens <= 0 || modelRecord.cost <= 0) {
				return null;
			}
			return modelRecord.cost / modelRecord.totalTokens;
		}

		const toolRecord = toolMap.get(`${date}|${segment.tool}`);
		if (!toolRecord || toolRecord.totalTokens <= 0 || toolRecord.cost <= 0) return null;
		return toolRecord.cost / toolRecord.totalTokens;
	}

	function formatIndex(value: number | null): string {
		if (value === null) return '—';
		return value.toFixed(1);
	}

	function formatCoverage(value: number): string {
		return `${(value * 100).toFixed(0)}%`;
	}

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
			const endLabel =
				end.getMonth() === d.getMonth()
					? end.getDate().toString()
					: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			return `${startLabel}–${endLabel}`;
		}

		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<div class="rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
	<div class="border-b border-zinc-100 px-6 pt-5 pb-4 dark:border-zinc-800">
		<h2 class="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
			Window-Average Basket Price Index
		</h2>
		<p class="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
			Uses the average mix across the visible {range === 'daily' ? 'days' : range === 'weekly' ? 'weeks' : 'months'} and reprices that same basket across time.
		</p>
		{#if selectedModel}
			<p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
				Filtered to <span class="font-mono">{selectedModel.model}</span>
			</p>
		{/if}
	</div>

	{#if basket && series.length > 0}
		<div class="grid grid-cols-1 gap-4 px-6 pt-5 pb-4 sm:grid-cols-3">
			<div class="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
					Latest Index
				</p>
				<p class="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
					{formatIndex(latestPoint?.index ?? null)}
				</p>
				<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
					100 = baseline pricing
				</p>
			</div>

			<div class="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
					Basket Basis
				</p>
				<p class="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-50">
					Window Average
				</p>
				<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
					Average token mix across the visible range
				</p>
			</div>

			<div class="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
				<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
					Latest Coverage
				</p>
				<p class="mt-1 font-mono text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
					{formatCoverage(latestPoint?.coverage ?? 0)}
				</p>
				<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
					Average basket share repriced in the latest bucket
				</p>
			</div>
		</div>

		<div class="px-6 pb-4">
			<div class="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
				<svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} class="h-56 w-full">
					<line
						x1={PADDING_X}
						y1={baselineY}
						x2={SVG_WIDTH - PADDING_X}
						y2={baselineY}
						stroke="currentColor"
						stroke-width="1.5"
						stroke-dasharray="6 6"
						class="text-zinc-300 dark:text-zinc-700"
					/>
					{#if chartPoints.length > 1}
						<polyline
							fill="none"
							stroke="currentColor"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
							points={polyline}
							class="text-emerald-500 dark:text-emerald-400"
						/>
					{/if}
					{#each chartPoints as point (`${point.date}-${point.position}`)}
						<circle
							cx={point.x}
							cy={point.y}
							r="4"
							fill="currentColor"
							class="text-emerald-500 dark:text-emerald-400"
						/>
					{/each}
				</svg>
				<div class="mt-2 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
					<span>{dates[0] ? formatDateLabel(dates[0]) : ''}</span>
					<span>Baseline = 100</span>
					<span>{dates.at(-1) ? formatDateLabel(dates.at(-1) as string) : ''}</span>
				</div>
			</div>
		</div>

		<div class="border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
			<div class="flex items-center justify-between">
				<h3 class="text-xs font-semibold tracking-widest text-zinc-400 uppercase dark:text-zinc-500">
					Recent Buckets
				</h3>
				<p class="text-xs text-zinc-400 dark:text-zinc-500">
					Higher than 100 means the same basket became more expensive
				</p>
			</div>
			<div class="mt-3 overflow-x-auto">
				<table class="w-full min-w-[480px] text-sm">
					<thead>
						<tr class="border-b border-zinc-100 dark:border-zinc-800">
							<th class="py-2 text-left text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
								Period
							</th>
							<th class="py-2 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
								Index
							</th>
							<th class="py-2 text-right text-xs font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
								Coverage
							</th>
						</tr>
					</thead>
					<tbody>
						{#each recentPoints as point (point.date)}
							<tr class="border-b border-zinc-50 last:border-b-0 dark:border-zinc-800/70">
								<td class="py-2 text-zinc-700 dark:text-zinc-300">{formatDateLabel(point.date)}</td>
								<td class="py-2 text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
									{formatIndex(point.index)}
								</td>
								<td class="py-2 text-right font-mono tabular-nums text-zinc-600 dark:text-zinc-400">
									{formatCoverage(point.coverage)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
				<p>
					Example: if the visible window averages 800k tokens on one model and 200k on another
					per bucket, and that average basket costs $10 at the window-average effective rate,
					then a bucket where the same 800k/200k basket would cost $12 gets an index of 120.
				</p>
				<p class="mt-2">
					Different token volume on any specific day does not change the index directly. The
					basket comes from the average mix across the visible range, and each bucket is used only
					to reprice that same average basket.
				</p>
			</div>
		</div>
	{:else}
		<div class="px-6 py-12 text-center">
			<p class="text-sm text-zinc-400 dark:text-zinc-500">
				Not enough priced usage to build a fixed basket index yet
			</p>
		</div>
	{/if}
</div>
