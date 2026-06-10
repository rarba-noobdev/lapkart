<script lang="ts">
	import Skeleton from '$lib/components/Skeleton.svelte';

	let { pathname }: { pathname: string } = $props();

	type Kind = 'home' | 'products' | 'product' | 'orders' | 'order' | 'profile' | 'cart' | 'generic';

	const kind = $derived.by<Kind>(() => {
		if (pathname === '/') return 'home';
		if (pathname === '/products') return 'products';
		if (pathname.startsWith('/product/')) return 'product';
		if (pathname === '/orders') return 'orders';
		if (pathname.startsWith('/order/')) return 'order';
		if (pathname === '/profile') return 'profile';
		if (pathname === '/cart') return 'cart';
		return 'generic';
	});

	const cards = [0, 1, 2, 3, 4, 5, 6, 7];
	const rows = [0, 1, 2, 3];
</script>

<div class="motion-section" aria-busy="true" aria-label="Loading">
	{#if kind === 'home'}
		<section class="bg-[var(--accent-black)] px-4 py-10 sm:py-16">
			<div class="container mx-auto max-w-lg">
				<Skeleton class="h-3 w-32 bg-white/10" />
				<Skeleton class="mt-4 h-10 w-3/4 bg-white/10" />
				<Skeleton class="mt-3 h-4 w-full bg-white/10" />
				<Skeleton class="mt-2 h-4 w-5/6 bg-white/10" />
				<Skeleton class="mt-6 h-11 w-44 bg-white/10" />
			</div>
		</section>
		<div class="container mx-auto space-y-10 px-4 py-8">
			<div>
				<Skeleton class="mb-4 h-6 w-40" />
				<div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
					{#each cards.slice(0, 4) as i (i)}
						<Skeleton rounded="lg" class="aspect-[3/4]" />
					{/each}
				</div>
			</div>
			<div>
				<Skeleton class="mb-4 h-6 w-44" />
				<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
					{#each cards as i (i)}
						<Skeleton rounded="lg" class="aspect-[3/4]" />
					{/each}
				</div>
			</div>
		</div>
	{:else if kind === 'products'}
		<div class="container mx-auto px-4 py-6">
			<Skeleton class="h-7 w-48" />
			<div class="mt-4 flex gap-2">
				{#each rows as i (i)}
					<Skeleton rounded="full" class="h-8 w-20" />
				{/each}
			</div>
			<div class="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
				{#each cards as i (i)}
					<Skeleton rounded="lg" class="aspect-[3/4]" />
				{/each}
			</div>
		</div>
	{:else if kind === 'product'}
		<div class="container mx-auto grid gap-8 px-4 py-6 lg:grid-cols-2">
			<Skeleton rounded="lg" class="aspect-square w-full" />
			<div>
				<Skeleton class="h-3 w-24" />
				<Skeleton class="mt-3 h-8 w-5/6" />
				<Skeleton class="mt-2 h-8 w-2/3" />
				<Skeleton class="mt-5 h-10 w-40" />
				<div class="mt-6 space-y-2">
					{#each rows as i (i)}
						<Skeleton class="h-4 w-full" />
					{/each}
				</div>
				<Skeleton rounded="md" class="mt-6 h-12 w-full" />
			</div>
		</div>
	{:else if kind === 'orders'}
		<div class="container mx-auto max-w-3xl px-4 py-6">
			<Skeleton class="h-8 w-40" />
			<div class="mt-6 space-y-3">
				{#each cards.slice(0, 5) as i (i)}
					<Skeleton rounded="lg" class="h-24 w-full" />
				{/each}
			</div>
		</div>
	{:else if kind === 'order'}
		<div class="container mx-auto max-w-3xl px-4 py-6">
			<Skeleton class="h-4 w-28" />
			<Skeleton class="mt-3 h-8 w-56" />
			<Skeleton rounded="lg" class="mt-5 h-32 w-full" />
			<div class="mt-5 space-y-3">
				{#each rows as i (i)}
					<Skeleton rounded="lg" class="h-20 w-full" />
				{/each}
			</div>
		</div>
	{:else if kind === 'profile'}
		<div class="container mx-auto max-w-3xl px-4 py-6">
			<div class="flex items-center gap-4">
				<Skeleton rounded="full" class="size-16" />
				<div class="flex-1">
					<Skeleton class="h-6 w-48" />
					<Skeleton class="mt-2 h-4 w-32" />
				</div>
			</div>
			<div class="mt-6 grid gap-3 sm:grid-cols-2">
				{#each rows as i (i)}
					<Skeleton rounded="lg" class="h-28 w-full" />
				{/each}
			</div>
		</div>
	{:else if kind === 'cart'}
		<div class="container mx-auto max-w-3xl px-4 py-6">
			<Skeleton class="h-8 w-32" />
			<div class="mt-6 space-y-3">
				{#each rows as i (i)}
					<Skeleton rounded="lg" class="h-24 w-full" />
				{/each}
			</div>
			<Skeleton rounded="lg" class="mt-6 h-40 w-full" />
		</div>
	{:else}
		<div class="container mx-auto max-w-3xl px-4 py-10">
			<Skeleton class="h-8 w-48" />
			<div class="mt-6 space-y-3">
				{#each cards as i (i)}
					<Skeleton class="h-5 w-full" />
				{/each}
			</div>
		</div>
	{/if}
</div>
