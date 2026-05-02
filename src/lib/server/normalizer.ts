import type { ModelUsageRecord, ToolName, UsageRecord } from '$lib/types';

export interface UsageSnapshot {
	usage: UsageRecord[];
	models: ModelUsageRecord[];
}

interface ClaudeModelBreakdown {
	modelName: string;
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	cost?: number;
}

interface ClaudeDaily {
	date: string;
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	totalTokens: number;
	totalCost: number;
	modelsUsed?: string[];
	modelBreakdowns?: ClaudeModelBreakdown[];
}

interface CodexModelBreakdown {
	inputTokens: number;
	cachedInputTokens: number;
	outputTokens: number;
	reasoningOutputTokens: number;
	totalTokens: number;
	isFallback?: boolean;
}

interface CodexDaily {
	date: string;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number;
	reasoningOutputTokens: number;
	totalTokens: number;
	costUSD: number;
	models?: Record<string, CodexModelBreakdown>;
}

const CODEX_MODEL_PRICING: Record<string, { input: number; cachedInput: number; output: number }> = {
	'gpt-5.4': { input: 2.5 / 1e6, cachedInput: 0.25 / 1e6, output: 15 / 1e6 },
	'gpt-5.3-codex': { input: 1.75 / 1e6, cachedInput: 0.175 / 1e6, output: 14 / 1e6 },
	'gpt-5.3-codex-spark': { input: 0.2 / 1e6, cachedInput: 0.02 / 1e6, output: 0.8 / 1e6 },
	'gpt-5.2-codex': { input: 1.75 / 1e6, cachedInput: 0.175 / 1e6, output: 14 / 1e6 }
};

const DEFAULT_CODEX_PRICING = CODEX_MODEL_PRICING['gpt-5.3-codex'];

export function normalizeClaudeUsage(
	data: { daily?: ClaudeDaily[]; monthly?: ClaudeDaily[] },
	tool: ToolName
): UsageSnapshot {
	const records = data.daily ?? data.monthly ?? [];

	return {
		usage: records.map((d) => ({
			date: normalizeDate(d.date ?? ''),
			tool,
			inputTokens: d.inputTokens ?? 0,
			outputTokens: d.outputTokens ?? 0,
			cacheTokens: (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0),
			totalTokens: d.totalTokens ?? 0,
			cost: d.totalCost ?? 0
		})),
		models: records.flatMap((d) => {
			const date = normalizeDate(d.date ?? '');
			const modelBreakdowns = d.modelBreakdowns ?? [];

			if (modelBreakdowns.length > 0) {
				return modelBreakdowns.map((model) => ({
					date,
					tool,
					model: model.modelName,
					inputTokens: model.inputTokens ?? 0,
					outputTokens: model.outputTokens ?? 0,
					cacheTokens: (model.cacheCreationTokens ?? 0) + (model.cacheReadTokens ?? 0),
					totalTokens:
						(model.inputTokens ?? 0) +
						(model.outputTokens ?? 0) +
						(model.cacheCreationTokens ?? 0) +
						(model.cacheReadTokens ?? 0),
					cost: model.cost ?? null
				}));
			}

			const fallbackModel = chooseFallbackModel(d.modelsUsed);
			return [
				{
					date,
					tool,
					model: fallbackModel,
					inputTokens: d.inputTokens ?? 0,
					outputTokens: d.outputTokens ?? 0,
					cacheTokens: (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0),
					totalTokens: d.totalTokens ?? 0,
					cost: d.totalCost ?? null
				}
			];
		})
	};
}

export function normalizeCodexUsage(data: { daily?: CodexDaily[]; monthly?: CodexDaily[] }): UsageSnapshot {
	const records = data.daily ?? data.monthly ?? [];

	return {
		usage: records.map((d) => ({
			date: normalizeDate(d.date ?? ''),
			tool: 'codex',
			inputTokens: d.inputTokens ?? 0,
			outputTokens: d.outputTokens ?? 0,
			cacheTokens: d.cachedInputTokens ?? 0,
			totalTokens: d.totalTokens ?? 0,
			cost: d.costUSD ?? 0
		})),
		models: records.flatMap((d) => {
			const date = normalizeDate(d.date ?? '');
			const modelEntries = Object.entries(d.models ?? {});

			if (modelEntries.length > 0) {
				const estimatedRows = modelEntries.map(([modelName, model]) => {
					const estimatedCost = estimateCodexModelCost(modelName, model);
					return {
						date,
						tool: 'codex' as ToolName,
						model: modelName,
						inputTokens: model.inputTokens ?? 0,
						outputTokens: model.outputTokens ?? 0,
						cacheTokens: model.cachedInputTokens ?? 0,
						totalTokens: model.totalTokens ?? 0,
						estimatedCost
					};
				});
				const estimatedTotal = estimatedRows.reduce((sum, row) => sum + row.estimatedCost, 0);
				const scale = estimatedTotal > 0 ? (d.costUSD ?? 0) / estimatedTotal : 0;

				return estimatedRows.map(({ estimatedCost, ...row }) => ({
					...row,
					cost: estimatedTotal > 0 ? estimatedCost * scale : null
				}));
			}

			return [
				{
					date,
					tool: 'codex' as ToolName,
					model: 'unknown',
					inputTokens: d.inputTokens ?? 0,
					outputTokens: d.outputTokens ?? 0,
					cacheTokens: d.cachedInputTokens ?? 0,
					totalTokens: d.totalTokens ?? 0,
					cost: null
				}
			];
		})
	};
}

function estimateCodexModelCost(modelName: string, model: CodexModelBreakdown): number {
	const pricing = CODEX_MODEL_PRICING[modelName] ?? DEFAULT_CODEX_PRICING;
	return (
		(model.inputTokens ?? 0) * pricing.input +
		(model.cachedInputTokens ?? 0) * pricing.cachedInput +
		((model.outputTokens ?? 0) + (model.reasoningOutputTokens ?? 0)) * pricing.output
	);
}

export function normalizePiUsage(data: unknown[]): UsageSnapshot {
	const records = Array.isArray(data) ? data : [];

	return {
		usage: records.map((d: any) => ({
			date: normalizeDate(d.date ?? ''),
			tool: 'pi' as ToolName,
			inputTokens: d.inputTokens ?? 0,
			outputTokens: d.outputTokens ?? 0,
			cacheTokens: 0,
			totalTokens: d.totalTokens ?? 0,
			cost: d.totalCost ?? d.costUSD ?? 0
		})),
		models: records.map((d: any) => ({
			date: normalizeDate(d.date ?? ''),
			tool: 'pi' as ToolName,
			model: chooseFallbackModel(d.modelsUsed),
			inputTokens: d.inputTokens ?? 0,
			outputTokens: d.outputTokens ?? 0,
			cacheTokens: 0,
			totalTokens: d.totalTokens ?? 0,
			cost: d.totalCost ?? d.costUSD ?? null
		}))
	};
}

function chooseFallbackModel(modelsUsed?: string[]): string {
	return modelsUsed?.length === 1 ? modelsUsed[0] : 'unknown';
}

function normalizeDate(dateStr: string): string {
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
	if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`;

	const parsed = new Date(dateStr);
	if (Number.isNaN(parsed.getTime())) return dateStr;

	return parsed.toISOString().slice(0, 10);
}
