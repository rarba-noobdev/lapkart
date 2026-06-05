<script lang="ts">
	import FulfillmentQueue from '$lib/components/admin/FulfillmentQueue.svelte';
</script>

<svelte:head>
	<title>Fulfillment | LapKart</title>
</svelte:head>

<section class="container mx-auto px-4 py-10">
	<div class="mb-8 space-y-4">
		<nav class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
			<a href="/" class="transition-colors hover:text-[var(--heat-100)]">home</a>
			<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
			<a href="/admin" class="transition-colors hover:text-[var(--heat-100)]">admin</a>
			<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
			<span class="text-[var(--heat-100)]">fulfillment</span>
		</nav>

		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Admin operations
				</p>
				<h1 class="text-title-h3 mt-3 font-display text-foreground">Fulfillment operations</h1>
				<p class="text-body-medium mt-2 max-w-[44rem] text-[var(--black-alpha-56)]">
					Shiprocket shipment creation, AWB assignment, pickup scheduling, tracking refresh, and
					batch processing now run inside SvelteKit.
				</p>
			</div>

			<a
				href="/admin"
				class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
			>
				Back to admin
			</a>
		</div>
	</div>

	<FulfillmentQueue />
</section>
