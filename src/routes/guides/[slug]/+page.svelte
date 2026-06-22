<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		ArrowLeft,
		ArrowRight,
		BookOpen,
		CheckCircle2,
		Search,
		ShieldCheck
	} from '@lucide/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import {
		absoluteUrl,
		breadcrumbListJsonLd,
		categoryName,
		itemListJsonLd,
		safeJsonLd,
		SITE_NAME
	} from '$lib/seo';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const guide = $derived(data.guide);
	const relatedGuides = $derived(data.relatedGuides);
	const relatedProducts = $derived(data.relatedProducts);
	const canonicalUrl = $derived(absoluteUrl(page.url.origin, `/guides/${guide.slug}`));
	const seoTitle = $derived(`${guide.title} - ${SITE_NAME}`);
	// '' = all-catalog CTA; undefined = legacy 'displays' default.
	const searchCategory = $derived(
		guide.productCategory === '' ? '' : (guide.productCategory ?? 'displays')
	);
	const ctaNoun = $derived(
		guide.productCtaLabel ?? (searchCategory ? categoryName(searchCategory) : 'Parts')
	);
	const productSearchHref = $derived(
		searchCategory
			? `/products?category=${searchCategory}&q=${encodeURIComponent(guide.primaryKeyword)}`
			: `/products?q=${encodeURIComponent(guide.primaryKeyword)}`
	);
	function keywordHref(keyword: string) {
		return searchCategory
			? `/products?category=${searchCategory}&q=${encodeURIComponent(keyword)}`
			: `/products?q=${encodeURIComponent(keyword)}`;
	}
	const jsonLd = $derived.by(() => {
		const schemas: unknown[] = [
			breadcrumbListJsonLd(page.url.origin, [
				{ name: 'Home', path: '/' },
				{ name: 'Guides', path: '/guides' },
				{ name: guide.shortTitle, path: `/guides/${guide.slug}` }
			]),
			{
				'@context': 'https://schema.org',
				'@type': 'TechArticle',
				headline: guide.title,
				description: guide.description,
				keywords: guide.keywords.join(', '),
				dateModified: guide.updatedAt,
				mainEntityOfPage: canonicalUrl,
				author: {
					'@type': 'Organization',
					name: SITE_NAME
				},
				publisher: {
					'@type': 'Organization',
					name: SITE_NAME,
					logo: {
						'@type': 'ImageObject',
						url: absoluteUrl(page.url.origin, '/favicon.svg')
					}
				}
			},
			{
				'@context': 'https://schema.org',
				'@type': 'FAQPage',
				mainEntity: guide.faqs.map((faq) => ({
					'@type': 'Question',
					name: faq.question,
					acceptedAnswer: {
						'@type': 'Answer',
						text: faq.answer
					}
				}))
			}
		];

		if (relatedProducts.length > 0) {
			schemas.push(itemListJsonLd(page.url.origin, relatedProducts));
		}

		return safeJsonLd(schemas);
	});
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={guide.description} />
	<meta name="keywords" content={guide.keywords.join(', ')} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={guide.description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="article:modified_time" content={guide.updatedAt} />
	<meta name="twitter:card" content="summary" />
	<svelte:element this={'script'} type="application/ld+json">{jsonLd}</svelte:element>
</svelte:head>

<section class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
		<a
			href={resolve('/guides')}
			class="motion-soft-link text-label-small inline-flex items-center gap-2 text-[var(--black-alpha-56)] transition-colors hover:text-[var(--heat-100)]"
		>
			<ArrowLeft class="size-4" />
			Guides
		</a>

		<div class="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end">
			<div>
				<p class="text-mono-x-small tracking-[0.22em] text-[var(--heat-100)] uppercase">
					{guide.eyebrow}
				</p>
				<h1 class="text-title-h2 mt-3 max-w-4xl font-display text-foreground">{guide.title}</h1>
				<p class="text-body-large mt-4 max-w-3xl leading-relaxed text-[var(--black-alpha-64)]">
					{guide.description}
				</p>
				<div class="mt-6 flex flex-wrap gap-2">
					<span
						class="text-label-small inline-flex items-center gap-2 rounded-full border border-[var(--heat-16)] bg-[var(--heat-4)] px-3 py-1.5 text-[var(--heat-100)]"
					>
						<BookOpen class="size-3.5" />
						{guide.readTime}
					</span>
					<span
						class="text-label-small inline-flex items-center gap-2 rounded-full border border-[var(--border-muted)] bg-white px-3 py-1.5 text-[var(--black-alpha-56)]"
					>
						Updated {guide.updatedAt}
					</span>
				</div>
			</div>

			<div class="rounded-lg border border-[var(--border-muted)] bg-[var(--background-base)] p-5">
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Best search phrase
				</p>
				<p class="text-title-h5 mt-2 text-foreground">{guide.primaryKeyword}</p>
				<a
					href={productSearchHref}
					class="button button-primary text-label-medium mt-5 inline-flex h-10 items-center gap-2 rounded-md px-4"
				>
					<Search class="size-4" />
					{ctaNoun.toLowerCase().startsWith('browse') ? ctaNoun : `Search ${ctaNoun.toLowerCase()}`}
				</a>
			</div>
		</div>
	</div>
</section>

<div class="container mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
	<main class="min-w-0">
		<section class="rounded-lg border border-[var(--border-muted)] bg-white p-6 sm:p-8">
			<h2 class="text-title-h4 text-foreground">What this guide covers</h2>
			<div class="mt-5 grid gap-3">
				{#each guide.summary as point (point)}
					<div class="flex gap-3">
						<CheckCircle2 class="mt-0.5 size-5 shrink-0 text-[var(--heat-100)]" />
						<p class="text-body-medium leading-relaxed text-[var(--black-alpha-64)]">{point}</p>
					</div>
				{/each}
			</div>
		</section>

		<div class="mt-8 space-y-6">
			{#each guide.sections as section (section.title)}
				<article class="rounded-lg border border-[var(--border-muted)] bg-white p-6 sm:p-8">
					<h2 class="text-title-h4 text-foreground">{section.title}</h2>
					<div class="mt-4 space-y-4">
						{#each section.body as paragraph (paragraph)}
							<p class="text-body-medium leading-relaxed text-[var(--black-alpha-64)]">
								{paragraph}
							</p>
						{/each}
					</div>

					{#if section.checklist}
						<ul class="mt-5 grid gap-2 sm:grid-cols-2">
							{#each section.checklist as item (item)}
								<li
									class="text-label-small flex items-start gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-base)] px-3 py-2 text-foreground"
								>
									<ShieldCheck class="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
									<span>{item}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</article>
			{/each}
		</div>

		<section class="mt-8 rounded-lg border border-[var(--border-muted)] bg-white p-6 sm:p-8">
			<h2 class="text-title-h4 text-foreground">Questions customers ask</h2>
			<div class="mt-5 divide-y divide-[var(--border-faint)]">
				{#each guide.faqs as faq (faq.question)}
					<article class="py-5 first:pt-0 last:pb-0">
						<h3 class="text-title-h6 text-foreground">{faq.question}</h3>
						<p class="text-body-medium mt-2 leading-relaxed text-[var(--black-alpha-64)]">
							{faq.answer}
						</p>
					</article>
				{/each}
			</div>
		</section>

		{#if relatedProducts.length > 0}
			<section class="mt-10">
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p class="text-mono-x-small tracking-[0.18em] text-[var(--heat-100)] uppercase">
							Related parts
						</p>
						<h2 class="text-title-h4 mt-2 text-foreground">Browse matching replacement parts</h2>
					</div>
					<a
						href={productSearchHref}
						class="text-label-medium inline-flex items-center gap-2 text-[var(--heat-100)]"
					>
						View all
						<ArrowRight class="size-4" />
					</a>
				</div>

				<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each relatedProducts as product, index (product.id)}
						<ProductCard {product} eager={index < 2} />
					{/each}
				</div>
			</section>
		{/if}
	</main>

	<aside class="space-y-5 lg:sticky lg:top-24 lg:h-fit">
		<section class="rounded-lg border border-[var(--border-muted)] bg-white p-5">
			<h2 class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Keyword focus
			</h2>
			<div class="mt-4 flex flex-wrap gap-2">
				{#each guide.keywords as keyword (keyword)}
					<a
						href={keywordHref(keyword)}
						class="text-label-small rounded-full border border-[var(--border-muted)] bg-white px-3 py-1.5 text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
					>
						{keyword}
					</a>
				{/each}
			</div>
		</section>

		<section class="rounded-lg border border-[var(--border-muted)] bg-white p-5">
			<h2 class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
				Related guides
			</h2>
			<div class="mt-4 space-y-3">
				{#each relatedGuides as related (related.href)}
					<a
						href={resolve(related.href)}
						class="block rounded-md border border-[var(--border-faint)] p-4 transition-colors hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)]"
					>
						<span class="text-label-medium text-foreground">{related.title}</span>
						<span class="text-body-small mt-1 block leading-relaxed text-[var(--black-alpha-56)]">
							{related.description}
						</span>
					</a>
				{/each}
			</div>
		</section>
	</aside>
</div>

<div class="h-20 md:hidden"></div>
