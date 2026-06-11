<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { preloadData } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		ArrowRight,
		ArrowUpRight,
		BadgeCheck,
		ChevronRight,
		Flame,
		RotateCcw,
		ShoppingCart,
		Star,
		Truck,
		Zap
	} from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { categories, discountPct, formatINR, type Product } from '$lib/catalog';
	import { addToCart } from '$lib/cart';
	import { DEFAULT_DESCRIPTION, SITE_NAME, absoluteUrl } from '$lib/seo';

	let { data }: { data: { products: Product[] } } = $props();

	onMount(() => {
		if ('requestIdleCallback' in window) {
			requestIdleCallback(() => {
				void preloadData('/products');
			});
		} else {
			setTimeout(() => {
				void preloadData('/products');
			}, 2000);
		}
	});

	let products = $derived(data.products);

	let heroProduct = $derived(
		[...products]
			.filter((p) => p.stock > 0 && p.images?.length)
			.sort((a, b) => b.reviews - a.reviews)[0] ?? products[0]
	);
	let deals = $derived(
		[...products]
			.sort((a, b) => discountPct(b) - discountPct(a) || b.reviews - a.reviews)
			.slice(0, 4)
	);
	let bestSellers = $derived(
		[...products].sort((a, b) => b.rating - a.rating).slice(0, 8)
	);
	let newArrivals = $derived(
		[...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4)
	);
	let featuredCategories = $derived(
		categories.filter((c) =>
			['ssd', 'ram', 'batteries', 'displays', 'chargers', 'processors'].includes(c.slug)
		)
	);
	let categoryTiles = $derived(
		featuredCategories
			.map((c) => ({
				...c,
				count: products.filter((p) => p.category === c.slug).length,
				product: products.find((p) => p.category === c.slug)
			}))
			.filter((c) => c.product)
	);

	let heroAdded = $state(false);
	const canonicalUrl = $derived(absoluteUrl(page.url.origin, '/'));
	const ogImage = $derived(
		heroProduct ? absoluteUrl(page.url.origin, heroProduct.images?.[0] ?? heroProduct.image) : canonicalUrl
	);

	function addHeroToCart() {
		if (!heroProduct || heroProduct.stock <= 0) return;
		addToCart(heroProduct.id, 1);
		heroAdded = true;
		setTimeout(() => (heroAdded = false), 2000);
	}

	const serviceNotes = [
		{
			id: 'genuine',
			title: 'Genuine parts',
			body: 'Grade, warranty & compatibility visible before checkout.',
			icon: BadgeCheck
		},
		{
			id: 'dispatch',
			title: 'Same-day dispatch',
			body: 'In-stock parts ship same day from local inventory.',
			icon: Truck
		},
		{
			id: 'returns',
			title: 'DOA replacements',
			body: 'Clear return windows and DOA support on every order.',
			icon: RotateCcw
		}
	];
</script>

<svelte:head>
	<title>{SITE_NAME} - Laptop Parts Store</title>
	<meta name="description" content={DEFAULT_DESCRIPTION} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="{SITE_NAME} - Laptop Parts Store" />
	<meta property="og:description" content={DEFAULT_DESCRIPTION} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<!-- ─── Hero ─── -->
