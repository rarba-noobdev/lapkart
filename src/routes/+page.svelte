<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		ArrowUpRight,
		BadgeCheck,
		Flame,
		RotateCcw,
		Truck,
		ChevronRight,
		Star
	} from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { categories, discountPct, formatINR, type Product } from '$lib/catalog';

	let { data }: { data: { products: Product[] } } = $props();

	let products = $derived(data.products);
	let deals = $derived(
		[...products]
			.sort((a, b) => discountPct(b) - discountPct(a) || b.reviews - a.reviews)
			.slice(0, 6)
	);
	let bestSellers = $derived(
		[...products].sort((a, b) => b.rating - a.rating).slice(0, 8)
	);
	let featuredCategories = $derived(
		categories.filter((category) =>
			['ssd', 'ram', 'batteries', 'displays', 'chargers', 'processors'].includes(category.slug)
		)
	);
	let categoryTiles = $derived(
		featuredCategories
			.map((category) => ({
				...category,
				product: products.find((product) => product.category === category.slug)
			}))
			.filter((category) => category.product)
	);

	const serviceNotes = [
		{
			id: 'genuine',
			title: 'Genuine parts',
			body: 'Warranty, compatibility, and grade visible before checkout.',
			icon: BadgeCheck
		},
		{
			id: 'dispatch',
			title: 'Fast dispatch',
			body: 'In-stock parts ship same day from local inventory.',
			icon: Truck
		},
		{
			id: 'returns',
			title: 'Easy returns',
			body: 'DOA replacements and clear return windows on every order.',
			icon: RotateCcw
		}
	];
</script>

<svelte:head>
	<title>LapKart - Premium Laptop Parts</title>
	<meta
		name="description"
		content="Shop laptop SSDs, RAM, batteries, displays, chargers, processors, and repair parts."
	/>
</svelte:head>

