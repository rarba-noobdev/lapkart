<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ArrowRight, BookOpen, Search, ShieldCheck } from '@lucide/svelte';
	import { screenGuides } from '$lib/guides';
	import { absoluteUrl, breadcrumbListJsonLd, safeJsonLd, SITE_NAME } from '$lib/seo';

	const title = `Laptop screen buying guides - ${SITE_NAME}`;
	const description =
		'Guides for laptop screen part numbers, 30-pin and 40-pin connectors, display resolution, and Tamil Nadu screen replacement delivery.';
	const canonicalUrl = $derived(absoluteUrl(page.url.origin, '/guides'));
	const jsonLd = $derived(
		safeJsonLd([
			breadcrumbListJsonLd(page.url.origin, [
				{ name: 'Home', path: '/' },
				{ name: 'Guides', path: '/guides' }
			]),
			{
				'@context': 'https://schema.org',
				'@type': 'CollectionPage',
				name: title,
				description,
				url: canonicalUrl,
				mainEntity: {
					'@type': 'ItemList',
					itemListElement: screenGuides.map((guide, index) => ({
						'@type': 'ListItem',
						position: index + 1,
						name: guide.title,
						url: absoluteUrl(page.url.origin, `/guides/${guide.slug}`)
					}))
				}
			}
		])
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary" />
	<svelte:element this={'script'} type="application/ld+json">{jsonLd}</svelte:element>
</svelte:head>

<section class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
		<p class="text-mono-x-small tracking-[0.22em] text-[var(--heat-100)] uppercase">
			Laptop screen guides
		</p>
		<h1 class="text-title-h2 mt-3 max-w-4xl font-display text-foreground">
			Choose the right replacement laptop screen
		</h1>
		<p class="text-body-large mt-4 max-w-3xl leading-relaxed text-[var(--black-alpha-64)]">
			Use these guides to match part numbers, connectors, resolution, display technology, and Tamil
			Nadu delivery requirements before ordering a laptop screen.
		</p>

		<div class="mt-7 flex flex-wrap gap-2">
			<a
				href={resolve('/products?category=displays')}
				class="button button-primary text-label-medium inline-flex h-10 items-center gap-2 rounded-md px-4"
			>
				<Search class="size-4" />
				Browse displays
			</a>
			<a
				href={resolve('/products')}
				class="button text-label-medium inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground"
			>
				All parts
				<ArrowRight class="size-4" />
			</a>
		</div>
	</div>
</section>

<section class="container mx-auto max-w-6xl px-4 py-10">
	<div class="grid gap-4 md:grid-cols-2">
		{#each screenGuides as guide (guide.slug)}
			<a
				href={resolve(`/guides/${guide.slug}`)}
				class="group rounded-lg border border-[var(--border-muted)] bg-white p-6 transition-colors hover:border-[var(--heat-100)] hover:bg-[var(--heat-4)]"
			>
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-mono-x-small tracking-[0.18em] text-[var(--heat-100)] uppercase">
							{guide.eyebrow}
						</p>
						<h2 class="text-title-h4 mt-3 text-foreground">{guide.shortTitle}</h2>
					</div>
					<BookOpen class="size-5 shrink-0 text-[var(--heat-100)]" />
				</div>
				<p class="text-body-medium mt-4 leading-relaxed text-[var(--black-alpha-64)]">
					{guide.description}
				</p>
				<div class="mt-5 flex flex-wrap gap-2">
					<span
						class="text-label-small inline-flex items-center gap-1.5 rounded-full border border-[var(--border-faint)] bg-white px-3 py-1.5 text-[var(--black-alpha-56)]"
					>
						<ShieldCheck class="size-3.5" />
						{guide.primaryKeyword}
					</span>
					<span
						class="text-label-small rounded-full border border-[var(--border-faint)] bg-white px-3 py-1.5 text-[var(--black-alpha-56)]"
					>
						{guide.readTime}
					</span>
				</div>
				<span class="text-label-medium mt-6 inline-flex items-center gap-2 text-[var(--heat-100)]">
					Read guide
					<ArrowRight class="size-4 transition-transform group-hover:translate-x-0.5" />
				</span>
			</a>
		{/each}
	</div>
</section>

<div class="h-20 md:hidden"></div>
