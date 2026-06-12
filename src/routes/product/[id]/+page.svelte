<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		ArrowUpRight,
		Check,
		ChevronRight,
		Minus,
		Plus,
		RotateCcw,
		ShieldCheck,
		ShoppingCart,
		Star,
		Truck
	} from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { addToCart } from '$lib/cart';
	import { discountPct, formatINR, type Product } from '$lib/catalog';
	import { MANUAL_DELIVERY_FREE_SUBTOTAL, MANUAL_DELIVERY_MIN_CHARGE } from '$lib/shipping';
	import {
		absoluteUrl,
		breadcrumbListJsonLd,
		categoryName,
		productJsonLd,
		productSeoDescription,
		productSeoTitle,
		safeJsonLd
	} from '$lib/seo';

	let {
		data
	}: {
		data: {
			product: Product;
			related: Product[];
		};
	} = $props();

	let product = $derived(data.product);
	let related = $derived(data.related);
	let qty = $state(1);
	let added = $state(false);
	let selectedImage = $state<string | null>(null);

	const baseSpecLabels = new Set([
		'compatibility',
		'warranty',
		'weight',
		'dimensions',
		'package size',
		'brand',
		'authenticity',
		'doa policy',
		'cod',
		'stock'
	]);

	const galleryImages = $derived(
		Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean)))
	);
	const activeImage = $derived(
		selectedImage && galleryImages.includes(selectedImage)
			? selectedImage
			: (galleryImages[0] ?? product.image)
	);
	const discount = $derived(discountPct(product));
	const highlights = $derived(
		product.highlights.length > 0
			? product.highlights
			: [
					'Compatibility guidance available before dispatch.',
					'Fast-moving inventory with stock visibility.',
					'Returns and warranty support remain visible after checkout.'
				]
	);
	const visibleHighlights = $derived(highlights.filter((highlight) => !isLabeledSpec(highlight)));
	const compatibility = $derived(
		product.compatibility || 'Compatibility guidance is available before dispatch.'
	);
	const warranty = $derived(product.warranty || 'Standard support applies.');
	const packageSize = $derived(formatPackageSize(product));
	const detailSpecs = $derived(productSpecificationSpecs(product));
	const hasDetailCondition = $derived(
		detailSpecs.some((spec) => specLabelKey(spec.label) === 'condition')
	);
	const quantity = $derived(Math.max(1, Number(qty) || 1));
	const seoTitle = $derived(productSeoTitle(product));
	const productUrl = $derived(absoluteUrl(page.url.origin, `/product/${product.id}`));
	const seoDescription = $derived(productSeoDescription(product));
	const seoImage = $derived(absoluteUrl(page.url.origin, galleryImages[0] ?? product.image));
	const jsonLd = $derived(
		safeJsonLd([
			productJsonLd(product, page.url.origin, productUrl),
			breadcrumbListJsonLd(page.url.origin, [
				{ name: 'Home', path: '/' },
				{ name: 'Catalog', path: '/products' },
				{ name: categoryName(product.category), path: `/products?category=${product.category}` },
				{ name: product.title, path: `/product/${product.id}` }
			])
		])
	);
	const specs = $derived([
		{ label: 'Compatibility', value: compatibility },
		{ label: 'Warranty', value: warranty },
		...detailSpecs,
		...(product.weight_kg
			? [{ label: 'Weight', value: `${formatSpecNumber(product.weight_kg)} kg` }]
			: []),
		...(packageSize ? [{ label: 'Package size', value: packageSize }] : []),
		{ label: 'Authenticity', value: gradeLabel(product.authenticity_grade) },
		...(hasDetailCondition
			? []
			: [{ label: 'Condition', value: gradeLabel(product.condition_grade ?? 'new') }]),
		{ label: 'DOA policy', value: `${product.doa_policy_days ?? 7}-day DOA support` },
		{
			label: 'COD',
			value: product.cod_eligible ? 'Eligible under checkout policy' : 'Prepaid only'
		},
		{
			label: 'Stock',
			value: `${product.stock > 0 ? product.stock + ' units available' : 'Out of stock'}`
		}
	]);

	function handleAddToCart() {
		if (product.stock <= 0) return;
		addToCart(product.id, quantity);
		added = true;
		window.setTimeout(() => {
			added = false;
		}, 1800);
	}

	function increment() {
		qty = qty + 1;
	}
	function decrement() {
		if (qty > 1) qty = qty - 1;
	}

	function gradeLabel(value: string | undefined) {
		return (value ?? 'compatible')
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function specLabelKey(value: string) {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	function splitLabeledSpec(value: string) {
		const separator = value.indexOf(':');
		if (separator <= 0) return null;

		const label = value.slice(0, separator).trim();
		const detail = value.slice(separator + 1).trim();
		if (!label || !detail || label.length > 48) return null;

		return { label, value: detail };
	}

	function isLabeledSpec(value: string) {
		return splitLabeledSpec(value) !== null;
	}

	function productSpecificationSpecs(value: Product) {
		const seen = new Set<string>();
		const specs: { label: string; value: string }[] = [];

		for (const [label, detail] of Object.entries(value.specifications ?? {})) {
			const spec = normalizedSpec(label, detail, seen);
			if (spec) specs.push(spec);
		}

		for (const highlight of value.highlights) {
			const spec = splitLabeledSpec(highlight);
			if (!spec) continue;

			const normalized = normalizedSpec(spec.label, spec.value, seen);
			if (normalized) specs.push(normalized);
		}

		return specs;
	}

	function normalizedSpec(label: string, value: unknown, seen = new Set<string>()) {
		const cleanLabel = String(label ?? '').trim();
		const cleanValue = String(value ?? '').trim();
		if (!cleanLabel || !cleanValue || cleanLabel.length > 48) return null;

		const key = specLabelKey(cleanLabel);
		if (baseSpecLabels.has(key) || seen.has(key)) return null;

		seen.add(key);
		return { label: cleanLabel, value: cleanValue };
	}

	function formatSpecNumber(value: number) {
		return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
	}

	function formatPackageSize(value: Product) {
		if (!value.length_cm || !value.breadth_cm || !value.height_cm) return '';
		return `${formatSpecNumber(value.length_cm)} x ${formatSpecNumber(value.breadth_cm)} x ${formatSpecNumber(value.height_cm)} cm`;
	}
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={productUrl} />
	<meta property="og:type" content="product" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:image" content={seoImage} />
	<meta property="og:url" content={productUrl} />
	<meta property="product:price:amount" content={String(product.price)} />
	<meta property="product:price:currency" content="INR" />
	<meta name="twitter:card" content="summary_large_image" />
	<svelte:element this={'script'} type="application/ld+json">{jsonLd}</svelte:element>
</svelte:head>

<!-- Breadcrumb -->
<nav class="container mx-auto hidden px-4 pt-4 pb-1 md:block md:pt-5">
	<ol
		class="text-mono-x-small flex flex-wrap items-center gap-1 tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
	>
		<li><a href={resolve('/')} class="transition-colors hover:text-[var(--heat-100)]">home</a></li>
		<li><ChevronRight class="size-3 text-[var(--black-alpha-20)]" /></li>
		<li>
			<a href={resolve('/products')} class="transition-colors hover:text-[var(--heat-100)]"
				>catalog</a
			>
		</li>
		<li><ChevronRight class="size-3 text-[var(--black-alpha-20)]" /></li>
		<li class="line-clamp-1 max-w-[200px] text-[var(--black-alpha-64)]">{product.title}</li>
	</ol>
</nav>

<!-- Product layout: two-panel card -->
<section class="container mx-auto px-0 pb-8 md:px-4 md:pb-14 lg:pb-14">
	<div
		class="motion-section overflow-hidden bg-white md:mt-4 md:rounded-lg md:border md:border-[var(--border-faint)] md:shadow-[0_8px_32px_-16px_rgba(0,0,0,0.12)]"
	>
		<div class="grid lg:grid-cols-2">
			<!-- Left panel: Gallery -->
			<div
				class="relative border-b border-[var(--border-faint)] bg-[var(--background-lighter)] lg:border-r lg:border-b-0"
			>
				<div class="sticky top-10 p-2 sm:p-6 md:top-20 md:p-8">
					<!-- Discount badge -->
					{#if discount >= 10}
						<span
							class="text-mono-x-small absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2.5 py-1 font-medium tracking-wide text-white shadow-[0_2px_8px_0_var(--heat-40)] sm:top-6 sm:left-6"
						>
							-{discount}% off
						</span>
					{/if}

					<!-- Main image -->
					<div class="flex aspect-square items-center justify-center sm:aspect-[5/4]">
						{#key activeImage}
							<img
								src={activeImage}
								alt={product.title}
								class="max-h-full max-w-full object-contain"
								fetchpriority="high"
								decoding="async"
								in:fade={{ duration: 160 }}
							/>
						{/key}
					</div>

					<!-- Thumbnail row -->
					{#if galleryImages.length > 1}
						<div
							class="mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mt-4 sm:justify-center sm:gap-2 sm:px-0"
						>
							{#each galleryImages as image, index (image)}
								<button
									type="button"
									aria-label="Show product image {index + 1}"
									aria-pressed={activeImage === image}
									class="size-12 shrink-0 overflow-hidden rounded-md border-2 bg-white p-0.5 transition-[border-color,opacity,box-shadow] duration-200 sm:size-14 sm:rounded-lg sm:p-1
										{activeImage === image
										? 'border-[var(--heat-100)] shadow-[0_0_0_2px_var(--heat-8)]'
										: 'border-[var(--border-faint)] opacity-50 hover:opacity-100'}"
									onclick={() => (selectedImage = image)}
								>
									<img
										src={image}
										alt=""
										class="size-full object-contain"
										loading="lazy"
										decoding="async"
									/>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Right panel: Product info -->
			<div class="px-4 py-4 sm:p-6 md:p-8 lg:p-8 xl:p-10">
				<!-- Brand -->
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--heat-100)] uppercase">
					{product.brand}
				</p>

				<!-- Title -->
				<h1
					class="mt-1.5 font-display text-[clamp(1.25rem,2.8vw,1.75rem)] leading-snug tracking-[-0.015em] text-foreground"
				>
					{product.title}
				</h1>

				<!-- Rating row -->
				<div class="mt-3 flex flex-wrap items-center gap-2.5">
					<span
						class="inline-flex items-center gap-1 rounded-sm bg-[var(--accent-forest)] px-2 py-0.5 text-[11px] leading-none font-semibold text-white"
					>
						{product.rating.toFixed(1)}
						<Star class="size-2.5 fill-white text-white" />
					</span>
					<span class="text-body-small text-[var(--black-alpha-48)]">
						{product.reviews.toLocaleString('en-IN')} ratings
					</span>
					<span class="text-body-small text-[var(--black-alpha-24)]">&bull;</span>
					<span
						class="text-mono-x-small font-medium tracking-wider uppercase
							{product.stock > 0 ? 'text-[var(--accent-forest)]' : 'text-[var(--accent-crimson)]'}"
					>
						{product.stock > 0 ? 'in stock' : 'out of stock'}
					</span>
					{#if product.stock > 0 && product.stock <= 5}
						<span
							class="text-mono-x-small font-medium tracking-wider text-[var(--heat-100)] uppercase"
						>
							&middot; only {product.stock} left
						</span>
					{/if}
				</div>

				<!-- Price -->
				<div class="mt-4 border-t border-b border-[var(--border-faint)] py-4">
					<div class="flex flex-wrap items-baseline gap-2.5">
						<span
							class="font-display text-[clamp(1.625rem,3.8vw,2.25rem)] tracking-[-0.02em] text-foreground"
						>
							{formatINR(product.price)}
						</span>
						<span class="text-body-medium text-[var(--black-alpha-32)] line-through">
							{formatINR(product.mrp)}
						</span>
						{#if discount > 0}
							<span class="text-mono-small font-semibold text-[var(--accent-forest)]">
								{discount}% off
							</span>
						{/if}
					</div>
					<p class="text-mono-x-small mt-1.5 tracking-wider text-[var(--black-alpha-56)] uppercase">
						Inclusive of taxes / Tamil Nadu delivery from {formatINR(MANUAL_DELIVERY_MIN_CHARGE)}
						/ free from {formatINR(MANUAL_DELIVERY_FREE_SUBTOTAL)}
					</p>
				</div>

				<!-- Highlights -->
				{#if visibleHighlights.length > 0}
					<div class="mt-4">
						<h2
							class="text-mono-x-small font-medium tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
						>
							Highlights
						</h2>
						<ul class="mt-2.5 space-y-1.5">
							{#each visibleHighlights as highlight (highlight)}
								<li class="text-body-small flex items-start gap-2 text-foreground">
									<span class="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--black-alpha-32)]"
									></span>
									{highlight}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Trust promises -->
				<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 sm:mt-5 sm:gap-x-5 sm:gap-y-2">
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<Truck class="size-3.5 text-[var(--heat-100)]" strokeWidth={2.2} />
						Courier delivery
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<ShieldCheck class="size-3.5 text-[var(--heat-100)]" strokeWidth={2.2} />
						Genuine product
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<RotateCcw class="size-3.5 text-[var(--heat-100)]" strokeWidth={2.2} />
						{product.doa_policy_days ?? 7}-day DOA
					</span>
				</div>

				<!-- Add-to-cart action -->
				<div class="mt-5 grid gap-3 sm:mt-7 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
					<!-- Quantity controls -->
					<div
						class="grid h-11 grid-cols-[44px_1fr_44px] overflow-hidden rounded-md border border-[var(--border-muted)] sm:h-10 sm:w-32 sm:grid-cols-[40px_1fr_40px]"
					>
						<button
							type="button"
							aria-label="Decrease quantity"
							disabled={qty <= 1}
							class="grid place-items-center text-[var(--black-alpha-48)] transition-colors hover:bg-[var(--black-alpha-2)] hover:text-foreground disabled:opacity-30"
							onclick={decrement}
						>
							<Minus class="size-4" />
						</button>
						<input
							type="number"
							min="1"
							bind:value={qty}
							class="text-label-medium h-full min-w-0 [appearance:textfield] border-x border-[var(--border-faint)] bg-transparent text-center text-foreground outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
						<button
							type="button"
							aria-label="Increase quantity"
							class="grid place-items-center text-[var(--black-alpha-48)] transition-colors hover:bg-[var(--black-alpha-2)] hover:text-foreground"
							onclick={increment}
						>
							<Plus class="size-4" />
						</button>
					</div>

					<!-- Primary CTA -->
					<button
						type="button"
						disabled={product.stock <= 0}
						aria-label={product.stock <= 0 ? 'Product is out of stock' : 'Add product to cart'}
						class="button button-primary text-label-small inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md px-6 text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-fit sm:flex-none"
						onclick={handleAddToCart}
					>
						{#if added}
							<Check class="size-4" />
							Added
						{:else}
							<ShoppingCart class="size-4" />
							Add to cart
						{/if}
					</button>
				</div>

				{#if added}
					<p
						class="text-body-small mt-3 rounded-lg border border-[rgba(66,195,102,0.18)] bg-[rgba(66,195,102,0.06)] px-3 py-2 text-[var(--accent-forest)]"
						transition:fly={{ y: 6, duration: 160 }}
					>
						Added {quantity} item{quantity === 1 ? '' : 's'} to cart
					</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Specifications table -->
	<div
		class="mt-0 overflow-hidden border-t border-[var(--border-faint)] bg-white md:mt-4 md:rounded-lg md:border md:shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]"
	>
		<div class="border-b border-[var(--border-faint)] px-4 py-3 sm:px-6 sm:py-4 md:px-8">
			<h2 class="text-label-large text-foreground">Specifications</h2>
		</div>
		<div class="divide-y divide-[var(--border-faint)]">
			{#each specs as spec (spec.label)}
				<div
					class="grid grid-cols-[90px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[140px_1fr] sm:gap-4 sm:px-6 sm:py-3 md:px-8"
				>
					<span class="text-body-small text-[var(--black-alpha-48)]">{spec.label}</span>
					<span class="text-body-small text-foreground">{spec.value}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- Related products -->
	{#if related.length > 0}
		<section class="mt-6 px-4 md:mt-14 md:px-0">
			<div class="mb-3 flex items-end justify-between gap-4 sm:mb-5">
				<div>
					<h2 class="text-title-h4 font-display text-foreground">Similar products</h2>
					<p class="text-body-small mt-1 text-[var(--black-alpha-48)]">
						Other parts from the same shelf
					</p>
				</div>
				<a
					href={resolve('/products')}
					class="text-label-small group inline-flex items-center gap-1 text-[var(--heat-100)] transition-colors hover:text-foreground"
				>
					View all
					<ArrowUpRight
						class="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
					/>
				</a>
			</div>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
				{#each related as item (item.id)}
					<div animate:flip={{ duration: 180 }}>
						<ProductCard product={item} />
					</div>
				{/each}
			</div>
		</section>
	{/if}
</section>
