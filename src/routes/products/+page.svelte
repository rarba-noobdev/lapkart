<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SlidersHorizontal, X, ChevronDown } from '@lucide/svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
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
	let filters = $derived(data.filters);

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

	function updateSearch(patch: Partial<Record<FilterKey, string | undefined>>) {
		const params = new SvelteURLSearchParams(page.url.searchParams);

		for (const [key, value] of Object.entries(patch)) {
			if (!value) params.delete(key);
			else params.set(key, value);
		}

		const next = params.toString();
		void goto(resolve(next ? `/products?${next}` : '/products'), {
			keepFocus: true,
			noScroll: true
		});
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
</svelte:head>

<div class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto px-4 py-3 sm:py-10">
		<nav class="text-mono-x-small hidden tracking-[0.18em] text-[var(--black-alpha-48)] uppercase sm:block">
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

		<div class="flex flex-wrap items-end justify-between gap-2 sm:mt-4 sm:gap-6">
			<div class="min-w-0 flex-1">
				<h1 class="text-[18px] font-medium leading-tight text-foreground sm:text-title-h3">
					{#if currentCategory}
						{currentCategory.name}
					{:else if q}
						Results for "{q}"
					{:else}
						All components
					{/if}
				</h1>
				<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)] sm:mt-1 sm:text-body-medium">
					<span class="font-medium text-foreground">{productTotal}</span> products{category
						? ` in ${currentCategory?.name.toLowerCase()}`
						: ''}
				</p>
			</div>

			<select
				value={activeSort}
				class="h-8 rounded-md border border-[var(--border-muted)] bg-white px-2 text-[12px] text-foreground sm:h-11 sm:px-3 sm:text-body-medium"
				onchange={(event) =>
					updateSearch({ sort: (event.currentTarget as HTMLSelectElement).value })}
			>
				{#each sortOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>

		{#if appliedFilters.length > 0}
			<div class="mt-3 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
				{#each appliedFilters as filter (filter.key)}
					<button
						type="button"
						aria-label={`Remove ${filter.label} filter`}
						class="text-label-small inline-flex h-8 items-center gap-2 rounded-full border border-[var(--heat-20)] bg-[var(--heat-4)] px-3 text-[var(--heat-100)]"
						onclick={() => updateSearch({ [filter.key]: undefined })}
					>
						{filter.label}
						<X class="size-3.5" />
					</button>
				{/each}
				<button
					type="button"
					aria-label="Clear all product filters"
					class="text-label-small inline-flex h-8 items-center rounded-full border border-[var(--border-muted)] bg-white px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
					onclick={clearFilters}
				>
					Clear all
				</button>
			</div>
		{/if}
	</div>
</div>

<div class="products-layout container mx-auto grid min-w-0 gap-3 overflow-hidden px-4 py-3 sm:gap-8 sm:py-10 lg:grid-cols-[240px_1fr]">
	<div class="min-w-0 lg:hidden">
		<div class="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-4 pb-1.5 sm:gap-2 sm:pb-2">
			<a
				href={resolve(q ? `/products?q=${encodeURIComponent(q)}` : '/products')}
				aria-current={!category ? 'page' : undefined}
				class={`shrink-0 snap-start rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[13px] ${
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
					class={`shrink-0 snap-start rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[13px] ${
						category === item.slug
							? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
							: 'border-[var(--border-muted)] bg-white text-foreground'
					}`}
				>
					{item.name}
				</a>
			{/each}
		</div>

		<!-- Collapsible mobile filter -->
		<button
			type="button"
			class="mt-2 flex w-full items-center justify-between rounded-lg border border-[var(--border-faint)] bg-white px-3 py-2 text-left transition-colors hover:border-[var(--heat-20)] sm:mt-3 sm:px-4 sm:py-3"
			onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
			aria-expanded={mobileFiltersOpen}
		>
			<span
				class="text-mono-x-small flex items-center gap-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase"
			>
				<SlidersHorizontal class="size-3" /> Refine Results
				{#if appliedFilters.length > 0}
					<span class="rounded-full bg-[var(--heat-100)] px-1.5 py-0.5 text-[10px] font-bold text-white">
						{appliedFilters.length}
					</span>
				{/if}
			</span>
			<span
				class="inline-flex transition-transform duration-200"
				style:transform={mobileFiltersOpen ? 'rotate(180deg)' : 'rotate(0)'}
			>
				<ChevronDown class="size-4 text-[var(--black-alpha-40)]" />
			</span>
		</button>

		{#if mobileFiltersOpen}
			<div class="mt-1 grid gap-3 rounded-b-lg border border-t-0 border-[var(--border-faint)] bg-white p-4">
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
						<span class="text-mono-x-small text-[var(--black-alpha-40)]">{productTotal}</span>
					</button>
				</li>
				{#each categories as item (item.slug)}
					{@const count = products.filter((product) => product.category === item.slug).length}
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

	<main class="min-w-0 w-full">
		{#if sorted.length === 0}
			<div
				class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-16 text-center"
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
					<div class="min-w-0">
						<ProductCard {product} eager={index < 2} />
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>

<style>
	.product-grid {
		display: grid;
		min-width: 0;
		grid-template-columns: minmax(0, 1fr);
		gap: 12px;
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
</style>
