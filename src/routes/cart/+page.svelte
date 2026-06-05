<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from '@lucide/svelte';
	import { cartState, hydrateCart, removeFromCart, setCartQty, type CartItem } from '$lib/cart';
	import { formatINR, type Product } from '$lib/catalog';
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
</script>

<svelte:head>
	<title>Your cart - lapkart</title>
</svelte:head>

<section class="min-h-screen bg-[var(--background-base)]">
	{#if !$cartState.hydrated || loading}
		<div class="container mx-auto px-4 py-10">
			<div class="grid gap-8 lg:grid-cols-[1fr_400px]">
				<div class="rounded-lg border border-[var(--border-muted)] bg-white">
					{#each ['cart-line-1', 'cart-line-2', 'cart-line-3'] as skeleton (skeleton)}
						<div
							class="h-[136px] animate-pulse border-b border-[var(--border-faint)] last:border-0"
						>
							<div class="m-5 h-24 rounded-md bg-[var(--background-lighter)]"></div>
						</div>
					{/each}
				</div>
				<div
					class="h-[260px] animate-pulse rounded-lg border border-[var(--border-muted)] bg-white"
				></div>
			</div>
		</div>
	{:else if error}
		<div class="container mx-auto px-4 py-10">
			<div
				class="rounded-lg border border-[var(--accent-crimson)]/20 bg-white p-6 text-[var(--accent-crimson)]"
			>
				{error}
			</div>
		</div>
	{:else if rows.length === 0}
		<div class="container mx-auto flex flex-col items-center justify-center px-4 py-32 text-center">
			<div
				class="grid size-20 place-items-center rounded-full border border-[var(--border-muted)] bg-white text-[var(--heat-100)]"
			>
				<ShoppingBag class="size-9" strokeWidth={1.8} />
			</div>
			<h1 class="text-title-h3 mt-2 font-display text-foreground">Your cart is empty</h1>
			<p class="text-body-medium mt-4 text-[var(--black-alpha-56)]">
				Add laptop parts to get started.
			</p>
			<a
				href={resolve('/products')}
				class="button button-primary text-label-medium mt-8 inline-flex h-12 items-center gap-2 rounded-md px-6"
			>
				Shop components <ArrowRight class="size-4" />
			</a>
		</div>
	{:else}
		<div class="container mx-auto px-4 py-10">
			<div class="mb-8">
				<span class="text-label-small text-[var(--heat-100)]">Cart</span>
				<h1 class="text-title-h3 mt-2 font-display text-foreground">
					Your selection <span class="text-[var(--black-alpha-40)]">({rows.length})</span>
				</h1>
			</div>

			<div class="grid gap-8 lg:grid-cols-[1fr_400px]">
				<div class="rounded-lg border border-[var(--border-muted)] bg-white">
					<ul>
						{#each rows as row (row.item.id)}
							<li
								class="flex flex-col gap-5 border-b border-[var(--border-faint)] p-5 last:border-0 sm:flex-row"
							>
								<a
									href={resolve(`/product/${row.product.id}`)}
									aria-label={`View ${row.product.title}`}
									class="size-24 shrink-0 overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)]"
								>
									<img
										src={row.product.images?.[0] ?? row.product.image}
										alt={row.product.title}
										class="size-full object-contain p-2"
									/>
								</a>
								<div class="min-w-0 flex-1">
									<p
										class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										{row.product.brand}
									</p>
									<a
										href={resolve(`/product/${row.product.id}`)}
										class="text-label-medium mt-0.5 line-clamp-2 block text-foreground transition-colors hover:text-[var(--heat-100)]"
									>
										{row.product.title}
									</a>
									<div class="mt-3 flex items-center justify-between gap-4">
										<div
											class="flex items-center rounded-md border border-[var(--border-muted)] bg-white"
										>
											<button
												type="button"
												class="grid size-11 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)]"
												aria-label={`Decrease quantity for ${row.product.title}`}
												onclick={() => setCartQty(row.item.id, row.item.qty - 1)}
											>
												<Minus class="size-3.5" />
											</button>
											<span class="text-mono-small w-8 text-center font-medium text-foreground">
												{row.item.qty}
											</span>
											<button
												type="button"
												class="grid size-11 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)]"
												aria-label={`Increase quantity for ${row.product.title}`}
												onclick={() => setCartQty(row.item.id, row.item.qty + 1)}
											>
												<Plus class="size-3.5" />
											</button>
										</div>
										<div class="text-right">
											<span class="text-label-large font-medium text-foreground">
												{formatINR(row.product.price * row.item.qty)}
											</span>
											<p class="text-mono-x-small text-[var(--black-alpha-40)] line-through">
												{formatINR(row.product.mrp * row.item.qty)}
											</p>
										</div>
									</div>
									<button
										type="button"
										aria-label={`Remove ${row.product.title} from cart`}
										class="text-mono-x-small mt-3 inline-flex items-center gap-1.5 tracking-wider text-[var(--accent-crimson)] uppercase hover:underline"
										onclick={() => removeFromCart(row.item.id)}
									>
										<Trash2 class="size-3" /> Remove
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</div>

				<aside class="h-fit space-y-4 lg:sticky lg:top-28">
					<div class="rounded-lg border border-[var(--border-muted)] bg-white p-6">
						<h2 class="text-label-medium mb-5 text-foreground">Order summary</h2>
						<dl class="text-body-medium space-y-3">
							<div class="flex justify-between">
								<dt class="text-[var(--black-alpha-72)]">Subtotal ({rows.length} items)</dt>
								<dd class="text-foreground">{formatINR(mrp)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--black-alpha-72)]">Discount</dt>
								<dd class="text-[var(--accent-forest)]">- {formatINR(savings)}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-[var(--black-alpha-72)]">Delivery</dt>
								<dd class={shipping === 0 ? 'text-[var(--accent-forest)]' : 'text-foreground'}>
									{shipping === 0 ? 'FREE' : formatINR(shipping)}
								</dd>
							</div>
							<div class="mt-3 border-t border-dashed border-[var(--border-muted)] pt-3">
								<div class="flex items-baseline justify-between">
									<dt class="text-label-large text-foreground">Total</dt>
									<dd class="text-title-h4 font-display text-foreground">{formatINR(total)}</dd>
								</div>
							</div>
						</dl>
						{#if savings > 0}
							<div
								class="text-mono-small mt-4 rounded-md bg-[var(--accent-forest)]/8 px-3 py-2 text-[var(--accent-forest)]"
							>
								You save {formatINR(savings)} on this order
							</div>
						{/if}
						<a
							href={resolve('/checkout')}
							class="button button-primary text-label-medium mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md"
						>
							Proceed to checkout <ArrowRight class="size-4" />
						</a>
						<p
							class="text-mono-x-small mt-3 text-center tracking-wider text-[var(--black-alpha-40)] uppercase"
						>
							Safe payments / Clear returns
						</p>
					</div>
				</aside>
			</div>
		</div>
	{/if}
</section>
