<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { navigating, page } from '$app/state';
	import { SlidersHorizontal, X, ChevronDown } from '@lucide/svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { slide, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { categories, formatINR, type Product } from '$lib/catalog';

	type FilterKey =
		| 'category'
		| 'q'
		| 'brand'
		| 'minPrice'
		| 'maxPrice'
		| 'inStock'
		| 'minRating'
		| 'sort';
	type SearchParamKey = FilterKey | 'page';
	type ProductsRoute = '/products' | `/products?${string}`;

	const pageSize = 96;

	const sortOptions = [
		{ value: 'relevance', label: 'Relevance' },
		{ value: 'price-asc', label: 'Price: low to high' },
		{ value: 'price-desc', label: 'Price: high to low' },
		{ value: 'rating-desc', label: 'Top rated' },
		{ value: 'discount-desc', label: 'Biggest discount' },
		{ value: 'newest', label: 'Newest' }
	];

	let {
		data
	}: {
		data: {
			products: Product[];
			productTotal: number;
			page: number;
			searchSource: 'typesense' | 'supabase';
			categoryCounts: Record<string, number>;
			filters: {
				category: string;
				q: string;
				brand: string;
				sort: string;
				inStock: boolean;
				minPrice: string;
				maxPrice: string;
				minRating: string;
			};
		};
	} = $props();
	let products = $derived(data.products);
	let productTotal = $derived(data.productTotal);
	let currentPage = $derived(Math.max(1, data.page ?? 1));
	let categoryCounts = $derived(data.categoryCounts);
	let filters = $derived(data.filters);
	const totalAllProducts = $derived(Object.values(categoryCounts).reduce((sum, n) => sum + n, 0));

	let mobileFiltersOpen = $state(false);

	const category = $derived(filters.category);
	const q = $derived(filters.q);
	const brand = $derived(filters.brand);
	const minPrice = $derived(filters.minPrice);
	const maxPrice = $derived(filters.maxPrice);
	const inStock = $derived(filters.inStock);
	const minRating = $derived(filters.minRating);
	const sort = $derived(filters.sort);

	const activeSort = $derived(
		sortOptions.some((option) => option.value === sort) ? sort : 'relevance'
	);
	const totalPages = $derived(Math.max(1, Math.ceil(productTotal / pageSize)));
	const resultStart = $derived(productTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	const resultEnd = $derived(Math.min(productTotal, currentPage * pageSize));
	const visiblePages = $derived.by(() => {
		const start = Math.max(1, currentPage - 2);
		const end = Math.min(totalPages, start + 4);
		return Array.from({ length: end - start + 1 }, (_, index) => start + index);
	});
	const currentCategory = $derived(categories.find((item) => item.slug === category) ?? null);
	const scopedProducts = $derived(
		category ? products.filter((product) => product.category === category) : products
	);
	const brandOptions = $derived(
		Array.from(new Set(scopedProducts.map((product) => product.brand)))
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b))
	);
	const sorted = $derived(products);
	const isRefreshing = $derived(
		Boolean(navigating.to && navigating.to.url.pathname === resolve('/products'))
	);

	const appliedFilters = $derived.by(() => {
		const filters: Array<{ key: FilterKey; label: string }> = [];
		if (currentCategory) filters.push({ key: 'category', label: currentCategory.name });
		if (q) filters.push({ key: 'q', label: `Search: ${q}` });
		if (brand) filters.push({ key: 'brand', label: brand });
		if (minPrice) filters.push({ key: 'minPrice', label: `Min ${formatINR(Number(minPrice))}` });
		if (maxPrice) filters.push({ key: 'maxPrice', label: `Max ${formatINR(Number(maxPrice))}` });
		if (inStock) filters.push({ key: 'inStock', label: 'In stock' });
		if (minRating) filters.push({ key: 'minRating', label: `${minRating}+ rating` });
		if (activeSort !== 'relevance') {
			filters.push({
				key: 'sort',
				label: sortOptions.find((option) => option.value === activeSort)?.label ?? activeSort
			});
		}
		return filters;
	});

	function updateSearch(patch: Partial<Record<SearchParamKey, string | undefined>>) {
		const params = new SvelteURLSearchParams(page.url.searchParams);

		for (const [key, value] of Object.entries(patch)) {
			if (!value) params.delete(key);
			else params.set(key, value);
		}
		if (!('page' in patch)) params.delete('page');

		const next = params.toString();
		void goto(resolve(next ? `/products?${next}` : '/products'), {
			keepFocus: true,
			noScroll: true
		});
	}

	function productsHrefWithPage(pageNumber: number): ProductsRoute {
		const params = new SvelteURLSearchParams(page.url.searchParams);
		if (pageNumber <= 1) params.delete('page');
		else params.set('page', String(pageNumber));
		const next = params.toString();
		return (next ? `/products?${next}` : '/products') as ProductsRoute;
	}

	function clearFilters() {
		void goto(resolve('/products'), {
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head>
	<title>All components - lapkart</title>
	<meta name="description" content="Browse RAM, SSDs, batteries, displays, processors and more." />
	{#if currentPage > 1}
		<link rel="prev" href={resolve(productsHrefWithPage(currentPage - 1))} />
	{/if}
	{#if currentPage < totalPages}
		<link rel="next" href={resolve(productsHrefWithPage(currentPage + 1))} />
	{/if}
</svelte:head>

<div class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto px-3 py-1.5 sm:px-4 sm:py-10">
		<nav
			class="text-mono-x-small hidden tracking-[0.18em] text-[var(--black-alpha-48)] uppercase sm:block"
		>
			<a href={resolve('/')} class="transition-colors hover:text-[var(--heat-100)]">home</a>
			<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
			<a href={resolve('/products')} class="transition-colors hover:text-[var(--heat-100)]"
				>catalog</a
			>
			{#if currentCategory}
				<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
				<span class="text-[var(--heat-100)]">{currentCategory.name}</span>
			{/if}
		</nav>

		<div class="flex items-center justify-between gap-2 sm:mt-4 sm:flex-wrap sm:items-end sm:gap-6">
			<div class="min-w-0 flex-1">
				<h1 class="text-[13px] leading-tight font-medium text-foreground sm:text-title-h3">
					{#if currentCategory}
						{currentCategory.name}
					{:else if q}
						Results for "{q}"
					{:else}
						All parts
					{/if}
					<span class="text-[11px] font-normal text-[var(--black-alpha-48)] sm:hidden">{productTotal}</span>
				</h1>
				<p class="mt-1 hidden text-body-medium text-[var(--black-alpha-56)] sm:block">
					<span class="font-medium text-foreground">{productTotal}</span> products{category
						? ` in ${currentCategory?.name.toLowerCase()}`
						: ''}
					{#if productTotal > pageSize}
						<span class="text-[var(--black-alpha-40)]">
							&nbsp;showing {resultStart}-{resultEnd}
						</span>
					{/if}
				</p>
			</div>

			<select
				value={activeSort}
				class="h-7 rounded-md border border-[var(--border-muted)] bg-white px-1.5 text-[11px] text-foreground sm:h-11 sm:px-3 sm:text-body-medium"
				onchange={(event) =>
					updateSearch({ sort: (event.currentTarget as HTMLSelectElement).value })}
			>
				{#each sortOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		{#if appliedFilters.length > 0}
			<div
				class="mt-1.5 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2"
				in:fly={{ y: 4, duration: 180, easing: cubicOut }}
			>
				{#each appliedFilters as filter (filter.key)}
					<button
						type="button"
						aria-label={`Remove ${filter.label} filter`}
						class="text-label-small inline-flex h-6 items-center gap-1 rounded-full border border-[var(--heat-20)] bg-[var(--heat-4)] px-2 text-[10px] text-[var(--heat-100)] sm:h-8 sm:gap-2 sm:px-3 sm:text-[13px]"
						onclick={() => updateSearch({ [filter.key]: undefined })}
					>
						{filter.label}
						<X class="size-2.5 sm:size-3" />
					</button>
				{/each}
				<button
					type="button"
					aria-label="Clear all product filters"
					class="text-label-small inline-flex h-6 items-center rounded-full border border-[var(--border-muted)] bg-white px-2 text-[10px] text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] sm:h-8 sm:px-3 sm:text-[13px]"
					onclick={clearFilters}
				>
					Clear all
				</button>
			</div>
		{/if}
	</div>
</div>

<div
	class="products-layout container mx-auto grid min-w-0 gap-2 overflow-hidden px-2 py-2 sm:gap-8 sm:px-4 sm:py-10 lg:grid-cols-[240px_1fr]"
>
	<div class="min-w-0 lg:hidden">
		<div
			class="scrollbar-hide -mx-2 flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 sm:-mx-4 sm:gap-2 sm:px-4 sm:pb-2"
		>
			<a
				href={resolve(q ? `/products?q=${encodeURIComponent(q)}` : '/products')}
				aria-current={!category ? 'page' : undefined}
				class={`shrink-0 snap-start rounded-full border px-2 py-1 text-[10px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[13px] ${
					!category
						? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
						: 'border-[var(--border-muted)] bg-white text-foreground'
				}`}
			>
				All
			</a>
			{#each categories as item (item.slug)}
				<a
					href={resolve(
						q
							? `/products?category=${item.slug}&q=${encodeURIComponent(q)}`
							: `/products?category=${item.slug}`
					)}
					aria-current={category === item.slug ? 'page' : undefined}
					class={`shrink-0 snap-start rounded-full border px-2 py-1 text-[10px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[13px] ${
						category === item.slug
							? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
							: 'border-[var(--border-muted)] bg-white text-foreground'
					}`}
				>
					{item.name}
				</a>
			{/each}

			<button
				type="button"
				class="shrink-0 snap-start rounded-full border border-[var(--border-muted)] bg-white px-2 py-1 text-[10px] font-medium text-[var(--black-alpha-56)] transition-colors sm:px-4 sm:py-2 sm:text-[13px]"
				onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
				aria-expanded={mobileFiltersOpen}
			>
				<span class="flex items-center gap-1">
					<SlidersHorizontal class="size-2.5 sm:size-3" />
					Filters
					{#if appliedFilters.length > 0}
						<span class="flex size-4 items-center justify-center rounded-full bg-[var(--heat-100)] text-[8px] font-bold text-white">
							{appliedFilters.length}
						</span>
					{/if}
				</span>
			</button>
		</div>

		{#if mobileFiltersOpen}
			<div
				class="mt-1 grid gap-3 rounded-b-lg border border-t-0 border-[var(--border-faint)] bg-white p-4"
				transition:slide={{ duration: 200, easing: cubicOut }}
			>
				<div class="grid grid-cols-2 gap-3">
					<label>
						<span
							class="text-mono-x-small mb-1 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>
							Brand
						</span>
						<select
							value={brand}
							class="text-body-small h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-foreground"
							onchange={(event) =>
								updateSearch({
									brand: (event.currentTarget as HTMLSelectElement).value || undefined
								})}
						>
							<option value="">Any brand</option>
							{#each brandOptions as item (item)}
								<option value={item}>{item}</option>
							{/each}
						</select>
					</label>
					<label>
						<span
							class="text-mono-x-small mb-1 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>
							Rating
						</span>
						<select
							value={minRating}
							class="text-body-small h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-foreground"
							onchange={(event) =>
								updateSearch({
									minRating: (event.currentTarget as HTMLSelectElement).value || undefined
								})}
						>
							<option value="">Any rating</option>
							<option value="4.5">4.5+</option>
							<option value="4">4.0+</option>
							<option value="3.5">3.5+</option>
						</select>
					</label>
					<div>
						<span
							class="text-mono-x-small mb-1 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>
							Price
						</span>
						<div class="grid grid-cols-2 gap-1.5">
							<input
								value={minPrice}
								type="number"
								min="0"
								inputmode="numeric"
								aria-label="Minimum price"
								placeholder="Min"
								class="text-body-small h-10 rounded-md border border-[var(--border-muted)] bg-white px-2.5"
								onchange={(event) =>
									updateSearch({
										minPrice: (event.currentTarget as HTMLInputElement).value || undefined
									})}
							/>
							<input
								value={maxPrice}
								type="number"
								min="0"
								inputmode="numeric"
								aria-label="Maximum price"
								placeholder="Max"
								class="text-body-small h-10 rounded-md border border-[var(--border-muted)] bg-white px-2.5"
								onchange={(event) =>
									updateSearch({
										maxPrice: (event.currentTarget as HTMLInputElement).value || undefined
									})}
							/>
						</div>
					</div>
					<label
						class="text-label-small flex h-10 cursor-pointer items-center gap-3 self-end rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
					>
						<input
							type="checkbox"
							checked={inStock}
							class="size-4 accent-[var(--heat-100)]"
							onchange={(event) =>
								updateSearch({
									inStock: (event.currentTarget as HTMLInputElement).checked ? 'true' : undefined
								})}
						/>
						In stock only
					</label>
				</div>
			</div>
		{/if}
	</div>

	<aside class="hidden h-fit space-y-7 lg:sticky lg:top-24 lg:block">
		<h3
			class="text-mono-x-small mb-4 flex items-center gap-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase"
		>
			<SlidersHorizontal class="size-3" /> Filters
		</h3>

		<section>
			<h4 class="text-mono-x-small mb-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Category
			</h4>
			<ul class="space-y-0.5">
				<li>
					<button
						type="button"
						aria-pressed={!category}
						class={`text-label-small flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
							!category
								? 'bg-[var(--heat-8)] text-[var(--heat-100)]'
								: 'text-foreground hover:bg-[var(--black-alpha-4)]'
						}`}
						onclick={() => updateSearch({ category: undefined, brand: undefined })}
					>
						All products
						<span class="text-mono-x-small text-[var(--black-alpha-40)]">{totalAllProducts}</span>
					</button>
				</li>
				{#each categories as item (item.slug)}
					{@const count = categoryCounts[item.slug] ?? 0}
					<li>
						<button
							type="button"
							aria-pressed={category === item.slug}
							class={`text-label-small flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
								category === item.slug
									? 'bg-[var(--heat-8)] text-[var(--heat-100)]'
									: 'text-foreground hover:bg-[var(--black-alpha-4)]'
							}`}
							onclick={() => updateSearch({ category: item.slug, brand: undefined })}
						>
							{item.name}
							<span class="text-mono-x-small text-[var(--black-alpha-40)]">{count}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>

		<section>
			<h4 class="text-mono-x-small mb-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Brand
			</h4>
			<select
				value={brand}
				class="text-body-small h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
				onchange={(event) =>
					updateSearch({ brand: (event.currentTarget as HTMLSelectElement).value || undefined })}
			>
				<option value="">Any brand</option>
				{#each brandOptions as item (item)}
					<option value={item}>{item}</option>
				{/each}
			</select>
		</section>

		<section>
			<h4 class="text-mono-x-small mb-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Price
			</h4>
			<div class="grid grid-cols-2 gap-2">
				<input
					value={minPrice}
					type="number"
					min="0"
					inputmode="numeric"
					aria-label="Minimum price"
					placeholder="Min"
					class="text-body-small h-10 rounded-md border border-[var(--border-muted)] bg-white px-3"
					onchange={(event) =>
						updateSearch({
							minPrice: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
				<input
					value={maxPrice}
					type="number"
					min="0"
					inputmode="numeric"
					aria-label="Maximum price"
					placeholder="Max"
					class="text-body-small h-10 rounded-md border border-[var(--border-muted)] bg-white px-3"
					onchange={(event) =>
						updateSearch({
							maxPrice: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</div>
		</section>

		<section>
			<h4 class="text-mono-x-small mb-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Availability
			</h4>
			<label
				class="text-label-small flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-foreground hover:bg-[var(--black-alpha-4)]"
			>
				<input
					type="checkbox"
					checked={inStock}
					class="size-4 accent-[var(--heat-100)]"
					onchange={(event) =>
						updateSearch({
							inStock: (event.currentTarget as HTMLInputElement).checked ? 'true' : undefined
						})}
				/>
				In stock only
			</label>
		</section>

		<section>
			<h4 class="text-mono-x-small mb-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Rating
			</h4>
			<select
				value={minRating}
				class="text-body-small h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
				onchange={(event) =>
					updateSearch({
						minRating: (event.currentTarget as HTMLSelectElement).value || undefined
					})}
			>
				<option value="">Any rating</option>
				<option value="4.5">4.5 and above</option>
				<option value="4">4.0 and above</option>
				<option value="3.5">3.5 and above</option>
			</select>
		</section>
	</aside>

	<main class="relative w-full min-w-0" aria-busy={isRefreshing}>
		{#if isRefreshing}
			<p class="sr-only" role="status">Updating products</p>
			<div
				class="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 overflow-hidden rounded-full bg-[var(--heat-8)]"
				transition:slide={{ duration: 160, easing: cubicOut }}
			>
				<div class="catalog-loading-bar h-full w-1/3 rounded-full bg-[var(--heat-100)]"></div>
			</div>
		{/if}
		{#if sorted.length === 0}
			<div
				class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-8 text-center sm:p-16"
				in:fly={{ y: 8, duration: 240, easing: cubicOut }}
			>
				<p class="text-label-small text-[var(--heat-100)]">No matching parts</p>
				<p class="text-body-large mt-3 text-foreground">No products found.</p>
				<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
					Try removing a filter, widening the price range, or checking another category.
				</p>
				<button
					type="button"
					class="button button-primary text-label-medium mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5"
					onclick={clearFilters}
				>
					Reset filters
				</button>
			</div>
		{:else}
			<div class="product-grid">
				{#each sorted as product, index (product.id)}
					<div
						class="min-w-0"
						in:fly={{ y: 8, duration: 240, delay: Math.min(index * 35, 280), easing: cubicOut }}
					>
						<ProductCard {product} eager={index < 2} />
					</div>
				{/each}
			</div>

			{#if totalPages > 1}
				<nav
					class="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8"
					aria-label="Product pages"
					in:fly={{ y: 8, duration: 220, easing: cubicOut }}
				>
					{#if currentPage > 1}
						<a
							href={resolve(productsHrefWithPage(currentPage - 1))}
							class="text-label-small inline-flex h-10 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						>
							Previous
						</a>
					{/if}

					{#each visiblePages as pageNumber (pageNumber)}
						<a
							href={resolve(productsHrefWithPage(pageNumber))}
							aria-current={pageNumber === currentPage ? 'page' : undefined}
							class={`text-label-small inline-flex size-10 items-center justify-center rounded-md border transition-colors ${
								pageNumber === currentPage
									? 'border-[var(--heat-100)] bg-[var(--heat-100)] text-white'
									: 'border-[var(--border-muted)] bg-white text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]'
							}`}
						>
							{pageNumber}
						</a>
					{/each}

					{#if currentPage < totalPages}
						<a
							href={resolve(productsHrefWithPage(currentPage + 1))}
							class="text-label-small inline-flex h-10 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						>
							Next
						</a>
					{/if}
				</nav>
			{/if}
		{/if}
	</main>
</div>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>

<style>
	.product-grid {
		display: grid;
		min-width: 0;
		grid-template-columns: 1fr;
		gap: 6px;
	}

	@media (min-width: 640px) {
		.product-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 14px;
		}
	}

	@media (min-width: 900px) {
		.product-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.product-grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 16px;
		}
	}

	@keyframes catalog-loading {
		0% {
			transform: translateX(-120%);
		}
		100% {
			transform: translateX(320%);
		}
	}

	.catalog-loading-bar {
		animation: catalog-loading 900ms ease-in-out infinite;
	}
</style>
