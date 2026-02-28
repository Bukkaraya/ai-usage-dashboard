import type { UsageRecord, ToolName } from '$lib/types';

interface ClaudeDaily {
	date: string;
	inputTokens: number;
	outputTokens: number;
	cacheCreationTokens: number;
	cacheReadTokens: number;
	totalTokens: number;
	totalCost: number;
	modelsUsed: string[];
}

interface CodexDaily {
	date: string;
	inputTokens: number;
	outputTokens: number;
	cachedInputTokens: number;
	reasoningOutputTokens: number;
	totalTokens: number;
	costUSD: number;
	models: Record<string, unknown>;
}

export function normalizeClaude(data: { daily: ClaudeDaily[] }, tool: ToolName): UsageRecord[] {
	return (data.daily ?? []).map((d) => ({
		date: d.date,
		tool,
		inputTokens: d.inputTokens,
		outputTokens: d.outputTokens,
		cacheTokens: (d.cacheCreationTokens ?? 0) + (d.cacheReadTokens ?? 0),
		totalTokens: d.totalTokens,
		cost: d.totalCost ?? 0,
		models: d.modelsUsed ?? []
	}));
}

export function normalizeCodex(data: { daily: CodexDaily[] }): UsageRecord[] {
	return (data.daily ?? []).map((d) => ({
		date: d.date,
		tool: 'codex' as ToolName,
		inputTokens: d.inputTokens,
		outputTokens: d.outputTokens,
		cacheTokens: d.cachedInputTokens ?? 0,
		totalTokens: d.totalTokens,
		cost: d.costUSD ?? 0,
		models: Object.keys(d.models ?? {})
	}));
}

export function normalizePi(data: unknown[]): UsageRecord[] {
	return (data ?? []).map((d: any) => ({
		date: d.date ?? '',
		tool: 'pi' as ToolName,
		inputTokens: d.inputTokens ?? 0,
		outputTokens: d.outputTokens ?? 0,
		cacheTokens: 0,
		totalTokens: d.totalTokens ?? 0,
		cost: d.totalCost ?? d.costUSD ?? 0,
		models: d.modelsUsed ?? []
	}));
}
