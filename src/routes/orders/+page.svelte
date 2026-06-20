<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, ChevronRight, Package } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { formatINR } from '$lib/catalog';
	import type { OrderSummary } from '$lib/orders';

	type OrdersRoute = '/orders' | `/orders?${string}`;

	let {
		data
	}: { data: { orders: OrderSummary[]; total: number; page: number; pageSize: number } } = $props();
	let orders = $derived(data.orders);
	let currentPage = $derived(Math.max(1, data.page ?? 1));
	let total = $derived(data.total ?? 0);
	let pageSize = $derived(data.pageSize ?? 20);
	let totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	let resultStart = $derived(total === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	let resultEnd = $derived(Math.min(total, currentPage * pageSize));

	function statusColor(status: string) {
		switch (status) {
			case 'confirmed':
			case 'delivered':
				return 'var(--accent-forest)';
			case 'shipped':
				return 'var(--accent-bluetron)';
			case 'cancelled':
			case 'refunded':
			case 'returned':
				return 'var(--accent-crimson)';
			default:
				return 'var(--heat-100)';
		}
	}

	function ordersHrefWithPage(pageNumber: number): OrdersRoute {
		return (pageNumber <= 1 ? '/orders' : `/orders?page=${pageNumber}`) as OrdersRoute;
	}
</script>

<svelte:head>
	<title>My orders - lapkart</title>
</svelte:head>

<section class="container mx-auto max-w-3xl px-4 py-10">
	<div class="mb-8" in:fly={{ y: 6, duration: 220, easing: cubicOut }}>
		<span class="text-label-small text-[var(--heat-100)]">Orders</span>
		<h1 class="text-title-h3 mt-2 font-display text-foreground">My orders</h1>
		{#if total > pageSize}
			<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
				Showing {resultStart}-{resultEnd} of {total} orders
			</p>
		{/if}
	</div>

	{#if orders.length === 0}
		<div
			class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white px-6 py-10 text-center sm:py-12"
		>
			<div
				class="mx-auto grid size-14 place-items-center rounded-full border border-[var(--border-muted)] bg-[var(--background-lighter)]"
			>
				<Package class="size-6 text-[var(--black-alpha-48)]" strokeWidth={1.8} />
			</div>
			<p class="text-label-small mt-4 text-[var(--heat-100)]">No orders yet</p>
			<p class="text-label-large mt-2 text-foreground">Your purchase history will appear here.</p>
			<p class="text-body-medium mt-1 text-[var(--black-alpha-56)]">
				Once you check out, tracking and totals show up on this page.
			</p>
			<a
				href={resolve('/products')}
				class="button button-primary text-label-medium mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-white"
			>
				Start shopping <ArrowRight class="size-4" />
			</a>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each orders as order, idx (order.id)}
				<li in:fly={{ y: 8, duration: 240, delay: Math.min(idx * 50, 300), easing: cubicOut }}>
					<a
						href={resolve(`/order/${order.id}`)}
						aria-label={`View order ${order.id.slice(0, 8).toUpperCase()}`}
						class="group flex items-center gap-5 rounded-lg border border-[var(--border-muted)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_12px_24px_-12px_var(--heat-20)]"
					>
						<div
							class="grid size-11 shrink-0 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--heat-4)] text-[var(--heat-100)]"
						>
							<Package class="size-5" strokeWidth={2.2} />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
								order id
							</p>
							<p class="text-label-medium mt-0.5 text-foreground">
								#{order.id.slice(0, 8).toUpperCase()}
							</p>
							<div
								class="text-mono-x-small mt-1.5 flex flex-wrap items-center gap-2 tracking-wider uppercase"
							>
								<span class="text-[var(--black-alpha-48)]">
									{new Date(order.createdAt).toLocaleString('en-IN')}
								</span>
								<span class="size-1 rounded-full bg-[var(--black-alpha-24)]"></span>
								<span style:color={statusColor(order.status)}>
									{order.status.replaceAll('_', ' ')}
								</span>
							</div>
						</div>
						<div class="text-right">
							<p class="text-mono-x-small tracking-wider text-[var(--black-alpha-48)] uppercase">
								total
							</p>
							<p class="mt-0.5 font-display text-[20px] font-medium text-foreground">
								{formatINR(order.total)}
							</p>
						</div>
						<ChevronRight
							class="size-5 text-[var(--black-alpha-32)] transition-[transform,color] group-hover:translate-x-1 group-hover:text-[var(--heat-100)]"
						/>
					</a>
				</li>
			{/each}
		</ul>

		{#if totalPages > 1}
			<nav class="mt-6 flex items-center justify-center gap-2" aria-label="Order pages">
				{#if currentPage > 1}
					<a
						href={resolve(ordersHrefWithPage(currentPage - 1))}
						class="text-label-small inline-flex h-10 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
					>
						Previous
					</a>
				{/if}
				<span class="text-label-small px-2 text-[var(--black-alpha-56)]">
					Page {currentPage} of {totalPages}
				</span>
				{#if currentPage < totalPages}
					<a
						href={resolve(ordersHrefWithPage(currentPage + 1))}
						class="text-label-small inline-flex h-10 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
					>
						Next
					</a>
				{/if}
			</nav>
		{/if}
	{/if}
</section>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>
