<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		ArrowUpRight,
		CheckCircle2,
		RotateCcw,
		ShieldCheck,
		Truck
	} from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { categories, discountPct, formatINR, type Product } from '$lib/catalog';

	let { data }: { data: { products: Product[] } } = $props();
	let products = $derived(data.products);

	const topRated = $derived([...products].sort((a, b) => b.rating - a.rating));
	const bestSellers = $derived(topRated.slice(0, 6));
	const leadProduct = $derived(
		products.find((product) => product.category === 'ssd') ?? topRated[0]
	);
	const secondaryProduct = $derived(
		products.find((product) => product.category === 'batteries') ?? topRated[1]
	);
	const dealProducts = $derived(
		[...products].sort((a, b) => b.mrp - b.price - (a.mrp - a.price)).slice(0, 4)
	);
	const leadDeal = $derived(dealProducts[0] ?? null);
	const moreDeals = $derived(dealProducts.slice(1, 4));
	const featuredCategories = $derived(
		categories.filter((category) =>
			['ssd', 'batteries', 'ram', 'displays', 'chargers'].includes(category.slug)
		)
	);
	const categoryHighlights = $derived(
		[
			{
				slug: 'ssd',
				name: 'Storage Upgrades',
				body: 'High-performance SSDs to dramatically improve boot times and system responsiveness.',
				product: products.find((product) => product.category === 'ssd') ?? topRated[0]
			},
			{
				slug: 'batteries',
				name: 'Replacement Batteries',
				body: '100% genuine and OEM-grade batteries to restore your laptop to all-day battery life.',
				product: products.find((product) => product.category === 'batteries') ?? topRated[1]
			},
			{
				slug: 'displays',
				name: 'Screen Replacements',
				body: 'Premium display panels to fix cracked screens, dead pixels, and color issues.',
				product: products.find((product) => product.category === 'displays') ?? topRated[2]
			}
		].filter((item) => item.product)
	);
	const leadRepairPath = $derived(categoryHighlights[0] ?? null);
	const secondaryRepairPaths = $derived(categoryHighlights.slice(1));
	const brandPartners = $derived(
		Array.from(new Set(products.map((product) => product.brand).filter(Boolean))).slice(0, 6)
	);
</script>

<svelte:head>
	<title>lapkart - Genuine laptop components, delivered fast</title>
	<meta
		name="description"
		content="Shop genuine laptop parts with fast dispatch, compatibility guidance, and clear pricing across RAM, SSDs, batteries, displays, and replacement hardware."
	/>
</svelte:head>

