<script lang="ts">
	import { resolve } from '$app/paths';
	import { Star } from '@lucide/svelte';
	import type { Product } from '$lib/catalog';
	import { discountPct, formatINR } from '$lib/catalog';

	let { product, eager = false } = $props<{ product: Product; eager?: boolean }>();

	const discount = $derived(discountPct(product));
</script>

<a
	href={resolve(`/product/${product.id}`)}
	aria-label={`${product.title} by ${product.brand}`}
	class="product-card group relative flex w-full flex-col overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white"
>
	{#if discount >= 30}
		<span
			class="absolute top-1.5 left-1.5 z-10 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white sm:top-3 sm:left-3 sm:px-2 sm:text-[11px]"
			style="background:var(--heat-100);box-shadow:0 2px 8px 0 var(--heat-40)"
		>
			-{discount}%
		</span>
	{/if}

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
		<span class="pointer-events-none absolute inset-0" style="border-bottom:1px solid var(--border-faint)"></span>
	</div>

	<div class="flex flex-1 flex-col px-2.5 py-2 sm:px-4 sm:py-3">
		<p class="truncate font-mono text-[10px] uppercase tracking-[0.12em] sm:text-[11px]" style="color:var(--black-alpha-48)">
			{product.brand}
		</p>
		<h3 class="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug sm:text-[13px]" style="color:var(--foreground);min-height:2.6em">
			{product.title}
		</h3>

		<div class="mt-1 flex items-center gap-1 sm:gap-1.5">
			<Star class="size-3 sm:size-3.5" style="fill:var(--accent-honey);color:var(--accent-honey)" />
			<span class="text-[11px] sm:text-[12px]" style="color:var(--foreground)">{product.rating.toFixed(1)}</span>
			<span class="text-[10px] sm:text-[11px]" style="color:var(--black-alpha-40)">({product.reviews.toLocaleString('en-IN')})</span>
		</div>

		<div class="mt-auto flex items-baseline gap-1.5 pt-2 sm:gap-2 sm:pt-3" style="border-top:1px solid var(--border-faint)">
			<span class="text-[13px] font-semibold sm:text-[15px]" style="color:var(--foreground)">{formatINR(product.price)}</span>
			<span class="text-[11px] line-through sm:text-[12px]" style="color:var(--black-alpha-40)">{formatINR(product.mrp)}</span>
		</div>
	</div>
</a>

<style>
	.product-card-media {
		position: relative;
		width: 100%;
		overflow: hidden;
		aspect-ratio: 16 / 9;
		background: var(--background-lighter);
	}

	.product-card-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 12px;
	}

	@media (min-width: 640px) {
		.product-card-media {
			aspect-ratio: 1 / 1;
		}

		.product-card-image {
			padding: 20px;
		}
	}

	.product-card {
		transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
	}
	.product-card:hover {
		border-color: var(--heat-20);
		box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.08);
		transform: translateY(-2px);
	}
</style>
