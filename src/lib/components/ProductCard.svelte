<script lang="ts">
	import { resolve } from '$app/paths';
	import { Star } from '@lucide/svelte';
	import type { Product } from '$lib/catalog';
	import { discountPct, formatINR } from '$lib/catalog';
	import { MANUAL_DELIVERY_FREE_SUBTOTAL } from '$lib/shipping';

	let { product, eager = false } = $props<{ product: Product; eager?: boolean }>();

	const discount = $derived(discountPct(product));
	// Honest scarcity: badge shows only for genuinely low real stock (<= 5).
	const lowStock = $derived(product.stock > 0 && product.stock <= 5);
	const outOfStock = $derived(product.stock <= 0);
	const freeDelivery = $derived(product.price >= MANUAL_DELIVERY_FREE_SUBTOTAL);
</script>

<a
	href={resolve(`/product/${product.id}`)}
	aria-label={`${product.title} by ${product.brand}`}
	class="product-card group relative flex w-full overflow-hidden rounded-md border border-[var(--border-faint)] bg-white sm:flex-col sm:rounded-lg"
>
	<div class="product-card-media">
		<img
			src={product.images?.[0] ?? product.image}
			alt={product.title}
			width="400"
			height="400"
			class="product-card-image"
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : 'auto'}
			decoding="async"
		/>
	</div>

	<!-- Badges render after the media so they always paint above it. -->
	{#if discount >= 30}
		<span
			class="absolute top-1.5 left-1.5 z-20 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white sm:top-3 sm:left-3 sm:px-2 sm:text-[11px]"
			style="background:var(--heat-100);box-shadow:0 2px 8px 0 var(--heat-40)"
		>
			-{discount}%
		</span>
	{/if}

	{#if outOfStock}
		<span
			class="absolute top-1.5 right-1.5 z-20 rounded-sm bg-[var(--black-alpha-72)] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase sm:top-3 sm:right-3 sm:text-[10px]"
		>
			Sold out
		</span>
	{:else if lowStock}
		<span
			class="absolute top-1.5 right-1.5 z-20 rounded-sm bg-[var(--accent-crimson)] px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white sm:top-3 sm:right-3 sm:text-[10px]"
		>
			{product.stock} left
		</span>
	{/if}

	<div class="flex flex-1 flex-col justify-center px-2.5 py-2 sm:px-4 sm:py-3">
		<p
			class="truncate font-mono text-[9px] tracking-[0.12em] uppercase sm:text-[11px]"
			style="color:var(--black-alpha-56)"
		>
			{product.brand}
		</p>
		<h3
			class="mt-0.5 line-clamp-2 text-[11px] leading-snug font-medium sm:text-[13px]"
			style="color:var(--foreground)"
		>
			{product.title}
		</h3>

		<div class="mt-1 flex items-center gap-1 sm:gap-1.5">
			<Star
				class="size-2.5 sm:size-3.5"
				style="fill:var(--accent-honey);color:var(--accent-honey)"
			/>
			<span class="text-[10px] sm:text-[12px]" style="color:var(--foreground)"
				>{product.rating.toFixed(1)}</span
			>
			<span class="hidden text-[11px] sm:inline" style="color:var(--black-alpha-48)"
				>({product.reviews.toLocaleString('en-IN')})</span
			>
		</div>

		<div
			class="mt-1.5 flex items-baseline gap-1.5 sm:mt-auto sm:gap-2 sm:border-t sm:border-[var(--border-faint)] sm:pt-3"
		>
			<span class="text-[13px] font-semibold sm:text-[15px]" style="color:var(--foreground)"
				>{formatINR(product.price)}</span
			>
			<span class="text-[10px] line-through sm:text-[12px]" style="color:var(--black-alpha-48)"
				>{formatINR(product.mrp)}</span
			>
		</div>
		{#if freeDelivery}
			<p class="mt-1 text-[9px] font-medium sm:text-[10px]" style="color:var(--accent-forest)">
				FREE delivery
			</p>
		{/if}
	</div>
</a>

<style>
	.product-card-media {
		position: relative;
		width: 100px;
		height: 100px;
		flex-shrink: 0;
		overflow: hidden;
		background: var(--background-lighter);
	}

	@media (min-width: 640px) {
		.product-card-media {
			width: 100%;
			height: auto;
			aspect-ratio: 4 / 3;
		}
	}

	.product-card-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 6px;
	}

	@media (min-width: 640px) {
		.product-card-image {
			padding: 14px;
		}
	}

	.product-card {
		transition:
			border-color 180ms cubic-bezier(0.23, 1, 0.32, 1),
			box-shadow 180ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.product-card-image {
		transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.product-card:focus-visible {
		outline: 3px solid var(--heat-40);
		outline-offset: 3px;
	}

	@media (hover: hover) and (pointer: fine) {
		.product-card:hover {
			border-color: var(--heat-20);
			box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.08);
			transform: translateY(-2px);
		}

		.product-card:hover .product-card-image {
			transform: scale(1.04);
		}
	}
</style>
