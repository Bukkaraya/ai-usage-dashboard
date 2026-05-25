import type { ModelUsageRecord, TimeRange, ToolName, UsageRecord } from '$lib/types';

export interface UsageSnapshot {
	usage: UsageRecord[];
	models: ModelUsageRecord[];
}

const METRIC_USAGE_PREFIX = 'usage_dashboard_usage';
const METRIC_MODEL_PREFIX = 'usage_dashboard_model';

export function serializeUsageMetrics(snapshot: UsageSnapshot, instance: string): string {
	const lines = [
		'# HELP usage_dashboard_usage_input_tokens Input tokens per day and tool.',
		'# TYPE usage_dashboard_usage_input_tokens gauge',
		'# HELP usage_dashboard_usage_output_tokens Output tokens per day and tool.',
		'# TYPE usage_dashboard_usage_output_tokens gauge',
		'# HELP usage_dashboard_usage_cache_tokens Cache tokens per day and tool.',
		'# TYPE usage_dashboard_usage_cache_tokens gauge',
		'# HELP usage_dashboard_usage_cache_read_tokens Cache read tokens per day and tool.',
		'# TYPE usage_dashboard_usage_cache_read_tokens gauge',
		'# HELP usage_dashboard_usage_cache_write_tokens Cache write tokens per day and tool.',
		'# TYPE usage_dashboard_usage_cache_write_tokens gauge',
		'# HELP usage_dashboard_usage_total_tokens Total tokens per day and tool.',
		'# TYPE usage_dashboard_usage_total_tokens gauge',
		'# HELP usage_dashboard_usage_cost_usd Cost in USD per day and tool.',
		'# TYPE usage_dashboard_usage_cost_usd gauge',
		'# HELP usage_dashboard_model_input_tokens Input tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_input_tokens gauge',
		'# HELP usage_dashboard_model_output_tokens Output tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_output_tokens gauge',
		'# HELP usage_dashboard_model_cache_tokens Cache tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_cache_tokens gauge',
		'# HELP usage_dashboard_model_cache_read_tokens Cache read tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_cache_read_tokens gauge',
		'# HELP usage_dashboard_model_cache_write_tokens Cache write tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_cache_write_tokens gauge',
		'# HELP usage_dashboard_model_total_tokens Total tokens per day, tool, and model.',
		'# TYPE usage_dashboard_model_total_tokens gauge',
		'# HELP usage_dashboard_model_cost_usd Cost in USD per day, tool, and model when known.',
		'# TYPE usage_dashboard_model_cost_usd gauge'
	];

	for (const record of snapshot.usage) {
		const labels = { instance, tool: record.tool, date: record.date };
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_input_tokens`, labels, record.inputTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_output_tokens`, labels, record.outputTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_cache_tokens`, labels, record.cacheTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_cache_read_tokens`, labels, record.cacheReadTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_cache_write_tokens`, labels, record.cacheWriteTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_total_tokens`, labels, record.totalTokens));
		lines.push(metricLine(`${METRIC_USAGE_PREFIX}_cost_usd`, labels, record.cost));
	}

	for (const record of snapshot.models) {
		const labels = {
			instance,
			tool: record.tool,
			date: record.date,
			model: record.model
		};
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_input_tokens`, labels, record.inputTokens));
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_output_tokens`, labels, record.outputTokens));
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_cache_tokens`, labels, record.cacheTokens));
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_cache_read_tokens`, labels, record.cacheReadTokens));
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_cache_write_tokens`, labels, record.cacheWriteTokens));
		lines.push(metricLine(`${METRIC_MODEL_PREFIX}_total_tokens`, labels, record.totalTokens));
		if (record.cost !== null) {
			lines.push(metricLine(`${METRIC_MODEL_PREFIX}_cost_usd`, labels, record.cost));
		}
	}

	return `${lines.join('\n')}\n`;
}

export function parseUsageMetrics(text: string): UsageSnapshot {
	const usageMap = new Map<string, UsageRecord>();
	const modelMap = new Map<string, ModelUsageRecord>();

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const parsed = parseMetricLine(line);
		if (!parsed) continue;

		const { name, labels, value } = parsed;
		const tool = labels.tool as ToolName | undefined;
		const date = labels.date;

		if (!tool || !date) continue;

		if (name.startsWith(METRIC_USAGE_PREFIX)) {
			const key = `${date}|${tool}`;
			const existing = usageMap.get(key) ?? createEmptyUsageRecord(date, tool);
			assignUsageMetric(existing, name, value);
			usageMap.set(key, existing);
			continue;
		}

		if (name.startsWith(METRIC_MODEL_PREFIX)) {
			const model = labels.model ?? 'unknown';
			const key = `${date}|${tool}|${model}`;
			const existing = modelMap.get(key) ?? createEmptyModelRecord(date, tool, model);
			assignModelMetric(existing, name, value);
			modelMap.set(key, existing);
		}
	}

	return {
		usage: Array.from(usageMap.values()),
		models: Array.from(modelMap.values())
	};
}

export function aggregateUsageForRange(records: UsageRecord[], range: TimeRange): UsageRecord[] {
	return sortUsageRecords(mergeUsageRecords(records, range));
}

export function aggregateModelUsageForRange(
	records: ModelUsageRecord[],
	range: TimeRange
): ModelUsageRecord[] {
	return sortModelRecords(mergeModelRecords(records, range));
}

function mergeUsageRecords(records: UsageRecord[], range: TimeRange): UsageRecord[] {
	const merged = new Map<string, UsageRecord>();

	for (const record of records) {
		const date = bucketDate(record.date, range);
		const key = `${date}|${record.tool}`;
		const existing = merged.get(key);

		if (existing) {
			existing.inputTokens += record.inputTokens;
			existing.outputTokens += record.outputTokens;
			existing.cacheReadTokens += record.cacheReadTokens;
			existing.cacheWriteTokens += record.cacheWriteTokens;
			existing.cacheTokens += record.cacheTokens;
			existing.totalTokens += record.totalTokens;
			existing.cost += record.cost;
		} else {
			merged.set(key, { ...record, date });
		}
	}

	return Array.from(merged.values());
}

function mergeModelRecords(records: ModelUsageRecord[], range: TimeRange): ModelUsageRecord[] {
	const merged = new Map<string, ModelUsageRecord>();

	for (const record of records) {
		const date = bucketDate(record.date, range);
		const key = `${date}|${record.tool}|${record.model}`;
		const existing = merged.get(key);

		if (existing) {
			existing.inputTokens += record.inputTokens;
			existing.outputTokens += record.outputTokens;
			existing.cacheReadTokens += record.cacheReadTokens;
			existing.cacheWriteTokens += record.cacheWriteTokens;
			existing.cacheTokens += record.cacheTokens;
			existing.totalTokens += record.totalTokens;
			existing.cost =
				existing.cost !== null && record.cost !== null ? existing.cost + record.cost : null;
		} else {
			merged.set(key, { ...record, date });
		}
	}

	return Array.from(merged.values());
}

function sortUsageRecords(records: UsageRecord[]): UsageRecord[] {
	return records.sort((a, b) => a.date.localeCompare(b.date) || a.tool.localeCompare(b.tool));
}

function sortModelRecords(records: ModelUsageRecord[]): ModelUsageRecord[] {
	return records.sort(
		(a, b) =>
			a.date.localeCompare(b.date) ||
			a.tool.localeCompare(b.tool) ||
			a.model.localeCompare(b.model)
	);
}

function bucketDate(date: string, range: TimeRange): string {
	if (range === 'daily') return date;
	if (range === 'monthly') return `${date.slice(0, 7)}-01`;

	const parsed = new Date(`${date}T00:00:00Z`);
	const day = parsed.getUTCDay() || 7;
	parsed.setUTCDate(parsed.getUTCDate() - day + 1);
	return parsed.toISOString().slice(0, 10);
}

function metricLine(name: string, labels: Record<string, string>, value: number): string {
	return `${name}{${formatLabels(labels)}} ${Number.isFinite(value) ? value : 0}`;
}

function formatLabels(labels: Record<string, string>): string {
	return Object.entries(labels)
		.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
		.join(',');
}

function escapeLabelValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function parseMetricLine(line: string):
	| { name: string; labels: Record<string, string>; value: number }
	| null {
	const match = line.match(
		/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/
	);
	if (!match) return null;

	const [, name, rawLabels = '', rawValue] = match;
	const labels: Record<string, string> = {};
	for (const labelMatch of rawLabels.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"])*)"/g)) {
		labels[labelMatch[1]] = labelMatch[2]
			.replace(/\\"/g, '"')
			.replace(/\\n/g, '\n')
			.replace(/\\\\/g, '\\');
	}

	return {
		name,
		labels,
		value: Number.parseFloat(rawValue)
	};
}

function createEmptyUsageRecord(date: string, tool: ToolName): UsageRecord {
	return {
		date,
		tool,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cacheTokens: 0,
		totalTokens: 0,
		cost: 0
	};
}

function createEmptyModelRecord(date: string, tool: ToolName, model: string): ModelUsageRecord {
	return {
		date,
		tool,
		model,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cacheTokens: 0,
		totalTokens: 0,
		cost: null
	};
}

function assignUsageMetric(record: UsageRecord, name: string, value: number): void {
	if (name.endsWith('_input_tokens')) record.inputTokens = value;
	if (name.endsWith('_output_tokens')) record.outputTokens = value;
	if (name.endsWith('_cache_read_tokens')) record.cacheReadTokens = value;
	if (name.endsWith('_cache_write_tokens')) record.cacheWriteTokens = value;
	if (name.endsWith('_cache_tokens')) {
		record.cacheTokens = value;
		if (record.cacheReadTokens === 0 && record.cacheWriteTokens === 0) {
			record.cacheReadTokens = value;
		}
	}
	if (name.endsWith('_total_tokens')) record.totalTokens = value;
	if (name.endsWith('_cost_usd')) record.cost = value;
	if (record.cacheTokens === 0 && (record.cacheReadTokens > 0 || record.cacheWriteTokens > 0)) {
		record.cacheTokens = record.cacheReadTokens + record.cacheWriteTokens;
	}
}

function assignModelMetric(record: ModelUsageRecord, name: string, value: number): void {
	if (name.endsWith('_input_tokens')) record.inputTokens = value;
	if (name.endsWith('_output_tokens')) record.outputTokens = value;
	if (name.endsWith('_cache_read_tokens')) record.cacheReadTokens = value;
	if (name.endsWith('_cache_write_tokens')) record.cacheWriteTokens = value;
	if (name.endsWith('_cache_tokens')) {
		record.cacheTokens = value;
		if (record.cacheReadTokens === 0 && record.cacheWriteTokens === 0) {
			record.cacheReadTokens = value;
		}
	}
	if (name.endsWith('_total_tokens')) record.totalTokens = value;
	if (name.endsWith('_cost_usd')) record.cost = value;
	if (record.cacheTokens === 0 && (record.cacheReadTokens > 0 || record.cacheWriteTokens > 0)) {
		record.cacheTokens = record.cacheReadTokens + record.cacheWriteTokens;
	}
}
