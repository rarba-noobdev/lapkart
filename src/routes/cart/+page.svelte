<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { fly, fade } from 'svelte/transition';
	import {
		ArrowLeft,
		ArrowRight,
		Minus,
		Package,
		Plus,
		ShoppingBag,
		Trash2,
		Truck
	} from '@lucide/svelte';
	import { cartState, hydrateCart, removeFromCart, setCartQty, type CartItem } from '$lib/cart';
	import { discountPct, formatINR, type Product } from '$lib/catalog';
	import { listProductsByIds } from '$lib/products';

	let loading = $state(true);
	let products = $state<Product[]>([]);
	let error = $state<string | null>(null);

	async function loadProducts(ids: string[]) {
		if (ids.length === 0) {
			products = [];
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			products = await listProductsByIds(ids);
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Could not load cart details';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const unsubscribe = cartState.subscribe((current) => {
			if (current.hydrated) {
				void loadProducts(current.items.map((item) => item.id));
			}
		});

		hydrateCart();

		return unsubscribe;
	});

	const rows = $derived.by(() => {
		const productMap = new Map(products.map((product) => [product.id, product]));
		return $cartState.items
			.map((item) => ({ item, product: productMap.get(item.id) }))
			.filter((row): row is { item: CartItem; product: Product } => Boolean(row.product));
	});

	const subtotal = $derived(rows.reduce((sum, row) => sum + row.product.price * row.item.qty, 0));
	const mrp = $derived(rows.reduce((sum, row) => sum + row.product.mrp * row.item.qty, 0));
	const savings = $derived(mrp - subtotal);
	const shipping = $derived(subtotal > 999 || subtotal === 0 ? 0 : 49);
	const total = $derived(subtotal + shipping);
	const freeShippingGap = $derived(subtotal < 999 && subtotal > 0 ? 999 - subtotal : 0);
	const freeShippingProgress = $derived(Math.min(100, (subtotal / 999) * 100));
</script>

<svelte:head>
	<title>Cart ({rows.length}) - LapKart</title>
</svelte:head>

