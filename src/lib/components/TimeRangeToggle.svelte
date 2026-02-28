<script lang="ts">
	import type { TimeRange } from '$lib/types';

	interface Props {
		value: TimeRange;
		onchange: (range: TimeRange) => void;
	}

	let { value, onchange }: Props = $props();

	const options: { label: string; value: TimeRange }[] = [
		{ label: 'Daily', value: 'daily' },
		{ label: 'Weekly', value: 'weekly' },
		{ label: 'Monthly', value: 'monthly' }
	];
</script>

<div class="inline-flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800" role="radiogroup" aria-label="Time range">
	{#each options as opt (opt.value)}
		<button
			role="radio"
			aria-checked={value === opt.value}
			class="rounded-md px-3.5 py-1.5 text-sm font-medium tracking-tight transition-all duration-200
				{value === opt.value
					? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
					: 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'}"
			onclick={() => onchange(opt.value)}
		>
			{opt.label}
		</button>
	{/each}
</div>
