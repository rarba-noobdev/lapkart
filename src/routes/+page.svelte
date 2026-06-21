<script lang="ts">
	import { preloadData } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		ArrowRight,
		BadgeCheck,
		ChevronRight,
		Flame,
		Headphones,
		Percent,
		RotateCcw,
		Search,
		ShoppingCart,
		Star,
		Timer,
		Truck,
		Zap
	} from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { addToCart } from '$lib/cart';
	import { categories, discountPct, formatINR, type Product } from '$lib/catalog';
	import { DEFAULT_DESCRIPTION, SITE_NAME, absoluteUrl } from '$lib/seo';

	type HomeData = {
		products: Product[];
	};

	let { data }: { data: HomeData } = $props();

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

	const categoryImages: Record<string, string> = {
		ssd: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=900&q=80',
		ram: 'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=900&q=80',
		batteries:
			'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80',
		displays:
			'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
		chargers:
			'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80',
		keyboards:
			'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
		processors:
			'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=900&q=80',
		cooling:
			'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=900&q=80'
	};

	const heroImage =
		'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1800&q=82';
	const repairImage =
		'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

	function stockAvailabilityCompare(a: Product, b: Product) {
		const leftInStock = a.stock > 0 ? 0 : 1;
		const rightInStock = b.stock > 0 ? 0 : 1;
		return leftInStock - rightInStock;
	}

	function stockFirst(items: Product[]) {
		return [...items].sort((a, b) => stockAvailabilityCompare(a, b));
	}

	let products = $derived(stockFirst(data.products ?? []));
	let inStockProducts = $derived(products.filter((product) => product.stock > 0));
	let heroProduct = $derived(
		inStockProducts.find((product) => product.images?.length) ?? inStockProducts[0] ?? products[0]
	);
	let deals = $derived(
		[...products]
			.sort(
				(a, b) =>
					stockAvailabilityCompare(a, b) || discountPct(b) - discountPct(a) || b.reviews - a.reviews
			)
			.slice(0, 4)
	);
	let bestSellers = $derived(
		[...products]
			.sort(
				(a, b) => stockAvailabilityCompare(a, b) || b.rating - a.rating || b.reviews - a.reviews
			)
			.slice(0, 8)
	);
	let popularPicks = $derived(
		[...products]
			.sort(
				(a, b) =>
					stockAvailabilityCompare(a, b) ||
					b.reviews - a.reviews ||
					new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
			)
			.slice(0, 6)
	);
	let featuredCategories = $derived(
		categories
			.filter((category) =>
				[
					'ssd',
					'ram',
					'batteries',
					'displays',
					'chargers',
					'keyboards',
					'processors',
					'cooling'
				].includes(category.slug)
			)
			.map((category) => ({
				...category,
				count: products.filter((product) => product.category === category.slug).length,
				image: categoryImages[category.slug] ?? repairImage
			}))
	);

	let heroAdded = $state(false);
	const canonicalUrl = $derived(absoluteUrl(page.url.origin, '/'));
	const ogImage = $derived(
		heroProduct ? absoluteUrl(page.url.origin, heroProduct.image) : canonicalUrl
	);

	const promoCards = [
		{
			id: 'upgrade',
			kicker: 'Upgrade week',
			title: 'SSD and RAM combos',
			body: 'Faster boot, cleaner multitasking, and verified fitment before dispatch.',
			href: '/products?category=ssd',
			icon: Zap
		},
		{
			id: 'delivery',
			kicker: 'Delivery promo',
			title: 'Free delivery over Rs 2,000',
			body: 'Same-day packing for stocked parts and Tamil Nadu local delivery from Rs 50.',
			href: '/products?inStock=true',
			icon: Truck
		},
		{
			id: 'support',
			kicker: 'Fitment help',
			title: 'Compatibility checked',
			body: 'Ask before you buy. Part numbers, panel specs, and laptop model fitment are visible.',
			href: '/contact',
			icon: Headphones
		}
	] as const;

	const serviceNotes = [
		{
			id: 'dispatch',
			title: 'Same-day dispatch',
			body: 'In-stock orders are packed quickly from local inventory.',
			icon: Timer
		},
		{
			id: 'genuine',
			title: 'Grade visible',
			body: 'OEM, compatible, open-box, warranty, and fitment notes stay visible.',
			icon: BadgeCheck
		},
		{
			id: 'returns',
			title: 'DOA support',
			body: 'Clear replacement and return windows for repair parts.',
			icon: RotateCcw
		}
	];

	function addHeroToCart() {
		if (!heroProduct || heroProduct.stock <= 0) return;
		addToCart(heroProduct.id, 1);
		heroAdded = true;
		setTimeout(() => (heroAdded = false), 1800);
	}
