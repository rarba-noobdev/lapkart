<script lang="ts">
	let { value }: { value: string } = $props();

	// How many comma-separated tokens before we treat the value as a list and
	// render compact chips instead of one long wrapping line.
	const LIST_THRESHOLD = 6;
	// Chips shown before the "show all" toggle. Keeps the initial DOM small for
	// parts that list 100+ compatible models.
	const COLLAPSED_COUNT = 14;

	let expanded = $state(false);

	const items = $derived.by(() => {
		if (!value.includes(',')) return [] as string[];
		const seen = new Set<string>();
		const out: string[] = [];
		for (const raw of value.split(',')) {
			const item = raw.trim();
			if (!item) continue;
			const key = item.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(item);
		}
		return out;
	});

	const isList = $derived(items.length >= LIST_THRESHOLD);
	const hidden = $derived(Math.max(0, items.length - COLLAPSED_COUNT));
	const visible = $derived(expanded ? items : items.slice(0, COLLAPSED_COUNT));
</script>

{#if isList}
	<div>
		<ul class="chip-list">
			{#each visible as item (item)}
				<li class="chip">{item}</li>
			{/each}
		</ul>
		{#if hidden > 0}
			<button type="button" class="show-toggle" onclick={() => (expanded = !expanded)}>
				{expanded ? 'Show less' : `Show all ${items.length}`}
			</button>
		{/if}
	</div>
{:else}
	<span class="text-body-small text-foreground">{value}</span>
{/if}

<style>
	.chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 3px 8px;
		font-size: 12px;
		line-height: 1.3;
		color: var(--black-alpha-72);
	}

	.show-toggle {
		margin-top: 8px;
		font-size: 12px;
		font-weight: 600;
		color: var(--heat-100);
		transition: color 150ms ease;
	}

	.show-toggle:hover {
		color: var(--foreground);
	}
</style>
