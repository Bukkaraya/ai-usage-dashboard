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
	// ccusage expects YYYYMMDD format, not YYYY-MM-DD
	if (since) args.push('--since', since.replace(/-/g, ''));
	if (until) args.push('--until', until.replace(/-/g, ''));

	const fullCmd = `${cmd} ${args.join(' ')}`;

	try {
		const { stdout, stderr } = await execAsync(fullCmd, {
			timeout: TIMEOUT_MS,
			maxBuffer: 10 * 1024 * 1024
		});
		// Some tools (e.g. opencode) print info/warning lines to stdout before JSON.
		// Find the actual JSON start: look for '{"' or '[{' or '[]' patterns.
		const output = stdout || stderr;
		const jsonMatch = output.match(/(\{[\s]*"|\[[\s]*[\[{]|\[\s*\])/);
		if (!jsonMatch || jsonMatch.index === undefined) return null;
		return JSON.parse(output.slice(jsonMatch.index));
	} catch {
		return null;
	}
}
