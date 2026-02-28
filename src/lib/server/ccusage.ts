import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { TOOL_COMMANDS } from '$lib/constants';
import type { ToolName } from '$lib/types';

const execAsync = promisify(exec);
const TIMEOUT_MS = 30_000;

export async function runCcusage(
	tool: ToolName,
	subcommand: 'daily' | 'monthly',
	since?: string,
	until?: string
): Promise<unknown> {
	const cmd = TOOL_COMMANDS[tool];
	const args = [subcommand, '--json'];
	if (since) args.push('--since', since);
	if (until) args.push('--until', until);

	const fullCmd = `${cmd} ${args.join(' ')}`;

	try {
		const { stdout } = await execAsync(fullCmd, { timeout: TIMEOUT_MS });
		return JSON.parse(stdout);
	} catch {
		return null;
	}
}