</script>

<svelte:head>
	<title>{SITE_NAME} - laptop parts, upgrades, and repair spares</title>
	<meta name="description" content={DEFAULT_DESCRIPTION} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="{SITE_NAME} - laptop parts, upgrades, and repair spares" />
	<meta property="og:description" content={DEFAULT_DESCRIPTION} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main class="home-shell">
	<section class="home-hero" style={`--hero-image: url('${heroImage}')`}>
		<div class="home-hero-media" aria-hidden="true"></div>
		<div class="home-hero-inner">
			<div class="home-hero-copy motion-section">
				<p class="home-kicker">Laptop parts marketplace</p>
				<h1>Find the right part before the laptop leaves your bench.</h1>
				<p class="home-hero-lede">
					Search SSDs, RAM, displays, batteries, chargers, keyboards, cooling parts, and repair
					spares with stock visibility and compatibility notes.
				</p>

				<form action={resolve('/products')} method="GET" class="hero-search" role="search">
					<Search class="size-4 text-[var(--black-alpha-40)]" strokeWidth={2.2} />
					<input
						name="q"
						placeholder="Search by laptop model, part number, brand, or category"
						aria-label="Search laptop parts"
					/>
					<button type="submit">Search</button>
				</form>

				<div class="hero-actions">
					<a href={resolve('/products')} class="button button-primary hero-primary">
						Shop all parts <ArrowRight class="size-4" strokeWidth={2.3} />
					</a>
					<a href={resolve('/products?inStock=true')} class="hero-secondary">
						In-stock only <ChevronRight class="size-4" strokeWidth={2.3} />
					</a>
				</div>

				<div class="hero-proof">
					{#each serviceNotes as note (note.id)}
						{@const Icon = note.icon}
						<span>
							<Icon class="size-3.5" strokeWidth={2.2} />
							{note.title}
						</span>
					{/each}
				</div>
			</div>

			{#if heroProduct}
				<aside class="hero-product motion-section" style="animation-delay: 90ms">
					<div class="hero-product-label">
						<span>Featured stocked part</span>
						{#if discountPct(heroProduct) > 0}
							<strong>{discountPct(heroProduct)}% off</strong>
						{/if}
					</div>
					<a href={resolve(`/product/${heroProduct.id}`)} class="hero-product-image">
						<img
							src={heroProduct.images?.[0] ?? heroProduct.image}
							alt={heroProduct.title}
							fetchpriority="high"
							width="520"
							height="520"
						/>
					</a>
					<div class="hero-product-body">
						<p>{heroProduct.brand}</p>
						<h2>{heroProduct.title}</h2>
						<div class="hero-price-row">
							<span>{formatINR(heroProduct.price)}</span>
							{#if heroProduct.mrp > heroProduct.price}
								<s>{formatINR(heroProduct.mrp)}</s>
							{/if}
						</div>
						<button
							type="button"
							class="button button-primary hero-cart"
							disabled={heroProduct.stock <= 0}
							onclick={addHeroToCart}
						>
							<ShoppingCart class="size-4" strokeWidth={2.2} />
							{heroAdded ? 'Added' : heroProduct.stock > 0 ? 'Add to cart' : 'Sold out'}
						</button>
					</div>
				</aside>
			{/if}
		</div>
	</section>

	<section class="promo-rail" aria-label="Current promotions">
		{#each promoCards as promo, index (promo.id)}
			{@const Icon = promo.icon}
			<a
				href={resolve(promo.href)}
				class="promo-card"
				style={`--delay: ${Math.min(index * 70, 180)}ms`}
			>
				<div>
					<p>{promo.kicker}</p>
					<h2>{promo.title}</h2>
					<span>{promo.body}</span>
				</div>
				<Icon class="size-5" strokeWidth={2.1} />
			</a>
		{/each}
	</section>

	<section class="home-section category-aisle" aria-labelledby="category-heading">
		<div class="section-heading">
			<div>
				<p class="home-kicker">Shop by repair job</p>
				<h2 id="category-heading">Popular component aisles</h2>
			</div>
			<a href={resolve('/products')}>View catalog <ChevronRight class="size-4" /></a>
		</div>

		<div class="category-grid">
			{#each featuredCategories as category, index (category.slug)}
				<a
					href={resolve(`/products?category=${category.slug}`)}
					class:wide-tile={index === 0}
					class="category-tile"
					style={`--tile-image: url('${category.image}')`}
				>
					<div class="category-tile-image" aria-hidden="true"></div>
					<div>
						<h3>{category.name}</h3>
						<span>Browse parts <ArrowRight class="size-3.5" /></span>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="home-section deal-section" aria-labelledby="deals-heading">
		<div class="section-heading">
			<div>
				<p class="home-kicker">Live offers</p>
				<h2 id="deals-heading">Promos and marked-down parts</h2>
			</div>
			<a href={resolve('/products?sort=discount-desc')}>See deals <ChevronRight class="size-4" /></a
			>
		</div>

		<div class="deal-layout">
			<a href={resolve('/products?sort=discount-desc')} class="feature-promo">
				<div class="feature-promo-media" style={`background-image: url('${repairImage}')`}></div>
				<div class="feature-promo-copy">
					<p><Percent class="size-4" strokeWidth={2.2} /> Repair week promo</p>
					<h3>Bundle upgrade parts and keep delivery costs down.</h3>
					<span>SSD, RAM, panels, chargers, and cooling parts are grouped for quick ordering.</span>
				</div>
			</a>

			<div class="deal-grid">
				{#each deals as deal (deal.id)}
					<a href={resolve(`/product/${deal.id}`)} class="deal-card">
						<div class="deal-media">
							{#if discountPct(deal) > 0}
								<span>-{discountPct(deal)}%</span>
							{/if}
							<img
								src={deal.images?.[0] ?? deal.image}
								alt={deal.title}
								loading="lazy"
								width="360"
								height="270"
							/>
						</div>
						<div class="deal-copy">
							<p>{deal.brand}</p>
							<h3>{deal.title}</h3>
							<div>
								<strong>{formatINR(deal.price)}</strong>
								{#if deal.mrp > deal.price}
									<s>{formatINR(deal.mrp)}</s>
								{/if}
							</div>
							{#if deal.stock <= 0}
								<span class="sold-out-note">Out of stock - shown last</span>
							{:else if deal.stock <= 5}
								<span class="stock-note">Only {deal.stock} left</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>

	<section class="home-section" aria-labelledby="best-sellers-heading">
		<div class="section-heading">
			<div>
				<p class="home-kicker">Customer picks</p>
				<h2 id="best-sellers-heading">Best sellers in stock first</h2>
			</div>
			<a href={resolve('/products?sort=rating-desc')}>Top rated <ChevronRight class="size-4" /></a>
		</div>

		{#if bestSellers.length}
			<div class="product-grid">
				{#each bestSellers as product, index (product.id)}
					<div class="product-entry" style={`--delay: ${Math.min(index * 35, 240)}ms`}>
						<ProductCard {product} eager={index < 2} />
					</div>
				{/each}
			</div>
		{:else}
			<div class="home-empty">
				<p>Catalog is temporarily unavailable.</p>
				<span>Search and category pages will still recover when the product API is back.</span>
			</div>
		{/if}
	</section>

	<section class="home-section popular-section" aria-labelledby="popular-heading">
		<div class="section-heading">
			<div>
				<p class="home-kicker">Quick replacements</p>
				<h2 id="popular-heading">Popular picks for common repairs</h2>
			</div>
			<a href={resolve('/products?sort=newest')}>Newest parts <ChevronRight class="size-4" /></a>
		</div>

		<div class="popular-row">
			{#each popularPicks as product (product.id)}
				<div class="popular-card">
					<ProductCard {product} />
				</div>
			{/each}
		</div>
	</section>

	<section class="service-band">
		<div class="service-band-copy">
			<p class="home-kicker">How LapKart keeps orders clean</p>
			<h2>Fitment, stock, dispatch, and support are visible before checkout.</h2>
		</div>
		<div class="service-grid">
			{#each serviceNotes as note (note.id)}
				{@const Icon = note.icon}
				<article>
					<Icon class="size-5" strokeWidth={2.2} />
					<h3>{note.title}</h3>
					<p>{note.body}</p>
				</article>
			{/each}
		</div>
	</section>
</main>

<div class="h-24 md:hidden"></div>

<style>
	.home-shell {
		background: linear-gradient(180deg, #fbfaf8 0%, #f5f2ee 44%, #fbfaf8 100%);
		color: var(--foreground);
	}

	.home-hero {
		position: relative;
		overflow: hidden;
		background: var(--accent-black);
	}

	.home-hero::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		content: '';
		background:
			radial-gradient(circle at 72% 24%, rgba(250, 93, 25, 0.2), transparent 28%),
			linear-gradient(
				90deg,
				rgba(18, 18, 18, 0.98) 0%,
				rgba(18, 18, 18, 0.85) 46%,
				rgba(18, 18, 18, 0.48) 100%
			);
	}

	.home-hero-media {
		position: absolute;
		inset: 0;
		background-image: var(--hero-image);
		background-position: center right;
		background-size: cover;
		opacity: 0.58;
	}

	.home-hero-inner {
		position: relative;
		z-index: 1;
		display: grid;
		max-width: 1240px;
		min-height: min(540px, calc(100dvh - 140px));
		margin: 0 auto;
		align-items: center;
		gap: 24px;
		padding: 40px 16px 36px;
	}

	.home-hero-copy {
		max-width: 680px;
	}

	.home-kicker {
		color: var(--heat-100);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.home-hero h1 {
		max-width: 600px;
		margin-top: 12px;
		color: white;
		font-size: clamp(30px, 4.6vw, 50px);
		font-weight: 650;
		line-height: 1.02;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.home-hero-lede {
		max-width: 540px;
		margin-top: 14px;
		color: rgba(255, 255, 255, 0.68);
		font-size: clamp(14px, 1.4vw, 16px);
		line-height: 1.6;
	}

	.hero-search {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		max-width: 640px;
		margin-top: 20px;
		align-items: center;
		gap: 10px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.94);
		padding: 8px 8px 8px 14px;
		box-shadow: 0 22px 70px rgba(0, 0, 0, 0.32);
	}

	.hero-search input {
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--foreground);
		font-size: 14px;
		outline: none;
	}

	.hero-search button,
	.hero-primary,
	.hero-secondary,
	.hero-cart {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 42px;
		border-radius: 7px;
		font-size: 13px;
		font-weight: 700;
	}

	.hero-search button {
		border: 0;
		background: var(--accent-black);
		padding: 0 18px;
		color: white;
	}

	.hero-actions,
	.hero-proof {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		margin-top: 18px;
	}

	.hero-primary {
		padding: 0 20px;
		color: white;
	}

	.hero-secondary {
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.08);
		padding: 0 16px;
		color: white;
		transition:
			border-color 180ms ease,
			background-color 180ms ease;
	}

	.hero-secondary:hover {
		border-color: rgba(255, 255, 255, 0.34);
		background: rgba(255, 255, 255, 0.12);
	}

	.hero-proof {
		margin-top: 20px;
		gap: 16px;
	}

	.hero-proof span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: rgba(255, 255, 255, 0.62);
		font-size: 12px;
	}

	.hero-proof :global(svg) {
		color: var(--heat-100);
	}

	.hero-product {
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(16px);
		box-shadow: 0 22px 80px rgba(0, 0, 0, 0.28);
	}

	.hero-product-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		color: rgba(255, 255, 255, 0.58);
		font-size: 11px;
		font-weight: 700;
	}

	.hero-product-label strong {
		color: var(--heat-100);
	}

	.hero-product-image {
		display: grid;
		aspect-ratio: 1.08;
		place-items: center;
		background: rgba(255, 255, 255, 0.94);
		padding: 28px;
	}

	.hero-product-image img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.hero-product-body {
		padding: 16px;
	}

	.hero-product-body p {
		color: rgba(255, 255, 255, 0.45);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.hero-product-body h2 {
		margin-top: 4px;
		color: white;
		font-size: 16px;
		font-weight: 650;
		line-height: 1.25;
	}

	.hero-price-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 10px;
	}

	.hero-price-row span {
		color: var(--heat-100);
		font-size: 22px;
		font-weight: 750;
	}

	.hero-price-row s {
		color: rgba(255, 255, 255, 0.42);
		font-size: 13px;
	}

	.hero-cart {
		width: 100%;
		margin-top: 14px;
		color: white;
	}

	.promo-rail,
	.home-section,
	.service-band {
		max-width: 1240px;
		margin-right: auto;
		margin-left: auto;
		padding-right: 16px;
		padding-left: 16px;
	}

	.promo-rail {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin-top: -30px;
	}

	.promo-card {
		position: relative;
		z-index: 2;
		display: flex;
		min-height: 112px;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
		border: 1px solid rgba(255, 255, 255, 0.62);
		border-radius: 10px;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 247, 242, 0.95));
		padding: 18px;
		box-shadow: 0 20px 50px rgba(24, 20, 18, 0.1);
		animation: promo-in 420ms cubic-bezier(0.23, 1, 0.32, 1) both;
		animation-delay: var(--delay);
	}

	.promo-card p {
		color: var(--heat-100);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		font-weight: 750;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.promo-card h2 {
		margin-top: 6px;
		color: var(--foreground);
		font-size: 16px;
		font-weight: 700;
		line-height: 1.15;
	}

	.promo-card span {
		display: block;
		max-width: 28ch;
		margin-top: 8px;
		color: var(--black-alpha-56);
		font-size: 12px;
		line-height: 1.5;
	}

	.promo-card :global(svg) {
		flex: 0 0 auto;
		color: var(--heat-100);
	}

	.home-section {
		padding-top: 44px;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 18px;
		margin-bottom: 14px;
	}

	.section-heading h2 {
		margin-top: 5px;
		color: var(--foreground);
		font-size: clamp(20px, 2.6vw, 28px);
		font-weight: 680;
		line-height: 1.05;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.section-heading a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--heat-100);
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}

	.category-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}

	.category-tile {
		position: relative;
		min-height: 180px;
		overflow: hidden;
		border-radius: 10px;
		background: var(--accent-black);
	}

	.category-tile.wide-tile {
		grid-column: span 2;
	}

	.category-tile-image {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(180deg, rgba(15, 15, 15, 0.08), rgba(15, 15, 15, 0.78)), var(--tile-image);
		background-position: center;
		background-size: cover;
		transition: transform 420ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.category-tile:hover .category-tile-image {
		transform: scale(1.05);
	}

	.category-tile > div:last-child {
		position: absolute;
		right: 16px;
		bottom: 16px;
		left: 16px;
	}

	.category-tile h3 {
		margin-top: 4px;
		color: white;
		font-size: 19px;
		font-weight: 720;
		line-height: 1.05;
	}

	.category-tile span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		margin-top: 14px;
		color: var(--heat-100);
		font-size: 13px;
		font-weight: 750;
	}

	.deal-layout {
		display: grid;
		grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.2fr);
		gap: 14px;
	}

	.feature-promo {
		position: relative;
		min-height: 100%;
		overflow: hidden;
		border-radius: 10px;
		background: var(--accent-black);
	}

	.feature-promo-media {
		position: absolute;
		inset: 0;
		background-position: center;
		background-size: cover;
		opacity: 0.66;
	}

	.feature-promo::after {
		position: absolute;
		inset: 0;
		content: '';
		background: linear-gradient(180deg, rgba(15, 15, 15, 0.12), rgba(15, 15, 15, 0.86));
	}

	.feature-promo-copy {
		position: relative;
		z-index: 1;
		display: flex;
		min-height: 100%;
		flex-direction: column;
		justify-content: end;
		padding: 24px;
	}

	.feature-promo-copy p {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		color: var(--heat-100);
		font-size: 12px;
		font-weight: 750;
	}

	.feature-promo-copy h3 {
		max-width: 16ch;
		margin-top: 10px;
		color: white;
		font-size: clamp(22px, 2.8vw, 32px);
		font-weight: 730;
		line-height: 1.04;
	}

	.feature-promo-copy span {
		max-width: 36ch;
		margin-top: 14px;
		color: rgba(255, 255, 255, 0.66);
		font-size: 13px;
		line-height: 1.6;
	}

	.deal-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.deal-card {
		overflow: hidden;
		border: 1px solid var(--border-faint);
		border-radius: 10px;
		background: white;
	}

	.deal-media {
		position: relative;
		display: grid;
		aspect-ratio: 4 / 3;
		place-items: center;
		background: var(--background-lighter);
	}

	.deal-media span {
		position: absolute;
		top: 10px;
		left: 10px;
		border-radius: 4px;
		background: var(--heat-100);
		padding: 3px 7px;
		color: white;
		font-size: 11px;
		font-weight: 750;
	}

	.deal-media img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 18px;
		transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.deal-card:hover .deal-media img {
		transform: scale(1.04);
	}

	.deal-copy {
		padding: 12px;
	}

	.deal-copy p {
		color: var(--black-alpha-48);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.deal-copy h3 {
		display: -webkit-box;
		min-height: 34px;
		margin-top: 4px;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		color: var(--foreground);
		font-size: 13px;
		font-weight: 650;
		line-height: 1.3;
	}

	.deal-copy div {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-top: 8px;
	}

	.deal-copy strong {
		color: var(--heat-100);
		font-size: 15px;
	}

	.deal-copy s {
		color: var(--black-alpha-40);
		font-size: 12px;
	}

	.stock-note,
	.sold-out-note {
		display: block;
		margin-top: 6px;
		font-size: 11px;
		font-weight: 650;
	}

	.stock-note {
		color: var(--accent-crimson);
	}

	.sold-out-note {
		color: var(--black-alpha-40);
	}

	.product-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
	}

	.product-entry {
		animation: promo-in 360ms cubic-bezier(0.23, 1, 0.32, 1) both;
		animation-delay: var(--delay);
	}

	.popular-row {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		padding-bottom: 6px;
		scroll-snap-type: x mandatory;
	}

	.popular-card {
		width: min(76vw, 280px);
		flex: 0 0 auto;
		scroll-snap-align: start;
	}

	.service-band {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: 28px;
		margin-top: 48px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(18, 18, 18, 0.96), rgba(37, 31, 28, 0.96));
		padding-top: 28px;
		padding-bottom: 28px;
		color: white;
	}

	.service-band-copy h2 {
		max-width: 18ch;
		margin-top: 8px;
		font-size: clamp(22px, 3vw, 32px);
		font-weight: 720;
		line-height: 1.04;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}

	.service-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.service-grid article {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.06);
		padding: 18px;
	}

	.service-grid :global(svg) {
		color: var(--heat-100);
	}

	.service-grid h3 {
		margin-top: 16px;
		color: white;
		font-size: 15px;
		font-weight: 700;
	}

	.service-grid p {
		margin-top: 6px;
		color: rgba(255, 255, 255, 0.58);
		font-size: 12px;
		line-height: 1.55;
	}

	.home-empty {
		border: 1px dashed var(--border-muted);
		border-radius: 10px;
		background: white;
		padding: 42px 18px;
		text-align: center;
	}

	.home-empty p {
		color: var(--foreground);
		font-size: 18px;
		font-weight: 700;
	}

	.home-empty span {
		display: block;
		margin-top: 8px;
		color: var(--black-alpha-56);
		font-size: 13px;
	}

	@keyframes promo-in {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (min-width: 920px) {
		.home-hero-inner {
			grid-template-columns: minmax(0, 1fr) 360px;
			padding-right: 24px;
			padding-left: 24px;
		}
	}

	@media (max-width: 1023px) {
		.promo-rail,
		.category-grid,
		.deal-layout,
		.product-grid,
		.service-band,
		.service-grid {
			grid-template-columns: 1fr;
		}

		.category-tile.wide-tile {
			grid-column: auto;
		}

		.deal-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 767px) {
		.home-hero-inner {
			min-height: auto;
			padding-top: 44px;
		}

		.hero-search {
			grid-template-columns: auto minmax(0, 1fr);
			padding-right: 12px;
		}

		.hero-search button {
			grid-column: 1 / -1;
			width: 100%;
		}

		.hero-product {
			display: none;
		}

		.promo-rail {
			margin-top: -18px;
		}

		.section-heading {
			align-items: start;
			flex-direction: column;
		}

		.category-grid {
			grid-template-columns: 1fr 1fr;
		}

		.category-tile {
			min-height: 176px;
		}

		.category-tile.wide-tile {
			grid-column: span 2;
		}

		.deal-layout,
		.deal-grid,
		.product-grid,
		.service-grid {
			grid-template-columns: 1fr;
		}

		.feature-promo {
			min-height: 360px;
		}

		.service-band {
			margin-top: 46px;
		}
	}
</style>
