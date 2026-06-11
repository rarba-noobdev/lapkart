<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowRight, LoaderCircle, Search } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { formatINR, type Product } from '$lib/catalog';

	let {
		placeholder = 'Search parts',
		size = 'md',
		class: className = ''
	}: {
		placeholder?: string;
		size?: 'md' | 'lg';
		class?: string;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let loading = $state(false);
	let results = $state<Product[]>([]);
	let activeIndex = $state(-1);
	let total = $state(0);

	let wrapper: HTMLDivElement;
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;

	const trimmed = $derived(query.trim());
	const flyY = $derived(prefersReducedMotion.current ? 0 : 6);

	function onInput() {
		clearTimeout(debounceTimer);
		if (trimmed.length < 2) {
			controller?.abort();
			open = false;
			loading = false;
			results = [];
			activeIndex = -1;
			return;
		}
		loading = true;
		open = true;
		debounceTimer = setTimeout(() => fetchResults(trimmed), 180);
	}

	async function fetchResults(q: string) {
		controller?.abort();
		controller = new AbortController();
		try {
			const res = await fetch(`/api/search/products?q=${encodeURIComponent(q)}&limit=6`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`search failed: ${res.status}`);
			const data = (await res.json()) as { products: Product[]; total: number };
			results = data.products ?? [];
			total = data.total ?? results.length;
			activeIndex = -1;
			loading = false;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			results = [];
			total = 0;
			loading = false;
		}
	}

	function close() {
		open = false;
		activeIndex = -1;
	}

	async function submitSearch(event: SubmitEvent) {
		event.preventDefault();
		if (activeIndex >= 0 && results[activeIndex]) {
			const id = results[activeIndex].id;
			close();
			await goto(resolve(`/product/${id}`));
			return;
		}
		close();
		await goto(resolve(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products'));
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open || !results.length) {
			if (event.key === 'Escape') close();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
		} else if (event.key === 'Escape') {
			close();
		}
	}

	function onFocusOut(event: FocusEvent) {
		if (!wrapper.contains(event.relatedTarget as Node)) close();
	}

	function onFocus() {
		if (trimmed.length >= 2 && results.length) open = true;
	}
</script>

<div class="relative {className}" bind:this={wrapper} onfocusout={onFocusOut}>
	<form onsubmit={submitSearch} role="search">
		<label
			class={[
				'group flex items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] transition-[border-color,background-color,box-shadow] focus-within:border-[var(--heat-100)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--heat-12)]',
				size === 'lg' ? 'h-11' : 'h-10'
			]}
		>
			<span class="sr-only">Search laptop parts</span>
			<span class="relative ml-3 size-[15px] shrink-0">
				{#if loading}
					<span class="absolute inset-0" in:fade={{ duration: 120 }}>
						<LoaderCircle class="size-[15px] animate-spin text-[var(--heat-100)]" />
					</span>
				{:else}
					<span class="absolute inset-0" in:fade={{ duration: 120 }}>
						<Search
							class="size-[15px] text-[var(--black-alpha-40)] transition-colors group-focus-within:text-[var(--heat-100)]"
						/>
					</span>
				{/if}
			</span>
			<input
				bind:value={query}
				oninput={onInput}
				onkeydown={onKeydown}
				onfocus={onFocus}
				type="search"
				name="q"
				autocomplete="off"
				aria-label="Search laptop parts"
				aria-expanded={open}
				aria-controls="search-suggestions"
				role="combobox"
				{placeholder}
				class="text-body-medium h-full flex-1 border-none bg-transparent px-3 outline-none placeholder:text-[var(--black-alpha-48)]"
			/>
		</label>
	</form>

	{#if open}
		<div
			id="search-suggestions"
			role="listbox"
			aria-label="Product suggestions"
			class="search-panel absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
			in:fly={{ y: flyY, duration: 180, easing: quintOut }}
			out:fade={{ duration: 120 }}
		>
			{#if loading && !results.length}
				<div class="space-y-1 p-2" aria-hidden="true">
					{#each [0, 1, 2] as i (i)}
						<div class="flex items-center gap-3 rounded-md p-2">
							<div class="shimmer size-10 shrink-0 rounded-md bg-[var(--background-lighter)]"></div>
							<div class="flex-1 space-y-1.5">
								<div class="shimmer h-3 w-3/4 rounded bg-[var(--background-lighter)]"></div>
								<div class="shimmer h-2.5 w-1/3 rounded bg-[var(--background-lighter)]"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if results.length}
				<ul class="p-2">
					{#each results as product, index (product.id)}
						<li
							in:fly={{ y: 4, delay: Math.min(index * 30, 150), duration: 160, easing: quintOut }}
						>
							<a
								href={resolve(`/product/${product.id}`)}
								role="option"
								aria-selected={index === activeIndex}
								class="search-row flex items-center gap-3 rounded-md p-2"
								class:is-active={index === activeIndex}
								onmousedown={(event) => event.preventDefault()}
								onclick={close}
								onpointerenter={() => (activeIndex = index)}
							>
								<span
									class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-1"
								>
									<img
										src={product.images?.[0] ?? product.image}
										alt=""
										class="size-full object-contain"
										loading="lazy"
										decoding="async"
									/>
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[13px] font-medium text-foreground">
										{product.title}
									</span>
									<span class="mt-0.5 block text-[11px] text-[var(--black-alpha-48)]">
										{product.brand}
									</span>
								</span>
								<span class="shrink-0 text-[13px] font-semibold text-foreground">
									{formatINR(product.price)}
								</span>
							</a>
						</li>
					{/each}
				</ul>
				<button
					type="button"
					class="search-row flex w-full items-center justify-between border-t border-[var(--border-faint)] px-4 py-2.5 text-[12px] font-medium text-[var(--heat-100)]"
					onmousedown={(event) => event.preventDefault()}
					onclick={() => {
						close();
						goto(resolve(`/products?q=${encodeURIComponent(trimmed)}`));
					}}
				>
					See all {total.toLocaleString('en-IN')} results
					<ArrowRight class="size-3.5" />
				</button>
			{:else}
				<p
					class="px-4 py-5 text-center text-[12px] text-[var(--black-alpha-48)]"
					in:fade={{ duration: 140 }}
				>
					No parts match “{trimmed}”
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.search-panel {
		transform-origin: top center;
	}

	/* Highlight is keyboard/pointer driven — instant on purpose, no transition. */
	.search-row.is-active,
	.search-row:hover {
		background: var(--heat-4);
	}

	.search-row:active {
		transform: scale(0.99);
	}
</style>
