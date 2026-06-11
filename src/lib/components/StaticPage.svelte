<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';
	import { absoluteUrl } from '$lib/seo';

	type PolicySection = {
		title: string;
		body: string;
	};

	let {
		eyebrow,
		title,
		description,
		sections
	}: {
		eyebrow: string;
		title: string;
		description: string;
		sections: PolicySection[];
	} = $props();

	const seoTitle = $derived(title.includes('LapKart') ? title : `${title} - LapKart`);
	const canonicalUrl = $derived(absoluteUrl(page.url.origin, page.url.pathname));
</script>

<svelte:head>
	<title>{seoTitle}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<section class="motion-section border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto max-w-4xl px-4 py-12">
		<a
			href={resolve('/')}
			class="motion-soft-link text-label-small inline-flex items-center gap-2 text-[var(--black-alpha-56)] transition-colors hover:text-[var(--heat-100)]"
		>
			<ArrowLeft class="size-4" />
			Home
		</a>
		<p class="text-mono-x-small mt-8 tracking-[0.22em] text-[var(--heat-100)] uppercase">
			{eyebrow}
		</p>
		<h1 class="text-title-h2 mt-3 font-display text-foreground">{title}</h1>
		<p class="text-body-large mt-4 max-w-2xl text-[var(--black-alpha-64)]">
			{description}
		</p>
	</div>
</section>

<section class="motion-section container mx-auto max-w-4xl px-4 py-10">
	<div
		class="motion-card divide-y divide-[var(--border-faint)] rounded-lg border border-[var(--border-muted)] bg-white"
	>
		{#each sections as section (section.title)}
			<article class="p-6">
				<h2 class="text-title-h5 text-foreground">{section.title}</h2>
				<p class="text-body-medium mt-3 leading-relaxed text-[var(--black-alpha-64)]">
					{section.body}
				</p>
			</article>
		{/each}
	</div>
</section>
