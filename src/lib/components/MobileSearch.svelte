<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import {
		ArrowLeft,
		ArrowRight,
		Clock,
		Flame,
		LoaderCircle,
		Search,
		TrendingUp,
		X
	} from '@lucide/svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { allCategories, formatINR, type Product } from '$lib/catalog';
	import { nativeImpact } from '$lib/native/capacitor';

	let {
		placeholder = 'Search parts',
		class: className = ''
	}: {
		placeholder?: string;
		class?: string;
	} = $props();

	const RECENTS_KEY = 'lapkart_recent_searches_v1';
	const RECENTS_MAX = 6;

	let open = $state(false);
	let query = $state('');
	let loading = $state(false);
	let results = $state<Product[]>([]);
	let activeIndex = $state(-1);
	let total = $state(0);
	let recents = $state<string[]>([]);

	let input = $state<HTMLInputElement | undefined>();
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;
	let popStateBound = false;

	const trimmed = $derived(query.trim());
	const reduce = $derived(prefersReducedMotion.current);
	const popularCategories = allCategories.slice(0, 8);

	function loadRecents() {
		try {
			const raw = localStorage.getItem(RECENTS_KEY);
			recents = raw ? (JSON.parse(raw) as string[]).slice(0, RECENTS_MAX) : [];
		} catch {
			recents = [];
		}
	}

	function pushRecent(term: string) {
		const value = term.trim();
		if (value.length < 2) return;
		const next = [value, ...recents.filter((r) => r.toLowerCase() !== value.toLowerCase())].slice(
			0,
			RECENTS_MAX
		);
		recents = next;
		try {
			localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
		} catch {
			/* storage unavailable */
		}
	}

	function clearRecents() {
		recents = [];
		try {
			localStorage.removeItem(RECENTS_KEY);
		} catch {
			/* ignore */
		}
	}

	async function openOverlay() {
		void nativeImpact();
		loadRecents();
		open = true;
		// Push a history entry so the Android hardware back button closes the
		// overlay instead of navigating away.
		try {
			history.pushState({ lapkartSearch: true }, '');
			if (!popStateBound) {
				window.addEventListener('popstate', onPopState);
				popStateBound = true;
			}
		} catch {
			/* history unavailable */
		}
		document.body.style.overflow = 'hidden';
		await tick();
		input?.focus();
	}

	function teardown() {
		open = false;
		document.body.style.overflow = '';
		if (popStateBound) {
			window.removeEventListener('popstate', onPopState);
			popStateBound = false;
		}
	}

	function onPopState() {
		// Hardware/browser back fired while overlay was open: just close it.
		teardown();
	}

	function closeOverlay() {
		if (!open) return;
		// Unwind the history entry we pushed; popstate handler does the teardown.
		if (history.state?.lapkartSearch) {
			history.back();
		} else {
			teardown();
		}
	}

	function onInput() {
		clearTimeout(debounceTimer);
		activeIndex = -1;
		if (trimmed.length < 2) {
			controller?.abort();
			loading = false;
			results = [];
			total = 0;
			return;
		}
		loading = true;
		debounceTimer = setTimeout(() => fetchResults(trimmed), 180);
	}

	async function fetchResults(q: string) {
		controller?.abort();
		controller = new AbortController();
		try {
			const res = await fetch(`/api/search/products?q=${encodeURIComponent(q)}&limit=8`, {
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`search failed: ${res.status}`);
			const data = (await res.json()) as { products: Product[]; total: number };
			results = data.products ?? [];
			total = data.total ?? results.length;
			loading = false;
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			results = [];
			total = 0;
			loading = false;
		}
	}

	async function gotoProduct(id: string) {
		pushRecent(trimmed);
		void nativeImpact();
		closeOverlay();
		await goto(resolve(`/product/${id}`));
	}

	async function gotoResults(term: string) {
		const q = term.trim();
		pushRecent(q);
		void nativeImpact();
		closeOverlay();
		await goto(resolve(q ? `/products?q=${encodeURIComponent(q)}` : '/products'));
	}

	function applyTerm(term: string) {
		query = term;
		onInput();
		input?.focus();
	}

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (activeIndex >= 0 && results[activeIndex]) {
			void gotoProduct(results[activeIndex].id);
			return;
		}
		void gotoResults(trimmed);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeOverlay();
			return;
		}
		if (!results.length) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % results.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
		}
	}

	function clearQuery() {
		query = '';
		onInput();
		input?.focus();
	}
</script>

