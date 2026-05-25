import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ModelUsageRecord, UsageRecord } from '$lib/types';

const execAsync = promisify(exec);

const DB_PATH = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');

const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
	'gpt-5.4': { input: 2.5 / 1e6, output: 10 / 1e6, cacheRead: 0.625 / 1e6 },
	'gpt-5.3-codex': { input: 2.5 / 1e6, output: 10 / 1e6, cacheRead: 0.625 / 1e6 },
	'gpt-5.3-codex-spark': { input: 2.5 / 1e6, output: 10 / 1e6, cacheRead: 0.625 / 1e6 },
	'gpt-5.2': { input: 2.5 / 1e6, output: 10 / 1e6, cacheRead: 0.625 / 1e6 },
	'gpt-5-nano': { input: 0.1 / 1e6, output: 0.4 / 1e6, cacheRead: 0.025 / 1e6 }
};

const DEFAULT_PRICING = { input: 2.5 / 1e6, output: 10 / 1e6, cacheRead: 0.625 / 1e6 };

interface DailyModelRow {
	d: string;
	model: string;
	input_tokens: number;
	output_tokens: number;
	cache_read: number;
	cache_write: number;
}

export async function queryOpenCodeUsage(
	since?: string,
	until?: string
): Promise<{ usage: UsageRecord[]; models: ModelUsageRecord[] } | null> {
	if (!existsSync(DB_PATH)) return null;

	const conditions = ["json_extract(data, '$.role') = 'assistant'"];
	if (since) conditions.push(`date(time_created/1000, 'unixepoch', 'localtime') >= '${since}'`);
	if (until) conditions.push(`date(time_created/1000, 'unixepoch', 'localtime') <= '${until}'`);

	const query = `
		SELECT
			date(time_created/1000, 'unixepoch', 'localtime') as d,
			json_extract(data, '$.modelID') as model,
			COALESCE(sum(json_extract(data, '$.tokens.input')), 0) as input_tokens,
			COALESCE(sum(json_extract(data, '$.tokens.output')), 0) as output_tokens,
			COALESCE(sum(json_extract(data, '$.tokens.cache.read')), 0) as cache_read,
			COALESCE(sum(json_extract(data, '$.tokens.cache.write')), 0) as cache_write
		FROM message
		WHERE ${conditions.join(' AND ')}
		GROUP BY d, model
		ORDER BY d ASC;
	`;

	try {
		const { stdout } = await execAsync(
			`sqlite3 -json '${DB_PATH}' "${query.replace(/"/g, '\\"')}"`,
			{ timeout: 15_000, maxBuffer: 10 * 1024 * 1024 }
		);
		if (!stdout.trim()) return null;

		const rows: DailyModelRow[] = JSON.parse(stdout);
		const usageMap = new Map<string, UsageRecord>();
		const modelRecords: ModelUsageRecord[] = [];

		for (const row of rows) {
			const model = row.model || 'unknown';
			const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
			const cost =
				row.input_tokens * pricing.input +
				row.output_tokens * pricing.output +
				row.cache_read * pricing.cacheRead;
			const totalTokens =
				row.input_tokens + row.output_tokens + row.cache_read + row.cache_write;

			modelRecords.push({
				date: row.d,
				tool: 'opencode',
				model,
				inputTokens: row.input_tokens,
				outputTokens: row.output_tokens,
				cacheReadTokens: row.cache_read,
				cacheWriteTokens: row.cache_write,
				cacheTokens: row.cache_read + row.cache_write,
				totalTokens,
				cost
			});

			const key = `${row.d}|opencode`;
			const existing = usageMap.get(key);
			if (existing) {
				existing.inputTokens += row.input_tokens;
				existing.outputTokens += row.output_tokens;
				existing.cacheReadTokens += row.cache_read;
				existing.cacheWriteTokens += row.cache_write;
				existing.cacheTokens += row.cache_read + row.cache_write;
				existing.totalTokens += totalTokens;
				existing.cost += cost;
			} else {
				usageMap.set(key, {
					date: row.d,
					tool: 'opencode',
					inputTokens: row.input_tokens,
					outputTokens: row.output_tokens,
					cacheReadTokens: row.cache_read,
					cacheWriteTokens: row.cache_write,
					cacheTokens: row.cache_read + row.cache_write,
					totalTokens,
					cost
				});
			}
		}

		return {
			usage: Array.from(usageMap.values()),
			models: modelRecords
		};
	} catch {
		return null;
	}
}
