<script lang="ts">
	import {
		ArrowUpRight,
		Boxes,
		CornerDownLeft,
		LoaderCircle,
		Package,
		Plus,
		Search
	} from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import { requestAdmin, type AdminOrderRecord } from '$lib/admin';

	type PaletteSection = {
		id: string;
		label: string;
		hint: string;
	};

	type PaletteProduct = {
		id: string;
		title: string;
		brand: string;
		category: string;
		image: string;
		price: number;
		stock: number;
		status: string;
	};

	type PaletteItem =
		| { kind: 'section'; section: PaletteSection }
		| { kind: 'action'; id: string; label: string; hint: string }
		| { kind: 'product'; product: PaletteProduct }
		| { kind: 'order'; order: AdminOrderRecord };

	let {
		open = $bindable(false),
		sections,
		onNavigate,
		onSelectProduct,
		onSelectOrder,
		onCreateProduct
	}: {
		open: boolean;
		sections: PaletteSection[];
		onNavigate: (sectionId: string) => void;
		onSelectProduct: (product: PaletteProduct) => void;
		onSelectOrder: (order: AdminOrderRecord) => void;
		onCreateProduct: () => void;
	} = $props();

	let query = $state('');
	let activeIndex = $state(0);
	let searching = $state(false);
	let products = $state<PaletteProduct[]>([]);
	let orders = $state<AdminOrderRecord[]>([]);
	let searchTimer: number | null = null;
	let requestSeq = 0;
	let inputEl = $state<HTMLInputElement | null>(null);

	const actions = [{ id: 'new-product', label: 'New product', hint: 'Create a catalog entry' }];

	const filteredSections = $derived(
		sections.filter((section) => section.label.toLowerCase().includes(query.trim().toLowerCase()))
	);
	const filteredActions = $derived(
		actions.filter((action) => action.label.toLowerCase().includes(query.trim().toLowerCase()))
	);

	const items = $derived.by<PaletteItem[]>(() => {
		const list: PaletteItem[] = [];
		for (const section of filteredSections) list.push({ kind: 'section', section });
		for (const action of filteredActions) list.push({ kind: 'action', ...action });
		for (const product of products) list.push({ kind: 'product', product });
		for (const order of orders) list.push({ kind: 'order', order });
		return list;
	});

	$effect(() => {
		if (activeIndex >= items.length) activeIndex = Math.max(0, items.length - 1);
	});

	$effect(() => {
		if (open) {
			query = '';
			products = [];
			orders = [];
			activeIndex = 0;
			queueMicrotask(() => inputEl?.focus());
		}
	});

	function queueSearch() {
		activeIndex = 0;
		if (searchTimer) window.clearTimeout(searchTimer);
		const q = query.trim();
		if (q.length < 2) {
			products = [];
			orders = [];
			searching = false;
			return;
		}
		searchTimer = window.setTimeout(() => void runSearch(q), 250);
	}

	async function runSearch(q: string) {
		const seq = ++requestSeq;
		searching = true;
		try {
			const [productResult, orderResult] = await Promise.allSettled([
				requestAdmin<{ products: PaletteProduct[] }>(
					`/admin/products?pageSize=5&q=${encodeURIComponent(q)}`
				),
				requestAdmin<{ orders: AdminOrderRecord[] }>(
					`/admin/orders?pageSize=5&q=${encodeURIComponent(q)}`
				)
			]);
			if (seq !== requestSeq) return;
			products = productResult.status === 'fulfilled' ? (productResult.value.products ?? []) : [];
			orders = orderResult.status === 'fulfilled' ? (orderResult.value.orders ?? []) : [];
		} finally {
			if (seq === requestSeq) searching = false;
		}
	}

	function execute(item: PaletteItem) {
		open = false;
		if (item.kind === 'section') onNavigate(item.section.id);
		else if (item.kind === 'action' && item.id === 'new-product') onCreateProduct();
		else if (item.kind === 'product') onSelectProduct(item.product);
		else if (item.kind === 'order') onSelectOrder(item.order);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			open = false;
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = Math.min(activeIndex + 1, items.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const item = items[activeIndex];
			if (item) execute(item);
		}
	}

	function isFirstOfKind(index: number) {
		const item = items[index];
		if (!item) return false;
		if (index === 0) return true;
		return items[index - 1].kind !== item.kind;
	}

	const groupLabel: Record<PaletteItem['kind'], string> = {
		section: 'Go to',
		action: 'Actions',
		product: 'Products',
		order: 'Orders'
	};
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-[80] flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-[3px]"
		onclick={(event) => {
			if (event.target === event.currentTarget) open = false;
		}}
	>
		<div
			class="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-[var(--accent-black)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
			role="dialog"
			aria-modal="true"
			aria-label="Admin command palette"
		>
			<div class="flex items-center gap-2.5 border-b border-white/8 px-4">
				{#if searching}
					<LoaderCircle class="size-4 shrink-0 animate-spin text-[var(--heat-100)]" />
				{:else}
					<Search class="size-4 shrink-0 text-white/35" strokeWidth={2} />
				{/if}
				<input
					bind:this={inputEl}
					bind:value={query}
					oninput={queueSearch}
					onkeydown={handleKeydown}
					class="h-12 w-full bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"
					placeholder="Search orders, products, or jump to a section..."
					spellcheck="false"
					autocomplete="off"
				/>
				<kbd
					class="hidden shrink-0 rounded border border-white/12 px-1.5 py-0.5 text-[10px] tracking-wide text-white/35 sm:block"
				>
					ESC
				</kbd>
			</div>

			<div class="max-h-[46vh] overflow-y-auto p-2">
				{#if !items.length}
					<p class="px-3 py-8 text-center text-[12px] text-white/35">
						{query.trim().length >= 2 && !searching
							? 'Nothing matches. Try a customer name, city, brand, or SKU.'
							: 'Type at least 2 characters to search the store.'}
					</p>
				{/if}

				{#each items as item, index (item.kind + (item.kind === 'section' ? item.section.id : item.kind === 'action' ? item.id : item.kind === 'product' ? item.product.id : item.order.id))}
					{#if isFirstOfKind(index)}
						<p
							class="px-3 pt-2.5 pb-1 font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase"
						>
							{groupLabel[item.kind]}
						</p>
					{/if}
					<button
						type="button"
						class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors {index ===
						activeIndex
							? 'bg-[var(--heat-100)]/14 text-white'
							: 'text-white/65 hover:bg-white/5'}"
						onmouseenter={() => (activeIndex = index)}
						onclick={() => execute(item)}
					>
						{#if item.kind === 'section'}
							<ArrowUpRight class="size-4 shrink-0 text-white/35" strokeWidth={2} />
							<span class="flex-1 text-[13px] font-medium">{item.section.label}</span>
							<kbd
								class="rounded border border-white/12 px-1.5 py-0.5 font-mono text-[10px] text-white/35"
							>
								{item.section.hint}
							</kbd>
						{:else if item.kind === 'action'}
							<Plus class="size-4 shrink-0 text-[var(--heat-100)]" strokeWidth={2} />
							<span class="flex-1 text-[13px] font-medium">{item.label}</span>
							<span class="text-[11px] text-white/30">{item.hint}</span>
						{:else if item.kind === 'product'}
							<span
								class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white p-0.5"
							>
								{#if item.product.image}
									<img
										src={item.product.image}
										alt=""
										class="max-h-full max-w-full object-contain"
										loading="lazy"
									/>
								{:else}
									<Boxes class="size-3.5 text-black/30" />
								{/if}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[13px] font-medium">{item.product.title}</span>
								<span class="block truncate text-[10px] text-white/35">
									{item.product.brand} · stock {item.product.stock} · {item.product.status}
								</span>
							</span>
							<span class="shrink-0 font-mono text-[12px] text-white/55">
								{formatINR(item.product.price)}
							</span>
						{:else}
							<Package class="size-4 shrink-0 text-white/35" strokeWidth={2} />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[13px] font-medium">
									#{item.order.id.slice(0, 8).toUpperCase()} · {item.order.shippingName ||
										item.order.userEmail ||
										'Customer'}
								</span>
								<span class="block truncate text-[10px] text-white/35">
									{item.order.status} · {item.order.paymentStatus} · {[
										item.order.shippingCity,
										item.order.shippingState
									]
										.filter(Boolean)
										.join(', ')}
								</span>
							</span>
							<span class="shrink-0 font-mono text-[12px] text-white/55">
								{formatINR(item.order.total)}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			<div
				class="flex items-center justify-between border-t border-white/8 px-4 py-2 text-[10px] text-white/30"
			>
				<span class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<kbd class="rounded border border-white/12 px-1 py-px font-mono">↑↓</kbd> navigate
					</span>
					<span class="flex items-center gap-1">
						<CornerDownLeft class="size-3" /> open
					</span>
				</span>
				<span class="font-mono tracking-[0.18em] uppercase">LapKart Ops</span>
			</div>
		</div>
	</div>
{/if}