<section class="min-h-[60vh]">
	{#if !$cartState.hydrated || loading}
		<!-- Skeleton -->
		<div class="container mx-auto px-4 py-8">
			<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
				<div class="space-y-2">
					{#each [1, 2, 3] as i (i)}
						<div class="h-[100px] animate-pulse rounded-lg border border-[var(--border-faint)] bg-white"></div>
					{/each}
				</div>
				<div class="h-[240px] animate-pulse rounded-lg border border-[var(--border-faint)] bg-white"></div>
			</div>
		</div>
	{:else if error}
		<div class="container mx-auto px-4 py-8">
			<div class="rounded-lg border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-5 text-[13px] text-[var(--accent-crimson)]">
				{error}
			</div>
		</div>
	{:else if rows.length === 0}
		<!-- Empty cart -->
		<div class="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center sm:py-32">
			<div class="grid size-16 place-items-center rounded-lg border border-[var(--border-muted)] bg-white text-[var(--heat-100)]">
				<ShoppingBag class="size-7" strokeWidth={1.5} />
			</div>
			<h1 class="mt-4 text-[20px] font-medium text-foreground sm:text-[24px]">Cart is empty</h1>
			<p class="mt-1 text-[13px] text-[var(--black-alpha-48)]">
				Browse laptop parts and add them here.
			</p>
			<a
				href={resolve('/products')}
				class="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-[13px] text-white"
			>
				Browse catalog <ArrowRight class="size-4" />
			</a>
		</div>
	{:else}
		<!-- Cart with items -->
		<div class="container mx-auto px-4 py-6 sm:py-8">
			<!-- Header -->
			<div class="mb-5 flex items-center justify-between sm:mb-6">
				<div class="flex items-center gap-3">
					<a
						href={resolve('/products')}
						class="grid size-8 place-items-center rounded-md border border-[var(--border-faint)] text-[var(--black-alpha-48)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						aria-label="Back to shop"
					>
						<ArrowLeft class="size-3.5" />
					</a>
					<div>
						<h1 class="text-[18px] font-medium text-foreground sm:text-[22px]">Cart</h1>
						<p class="text-[12px] text-[var(--black-alpha-48)]">{rows.length} item{rows.length === 1 ? '' : 's'}</p>
					</div>
				</div>
			</div>

			<!-- Free shipping progress -->
			{#if freeShippingGap > 0}
				<div class="mb-4 rounded-lg border border-[var(--border-faint)] bg-white p-3 sm:mb-5" in:fade={{ duration: 160 }}>
					<div class="flex items-center justify-between text-[12px]">
						<span class="flex items-center gap-1.5 text-[var(--black-alpha-56)]">
							<Truck class="size-3.5 text-[var(--heat-100)]" strokeWidth={2} />
							Add {formatINR(freeShippingGap)} more for free shipping
						</span>
						<span class="text-[11px] font-medium text-[var(--heat-100)]">{Math.round(freeShippingProgress)}%</span>
					</div>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-[var(--background-lighter)]">
						<div
							class="h-full rounded-full bg-[var(--heat-100)] transition-all duration-500"
							style:width="{freeShippingProgress}%"
						></div>
					</div>
				</div>
			{/if}

			<div class="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
				<!-- Item list -->
				<div class="space-y-2">
					{#each rows as row, idx (row.item.id)}
						<div
							class="group rounded-lg border border-[var(--border-faint)] bg-white p-3 transition-all hover:border-[var(--heat-20)] sm:p-4"
							in:fly={{ y: 12, duration: 200, delay: idx * 40 }}
						>
							<div class="flex gap-3 sm:gap-4">
								<!-- Product image -->
								<a
									href={resolve(`/product/${row.product.id}`)}
									aria-label={`View ${row.product.title}`}
									class="size-20 shrink-0 overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] sm:size-24"
								>
									<img
										src={row.product.images?.[0] ?? row.product.image}
										alt={row.product.title}
										class="size-full object-contain p-2"
									/>
								</a>

								<!-- Product info -->
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-2">
										<div class="min-w-0">
											<p class="text-[10px] tracking-[0.12em] text-[var(--black-alpha-56)] uppercase">
												{row.product.brand}
											</p>
											<a
												href={resolve(`/product/${row.product.id}`)}
												class="mt-0.5 line-clamp-2 block text-[13px] font-medium leading-snug text-foreground transition-colors hover:text-[var(--heat-100)] sm:text-[14px]"
											>
												{row.product.title}
											</a>
										</div>
										<!-- Price (desktop) -->
										<div class="hidden shrink-0 text-right sm:block">
											<p class="text-[15px] font-semibold text-foreground">{formatINR(row.product.price * row.item.qty)}</p>
											{#if discountPct(row.product) > 0}
												<p class="text-[11px] text-[var(--black-alpha-32)] line-through">{formatINR(row.product.mrp * row.item.qty)}</p>
											{/if}
										</div>
									</div>

									<!-- Bottom row: qty + price(mobile) + remove -->
									<div class="mt-2.5 flex items-center gap-3 sm:mt-3">
										<!-- Quantity control -->
										<div class="flex items-center rounded-md border border-[var(--border-muted)]">
											<button
												type="button"
												class="grid size-10 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)] disabled:opacity-30 sm:size-8"
												aria-label="Decrease quantity"
												disabled={row.item.qty <= 1}
												onclick={() => setCartQty(row.item.id, row.item.qty - 1)}
											>
												<Minus class="size-3" />
											</button>
											<span class="w-7 text-center text-[12px] font-medium text-foreground">{row.item.qty}</span>
											<button
												type="button"
												class="grid size-10 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)] sm:size-8"
												aria-label="Increase quantity"
												onclick={() => setCartQty(row.item.id, row.item.qty + 1)}
											>
												<Plus class="size-3" />
											</button>
										</div>

										<!-- Price (mobile) -->
										<div class="sm:hidden">
											<p class="text-[13px] font-semibold text-foreground">{formatINR(row.product.price * row.item.qty)}</p>
										</div>

										<!-- Remove -->
										<button
											type="button"
											aria-label={`Remove ${row.product.title}`}
											class="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--black-alpha-56)] transition-colors hover:text-[var(--accent-crimson)]"
											onclick={() => removeFromCart(row.item.id)}
										>
											<Trash2 class="size-3" />
											<span class="hidden sm:inline">Remove</span>
										</button>
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Order summary sidebar -->
				<aside class="h-fit lg:sticky lg:top-24">
					<div class="rounded-lg border border-[var(--border-faint)] bg-white">
						<div class="border-b border-[var(--border-faint)] px-4 py-3">
							<h2 class="text-[13px] font-medium text-foreground">Order summary</h2>
						</div>

						<div class="space-y-2.5 px-4 py-4 text-[13px]">
							<div class="flex justify-between text-[var(--black-alpha-64)]">
								<span>Subtotal ({rows.length} items)</span>
								<span class="text-foreground">{formatINR(mrp)}</span>
							</div>
							{#if savings > 0}
								<div class="flex justify-between">
									<span class="text-[var(--accent-forest)]">Discount</span>
									<span class="text-[var(--accent-forest)]">- {formatINR(savings)}</span>
								</div>
							{/if}
							<div class="flex justify-between text-[var(--black-alpha-64)]">
								<span>Delivery</span>
								<span class={shipping === 0 ? 'text-[var(--accent-forest)]' : 'text-foreground'}>
									{shipping === 0 ? 'FREE' : formatINR(shipping)}
								</span>
							</div>
							<div class="border-t border-dashed border-[var(--border-muted)] pt-2.5">
								<div class="flex items-baseline justify-between">
									<span class="text-[14px] font-medium text-foreground">Total</span>
									<span class="text-[20px] font-semibold text-foreground">{formatINR(total)}</span>
								</div>
							</div>
						</div>

						{#if savings > 0}
							<div class="mx-4 mb-3 rounded-md bg-[var(--accent-forest)]/8 px-3 py-2 text-[12px] font-medium text-[var(--accent-forest)]">
								You save {formatINR(savings)} on this order
							</div>
						{/if}

						<div class="border-t border-[var(--border-faint)] p-4 space-y-2">
							<a
								href={resolve('/checkout')}
								class="button button-primary flex h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-medium text-white"
							>
								Proceed to checkout <ArrowRight class="size-4" />
							</a>
							<a
								href={resolve('/products')}
								class="flex h-9 w-full items-center justify-center rounded-md text-[12px] font-medium text-[var(--black-alpha-56)] transition-colors hover:text-[var(--heat-100)]"
							>
								<ArrowLeft class="mr-1.5 size-3" /> Continue shopping
							</a>
						</div>
					</div>

					<!-- Trust note -->
					<div class="mt-3 flex items-center justify-center gap-4 rounded-lg border border-[var(--border-faint)] bg-white px-4 py-3">
						<span class="inline-flex items-center gap-1.5 text-[11px] text-[var(--black-alpha-56)]">
							<Package class="size-3 text-[var(--heat-100)]" strokeWidth={2} /> Genuine parts
						</span>
						<span class="text-[var(--border-muted)]">|</span>
						<span class="inline-flex items-center gap-1.5 text-[11px] text-[var(--black-alpha-56)]">
							<Truck class="size-3 text-[var(--heat-100)]" strokeWidth={2} /> Fast dispatch
						</span>
					</div>
				</aside>
			</div>
		</div>
	{/if}
</section>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>
