<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Star } from '@lucide/svelte';
	import type { Product } from '$lib/catalog';
	import { discountPct, formatINR } from '$lib/catalog';

	let { product } = $props<{ product: Product }>();

	const discount = $derived(discountPct(product));
</script>

<a
	href={resolve(`/product/${product.id}`)}
	aria-label={`${product.title} by ${product.brand}`}
	class="motion-card motion-image-parent group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white hover:border-[var(--heat-20)] hover:shadow-[0_24px_56px_-24px_var(--heat-40),0_4px_12px_-4px_rgba(0,0,0,0.06)]"
>
	{#if discount >= 30}
		<span
			class="text-mono-x-small absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2 py-0.5 font-medium tracking-wide text-white shadow-[0_2px_8px_0_var(--heat-40)]"
		>
			-{discount}%
		</span>
	{/if}

	<div class="relative aspect-square overflow-hidden bg-[var(--background-lighter)]">
		<img
			src={product.images?.[0] ?? product.image}
			alt={product.title}
			width="640"
			height="640"
			class="motion-image size-full object-contain p-6"
			loading="lazy"
		/>
		<span class="pointer-events-none absolute inset-0 border-b border-[var(--border-faint)]"></span>
		<ArrowUpRight
			aria-hidden="true"
			class="absolute top-3 right-3 size-4 text-[var(--black-alpha-32)] transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--heat-100)]"
		/>
	</div>

	<div class="flex flex-1 flex-col gap-1.5 px-4 py-4">
		<p class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
			{product.brand}
		</p>
		<h3 class="text-label-small line-clamp-2 min-h-[40px] leading-snug text-foreground">
			{product.title}
		</h3>

		<div class="mt-1 flex items-center gap-2">
			<span class="text-body-small inline-flex items-center gap-0.5 text-foreground">
				<Star class="size-3 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
				{product.rating.toFixed(1)}
			</span>
			<span class="text-mono-x-small text-[var(--black-alpha-40)]">
				({product.reviews.toLocaleString('en-IN')})
			</span>
		</div>

		<div class="mt-auto flex items-baseline gap-2 border-t border-[var(--border-faint)] pt-3">
			<span class="text-label-large font-medium text-foreground">{formatINR(product.price)}</span>
			<span class="text-body-small text-[var(--black-alpha-40)] line-through">
				{formatINR(product.mrp)}
			</span>
		</div>
	</div>
</a>