<!-- Trigger: looks like a search field, opens the full-screen overlay on tap. -->
<button type="button" class="search-trigger {className}" onclick={openOverlay}>
	<Search class="trigger-icon size-[17px]" strokeWidth={2} />
	<span class="trigger-label">{placeholder}</span>
	<span class="trigger-cue" aria-hidden="true">
		<ArrowRight class="size-3.5" strokeWidth={2.2} />
	</span>
</button>

{#if open}
	<div class="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
		<div
			class="overlay-backdrop"
			in:fade={{ duration: reduce ? 0 : 160 }}
			out:fade={{ duration: reduce ? 0 : 140 }}
		></div>

		<div
			class="overlay-sheet"
			in:fly={{ y: reduce ? 0 : 16, duration: reduce ? 0 : 240, easing: quintOut }}
			out:fly={{ y: reduce ? 0 : 12, duration: reduce ? 0 : 160, easing: quintOut }}
		>
			<div class="overlay-head">
				<div class="head-top">
					<button type="button" class="head-btn" aria-label="Close search" onclick={closeOverlay}>
						<ArrowLeft class="size-[18px]" strokeWidth={2.2} />
					</button>
					<span class="head-kicker">
						<Flame class="size-3.5 text-[var(--heat-100)]" strokeWidth={2.4} />
						Search lapkart
					</span>
				</div>
				<form class="search-head" onsubmit={onSubmit} role="search">
					<div class="head-field">
						{#if loading}
							<LoaderCircle class="size-[18px] shrink-0 animate-spin text-[var(--heat-100)]" />
						{:else}
							<Search class="size-[18px] shrink-0 text-[var(--black-alpha-40)]" strokeWidth={2.2} />
						{/if}
						<input
							bind:this={input}
							bind:value={query}
							oninput={onInput}
							onkeydown={onKeydown}
							type="search"
							name="q"
							autocomplete="off"
							enterkeyhint="search"
							aria-label="Search laptop parts"
							{placeholder}
						/>
						{#if trimmed}
							<button
								type="button"
								class="clear-btn"
								aria-label="Clear search"
								onclick={clearQuery}
								in:scale={{ duration: reduce ? 0 : 140, start: 0.6, easing: quintOut }}
							>
								<X class="size-4" />
							</button>
						{/if}
					</div>
				</form>
			</div>

			<div class="overlay-body">
				{#if trimmed.length < 2}
					<!-- Idle: recent searches + popular categories -->
					{#if recents.length}
						<section class="block" in:fade={{ duration: reduce ? 0 : 160 }}>
							<div class="block-head">
								<span class="block-title">
									<Clock class="size-3.5" /> Recent
								</span>
								<button type="button" class="block-action" onclick={clearRecents}>Clear</button>
							</div>
							<ul class="recent-list">
								{#each recents as term, i (term)}
									<li
										class="recent-row"
										in:fly={{
											x: reduce ? 0 : -8,
											delay: reduce ? 0 : Math.min(i * 28, 160),
											duration: 200,
											easing: quintOut
										}}
									>
										<button type="button" class="recent-main" onclick={() => gotoResults(term)}>
											<Clock class="size-4 text-[var(--black-alpha-32)]" />
											<span class="recent-text">{term}</span>
										</button>
										<button
											type="button"
											class="recent-fill"
											aria-label={`Use ${term}`}
											onclick={() => applyTerm(term)}
										>
											<ArrowLeft class="size-4 rotate-[135deg] text-[var(--black-alpha-32)]" />
										</button>
									</li>
								{/each}
							</ul>
						</section>
					{/if}

					<section class="block" in:fade={{ duration: reduce ? 0 : 160, delay: reduce ? 0 : 60 }}>
						<div class="block-head">
							<span class="block-title">
								<TrendingUp class="size-3.5" /> Popular
							</span>
						</div>
						<div class="chip-row">
							{#each popularCategories as cat, i (cat.slug)}
								<button
									type="button"
									class="chip"
									onclick={() => gotoResults(cat.name)}
									in:scale={{
										start: 0.85,
										delay: reduce ? 0 : Math.min(i * 30, 200),
										duration: 220,
										easing: quintOut
									}}
								>
									{cat.name}
								</button>
							{/each}
						</div>
					</section>
				{:else if loading && !results.length}
					<!-- Loading skeletons -->
					<ul class="result-list" aria-hidden="true">
						{#each [0, 1, 2, 3, 4] as i (i)}
							<li class="result-row">
								<span class="shimmer result-thumb"></span>
								<span class="skeleton-text">
									<span class="shimmer line w-3/4"></span>
									<span class="shimmer line line-sm w-1/3"></span>
								</span>
							</li>
						{/each}
					</ul>
				{:else if results.length}
					<ul class="result-list">
						{#each results as product, index (product.id)}
							<li
								in:fly={{
									y: reduce ? 0 : 10,
									delay: reduce ? 0 : Math.min(index * 34, 240),
									duration: 220,
									easing: quintOut
								}}
							>
								<button
									type="button"
									class="result-row"
									class:is-active={index === activeIndex}
									onclick={() => gotoProduct(product.id)}
									onpointerenter={() => (activeIndex = index)}
								>
									<span class="result-thumb">
										<img
											src={product.images?.[0] ?? product.image}
											alt=""
											loading="lazy"
											decoding="async"
										/>
									</span>
									<span class="result-meta">
										<span class="result-title">{product.title}</span>
										<span class="result-brand">{product.brand}</span>
									</span>
									<span class="result-price">{formatINR(product.price)}</span>
								</button>
							</li>
						{/each}
					</ul>
					<button type="button" class="see-all" onclick={() => gotoResults(trimmed)}>
						See all {total.toLocaleString('en-IN')} results
						<ArrowRight class="size-4" />
					</button>
				{:else}
					<div class="empty" in:fade={{ duration: reduce ? 0 : 160 }}>
						<span class="empty-icon">
							<Search class="size-6 text-[var(--black-alpha-32)]" />
						</span>
						<p class="empty-title">No parts match “{trimmed}”</p>
						<p class="empty-sub">Try a brand, model, or category</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.search-trigger {
		display: flex;
		height: 44px;
		width: 100%;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--border-muted);
		border-radius: 10px;
		background: #fff;
		padding: 0 10px 0 13px;
		color: var(--black-alpha-48);
		text-align: left;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
		transition:
			border-color 200ms var(--motion-ease),
			box-shadow 200ms var(--motion-ease),
			transform 120ms var(--motion-ease-out);
	}

	.search-trigger:active {
		transform: scale(0.99);
		border-color: var(--heat-100);
		box-shadow: 0 0 0 3px var(--heat-8);
	}

	.search-trigger :global(.trigger-icon) {
		flex-shrink: 0;
		color: var(--black-alpha-40);
	}

	.trigger-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 14px;
		font-weight: 450;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.trigger-cue {
		display: grid;
		height: 28px;
		width: 28px;
		flex-shrink: 0;
		place-items: center;
		border-radius: 8px;
		background: var(--heat-8);
		color: var(--heat-100);
	}

	.search-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		flex-direction: column;
	}

	.overlay-backdrop {
		position: absolute;
		inset: 0;
		background: var(--black-alpha-32);
		backdrop-filter: blur(3px);
	}

	.overlay-sheet {
		position: relative;
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		background: var(--background);
		box-shadow: var(--shadow-pop);
	}

	/* Branded dark header: mirrors the home hero (accent-black + heat glow). */
	.overlay-head {
		position: relative;
		overflow: hidden;
		flex: 0 0 auto;
		background: var(--accent-black);
		padding: max(12px, env(safe-area-inset-top)) 14px 16px;
	}

	.overlay-head::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		content: '';
		background: radial-gradient(circle at 88% 0%, rgba(250, 93, 25, 0.28), transparent 42%);
	}

	.head-top {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}

	.head-kicker {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: rgba(255, 255, 255, 0.82);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.head-btn {
		display: grid;
		height: 36px;
		width: 36px;
		flex-shrink: 0;
		place-items: center;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		color: #fff;
		transition:
			background-color 160ms var(--motion-ease),
			transform 120ms var(--motion-ease-out);
	}

	.head-btn:active {
		transform: scale(0.9);
		background: rgba(255, 255, 255, 0.16);
	}

	.search-head {
		position: relative;
		z-index: 1;
	}

	.head-field {
		display: flex;
		height: 48px;
		align-items: center;
		gap: 10px;
		border: 1px solid transparent;
		border-radius: 12px;
		background: #fff;
		padding-inline: 14px;
		box-shadow: 0 18px 44px -18px rgba(0, 0, 0, 0.55);
		transition:
			border-color 200ms var(--motion-ease),
			box-shadow 200ms var(--motion-ease);
	}

	.head-field:focus-within {
		border-color: var(--heat-100);
		box-shadow:
			0 0 0 3px var(--heat-40),
			0 18px 44px -18px rgba(0, 0, 0, 0.55);
	}

	.head-field input {
		height: 100%;
		flex: 1;
		border: none;
		background: transparent;
		font-size: 15px;
		color: var(--foreground);
		outline: none;
	}

	.head-field input::placeholder {
		color: var(--black-alpha-48);
	}

	.clear-btn {
		display: grid;
		height: 24px;
		width: 24px;
		flex-shrink: 0;
		place-items: center;
		border-radius: 999px;
		background: var(--black-alpha-6);
		color: var(--black-alpha-48);
		transition: background-color 160ms var(--motion-ease);
	}

	.clear-btn:active {
		background: var(--black-alpha-12);
	}

	.overlay-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 12px max(24px, env(safe-area-inset-bottom));
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.block + .block {
		margin-top: 22px;
	}

	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: 4px;
		margin-bottom: 8px;
	}

	.block-title {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--heat-100);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.block-action {
		color: var(--heat-100);
		font-size: 12px;
		font-weight: 600;
	}

	.recent-list {
		display: flex;
		flex-direction: column;
	}

	.recent-row {
		display: flex;
		align-items: center;
		gap: 4px;
		border-radius: 10px;
	}

	.recent-main {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 12px;
		border-radius: 10px;
		padding: 10px 8px;
		text-align: left;
		transition: background-color 140ms var(--motion-ease);
	}

	.recent-main:active {
		background: var(--heat-4);
	}

	.recent-text {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-size: 14px;
		color: var(--foreground);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recent-fill {
		display: grid;
		height: 28px;
		width: 28px;
		flex-shrink: 0;
		place-items: center;
		border-radius: 999px;
	}

	.recent-fill:active {
		background: var(--black-alpha-6);
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding-inline: 4px;
	}

	.chip {
		border: 1px solid var(--border-muted);
		border-radius: 999px;
		background: var(--background-lighter);
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
		transition:
			border-color 160ms var(--motion-ease),
			color 160ms var(--motion-ease),
			background-color 160ms var(--motion-ease),
			transform 120ms var(--motion-ease-out);
	}

	.chip:active {
		transform: scale(0.94);
		border-color: var(--heat-100);
		background: var(--heat-4);
		color: var(--heat-100);
	}

	.result-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.result-row {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 12px;
		border-radius: 12px;
		padding: 10px;
		text-align: left;
		transition: background-color 140ms var(--motion-ease);
	}

	.result-row.is-active,
	.result-row:active {
		background: var(--heat-4);
	}

	.result-thumb {
		display: grid;
		height: 52px;
		width: 52px;
		flex-shrink: 0;
		place-items: center;
		overflow: hidden;
		border: 1px solid var(--border-faint);
		border-radius: 10px;
		background: var(--background-lighter);
		padding: 4px;
	}

	.result-thumb img {
		height: 100%;
		width: 100%;
		object-fit: contain;
	}

	.result-meta {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 3px;
	}

	.result-title {
		overflow: hidden;
		font-size: 14px;
		font-weight: 500;
		color: var(--foreground);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-brand {
		font-size: 12px;
		color: var(--black-alpha-48);
	}

	.result-price {
		flex-shrink: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
	}

	.see-all {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 8px;
		border-radius: 12px;
		background: var(--heat-4);
		padding: 14px;
		font-size: 13px;
		font-weight: 600;
		color: var(--heat-100);
		transition:
			background-color 160ms var(--motion-ease),
			transform 120ms var(--motion-ease-out);
	}

	.see-all:active {
		transform: scale(0.98);
		background: var(--heat-12);
	}

	.skeleton-text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 8px;
	}

	.line {
		height: 12px;
		border-radius: 6px;
		background: var(--background-lighter);
	}

	.line-sm {
		height: 10px;
	}

	.w-3\/4 {
		width: 75%;
	}

	.w-1\/3 {
		width: 33%;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding-top: 64px;
		text-align: center;
	}

	.empty-icon {
		display: grid;
		height: 56px;
		width: 56px;
		place-items: center;
		margin-bottom: 6px;
		border-radius: 999px;
		background: var(--background-lighter);
	}

	.empty-title {
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
	}

	.empty-sub {
		font-size: 12px;
		color: var(--black-alpha-48);
	}

	@media (prefers-reduced-motion: reduce) {
		.search-trigger,
		.head-btn,
		.chip,
		.result-row,
		.see-all {
			transition-duration: 0.01ms !important;
		}
	}
</style>
