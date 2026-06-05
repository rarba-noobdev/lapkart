<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';

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
</script>

<section class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto max-w-4xl px-4 py-12">
		<a
			href={resolve('/')}
			class="text-label-small inline-flex items-center gap-2 text-[var(--black-alpha-56)] transition-colors hover:text-[var(--heat-100)]"
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

<section class="container mx-auto max-w-4xl px-4 py-10">
	<div
		class="divide-y divide-[var(--border-faint)] rounded-lg border border-[var(--border-muted)] bg-white"
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
