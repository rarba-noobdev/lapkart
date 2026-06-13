<script lang="ts">
	import { resolve } from '$app/paths';
	import { fly } from 'svelte/transition';
	import { Check, Minus, Plus, ShoppingCart } from '@lucide/svelte';
	import { cartState } from '$lib/cart';
	import { formatINR, type Product } from '$lib/catalog';

	/*
	 * Sticky add-to-cart bar for the product page. Appears only once the main
	 * in-page CTA has scrolled out of view (parent toggles `visible`). Every
	 * number shown here — price, MRP, savings, stock — comes from the real
	 * product row; nothing is fabricated.
	 */
	let {
		product,
		qty = $bindable(1),
		added,
		visible,
		onAdd
	}: {
		product: Product;
		qty: number;
		added: boolean;
		visible: boolean;
		onAdd: () => void;
	} = $props();

	const cartCount = $derived($cartState.items.reduce((total, item) => total + item.qty, 0));
	const save = $derived(Math.max(0, Math.round(product.mrp - product.price)));
	const outOfStock = $derived(product.stock <= 0);
	const lowStock = $derived(product.stock > 0 && product.stock <= 5);

	function increment() {
		qty = qty + 1;
	}
	function decrement() {
		if (qty > 1) qty = qty - 1;
	}
</script>

{#if visible}
	<div
		class="sticky-atc"
		transition:fly={{ y: 80, duration: 220 }}
		role="region"
		aria-label="Add to cart"
	>
		<div class="sticky-atc-inner">
			<div class="min-w-0 flex-1">
				<div class="flex items-baseline gap-2">
					<span class="text-[17px] font-semibold tracking-tight text-foreground tabular-nums">
						{formatINR(product.price)}
					</span>
					{#if save > 0}
						<span class="text-[12px] text-[var(--black-alpha-32)] tabular-nums line-through">
							{formatINR(product.mrp)}
						</span>
					{/if}
				</div>
				{#if lowStock}
					<p class="text-[11px] font-medium text-[var(--accent-crimson)]">
						Only {product.stock} left
					</p>
				{:else if save > 0}
					<p class="text-[11px] font-medium text-[var(--accent-forest)]">
						You save {formatINR(save)}
					</p>
				{/if}
			</div>

			{#if added}
				<a href={resolve('/cart')} class="sticky-atc-cta sticky-atc-cta-success">
					<Check class="size-4" strokeWidth={2.4} />
					Go to cart{cartCount > 0 ? ` (${cartCount})` : ''}
				</a>
			{:else}
				<div
					class="grid h-11 shrink-0 grid-cols-[40px_minmax(28px,1fr)_40px] overflow-hidden rounded-md border border-[var(--border-muted)] bg-white"
				>
					<button
						type="button"
						aria-label="Decrease quantity"
						disabled={qty <= 1 || outOfStock}
						class="grid place-items-center text-[var(--black-alpha-48)] transition-colors hover:bg-[var(--black-alpha-2)] hover:text-foreground disabled:opacity-30"
						onclick={decrement}
					>
						<Minus class="size-4" />
					</button>
					<span class="grid place-items-center text-[14px] font-medium tabular-nums">{qty}</span>
					<button
						type="button"
						aria-label="Increase quantity"
						disabled={outOfStock}
						class="grid place-items-center text-[var(--black-alpha-48)] transition-colors hover:bg-[var(--black-alpha-2)] hover:text-foreground disabled:opacity-30"
						onclick={increment}
					>
						<Plus class="size-4" />
					</button>
				</div>
				<button type="button" disabled={outOfStock} class="sticky-atc-cta" onclick={onAdd}>
					<ShoppingCart class="size-4" strokeWidth={2.2} />
					{outOfStock ? 'Out of stock' : 'Add to cart'}
				</button>
			{/if}
		</div>
	</div>
{/if}

<style>
	.sticky-atc {
		position: fixed;
		inset-inline: 0;
		bottom: calc(82px + env(safe-area-inset-bottom));
		z-index: 45;
		border-top: 1px solid var(--border-faint);
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(12px);
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
	}

	@media (min-width: 768px) {
		.sticky-atc {
			bottom: 0;
		}
	}

	.sticky-atc-inner {
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: 56rem;
		margin-inline: auto;
		padding: 10px 16px calc(10px + env(safe-area-inset-bottom) * 0);
	}

	.sticky-atc-cta {
		display: inline-flex;
		flex: 1 1 auto;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 44px;
		min-width: 0;
		padding-inline: 20px;
		border-radius: 8px;
		background: var(--heat-100);
		color: white;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		transition:
			background-color 150ms ease,
			opacity 150ms ease;
	}

	@media (min-width: 768px) {
		.sticky-atc-cta {
			flex: 0 0 auto;
			min-width: 200px;
		}
	}

	.sticky-atc-cta:hover {
		background: var(--heat-120, var(--heat-100));
	}

	.sticky-atc-cta:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sticky-atc-cta-success {
		background: var(--accent-forest);
	}
</style>
