<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		ArrowUpRight,
		Check,
		ChevronRight,
		Lock,
		LoaderCircle,
		Minus,
		PackageCheck,
		Pencil,
		Plus,
		RotateCcw,
		Save,
		ShieldCheck,
		ShoppingCart,
		Star,
		Truck,
		X
	} from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { fade, fly } from 'svelte/transition';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import ProductGallery from '$lib/components/ProductGallery.svelte';
	import ProductSpecValue from '$lib/components/ProductSpecValue.svelte';
	import ProductStickyBar from '$lib/components/ProductStickyBar.svelte';
	import DispatchCountdown from '$lib/components/DispatchCountdown.svelte';
	import NativeShareButton from '$lib/components/NativeShareButton.svelte';
	import RecentlyBought from '$lib/components/RecentlyBought.svelte';
	import { requestAdmin, roundMoney } from '$lib/admin';
	import { getAuthContext } from '$lib/auth-context';
	import { addToCart } from '$lib/cart';
	import { discountPct, formatINR, type Product } from '$lib/catalog';
	import { isStaffRole } from '$lib/roles';
	import { MANUAL_DELIVERY_FREE_SUBTOTAL, MANUAL_DELIVERY_MIN_CHARGE } from '$lib/shipping';
	import {
		absoluteUrl,
		breadcrumbListJsonLd,
		categoryName,
		productJsonLd,
		productSeoBrand,
		productSeoDescription,
		productSeoKeywordContent,
		productSeoTitle,
		safeJsonLd
	} from '$lib/seo';

	let {
		data
	}: {
		data: {
			product: Product;
			related: Product[];
			weeklyOrders?: number;
		};
	} = $props();

	const weeklyOrders = $derived(data.weeklyOrders ?? 0);

	const auth = getAuthContext();
	const isAdmin = $derived(isStaffRole(auth.role));
	let productOverride = $state<{ id: string; product: Product } | null>(null);
	const product = $derived(
		productOverride?.id === data.product.id ? productOverride.product : data.product
	);
	let related = $derived(data.related);
	let qty = $state(1);
	let added = $state(false);
	let adminEditorOpen = $state(false);
	let adminSaving = $state(false);
	let adminMessage = $state('');
	let adminMessageProductId = $state('');
	let adminError = $state('');
	let adminForm = $state({
		productId: '',
		title: '',
		price: '',
		mrp: '',
		stock: '',
		warranty: '',
		compatibility: ''
	});
	const adminEditorVisible = $derived(
		isAdmin && adminEditorOpen && adminForm.productId === product.id
	);
	const adminVisibleMessage = $derived(adminMessageProductId === product.id ? adminMessage : '');

	type AdminProductResponse = {
		product: Record<string, unknown>;
	};

	type DisplayPartNumberRow = {
		type: string;
		value: string;
	};

	type DisplayCompatibleModelRow = {
		brand: string;
		model: string;
	};

	function resetAdminForm(value: Product) {
		adminForm = {
			productId: value.id,
			title: value.title,
			price: String(value.price),
			mrp: String(value.mrp),
			stock: String(value.stock),
			warranty: value.warranty,
			compatibility: value.compatibility
		};
	}

	function openAdminEditor() {
		resetAdminForm(product);
		adminEditorOpen = true;
		adminMessage = '';
		adminError = '';
	}

	function closeAdminEditor() {
		resetAdminForm(product);
		adminEditorOpen = false;
		adminError = '';
	}

	function parseAdminMoney(value: string, label: string) {
		const parsed = Number(value.replace(/,/g, '').trim());
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error(`${label} must be a valid amount.`);
		}
		return roundMoney(parsed);
	}

	function parseAdminStock(value: string) {
		const parsed = Number(value.trim());
		if (!Number.isInteger(parsed) || parsed < 0) {
			throw new Error('Stock must be a whole number.');
		}
		return parsed;
	}

	function adminNumberField(record: Record<string, unknown>, key: string, fallback: number) {
		const value = record[key];
		const parsed =
			typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	function adminStringField(record: Record<string, unknown>, key: string, fallback: string) {
		const value = record[key];
		return typeof value === 'string' ? value : fallback;
	}

	function mergeAdminProduct(
		current: Product,
		updated: Record<string, unknown>,
		fallback: {
			title: string;
			price: number;
			mrp: number;
			stock: number;
			warranty: string;
			compatibility: string;
		}
	): Product {
		return {
			...current,
			title: adminStringField(updated, 'title', fallback.title),
			price: adminNumberField(
				updated,
				'selling_price',
				adminNumberField(updated, 'price', fallback.price)
			),
			mrp: adminNumberField(updated, 'mrp', fallback.mrp),
			stock: adminNumberField(updated, 'stock', fallback.stock),
			warranty: adminStringField(updated, 'warranty', fallback.warranty),
			compatibility: adminStringField(updated, 'compatibility', fallback.compatibility),
			updated_at: adminStringField(updated, 'updated_at', current.updated_at ?? '')
		};
	}

	async function clearCatalogCaches() {
		await fetch('/api/admin/catalog-cache', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		}).catch(() => null);
		await invalidateAll();
	}

	async function saveAdminProduct() {
		if (adminSaving) return;
		adminSaving = true;
		adminMessage = '';
		adminError = '';

		try {
			const title = adminForm.title.trim();
			if (title.length < 4) throw new Error('Title must be at least 4 characters.');

			const price = parseAdminMoney(adminForm.price, 'Selling price');
			const mrp = parseAdminMoney(adminForm.mrp, 'MRP');
			const stock = parseAdminStock(adminForm.stock);
			const payload = {
				title,
				price,
				sellingPrice: price,
				mrp,
				stock,
				warranty: adminForm.warranty.trim(),
				compatibility: adminForm.compatibility.trim()
			};

			const response = await requestAdmin<AdminProductResponse>(`/admin/products/${product.id}`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			});
			const updatedProduct = mergeAdminProduct(product, response.product, payload);
			productOverride = { id: updatedProduct.id, product: updatedProduct };
			resetAdminForm(updatedProduct);
			adminMessage = 'Product updated.';
			adminMessageProductId = updatedProduct.id;
			adminEditorOpen = false;
			void clearCatalogCaches();
		} catch (saveError) {
			adminError = saveError instanceof Error ? saveError.message : 'Could not update product.';
		} finally {
			adminSaving = false;
		}
	}

	// Sticky add-to-cart bar visibility: shown only when the in-page primary CTA
	// has scrolled out of view, observed below.
	let ctaInView = $state(true);
	const showStickyBar = $derived(!ctaInView && product.stock > 0);

	function observeCtaVisibility(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') {
			ctaInView = true;
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				ctaInView = entry.isIntersecting;
			},
			{ rootMargin: '0px 0px -40px 0px' }
		);
		observer.observe(node);

		return () => observer.disconnect();
	}

	const savings = $derived(Math.max(0, Math.round(product.mrp - product.price)));

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
		'stock',
		'compatible device models',
		'compatible device model table',
		'panel part number table',
		'panel part numbers',
		'compatibility brands',
		'compatibility classification',
		'compatibility source'
	]);

	const galleryImages = $derived(
		Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean)))
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
	const displayCompatibility = $derived(displayCompatibilityTables(product));
	const hasDisplayCompatibilityTables = $derived(
		product.category === 'displays' &&
			(displayCompatibility.partNumbers.length > 0 || displayCompatibility.models.length > 0)
	);
	const showInternalCompatibilitySource = $derived(
		isAdmin && (displayCompatibility.brands.length > 0 || displayCompatibility.source)
	);
	const detailSpecs = $derived(productSpecificationSpecs(product));
	const hasDetailCondition = $derived(
		detailSpecs.some((spec) => specLabelKey(spec.label) === 'condition')
	);
	const quantity = $derived(Math.max(1, Number(qty) || 1));
	const seoTitle = $derived(productSeoTitle(product));
	const productUrl = $derived(absoluteUrl(page.url.origin, `/product/${product.id}`));
	const seoDescription = $derived(productSeoDescription(product));
	const seoKeywords = $derived(productSeoKeywordContent(product));
	const seoBrand = $derived(productSeoBrand(product));
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
		...(hasDisplayCompatibilityTables ? [] : [{ label: 'Compatibility', value: compatibility }]),
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
		const seen: string[] = [];
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

	function normalizedSpec(label: string, value: unknown, seen: string[] = []) {
		const cleanLabel = String(label ?? '').trim();
		const cleanValue = formatSpecValue(value);
		if (!cleanLabel || !cleanValue || cleanLabel.length > 48) return null;

		const key = specLabelKey(cleanLabel);
		if (baseSpecLabels.has(key) || seen.includes(key)) return null;

		seen.push(key);
		return { label: cleanLabel, value: cleanValue };
	}

	function formatSpecValue(value: unknown): string {
		if (Array.isArray(value)) {
			return value
				.map((item) => formatSpecValue(item))
				.filter(Boolean)
				.join(', ');
		}

		if (value && typeof value === 'object') {
			return Object.values(value)
				.map((item) => formatSpecValue(item))
				.filter(Boolean)
				.join(', ');
		}

		return String(value ?? '').trim();
	}

	function stringListSpec(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value
				.map((item) => formatSpecValue(item))
				.map((item) => item.trim())
				.filter(Boolean);
		}

		return String(value ?? '')
			.split(/\s*,\s*/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function objectListSpec(value: unknown): Record<string, unknown>[] {
		if (!Array.isArray(value)) return [];
		return value.filter(
			(item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object'
		);
	}

	function displayCompatibilityTables(value: Product) {
		const productSpecs = value.specifications ?? {};
		const partRows = objectListSpec(productSpecs['Panel Part Number Table'])
			.map((row): DisplayPartNumberRow => {
				return {
					type: formatSpecValue(row.type) || 'Part number',
					value: formatSpecValue(row.value)
				};
			})
			.filter((row) => row.value);
		const modelRows = objectListSpec(productSpecs['Compatible Device Model Table'])
			.map((row): DisplayCompatibleModelRow => {
				return {
					brand: formatSpecValue(row.brand) || 'Compatible',
					model: formatSpecValue(row.model)
				};
			})
			.filter((row) => row.model);
		const brands = stringListSpec(productSpecs['Compatibility Brands']);
		const classification = formatSpecValue(productSpecs['Compatibility Classification']);
		const source = formatSpecValue(productSpecs['Compatibility Source']);

		return {
			partNumbers: partRows,
			models: modelRows,
			brands,
			classification,
			source
		};
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
	<meta
		name="robots"
		content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"
	/>
	{#if seoKeywords}
		<meta name="keywords" content={seoKeywords} />
	{/if}
	<link rel="canonical" href={productUrl} />
	<meta property="og:type" content="product" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:image" content={seoImage} />
	<meta property="og:image:alt" content={product.title} />
	<meta property="og:url" content={productUrl} />
	<meta property="product:retailer_item_id" content={product.sku ?? product.id} />
	{#if seoBrand}
		<meta property="product:brand" content={seoBrand} />
	{/if}
	<meta property="product:availability" content={product.stock > 0 ? 'in stock' : 'out of stock'} />
	<meta property="product:price:amount" content={String(product.price)} />
	<meta property="product:price:currency" content="INR" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDescription} />
	<meta name="twitter:image" content={seoImage} />
	<meta name="twitter:image:alt" content={product.title} />
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
				<div class="sticky top-10 md:top-20">
					<ProductGallery images={galleryImages} alt={product.title} {discount} />
				</div>
			</div>

			<!-- Right panel: Product info -->
			<div class="px-4 py-4 sm:p-6 md:p-8 lg:p-8 xl:p-10">
				<!-- Brand -->
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--heat-100)] uppercase">
					{product.brand}
				</p>

				<!-- Title -->
				<div class="mt-1.5 flex items-start gap-3">
					<h1
						class="min-w-0 flex-1 font-display text-[clamp(1.25rem,2.8vw,1.75rem)] leading-snug tracking-[-0.015em] text-foreground"
					>
						{product.title}
					</h1>
					<NativeShareButton
						title={product.title}
						text={seoDescription}
						url={productUrl}
						label="Share"
						className="mt-0.5"
					/>
				</div>

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
					{#if weeklyOrders >= 3}
						<span
							class="text-mono-x-small font-medium tracking-wider text-[var(--accent-forest)] uppercase"
						>
							&middot; ordered {weeklyOrders} times this week
						</span>
					{/if}
				</div>

				<!-- Price -->
				<div class="mt-4 border-t border-b border-[var(--border-faint)] py-4">
					<div class="flex flex-wrap items-baseline gap-2.5">
						{#if isAdmin}
							<button
								type="button"
								class="group -ml-1 inline-flex items-center gap-2 rounded-md border border-transparent px-1 py-0.5 text-left transition-colors hover:border-[var(--heat-20)] hover:bg-[var(--heat-4)]"
								aria-label="Edit product price"
								onclick={openAdminEditor}
							>
								<span
									class="font-display text-[clamp(1.625rem,3.8vw,2.25rem)] tracking-[-0.02em] text-foreground"
								>
									{formatINR(product.price)}
								</span>
								<Pencil
									class="size-4 text-[var(--black-alpha-32)] transition-colors group-hover:text-[var(--heat-100)]"
								/>
							</button>
						{:else}
							<span
								class="font-display text-[clamp(1.625rem,3.8vw,2.25rem)] tracking-[-0.02em] text-foreground"
							>
								{formatINR(product.price)}
							</span>
						{/if}
						<span class="text-body-medium text-[var(--black-alpha-32)] line-through">
							{formatINR(product.mrp)}
						</span>
						{#if discount > 0}
							<span class="text-mono-small font-semibold text-[var(--accent-forest)]">
								{discount}% off
							</span>
						{/if}
						{#if savings > 0}
							<span class="text-body-small font-medium text-[var(--accent-forest)]">
								You save {formatINR(savings)}
							</span>
						{/if}
					</div>
					<p class="text-mono-x-small mt-1.5 tracking-wider text-[var(--black-alpha-56)] uppercase">
						Inclusive of taxes / Tamil Nadu delivery from {formatINR(MANUAL_DELIVERY_MIN_CHARGE)}
						/ free from {formatINR(MANUAL_DELIVERY_FREE_SUBTOTAL)}
					</p>
					{#if isAdmin && adminVisibleMessage && !adminEditorVisible}
						<p
							class="text-body-small mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700"
						>
							{adminVisibleMessage}
						</p>
					{/if}
					{#if adminEditorVisible}
						<form
							class="mt-4 rounded-lg border border-[var(--heat-20)] bg-[var(--heat-4)] p-3 sm:p-4"
							onsubmit={(event) => {
								event.preventDefault();
								void saveAdminProduct();
							}}
						>
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p class="text-mono-x-small tracking-[0.16em] text-[var(--heat-100)] uppercase">
										Admin quick edit
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										Updates the live product record.
									</p>
									<a
										href={resolve(`/admin?section=catalog&q=${product.id}`)}
										class="text-label-small mt-2 inline-flex items-center gap-1 text-[var(--heat-100)] transition-colors hover:text-foreground"
									>
										Open full catalog editor
										<ArrowUpRight class="size-3.5" />
									</a>
								</div>
								<button
									type="button"
									class="grid size-8 place-items-center rounded-md border border-[var(--border-muted)] bg-white text-[var(--black-alpha-56)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
									aria-label="Close product editor"
									disabled={adminSaving}
									onclick={closeAdminEditor}
								>
									<X class="size-4" />
								</button>
							</div>

							<div class="mt-3 grid gap-2.5 sm:grid-cols-3">
								<label class="sm:col-span-3">
									<span class="field-label">Title</span>
									<input bind:value={adminForm.title} class="input-field bg-white" />
								</label>
								<label>
									<span class="field-label">Selling price</span>
									<input
										bind:value={adminForm.price}
										class="input-field bg-white"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span class="field-label">MRP</span>
									<input
										bind:value={adminForm.mrp}
										class="input-field bg-white"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span class="field-label">Stock</span>
									<input
										bind:value={adminForm.stock}
										class="input-field bg-white"
										inputmode="numeric"
									/>
								</label>
								<label class="sm:col-span-3">
									<span class="field-label">Warranty</span>
									<input bind:value={adminForm.warranty} class="input-field bg-white" />
								</label>
								<label class="sm:col-span-3">
									<span class="field-label">Compatibility</span>
									<textarea
										bind:value={adminForm.compatibility}
										class="input-field min-h-[72px] bg-white py-2"
									></textarea>
								</label>
							</div>

							{#if adminError}
								<p
									class="text-body-small mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700"
								>
									{adminError}
								</p>
							{/if}

							<div class="mt-4 flex flex-wrap gap-2">
								<button
									type="submit"
									class="button button-primary text-label-small inline-flex h-9 items-center gap-2 rounded-md px-4 text-white disabled:opacity-50"
									disabled={adminSaving}
								>
									{#if adminSaving}
										<LoaderCircle class="size-4 animate-spin" />
										Saving
									{:else}
										<Save class="size-4" />
										Save product
									{/if}
								</button>
								<button
									type="button"
									class="text-label-small inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-[var(--black-alpha-64)] transition-colors hover:border-[var(--black-alpha-32)] hover:text-foreground disabled:opacity-50"
									disabled={adminSaving}
									onclick={closeAdminEditor}
								>
									Cancel
								</button>
							</div>
						</form>
					{/if}
					{#if product.stock > 0}
						<div class="mt-3">
							<DispatchCountdown />
						</div>
					{/if}
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

				<!-- Trust strip -->
				<div
					class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 sm:mt-5 sm:grid-cols-3"
				>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<PackageCheck class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
						Tested before dispatch
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<RotateCcw class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
						{product.doa_policy_days ?? 7}-day replacement
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<ShieldCheck class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
						GST invoice
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
					>
						<Lock class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
						Secure UPI payments
					</span>
					<span
						class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)] sm:col-span-1"
					>
						<Truck class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
						Chennai warehouse
					</span>
					{#if product.cod_eligible}
						<span
							class="text-body-small inline-flex items-center gap-1.5 text-[var(--black-alpha-56)]"
						>
							<Check class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2.2} />
							COD available
						</span>
					{/if}
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
						{@attach observeCtaVisibility}
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

	{#if hasDisplayCompatibilityTables}
		<div
			class="mt-0 overflow-hidden border-t border-[var(--border-faint)] bg-white md:mt-4 md:rounded-lg md:border md:shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]"
		>
			<div
				class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-faint)] px-4 py-3 sm:px-6 sm:py-4 md:px-8"
			>
				<div>
					<h2 class="text-label-large text-foreground">Display compatibility</h2>
					<p class="text-body-small mt-1 text-[var(--black-alpha-48)]">
						Match the panel number first, then verify laptop model, connector, resolution and
						bracket style before ordering.
					</p>
				</div>
				{#if displayCompatibility.classification}
					<span
						class="text-mono-x-small rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-2.5 py-1 tracking-[0.12em] text-[var(--black-alpha-56)] uppercase"
					>
						{displayCompatibility.classification}
					</span>
				{/if}
			</div>

			<div class="grid gap-0 md:grid-cols-[minmax(260px,0.9fr)_1fr]">
				{#if displayCompatibility.partNumbers.length > 0}
					<div class="border-b border-[var(--border-faint)] md:border-r md:border-b-0">
						<div class="bg-[var(--background-lighter)] px-4 py-2.5 sm:px-6 md:px-8">
							<h3
								class="text-mono-x-small font-medium tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
							>
								Panel numbers
							</h3>
						</div>
						<div class="divide-y divide-[var(--border-faint)]">
							{#each displayCompatibility.partNumbers as row, index (`${row.type}-${row.value}-${index}`)}
								<div
									class="grid grid-cols-[104px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[132px_1fr] sm:px-6 md:px-8"
								>
									<span class="text-body-small text-[var(--black-alpha-48)]">{row.type}</span>
									<span class="text-body-small font-medium text-foreground">{row.value}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if displayCompatibility.models.length > 0}
					<div>
						<div class="bg-[var(--background-lighter)] px-4 py-2.5 sm:px-6 md:px-8">
							<h3
								class="text-mono-x-small font-medium tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
							>
								Compatible laptop models
							</h3>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full min-w-[420px] border-collapse text-left">
								<thead>
									<tr class="border-b border-[var(--border-faint)]">
										<th
											class="text-body-small w-28 px-4 py-2.5 font-medium text-[var(--black-alpha-48)] sm:px-6 md:px-8"
											>Brand</th
										>
										<th
											class="text-body-small px-4 py-2.5 font-medium text-[var(--black-alpha-48)] sm:px-6 md:px-8"
											>Model</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-[var(--border-faint)]">
									{#each displayCompatibility.models as row, index (`${row.brand}-${row.model}-${index}`)}
										<tr>
											<td
												class="text-body-small px-4 py-2.5 font-medium text-foreground sm:px-6 md:px-8"
												>{row.brand}</td
											>
											<td class="text-body-small px-4 py-2.5 text-foreground sm:px-6 md:px-8"
												>{row.model}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else}
					<div class="px-4 py-4 sm:px-6 md:px-8">
						<p class="text-body-small text-[var(--black-alpha-56)]">
							No laptop model list is available for this panel. Use the panel number and physical
							specs for matching.
						</p>
					</div>
				{/if}
			</div>

			{#if showInternalCompatibilitySource}
				<div
					class="flex flex-wrap gap-2 border-t border-[var(--border-faint)] px-4 py-3 sm:px-6 md:px-8"
				>
					{#each displayCompatibility.brands as brand (brand)}
						<span
							class="text-mono-x-small rounded-full bg-[var(--black-alpha-4)] px-2.5 py-1 tracking-[0.12em] text-[var(--black-alpha-56)] uppercase"
						>
							{brand}
						</span>
					{/each}
					{#if displayCompatibility.source}
						<span class="text-body-small text-[var(--black-alpha-48)]">
							Source: {displayCompatibility.source}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

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
					<ProductSpecValue value={spec.value} />
				</div>
			{/each}
		</div>
	</div>

	<!-- Recently bought ticker (real, anonymized orders) -->
	<div class="mt-4 px-4 md:px-0">
		<RecentlyBought />
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

<ProductStickyBar {product} bind:qty {added} visible={showStickyBar} onAdd={handleAddToCart} />