<!-- Hero -->
<section class="relative overflow-hidden border-b border-[var(--border-faint)] bg-[var(--accent-black)]">
	<div class="grid-pattern absolute inset-0 opacity-40"></div>
	<div class="container relative mx-auto px-4 py-10 sm:py-20">
		<div class="max-w-xl">
			<p class="text-mono-x-small mb-3 tracking-[0.2em] text-[var(--heat-100)] uppercase sm:mb-4">
				Laptop parts catalog
			</p>
			<h1 class="text-[28px] font-medium leading-[1.15] tracking-tight text-white sm:text-title-h2">
				Upgrade. Repair.<br />
				<span class="gradient-text">Ship fast.</span>
			</h1>
			<p class="mt-3 max-w-md text-[14px] leading-relaxed text-white/60 sm:mt-5 sm:text-body-large">
				SSDs, RAM, batteries, displays, and more — with fitment guidance and same-day dispatch.
			</p>
			<div class="mt-5 flex flex-wrap gap-3 sm:mt-8">
				<a
					href={resolve('/products')}
					class="button button-primary text-label-medium inline-flex h-10 items-center gap-2 rounded-md px-5 sm:h-12 sm:px-6"
				>
					Browse catalog
					<ArrowRight class="size-4" />
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Category quick-nav pills -->
<div class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto px-4">
		<div class="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto px-4 sm:mx-0 sm:gap-1 sm:px-0">
			{#each featuredCategories as cat (cat.slug)}
				<a
					href={resolve(`/products?category=${cat.slug}`)}
					class="motion-soft-link flex snap-start items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-[12px] font-medium text-[var(--black-alpha-56)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] sm:px-4 sm:py-4 sm:text-[13px]"
				>
					{cat.name}
				</a>
			{/each}
			<a
				href={resolve('/products')}
				class="motion-soft-link flex snap-start items-center gap-1 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:border-[var(--heat-100)] sm:px-4 sm:py-4 sm:text-[13px]"
			>
				View all <ChevronRight class="size-3" />
			</a>
		</div>
	</div>
</div>

<div class="container mx-auto space-y-8 px-4 py-6 sm:space-y-14 sm:py-12">

	<!-- Deals -->
	<section aria-labelledby="deals-heading">
		<div class="mb-3 flex items-center justify-between sm:mb-5">
			<h2 id="deals-heading" class="text-title-h5 flex items-center gap-2 text-foreground sm:text-title-h4">
				<Flame class="size-5 text-[var(--heat-100)]" />
				Today's deals
			</h2>
			<a
				href={resolve('/products')}
				class="text-label-small flex items-center gap-1 text-[var(--heat-100)] transition-colors hover:text-[var(--heat-200)]"
			>
				See all <ChevronRight class="size-3.5" />
			</a>
		</div>

		<div class="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0">
			{#each deals as deal (deal.id)}
				<a
					href={resolve(`/product/${deal.id}`)}
					class="motion-card group block w-[160px] shrink-0 snap-start overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white sm:w-[220px] sm:rounded-xl"
				>
					<div class="relative aspect-[4/3] overflow-hidden bg-[var(--background-lighter)]">
						<span class="absolute top-2 left-2 z-10 rounded-sm bg-[var(--heat-100)] px-1.5 py-0.5 text-[10px] font-semibold text-white sm:text-[11px]">
							-{discountPct(deal)}%
						</span>
						<img
							src={deal.images?.[0] ?? deal.image}
							alt={deal.title}
							class="motion-image size-full object-contain p-3 sm:p-5"
							loading="lazy"
						/>
					</div>
					<div class="p-2.5 sm:p-4">
						<p class="text-mono-x-small truncate tracking-[0.14em] text-[var(--black-alpha-48)] uppercase" style="font-size: 9px">
							{deal.brand}
						</p>
						<h3 class="mt-0.5 line-clamp-1 text-[12px] font-medium leading-tight text-foreground sm:text-[14px]">
							{deal.title}
						</h3>
						<div class="mt-1.5 flex items-baseline gap-1.5 sm:mt-2">
							<span class="text-[13px] font-medium text-[var(--heat-100)] sm:text-[16px]">{formatINR(deal.price)}</span>
							<span class="text-[10px] text-[var(--black-alpha-40)] line-through sm:text-[12px]">{formatINR(deal.mrp)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- Shop by component -->
	<section aria-labelledby="category-heading">
		<h2 id="category-heading" class="text-title-h5 mb-3 text-foreground sm:mb-5 sm:text-title-h4">
			Shop by component
		</h2>

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4">
			{#each categoryTiles as category, i (category.slug)}
				<a
					href={resolve(`/products?category=${category.slug}`)}
					class="motion-card group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white p-3 sm:rounded-xl sm:p-5
					{i === 0 ? 'col-span-2 sm:col-span-2' : ''}"
				>
					<div class="relative z-10">
						<h3 class="text-[13px] font-medium text-foreground sm:text-[16px] {i === 0 ? 'sm:text-[20px]' : ''}">
							{category.name}
						</h3>
						<span class="mt-1 inline-flex items-center gap-0.5 text-[11px] text-[var(--heat-100)] sm:text-[13px]">
							Browse <ArrowRight class="size-3" />
						</span>
					</div>
					<div class="absolute right-1 bottom-1 {i === 0 ? 'h-[80px] w-[120px] sm:h-[120px] sm:w-[180px]' : 'h-[56px] w-[56px] sm:h-[80px] sm:w-[80px]'} opacity-60 transition-transform duration-500 group-hover:scale-105">
						<img
							src={category.product?.images?.[0] ?? category.product?.image}
							alt={category.name}
							class="size-full object-contain"
							loading="lazy"
						/>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- Best sellers -->
	<section aria-labelledby="best-sellers-heading">
		<div class="mb-3 flex items-center justify-between sm:mb-5">
			<h2 id="best-sellers-heading" class="text-title-h5 text-foreground sm:text-title-h4">
				Best sellers
			</h2>
		</div>

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
			{#each bestSellers as product (product.id)}
				<div class="animate-fade-up" style:animation-delay={`${Math.min(bestSellers.indexOf(product) * 40, 300)}ms`}>
					<ProductCard {product} />
				</div>
			{/each}
		</div>
	</section>

	<!-- Trust strip -->
	<section class="grain relative overflow-hidden rounded-xl bg-[var(--accent-black)] p-5 sm:rounded-2xl sm:p-10">
		<div class="relative z-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
			{#each serviceNotes as note}
				{@const Icon = note.icon}
				<div class="flex items-start gap-3 sm:flex-col sm:gap-4">
					<div class="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--heat-100)]/12 sm:size-10">
						<Icon class="size-4 text-[var(--heat-100)] sm:size-5" />
					</div>
					<div>
						<h3 class="text-[14px] font-medium text-white sm:text-[16px]">{note.title}</h3>
						<p class="mt-0.5 text-[12px] leading-relaxed text-white/50 sm:mt-1 sm:text-[14px]">{note.body}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

</div>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>
