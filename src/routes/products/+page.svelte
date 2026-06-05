<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SlidersHorizontal, X } from '@lucide/svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { categories, discountPct, formatINR, type Product } from '$lib/catalog';

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

	let { data }: { data: { products: Product[] } } = $props();
	let products = $derived(data.products);

	const category = $derived(page.url.searchParams.get('category') ?? '');
	const q = $derived(page.url.searchParams.get('q') ?? '');
	const brand = $derived(page.url.searchParams.get('brand') ?? '');
	const minPrice = $derived(page.url.searchParams.get('minPrice') ?? '');
	const maxPrice = $derived(page.url.searchParams.get('maxPrice') ?? '');
	const inStock = $derived(page.url.searchParams.get('inStock') ?? '');
	const minRating = $derived(page.url.searchParams.get('minRating') ?? '');
	const sort = $derived(page.url.searchParams.get('sort') ?? 'relevance');

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
	const minPriceValue = $derived(Number(minPrice));
	const maxPriceValue = $derived(Number(maxPrice));
	const minRatingValue = $derived(Number(minRating));

	const filtered = $derived.by(() => {
		return products.filter((product) => {
			if (category && product.category !== category) return false;
			if (q && !`${product.title} ${product.brand}`.toLowerCase().includes(q.toLowerCase())) {
				return false;
			}
			if (brand && product.brand !== brand) return false;
			if (Number.isFinite(minPriceValue) && minPriceValue > 0 && product.price < minPriceValue) {
				return false;
			}
			if (Number.isFinite(maxPriceValue) && maxPriceValue > 0 && product.price > maxPriceValue) {
				return false;
			}
			if (inStock === 'true' && product.stock <= 0) return false;
			if (
				Number.isFinite(minRatingValue) &&
				minRatingValue > 0 &&
				product.rating < minRatingValue
			) {
				return false;
			}
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const items = [...filtered];
		if (activeSort === 'price-asc') return items.sort((a, b) => a.price - b.price);
		if (activeSort === 'price-desc') return items.sort((a, b) => b.price - a.price);
		if (activeSort === 'rating-desc') return items.sort((a, b) => b.rating - a.rating);
		if (activeSort === 'discount-desc') {
			return items.sort((a, b) => discountPct(b) - discountPct(a));
		}
		return items;
	});

	const appliedFilters = $derived.by(() => {
		const filters: Array<{ key: FilterKey; label: string }> = [];
		if (currentCategory) filters.push({ key: 'category', label: currentCategory.name });
		if (q) filters.push({ key: 'q', label: `Search: ${q}` });
		if (brand) filters.push({ key: 'brand', label: brand });
		if (minPrice) filters.push({ key: 'minPrice', label: `Min ${formatINR(Number(minPrice))}` });
		if (maxPrice) filters.push({ key: 'maxPrice', label: `Max ${formatINR(Number(maxPrice))}` });
		if (inStock === 'true') filters.push({ key: 'inStock', label: 'In stock' });
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
	<div class="container mx-auto px-4 py-10">
		<nav class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
			<a href="/" class="transition-colors hover:text-[var(--heat-100)]">home</a>
			<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
			<a href="/products" class="transition-colors hover:text-[var(--heat-100)]">catalog</a>
			{#if currentCategory}
				<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
				<span class="text-[var(--heat-100)]">{currentCategory.name}</span>
			{/if}
		</nav>

		<div class="mt-4 flex flex-wrap items-end justify-between gap-6">
			<div>
				<h1 class="text-title-h3 font-display text-foreground">
					{#if currentCategory}
						{currentCategory.name}
					{:else if q}
						Results for "{q}"
					{:else}
						All components
					{/if}
				</h1>
				<p class="text-body-medium mt-1 text-[var(--black-alpha-56)]">
					<span class="font-medium text-foreground">{sorted.length}</span> products{category
						? ` in ${currentCategory?.name.toLowerCase()}`
						: ''}
				</p>
			</div>

			<label class="flex min-w-[220px] flex-col gap-2">
				<span class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Sort
				</span>
				<select
					value={activeSort}
					class="text-body-medium h-11 rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
					onchange={(event) =>
						updateSearch({ sort: (event.currentTarget as HTMLSelectElement).value })}
				>
					{#each sortOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		</div>

		{#if appliedFilters.length > 0}
			<div class="mt-6 flex flex-wrap gap-2">
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

<div class="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[240px_1fr]">
	<div class="lg:hidden">
		<div class="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
			<a
				href={q ? `/products?q=${encodeURIComponent(q)}` : '/products'}
				aria-current={!category ? 'page' : undefined}
				class={`text-label-small shrink-0 rounded-full border px-4 py-2 transition-colors ${
					!category
						? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
						: 'border-[var(--border-muted)] bg-white text-foreground'
				}`}
			>
				All products
			</a>
			{#each categories as item (item.slug)}
				<a
					href={q
						? `/products?category=${item.slug}&q=${encodeURIComponent(q)}`
						: `/products?category=${item.slug}`}
					aria-current={category === item.slug ? 'page' : undefined}
					class={`text-label-small shrink-0 rounded-full border px-4 py-2 transition-colors ${
						category === item.slug
							? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
							: 'border-[var(--border-muted)] bg-white text-foreground'
					}`}
				>
					{item.name}
				</a>
			{/each}
		</div>

		<div class="mt-4 grid gap-4 rounded-lg border border-[var(--border-faint)] bg-white p-4">
			<div
				class="text-mono-x-small flex items-center gap-2 tracking-[0.18em] text-[var(--black-alpha-48)] uppercase"
			>
				<SlidersHorizontal class="size-3" /> Refine Results
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				<label>
					<span
						class="text-mono-x-small mb-1.5 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Brand
					</span>
					<select
						value={brand}
						class="text-body-small h-10 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
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
						class="text-mono-x-small mb-1.5 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Rating
					</span>
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
				</label>
				<div>
					<span
						class="text-mono-x-small mb-1.5 block tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Price
					</span>
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
				</div>
				<label
					class="text-label-small flex h-10 cursor-pointer items-center gap-3 rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground"
				>
					<input
						type="checkbox"
						checked={inStock === 'true'}
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
						<span class="text-mono-x-small text-[var(--black-alpha-40)]">{products.length}</span>
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
					checked={inStock === 'true'}
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

	<main>
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
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
				{#each sorted as product, index (product.id)}
					<div class="animate-fade-up" style:animation-delay={`${Math.min(index * 30, 400)}ms`}>
						<ProductCard {product} />
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>
