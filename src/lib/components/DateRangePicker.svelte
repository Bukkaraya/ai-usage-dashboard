<script lang="ts">
	interface Props {
		since: string;
		until: string;
		onchange: (since: string, until: string) => void;
	}

	let { since, until, onchange }: Props = $props();

	let localSince = $state(since);
	let localUntil = $state(until);

	function handleApply() {
		onchange(localSince, localUntil);
	}

	function handleClear() {
		localSince = '';
		localUntil = '';
		onchange('', '');
	}

	// Keep local state in sync with props
	$effect(() => {
		localSince = since;
	});

	$effect(() => {
		localUntil = until;
	});
</script>

<div class="flex items-center gap-2">
	<div class="flex items-center gap-1.5">
		<label for="date-since" class="text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">From</label>
		<input
			id="date-since"
			type="date"
			bind:value={localSince}
			class="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors
				focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300
				dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
		/>
	</div>
	<div class="flex items-center gap-1.5">
		<label for="date-until" class="text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">To</label>
		<input
			id="date-until"
			type="date"
			bind:value={localUntil}
			class="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-700 shadow-sm transition-colors
				focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300
				dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-500 dark:focus:ring-zinc-600"
		/>
	</div>
	<button
		onclick={handleApply}
		class="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors
			hover:bg-zinc-800 active:bg-zinc-700
			dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
	>
		Apply
	</button>
	{#if since || until}
		<button
			onclick={handleClear}
			class="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-400 transition-colors
				hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
		>
			Clear
		</button>
	{/if}
</div>