<section class="relative overflow-hidden bg-[var(--accent-black)]">
	<div class="grid-pattern absolute inset-0 opacity-30"></div>

	<div class="container relative mx-auto px-4 py-10 sm:py-16 lg:py-20">
		<div class="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
			<div class="motion-section max-w-lg">
				<p class="text-mono-x-small tracking-[0.2em] text-[var(--heat-100)] uppercase">
					Laptop parts catalog
				</p>
				<h1 class="mt-3 text-[28px] font-medium leading-[1.1] tracking-tight text-white sm:text-[44px]">
					Parts that fit.<br />
					<span class="text-[var(--heat-100)]">Ship fast.</span>
				</h1>
				<p class="mt-3 max-w-md text-[14px] leading-relaxed text-white/60 sm:mt-4 sm:text-[16px]">
					SSDs, RAM, batteries, displays — with fitment guidance and same-day dispatch from local inventory.
				</p>
				<div class="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
					<a
						href={resolve('/products')}
						class="button button-primary text-label-medium inline-flex h-11 items-center gap-2 rounded-md px-6"
					>
						Browse catalog <ArrowRight class="size-4" />
					</a>
				</div>

				<!-- Trust badges inline -->
				<div class="mt-6 flex flex-wrap gap-x-5 gap-y-2 sm:mt-8">
					{#each serviceNotes as note (note.id)}
						{@const Icon = note.icon}
						<span class="inline-flex items-center gap-1.5 text-[12px] text-white/55">
							<Icon class="size-3 text-[var(--heat-100)]" strokeWidth={2.2} />
							{note.title}
						</span>
					{/each}
				</div>
			</div>

			<!-- Hero product spotlight -->
			{#if heroProduct}
				<div class="motion-section hidden lg:block" style="animation-delay: 80ms">
					<a
						href={resolve(`/product/${heroProduct.id}`)}
						class="group relative block w-[320px] overflow-hidden rounded-lg border border-white/8 bg-white/[0.04] backdrop-blur-sm"
					>
						<div class="relative aspect-square overflow-hidden bg-white/[0.03] p-8">
							<img
								src={heroProduct.images?.[0] ?? heroProduct.image}
								alt={heroProduct.title}
								class="size-full object-contain transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
								fetchpriority="high"
							/>
							{#if discountPct(heroProduct) >= 10}
								<span class="absolute top-3 left-3 rounded-sm bg-[var(--heat-100)] px-2 py-0.5 text-[10px] font-semibold text-white">
									-{discountPct(heroProduct)}%
								</span>
							{/if}
						</div>
						<div class="border-t border-white/8 p-4">
							<p class="text-[10px] tracking-[0.14em] text-white/55 uppercase">{heroProduct.brand}</p>
							<h3 class="mt-0.5 line-clamp-1 text-[14px] font-medium text-white">{heroProduct.title}</h3>
							<div class="mt-2 flex items-baseline gap-2">
								<span class="text-[18px] font-semibold text-[var(--heat-100)]">{formatINR(heroProduct.price)}</span>
								<span class="text-[12px] text-white/45 line-through">{formatINR(heroProduct.mrp)}</span>
							</div>
						</div>
					</a>
				</div>
			{/if}
		</div>
	</div>
</section>

<!-- ─── Category strip ─── -->
<div class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto px-4">
		<div class="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto px-4 sm:mx-0 sm:px-0">
			{#each featuredCategories as cat (cat.slug)}
				<a
					href={resolve(`/products?category=${cat.slug}`)}
					class="flex snap-start items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-[12px] font-medium text-[var(--black-alpha-56)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] sm:px-4 sm:py-3.5 sm:text-[13px]"
				>
					{cat.name}
				</a>
			{/each}
			<a
				href={resolve('/products')}
				class="flex snap-start items-center gap-1 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:border-[var(--heat-100)] sm:px-4 sm:py-3.5 sm:text-[13px]"
			>
				All parts <ChevronRight class="size-3" />
			</a>
		</div>
	</div>
</div>

<div class="container mx-auto space-y-10 px-4 py-8 sm:space-y-16 sm:py-12">

	<!-- ─── Deals ─── -->
	<section aria-labelledby="deals-heading" class="reveal-stagger">
		<div class="mb-4 flex items-center justify-between sm:mb-6">
			<h2 id="deals-heading" class="flex items-center gap-2 text-[18px] font-medium text-foreground sm:text-[22px]">
				<Flame class="size-5 text-[var(--heat-100)]" />
				Today's deals
			</h2>
			<a
				href={resolve('/products')}
				class="flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-200)]"
			>
				See all <ChevronRight class="size-3.5" />
			</a>
		</div>

		<div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
			{#each deals as deal (deal.id)}
				<a
					href={resolve(`/product/${deal.id}`)}
					class="group relative overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white transition-[border-color,box-shadow] duration-200 hover:border-[var(--heat-20)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]"
				>
					<div class="relative aspect-[4/3] overflow-hidden bg-[var(--background-lighter)]">
						<span class="absolute top-2 left-2 z-10 rounded-sm bg-[var(--heat-100)] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-[0_2px_8px_var(--heat-40)]">
							-{discountPct(deal)}%
						</span>
						<img
							src={deal.images?.[0] ?? deal.image}
							alt={deal.title}
							class="size-full object-contain p-4 transition-transform duration-300 group-hover:scale-105 sm:p-6"
							loading="lazy"
						/>
					</div>
					<div class="border-t border-[var(--border-faint)] p-2.5 sm:p-3">
						<p class="truncate text-[10px] tracking-[0.14em] text-[var(--black-alpha-56)] uppercase sm:text-[10px]">
							{deal.brand}
						</p>
						<h3 class="mt-0.5 line-clamp-1 text-[12px] font-medium text-foreground sm:text-[13px]">
							{deal.title}
						</h3>
						<div class="mt-1.5 flex items-baseline gap-1.5">
							<span class="text-[13px] font-semibold text-[var(--heat-100)] sm:text-[15px]">{formatINR(deal.price)}</span>
							<span class="text-[10px] text-[var(--black-alpha-48)] line-through sm:text-[11px]">{formatINR(deal.mrp)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- ─── Shop by component ─── -->
	<section aria-labelledby="category-heading" class="reveal-stagger">
		<h2 id="category-heading" class="mb-4 text-[18px] font-medium text-foreground sm:mb-6 sm:text-[22px]">
			Shop by component
		</h2>

		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
			{#each categoryTiles as tile, i (tile.slug)}
				<a
					href={resolve(`/products?category=${tile.slug}`)}
					class="group relative flex min-h-[100px] flex-col justify-between overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white p-3 transition-[border-color,box-shadow] duration-200 hover:border-[var(--heat-20)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] sm:min-h-[120px] sm:p-4
					{i === 0 ? 'col-span-2 sm:col-span-2 sm:min-h-[140px]' : ''}"
				>
					<div class="relative z-10">
						<h3 class="text-[13px] font-medium text-foreground sm:text-[15px] {i === 0 ? 'sm:text-[18px]' : ''}">
							{tile.name}
						</h3>
						<p class="mt-0.5 text-[11px] text-[var(--black-alpha-56)]">{tile.count} products</p>
					</div>
					<span class="relative z-10 mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--heat-100)]">
						Browse <ArrowRight class="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
					</span>
					<div class="absolute right-1 bottom-1 {i === 0 ? 'h-[70px] w-[110px] sm:h-[100px] sm:w-[160px]' : 'h-[50px] w-[50px] sm:h-[70px] sm:w-[70px]'} opacity-50 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105">
						<img
							src={tile.product?.images?.[0] ?? tile.product?.image}
							alt={tile.name}
							class="size-full object-contain"
							loading="lazy"
						/>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- ─── Best sellers ─── -->
	<section aria-labelledby="best-sellers-heading">
		<div class="mb-4 flex items-center justify-between sm:mb-6">
			<h2 id="best-sellers-heading" class="flex items-center gap-2 text-[18px] font-medium text-foreground sm:text-[22px]">
				<Star class="size-4 text-[var(--accent-honey)]" />
				Best sellers
			</h2>
			<a
				href={resolve('/products?sort=rating-desc')}
				class="flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-200)]"
			>
				View all <ChevronRight class="size-3.5" />
			</a>
		</div>

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
			{#each bestSellers as product, idx (product.id)}
				<div class="animate-fade-up" style:animation-delay="{Math.min(idx * 40, 280)}ms">
					<ProductCard {product} eager={idx < 2} />
				</div>
			{/each}
		</div>
	</section>

	<!-- ─── New arrivals row ─── -->
	<section aria-labelledby="new-heading">
		<div class="mb-4 flex items-center justify-between sm:mb-6">
			<h2 id="new-heading" class="flex items-center gap-2 text-[18px] font-medium text-foreground sm:text-[22px]">
				<Zap class="size-4 text-[var(--accent-bluetron)]" />
				Popular picks
			</h2>
			<a
				href={resolve('/products?sort=newest')}
				class="flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-200)]"
			>
				View all <ChevronRight class="size-3.5" />
			</a>
		</div>

		<div class="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-3 sm:px-0">
			{#each newArrivals as product (product.id)}
				<div class="w-[75vw] max-w-[280px] shrink-0 snap-start sm:w-[220px]">
					<ProductCard {product} />
				</div>
			{/each}
		</div>
	</section>

	<!-- ─── Trust strip ─── -->
	<section class="grain relative overflow-hidden rounded-lg bg-[var(--accent-black)] p-5 sm:p-8">
		<div class="relative z-10 grid gap-5 sm:grid-cols-3 sm:gap-8">
			{#each serviceNotes as note (note.id)}
				{@const Icon = note.icon}
				<div class="flex items-start gap-3">
					<div class="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--heat-100)]/12">
						<Icon class="size-4 text-[var(--heat-100)]" />
					</div>
					<div>
						<h3 class="text-[13px] font-medium text-white sm:text-[14px]">{note.title}</h3>
						<p class="mt-0.5 text-[11px] leading-relaxed text-white/55 sm:text-[12px]">{note.body}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

</div>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>
