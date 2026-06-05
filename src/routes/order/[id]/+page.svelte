<script lang="ts">
	import { formatINR } from '$lib/catalog';
	import type { OrderSummary } from '$lib/orders';
	import { apiBase } from '$lib/api-base';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';

	let { data }: { data: { order: OrderSummary } } = $props();
	let order = $derived(data.order);
	let trackingMessage = $state<string | null>(null);
	let trackingRefreshing = $state(false);
	let trackingMessageTone = $state<'info' | 'error'>('info');

	const orderStatusLabel = $derived(order ? formatStatusLabel(order.status) : '');
	const paymentStatusLabel = $derived(order ? formatStatusLabel(order.paymentStatus) : '');
	const courierLabel = $derived(order?.shipment?.courierName || 'Pending');
	const awbLabel = $derived(order?.shipment?.awbCode || 'Pending');
	const itemCount = $derived(order ? order.items.reduce((sum, item) => sum + item.qty, 0) : 0);

	function formatStatusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	async function refreshTracking() {
		if (!order?.shipment) return;

		try {
			trackingRefreshing = true;
			trackingMessageTone = 'info';
			const response = await fetch(`${apiBase}/orders/${order.id}/tracking`, {
				headers: await getAuthorizationHeaders()
			});
			const body = (await response.json().catch(() => null)) as {
				tracking?: { latest?: string };
				error?: string;
			} | null;
			if (!response.ok) throw new Error(body?.error ?? 'Could not refresh tracking');
			trackingMessage = body?.tracking?.latest ?? 'Tracking refreshed';
		} catch (refreshError) {
			trackingMessageTone = 'error';
			trackingMessage =
				refreshError instanceof Error ? refreshError.message : 'Could not refresh tracking';
		} finally {
			trackingRefreshing = false;
		}
	}
</script>

<svelte:head>
	<title>Order detail - lapkart</title>
</svelte:head>

<section class="container mx-auto px-4 py-10">
	{#if order}
		<div class="space-y-6">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div class="space-y-4">
					<nav class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
						<a href="/" class="transition-colors hover:text-[var(--heat-100)]">home</a>
						<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
						<a href="/dashboard" class="transition-colors hover:text-[var(--heat-100)]">account</a>
						<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
						<a href="/orders" class="transition-colors hover:text-[var(--heat-100)]">orders</a>
						<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
						<span class="text-[var(--heat-100)]">#{order.id.slice(0, 8).toUpperCase()}</span>
					</nav>

					<div>
						<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
							Order detail
						</p>
						<div class="mt-3 flex flex-wrap items-center gap-3">
							<h1 class="text-title-h3 font-display text-foreground">
								Order #{order.id.slice(0, 8).toUpperCase()}
							</h1>
							<span
								class="text-mono-x-small rounded-full bg-[var(--heat-8)] px-3 py-1 text-[var(--heat-100)]"
							>
								{orderStatusLabel}
							</span>
						</div>
						<p class="text-body-medium mt-2 text-[var(--black-alpha-56)]">
							Created {new Date(order.createdAt).toLocaleString('en-IN')}
						</p>
					</div>
				</div>

				<a
					href="/orders"
					class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-5 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				>
					Back to orders
				</a>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
						Payment
					</p>
					<p class="text-label-large mt-3 text-foreground">{paymentStatusLabel}</p>
				</div>
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
						Items
					</p>
					<p class="text-label-large mt-3 text-foreground">{itemCount}</p>
				</div>
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
						Total
					</p>
					<p class="text-label-large mt-3 text-foreground">{formatINR(order.total)}</p>
				</div>
			</div>

			<div class="grid gap-6 lg:grid-cols-[1fr_360px]">
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6 md:p-8">
					<div
						class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-5"
					>
						<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
							Items in this order
						</p>
						<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
							Product, quantity, and per-line pricing captured at checkout.
						</p>
					</div>

					<div class="mt-8 space-y-4">
						{#each order.items as item (item.id)}
							<div
								class="grid gap-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 sm:grid-cols-[88px_1fr_auto]"
							>
								<div
									class="flex aspect-square items-center justify-center rounded-[12px] bg-white p-3"
								>
									<img src={item.image} alt={item.title} class="max-h-full w-full object-contain" />
								</div>
								<div>
									<p class="text-label-medium text-foreground">{item.title}</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">{item.brand}</p>
								</div>
								<div class="text-left sm:text-right">
									<p class="text-label-medium text-foreground">{formatINR(item.price)}</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">Qty {item.qty}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<aside class="space-y-4">
					<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
						<h2 class="text-label-large text-foreground">Summary</h2>
						<div class="text-body-small mt-4 space-y-3 text-[var(--black-alpha-64)]">
							<div class="flex items-center justify-between">
								<span>Total</span>
								<span class="text-foreground">{formatINR(order.total)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>Payment</span>
								<span class="text-foreground">{paymentStatusLabel}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>Courier</span>
								<span class="text-foreground">{courierLabel}</span>
							</div>
							<div class="flex items-center justify-between">
								<span>AWB</span>
								<span class="text-foreground">{awbLabel}</span>
							</div>
						</div>
						{#if trackingMessage}
							<p
								class={`text-body-small mt-4 rounded-md px-4 py-3 ${
									trackingMessageTone === 'error'
										? 'border border-red-200 bg-red-50 text-red-700'
										: 'border border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
								}`}
							>
								{trackingMessage}
							</p>
						{/if}
						<button
							type="button"
							class="text-label-medium mt-4 inline-flex h-11 w-full items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
							onclick={refreshTracking}
							disabled={!order.shipment || trackingRefreshing}
						>
							{trackingRefreshing ? 'Refreshing...' : 'Refresh tracking'}
						</button>
						{#if order.shipment?.trackingUrl}
							<a
								href={order.shipment.trackingUrl}
								target="_blank"
								rel="noreferrer"
								class="text-label-medium mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-[var(--border-muted)] bg-white text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
							>
								Open carrier tracking
							</a>
						{/if}
					</div>

					<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
						<h2 class="text-label-large text-foreground">Delivery address</h2>
						<div
							class="mt-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
						>
							<p class="text-label-small text-foreground">{order.shippingName || 'Customer'}</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-64)]">
								{[order.shippingCity, order.shippingState, order.shippingPincode]
									.filter(Boolean)
									.join(', ') || 'Address pending'}
							</p>
						</div>
					</div>
				</aside>
			</div>
		</div>
	{:else}
		<div class="rounded-[16px] border border-red-200 bg-red-50 p-6 text-red-700">
			Order not found
		</div>
	{/if}
</section>
