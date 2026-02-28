export interface UsageRecord {
	date: string;
	tool: ToolName;
	inputTokens: number;
	outputTokens: number;
	cacheTokens: number;
	totalTokens: number;
	cost: number;
	models: string[];
}

export interface UsageTotals {
	totalTokens: number;
	totalCost: number;
}

export interface UsageResponse {
	data: UsageRecord[];
	totals: UsageTotals;
}

export type ToolName = 'claude' | 'codex' | 'opencode' | 'amp' | 'pi';
export type TimeRange = 'daily' | 'weekly' | 'monthly';