<section class="container mx-auto px-4 pt-6 pb-10 md:pt-10 md:pb-12">
	<div class="grid gap-5 md:gap-6 lg:grid-cols-[0.92fr_1.08fr]">
		<div
			class="flex flex-col justify-center rounded-[16px] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.16)] sm:p-7 md:p-10"
		>
			<p class="text-body-small font-medium tracking-wider text-[var(--black-alpha-56)] uppercase">
				Premium Laptop Components
			</p>
			<h1
				class="mt-3 font-display text-[clamp(2rem,6vw,4.5rem)] leading-[1.05] tracking-tight text-balance text-foreground sm:mt-4 md:max-w-[14ch]"
			>
				Revive your laptop with genuine parts.
			</h1>
			<p
				class="text-body-medium sm:text-body-large mt-4 max-w-[33rem] text-[var(--black-alpha-72)] sm:mt-5"
			>
				Shop India's most trusted catalog of laptop screens, batteries, SSDs, and RAM. Guaranteed
				compatibility, fast dispatch, and 7-day DOA support.
			</p>

			<div class="mt-6 flex flex-wrap gap-3 sm:mt-8">
				<a
					href={resolve('/products')}
					class="button button-primary text-label-medium inline-flex h-12 items-center gap-2 rounded-md px-6 text-white"
				>
					Shop all parts
					<ArrowRight class="size-4" />
				</a>
				<a
					href={resolve('/products?category=batteries')}
					class="text-label-medium inline-flex h-12 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-6 text-foreground transition-[border-color,background-color,color] hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)]"
				>
					Browse batteries
					<ArrowUpRight class="size-4" />
				</a>
			</div>

			<div
				class="text-body-small mt-6 flex flex-col gap-2.5 text-[var(--black-alpha-64)] sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3"
			>
				<span class="inline-flex items-center gap-2">
					<CheckCircle2 class="size-4 text-[var(--heat-100)]" />
					Verified stock visibility
				</span>
				<span class="inline-flex items-center gap-2">
					<Truck class="size-4 text-[var(--heat-100)]" />
					Fast dispatch on common parts
				</span>
				<span class="inline-flex items-center gap-2">
					<RotateCcw class="size-4 text-[var(--heat-100)]" />
					Returns and warranty support
				</span>
			</div>
		</div>

		<div
			class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.12)] md:p-6"
		>
			<div class="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
				<div
					class="flex min-h-[200px] items-center justify-center rounded-[14px] bg-white p-4 sm:min-h-[280px] md:min-h-[320px] md:p-6"
				>
					{#if leadProduct}
						<img
							src={leadProduct.images?.[0] ?? leadProduct.image}
							alt={leadProduct.title}
							class="max-h-[280px] w-full object-contain"
						/>
					{:else}
						<div class="text-body-small text-[var(--black-alpha-48)]">Top SSD shelf</div>
					{/if}
				</div>

				<div class="grid gap-4">
					<div class="rounded-[14px] bg-white p-5">
						<p
							class="text-body-small font-medium tracking-wider text-[var(--black-alpha-56)] uppercase"
						>
							Trending Category
						</p>
						{#if secondaryProduct}
							<p class="text-label-large mt-2 line-clamp-2 text-foreground">
								{secondaryProduct.title}
							</p>
							<p class="text-body-small mt-3 text-[var(--black-alpha-64)]">
								High demand replacement parts available for immediate dispatch.
							</p>
						{:else}
							<p class="text-body-small mt-2 text-[var(--black-alpha-64)]">
								Battery replacements and SSD upgrades are currently in high demand.
							</p>
						{/if}
					</div>

					{#if leadProduct}
						<a
							href={resolve(`/product/${leadProduct.id}`)}
							class="rounded-[14px] border border-[var(--heat-16)] bg-white p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--heat-100)]"
						>
							<p
								class="text-body-small font-medium tracking-wider text-[var(--black-alpha-56)] uppercase"
							>
								Bestseller
							</p>
							<p class="text-label-large mt-1 line-clamp-2 text-foreground">{leadProduct.title}</p>
							<div class="mt-4 flex items-end gap-3">
								<div>
									<p class="text-label-large font-medium text-foreground">
										{formatINR(leadProduct.price)}
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-40)] line-through">
										{formatINR(leadProduct.mrp)}
									</p>
								</div>
								<span
									class="text-mono-small rounded-full bg-[var(--heat-8)] px-3 py-1 text-[var(--heat-100)]"
								>
									Save {discountPct(leadProduct)}%
								</span>
							</div>
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>

<section class="container mx-auto px-4">
	<div class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4 sm:p-5">
		<div
			class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4"
		>
			<p class="text-label-medium text-foreground">Shop by Category</p>
			<div class="flex flex-wrap gap-2">
				{#each featuredCategories as category (category.slug)}
					<a
						href={resolve(`/products?category=${category.slug}`)}
						class="text-label-small rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-1.5 text-foreground transition-[border-color,background-color,color] hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)] hover:text-[var(--heat-100)] sm:px-4 sm:py-2"
					>
						{category.name}
					</a>
				{/each}
			</div>
		</div>
	</div>
</section>

<section class="container mx-auto px-4 pt-10 md:pt-16">
	<div class="mb-6 md:mb-8">
		<h2 class="text-title-h3 font-display text-foreground">Top Selling Components</h2>
		<p class="text-body-medium mt-2 max-w-[42rem] text-[var(--black-alpha-56)]">
			Our most popular parts across all categories, backed by guaranteed compatibility and fast
			delivery.
		</p>
	</div>

	{#if bestSellers.length > 0}
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
			{#each bestSellers as product (product.id)}
				<ProductCard {product} />
			{/each}
		</div>
	{:else}
		<div
			class="text-body-medium rounded-[16px] border border-[var(--border-faint)] bg-white p-5 text-[var(--black-alpha-64)]"
		>
			Products are being prepared for this shelf.
		</div>
	{/if}
</section>

{#if leadRepairPath}
	<section class="container mx-auto px-4 pt-10 md:pt-16">
		<div class="mb-8">
			<h2 class="text-title-h3 font-display text-foreground">Find the Right Fix</h2>
			<p class="text-body-medium mt-2 max-w-[42rem] text-[var(--black-alpha-56)]">
				Browse curated parts for the most common laptop repairs and upgrades.
			</p>
		</div>

		<div class="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
			<a
				href={resolve(`/products?category=${leadRepairPath.slug}`)}
				class="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_20px_44px_-30px_var(--heat-40)] md:grid-cols-[1.04fr_0.96fr]"
			>
				<div class="flex flex-col justify-between p-6 md:p-8">
					<div>
						<h3 class="text-title-h4 font-display text-foreground">{leadRepairPath.name}</h3>
						<p class="text-body-medium mt-3 max-w-[28rem] text-[var(--black-alpha-56)]">
							{leadRepairPath.body}
						</p>
					</div>
					<span
						class="text-label-small mt-6 inline-flex items-center gap-1.5 text-[var(--heat-100)]"
					>
						Shop {leadRepairPath.name.toLowerCase()}
						<ArrowUpRight class="size-4" />
					</span>
				</div>
				<div class="flex items-center justify-center bg-[var(--background-lighter)] p-6">
					<img
						src={leadRepairPath.product.images?.[0] ?? leadRepairPath.product.image}
						alt={leadRepairPath.product.title}
						class="max-h-[280px] w-full object-contain"
					/>
				</div>
			</a>

			<div class="grid gap-4">
				{#each secondaryRepairPaths as item (item.slug)}
					<a
						href={resolve(`/products?category=${item.slug}`)}
						class="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_18px_38px_-30px_var(--heat-40)] sm:grid-cols-[0.88fr_1.12fr]"
					>
						<div class="flex items-center justify-center bg-[var(--background-lighter)] p-5">
							<img
								src={item.product.images?.[0] ?? item.product.image}
								alt={item.product.title}
								class="max-h-[140px] w-full object-contain"
							/>
						</div>
						<div class="flex flex-col justify-between p-5">
							<div>
								<h3 class="text-label-large text-foreground">{item.name}</h3>
								<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">{item.body}</p>
							</div>
							<span
								class="text-label-small mt-4 inline-flex items-center gap-1.5 text-[var(--heat-100)]"
							>
								Shop category <ArrowUpRight class="size-4" />
							</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

{#if leadDeal}
	<section class="container mx-auto px-4 pt-10 pb-8 md:pt-16 md:pb-12">
		<div class="mb-8">
			<h2 class="text-title-h3 font-display text-foreground">Today's Top Deals</h2>
			<p class="text-body-medium mt-2 max-w-[42rem] text-[var(--black-alpha-56)]">
				Save big on premium components with these limited-time price drops.
			</p>
		</div>
		<div class="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
			<a
				href={resolve(`/product/${leadDeal.id}`)}
				class="group grid overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-white transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_20px_44px_-30px_var(--heat-40)] md:grid-cols-[1fr_1fr]"
			>
				<div class="flex flex-col justify-between p-6 md:p-8">
					<div>
						<h3 class="text-title-h4 font-display text-foreground">{leadDeal.title}</h3>
						<p class="text-body-medium mt-3 text-[var(--black-alpha-56)]">
							Don't miss out on this massive discount on one of our top-rated products. Limited
							stock available.
						</p>
					</div>

					<div class="mt-8 flex items-end justify-between gap-4">
						<div>
							<p class="text-label-large font-medium text-foreground">
								{formatINR(leadDeal.price)}
							</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-40)] line-through">
								{formatINR(leadDeal.mrp)}
							</p>
						</div>
						<span
							class="text-mono-small rounded-full bg-[var(--heat-8)] px-3 py-1 text-[var(--heat-100)]"
						>
							Save {discountPct(leadDeal)}%
						</span>
					</div>
				</div>

				<div class="flex items-center justify-center bg-[var(--background-lighter)] p-8">
					<img
						src={leadDeal.images?.[0] ?? leadDeal.image}
						alt={leadDeal.title}
						class="max-h-[260px] w-full object-contain"
					/>
				</div>
			</a>

			<div class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4 md:p-5">
				<div class="divide-y divide-[var(--border-faint)]">
					{#each moreDeals as product (product.id)}
						<a
							href={resolve(`/product/${product.id}`)}
							class="group grid gap-4 py-4 first:pt-1 last:pb-1 sm:grid-cols-[92px_1fr_auto]"
						>
							<div
								class="flex h-[92px] items-center justify-center rounded-[12px] bg-[var(--background-lighter)] p-3"
							>
								<img
									src={product.images?.[0] ?? product.image}
									alt={product.title}
									class="max-h-[72px] w-full object-contain"
								/>
							</div>
							<div>
								<p
									class="text-label-medium line-clamp-2 text-foreground transition-colors group-hover:text-[var(--heat-100)]"
								>
									{product.title}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">{product.brand}</p>
							</div>
							<div class="sm:text-right">
								<p class="text-label-medium font-medium text-foreground">
									{formatINR(product.price)}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-40)] line-through">
									{formatINR(product.mrp)}
								</p>
								<p class="text-mono-x-small mt-2 text-[var(--heat-100)]">
									Save {discountPct(product)}%
								</p>
							</div>
						</a>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}

<section class="container mx-auto px-4 pt-6 md:pt-4">
	<div class="rounded-[16px] border border-[var(--heat-16)] bg-[var(--heat-4)] p-5 sm:p-6 md:p-8">
		<div class="grid gap-6 sm:gap-8 lg:grid-cols-[0.9fr_1.1fr]">
			<div class="max-w-[30rem]">
				<h2 class="text-title-h3 font-display text-foreground">
					Why thousands of customers trust LapKart.
				</h2>
				<p class="text-body-medium mt-3 text-[var(--black-alpha-64)]">
					We built LapKart to solve the hardest parts of repairing laptops in India: finding genuine
					components, guaranteeing compatibility, and getting them fast.
				</p>
				<a
					href={resolve('/orders')}
					class="text-label-small mt-5 inline-flex items-center gap-1.5 text-[var(--heat-100)]"
				>
					Track an order <ArrowUpRight class="size-4" />
				</a>
			</div>

			<div class="grid gap-5 sm:gap-6 md:grid-cols-3">
				<div>
					<div
						class="grid size-10 place-items-center rounded-[12px] bg-white text-[var(--heat-100)]"
					>
						<ShieldCheck class="size-5" strokeWidth={2} />
					</div>
					<p class="text-label-large mt-4 text-foreground">100% Genuine Parts</p>
					<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
						We source directly from trusted OEMs and top brands to ensure your laptop runs
						flawlessly.
					</p>
				</div>
				<div>
					<div
						class="grid size-10 place-items-center rounded-[12px] bg-white text-[var(--heat-100)]"
					>
						<Truck class="size-5" strokeWidth={2} />
					</div>
					<p class="text-label-large mt-4 text-foreground">Fast Dispatch</p>
					<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
						Most orders are dispatched within 24 hours. Get your machine back up and running fast.
					</p>
				</div>
				<div>
					<div
						class="grid size-10 place-items-center rounded-[12px] bg-white text-[var(--heat-100)]"
					>
						<RotateCcw class="size-5" strokeWidth={2} />
					</div>
					<p class="text-label-large mt-4 text-foreground">7-Day Returns</p>
					<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
						Easy returns for DOA items and comprehensive warranty support on all verified purchases.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

{#if brandPartners.length > 0}
	<section class="container mx-auto px-4 pt-10 pb-10 md:pt-16 md:pb-12">
		<div class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4 sm:p-5 md:p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
				<p class="text-label-medium text-foreground">Top Brands We Carry</p>
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
					{#each brandPartners as brand (brand)}
						<div
							class="flex min-h-20 items-center justify-center rounded-[12px] bg-[var(--background-lighter)] px-6 py-4"
						>
							<span class="text-label-large text-[var(--black-alpha-72)]">{brand}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}
