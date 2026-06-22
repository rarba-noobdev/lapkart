<script lang="ts">
	import { page } from '$app/state';
	import { ArrowRight, ChevronRight, Search } from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import {
		absoluteUrl,
		breadcrumbListJsonLd,
		itemListJsonLd,
		safeJsonLd,
		SITE_NAME
	} from '$lib/seo';
	import type { Product } from '$lib/catalog';

	type Crumb = { name: string; path: string };
	type LinkCard = { title: string; href: string; description?: string };
	type Faq = { question: string; answer: string };

	type View = {
		h1: string;
		title: string;
		metaDescription: string;
		keywords: string[];
		intro: string[];
		faqs: Faq[];
		breadcrumbs: Crumb[];
		canonicalPath: string;
		productHref?: string;
		productHrefLabel?: string;
		products: Product[];
		siblingHeading?: string;
		siblings: LinkCard[];
		guides: LinkCard[];
		categoryLinks?: LinkCard[];
	};

	let { view }: { view: View } = $props();

	const canonicalUrl = $derived(absoluteUrl(page.url.origin, view.canonicalPath));
	const seoTitle = $derived(
		view.title.includes(SITE_NAME) ? view.title : `${view.title} - ${SITE_NAME}`
	);

	const jsonLd = $derived.by(() => {
		const schemas: unknown[] = [breadcrumbListJsonLd(page.url.origin, view.breadcrumbs)];
		if (view.products.length > 0) {
			schemas.push(itemListJsonLd(page.url.origin, view.products));
		}
		if (view.faqs.length > 0) {
			schemas.push({
				'@context': 'https://schema.org',
				'@type': 'FAQPage',
				mainEntity: view.faqs.map((faq) => ({
					'@type': 'Question',
					name: faq.question,
					acceptedAnswer: { '@type': 'Answer', text: faq.answer }
				}))
			});
		}
		return safeJsonLd(schemas);
	});
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={view.metaDescription} />
	{#if view.keywords.length}
		<meta name="keywords" content={view.keywords.join(', ')} />
	{/if}
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={view.metaDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary" />
	<svelte:element this={'script'} type="application/ld+json">{jsonLd}</svelte:element>
</svelte:head>

<section class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto max-w-6xl px-4 py-8 sm:py-12">
		<nav aria-label="Breadcrumb">
			<ol
				class="text-mono-x-small flex flex-wrap items-center gap-1 tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
			>
				{#each view.breadcrumbs as crumb, i (crumb.path)}
					{#if i < view.breadcrumbs.length - 1}
						<li>
							<a href={crumb.path} class="transition-colors hover:text-[var(--heat-100)]"
								>{crumb.name}</a
							>
						</li>
						<li><ChevronRight class="size-3 text-[var(--black-alpha-20)]" /></li>
					{:else}
						<li class="text-[var(--heat-100)]">{crumb.name}</li>
					{/if}
				{/each}
			</ol>
		</nav>

		<h1 class="text-title-h2 mt-5 max-w-4xl font-display text-foreground">{view.h1}</h1>
		<div class="mt-4 max-w-3xl space-y-3">
			{#each view.intro as paragraph (paragraph)}
				<p class="text-body-medium leading-relaxed text-[var(--black-alpha-64)]">{paragraph}</p>
			{/each}
		</div>

		{#if view.productHref}
			<a
				href={view.productHref}
				class="button button-primary text-label-medium mt-6 inline-flex h-10 items-center gap-2 rounded-md px-4"
			>
				<Search class="size-4" />
				{view.productHrefLabel ?? 'Browse parts'}
			</a>
		{/if}
	</div>
</section>

<div class="container mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
	<main class="min-w-0">
		{#if view.categoryLinks && view.categoryLinks.length}
			<section class="mb-10">
				<h2 class="text-title-h4 text-foreground">Shop by part type</h2>
				<div class="mt-5 grid gap-3 sm:grid-cols-2">
					{#each view.categoryLinks as link (link.href)}
						<a
							href={link.href}
							class="group flex items-center justify-between gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-4 transition-colors hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)]"
						>
							<span>
								<span class="text-label-medium block text-foreground">{link.title}</span>
								{#if link.description}
									<span class="text-body-small mt-0.5 block text-[var(--black-alpha-56)]"
										>{link.description}</span
									>
								{/if}
							</span>
							<ArrowRight
								class="size-4 shrink-0 text-[var(--black-alpha-24)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--heat-100)]"
							/>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if view.products.length > 0}
			<section>
				<div class="flex flex-wrap items-end justify-between gap-4">
					<h2 class="text-title-h4 text-foreground">In stock now</h2>
					{#if view.productHref}
						<a
							href={view.productHref}
							class="text-label-medium inline-flex items-center gap-2 text-[var(--heat-100)]"
						>
							View all
							<ArrowRight class="size-4" />
						</a>
					{/if}
				</div>
				<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each view.products as product, index (product.id)}
						<ProductCard {product} eager={index < 2} />
					{/each}
				</div>
			</section>
		{/if}

		{#if view.siblings.length > 0}
			<section class="mt-10">
				<h2 class="text-title-h4 text-foreground">{view.siblingHeading ?? 'Browse by brand'}</h2>
				<div class="mt-5 grid gap-3 sm:grid-cols-2">
					{#each view.siblings as link (link.href)}
						<a
							href={link.href}
							class="group flex items-center justify-between gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-4 transition-colors hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)]"
						>
							<span class="text-label-medium text-foreground">{link.title}</span>
							<ArrowRight
								class="size-4 shrink-0 text-[var(--black-alpha-24)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--heat-100)]"
							/>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if view.faqs.length > 0}
			<section class="mt-10 rounded-lg border border-[var(--border-muted)] bg-white p-6 sm:p-8">
				<h2 class="text-title-h4 text-foreground">Frequently asked questions</h2>
				<div class="mt-5 divide-y divide-[var(--border-faint)]">
					{#each view.faqs as faq (faq.question)}
						<article class="py-5 first:pt-0 last:pb-0">
							<h3 class="text-title-h6 text-foreground">{faq.question}</h3>
							<p class="text-body-medium mt-2 leading-relaxed text-[var(--black-alpha-64)]">
								{faq.answer}
							</p>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	</main>

	<aside class="space-y-5 lg:sticky lg:top-24 lg:h-fit">
		{#if view.guides.length > 0}
			<section class="rounded-lg border border-[var(--border-muted)] bg-white p-5">
				<h2 class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Buying guides
				</h2>
				<div class="mt-4 space-y-3">
					{#each view.guides as link (link.href)}
						<a
							href={link.href}
							class="block rounded-md border border-[var(--border-faint)] p-4 transition-colors hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)]"
						>
							<span class="text-label-medium text-foreground">{link.title}</span>
							{#if link.description}
								<span
									class="text-body-small mt-1 block leading-relaxed text-[var(--black-alpha-56)]"
									>{link.description}</span
								>
							{/if}
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if view.keywords.length > 0}
			<section class="rounded-lg border border-[var(--border-muted)] bg-white p-5">
				<h2 class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Popular searches
				</h2>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each view.keywords as keyword (keyword)}
						<a
							href={`/products?q=${encodeURIComponent(keyword)}`}
							class="text-label-small rounded-full border border-[var(--border-muted)] bg-white px-3 py-1.5 text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						>
							{keyword}
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</aside>
</div>

<div class="h-20 md:hidden"></div>
