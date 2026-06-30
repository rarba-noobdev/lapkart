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
			<div class="sticky-atc-price">
				<div class="sticky-atc-price-row">
					<span class="sticky-atc-current">
						{formatINR(product.price)}
					</span>
					{#if save > 0}
						<span class="sticky-atc-mrp">
							{formatINR(product.mrp)}
						</span>
					{/if}
				</div>
				{#if lowStock}
					<p class="sticky-atc-meta sticky-atc-low">
						Only {product.stock} left
					</p>
				{:else if save > 0}
					<p class="sticky-atc-meta sticky-atc-save">
						You save {formatINR(save)}
					</p>
				{/if}
			</div>

			{#if added}
				<a href={resolve('/cart')} class="sticky-atc-confirm">
					<Check class="size-4" strokeWidth={2.4} />
					Go to cart{cartCount > 0 ? ` (${cartCount})` : ''}
				</a>
			{:else}
				<div class="sticky-atc-pill" aria-label="Quantity and add to cart controls">
					<div class="sticky-atc-stepper" aria-label="Quantity">
						<button
							type="button"
							aria-label="Decrease quantity"
							disabled={qty <= 1 || outOfStock}
							class="sticky-atc-icon"
							onclick={decrement}
						>
							<Minus class="size-4" />
						</button>
						<span class="sticky-atc-qty" aria-label={`Quantity ${qty}`}>
							<span class="sticky-atc-qty-label">Qty</span>
							<span class="sticky-atc-qty-value">{qty}</span>
						</span>
						<button
							type="button"
							aria-label="Increase quantity"
							disabled={outOfStock}
							class="sticky-atc-icon"
							onclick={increment}
						>
							<Plus class="size-4" />
						</button>
					</div>
					<button type="button" disabled={outOfStock} class="sticky-atc-add" onclick={onAdd}>
						<ShoppingCart class="size-4 shrink-0" strokeWidth={2.2} />
						<span>{outOfStock ? 'Sold out' : 'Add'}</span>
						{#if !outOfStock}
							<span class="sticky-atc-add-wide">to cart</span>
						{/if}
					</button>
				</div>
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
		padding-inline: 10px;
		pointer-events: none;
	}

	@media (min-width: 768px) {
		.sticky-atc {
			bottom: calc(18px + env(safe-area-inset-bottom));
		}
	}

	.sticky-atc-inner {
		display: grid;
		grid-template-columns: minmax(72px, 0.82fr) minmax(0, 1.65fr);
		align-items: center;
		gap: 8px;
		width: min(56rem, calc(100vw - 20px));
		min-height: 56px;
		margin-inline: auto;
		overflow: hidden;
		border: 1px solid var(--border-muted);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.96);
		padding: 5px 5px 5px 12px;
		box-shadow:
			0 18px 42px -24px rgba(17, 24, 39, 0.42),
			0 2px 10px rgba(17, 24, 39, 0.08);
		backdrop-filter: blur(14px);
		pointer-events: auto;
	}

	.sticky-atc-price {
		min-width: 0;
		padding-left: 2px;
	}

	.sticky-atc-price-row {
		display: flex;
		min-width: 0;
		align-items: baseline;
		gap: 6px;
	}

	.sticky-atc-current {
		min-width: 0;
		font-size: 16px;
		font-weight: 650;
		letter-spacing: 0;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.sticky-atc-mrp {
		min-width: 0;
		font-size: 11px;
		color: var(--black-alpha-32);
		text-decoration: line-through;
		font-variant-numeric: tabular-nums;
	}

	.sticky-atc-meta {
		margin-top: 1px;
		overflow: hidden;
		font-size: 11px;
		font-weight: 600;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sticky-atc-low {
		color: var(--accent-crimson);
	}

	.sticky-atc-save {
		color: var(--accent-forest);
	}

	.sticky-atc-pill {
		display: grid;
		min-width: 0;
		height: 46px;
		grid-template-columns: auto minmax(82px, 1fr);
		align-items: center;
		gap: 6px;
		overflow: visible;
	}

	.sticky-atc-stepper {
		display: grid;
		grid-template-columns: 34px minmax(36px, 44px) 34px;
		align-items: center;
		gap: 2px;
		height: 42px;
		padding: 4px;
		border-radius: 999px;
		background: var(--black-alpha-4);
	}

	.sticky-atc-icon {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: 999px;
		color: var(--black-alpha-56);
		transition:
			background-color 150ms ease,
			color 150ms ease,
			opacity 150ms ease;
	}

	.sticky-atc-icon:hover {
		background: var(--black-alpha-4);
		color: var(--foreground);
	}

	.sticky-atc-icon:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.sticky-atc-qty {
		display: grid;
		min-width: 0;
		place-items: center;
		line-height: 1;
		text-align: center;
	}

	.sticky-atc-qty-label {
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0;
		color: var(--black-alpha-40);
		text-transform: uppercase;
	}

	.sticky-atc-qty-value {
		margin-top: 2px;
		font-size: 14px;
		font-weight: 650;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.sticky-atc-add,
	.sticky-atc-confirm {
		display: inline-flex;
		min-width: 0;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 42px;
		margin: 0;
		border-radius: 999px;
		background: var(--heat-100);
		color: white;
		font-size: 14px;
		font-weight: 600;
		line-height: 1;
		white-space: nowrap;
		transition:
			background-color 150ms ease,
			opacity 150ms ease;
	}

	.sticky-atc-add {
		padding-inline: 12px 14px;
	}

	.sticky-atc-confirm {
		height: 46px;
		margin: 0;
		padding-inline: 18px;
		background: var(--accent-forest);
	}

	@media (min-width: 768px) {
		.sticky-atc-inner {
			grid-template-columns: minmax(160px, 1fr) minmax(340px, 380px);
			gap: 14px;
			width: min(56rem, calc(100vw - 32px));
			padding: 6px 6px 6px 18px;
		}
	}

	.sticky-atc-add:hover,
	.sticky-atc-confirm:hover {
		background: var(--heat-120, var(--heat-100));
	}

	.sticky-atc-add:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sticky-atc-confirm:hover {
		background: var(--accent-forest);
	}

	@media (max-width: 360px) {
		.sticky-atc {
			padding-inline: 8px;
		}

		.sticky-atc-inner {
			grid-template-columns: minmax(64px, 0.72fr) minmax(0, 1.9fr);
			gap: 6px;
			width: calc(100vw - 16px);
			min-height: 54px;
			padding: 5px 5px 5px 10px;
		}

		.sticky-atc-current {
			font-size: 15px;
		}

		.sticky-atc-mrp,
		.sticky-atc-qty-label,
		.sticky-atc-add-wide {
			display: none;
		}

		.sticky-atc-pill {
			height: 44px;
			grid-template-columns: auto minmax(70px, 1fr);
			gap: 4px;
		}

		.sticky-atc-stepper {
			grid-template-columns: 30px 28px 30px;
			gap: 0;
			height: 40px;
			padding: 3px;
		}

		.sticky-atc-icon {
			width: 30px;
			height: 30px;
		}

		.sticky-atc-add {
			padding-inline: 10px 12px;
		}
	}
</style>
