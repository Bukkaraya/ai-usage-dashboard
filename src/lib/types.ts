export interface UsageRecord {
	date: string;
	tool: ToolName;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	cacheTokens: number;
	totalTokens: number;
	cost: number;
}

export interface ModelUsageRecord {
	date: string;
	tool: ToolName;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	cacheTokens: number;
	totalTokens: number;
	cost: number | null;
}

export interface ModelFilter {
	tool: ToolName;
	model: string;
}

export interface UsageTotals {
	totalTokens: number;
	totalCost: number;
}

export interface UsageResponse {
	data: UsageRecord[];
	models: ModelUsageRecord[];
	totals: UsageTotals;
}

export type ToolName = 'claude' | 'codex' | 'opencode' | 'amp' | 'pi';
export type TimeRange = 'daily' | 'weekly' | 'monthly';
