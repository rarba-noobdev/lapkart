<script lang="ts">
	import { formatINR } from '$lib/catalog';
	import { resolve } from '$app/paths';
	import type { OrderSummary } from '$lib/orders';
	import { apiBase } from '$lib/api-base';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
	import {
		ArrowLeft,
		CalendarClock,
		CheckCircle2,
		CreditCard,
		ExternalLink,
		Hash,
		MapPin,
		Package,
		ReceiptText,
		RefreshCw,
		Truck
	} from '@lucide/svelte';

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
	const shippingLocation = $derived(
		order
			? [order.shippingCity, order.shippingState, order.shippingPincode].filter(Boolean).join(', ')
			: ''
	);

	function formatStatusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	function statusTone(status: string) {
		const normalized = status.toLowerCase();
		if (['delivered', 'paid', 'captured', 'verified'].includes(normalized)) {
			return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		}
		if (['cancelled', 'failed', 'payment_failed', 'refunded'].includes(normalized)) {
			return 'border-red-200 bg-red-50 text-red-700';
		}
		if (['pending_payment', 'pending', 'cod_pending', 'processing'].includes(normalized)) {
			return 'border-amber-200 bg-amber-50 text-amber-700';
		}
		return 'border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]';
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

	function openTrackingUrl(url: string | null | undefined) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>Order detail - lapkart</title>
</svelte:head>

<section class="motion-page mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
	{#if order}
		<div class="space-y-6">
			<header
				class="relative overflow-hidden rounded-[24px] border border-[var(--border-faint)] bg-white shadow-card"
			>
				<div class="grain absolute inset-0 opacity-20"></div>
				<div
					class="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-[var(--heat-12)] blur-3xl"
				></div>
				<div class="relative grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-6 lg:p-8">
					<div>
						<a
							href={resolve('/orders')}
							class="motion-soft-link text-label-small mb-5 inline-flex items-center gap-2 text-[var(--black-alpha-56)] hover:text-[var(--heat-100)]"
						>
							<ArrowLeft class="size-4" strokeWidth={2} />
							Back to orders
						</a>
						<nav class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
							<a href={resolve('/')} class="motion-soft-link hover:text-[var(--heat-100)]">home</a>
							<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
							<a href={resolve('/dashboard')} class="motion-soft-link hover:text-[var(--heat-100)]"
								>account</a
							>
							<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
							<a href={resolve('/orders')} class="motion-soft-link hover:text-[var(--heat-100)]"
								>orders</a
							>
							<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
							<span class="text-[var(--heat-100)]">#{order.id.slice(0, 8).toUpperCase()}</span>
						</nav>

						<div class="mt-4 flex flex-wrap items-center gap-3">
							<h1 class="text-title-h3 font-display text-foreground">
								Order #{order.id.slice(0, 8).toUpperCase()}
							</h1>
							<span
								class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.14em] uppercase ${statusTone(order.status)}`}
							>
								{orderStatusLabel}
							</span>
						</div>
						<p class="text-body-medium mt-2 text-[var(--black-alpha-56)]">
							Placed {new Date(order.createdAt).toLocaleString('en-IN')}
						</p>
					</div>

					<div class="grid min-w-[280px] gap-2 rounded-[18px] bg-[var(--background-lighter)] p-3">
						<div class="rounded-[14px] bg-white p-3 shadow-card">
							<div class="flex items-center gap-2 text-[var(--black-alpha-48)]">
								<ReceiptText class="size-4" strokeWidth={2} />
								<span class="text-mono-x-small tracking-[0.14em] uppercase">Total</span>
							</div>
							<p class="text-title-h5 mt-2 text-foreground">{formatINR(order.total)}</p>
						</div>
						<div class="grid gap-2 sm:grid-cols-2">
							<div class="rounded-[14px] bg-white p-3 shadow-card">
								<p
									class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									Items
								</p>
								<p class="text-label-large mt-2 text-foreground">{itemCount}</p>
							</div>
							<div class="rounded-[14px] bg-white p-3 shadow-card">
								<p
									class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									Payment
								</p>
								<p class="text-label-large mt-2 text-foreground">{paymentStatusLabel}</p>
							</div>
						</div>
					</div>
				</div>
			</header>

			<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
				<div class="motion-list space-y-6">
					<article class="rounded-[22px] border border-[var(--border-faint)] bg-white shadow-card">
						<div
							class="flex items-start gap-3 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] p-5"
						>
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-black)] text-[var(--heat-100)]"
							>
								<Package class="size-5" strokeWidth={2} />
							</div>
							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Order items
								</p>
								<h2 class="text-title-h5 text-foreground">Snapshot captured at checkout</h2>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Product title, brand, quantity, and line pricing are preserved for this order.
								</p>
							</div>
						</div>

						<div class="space-y-3 p-5">
							{#each order.items as item (item.id)}
								<div
									class="grid gap-4 rounded-[18px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center"
								>
									<div
										class="flex aspect-square items-center justify-center rounded-[14px] bg-white p-3"
									>
										<img
											src={item.image}
											alt={item.title}
											class="max-h-full w-full object-contain"
										/>
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
					</article>

					<article
						class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card"
					>
						<div class="flex items-start gap-3">
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-black)] text-[var(--heat-100)]"
							>
								<Truck class="size-5" strokeWidth={2} />
							</div>
							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Fulfillment
								</p>
								<h2 class="text-title-h5 text-foreground">Shipment status</h2>
							</div>
						</div>

						<div class="mt-5 grid gap-3 md:grid-cols-3">
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									Courier
								</p>
								<p class="text-label-medium mt-2 text-foreground">{courierLabel}</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									AWB
								</p>
								<p class="text-label-medium mt-2 text-foreground">{awbLabel}</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									Expected
								</p>
								<p class="text-label-medium mt-2 text-foreground">
									{order.shipment?.expectedDeliveryDate ?? 'After dispatch'}
								</p>
							</div>
						</div>
					</article>
				</div>

				<aside class="sticky top-24 h-fit space-y-4">
					<div class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Summary
								</p>
								<h2 class="text-title-h5 mt-2 text-foreground">Order state</h2>
							</div>
							<div
								class="flex size-10 items-center justify-center rounded-[14px] bg-[var(--heat-8)] text-[var(--heat-100)]"
							>
								<Hash class="size-5" strokeWidth={2} />
							</div>
						</div>

						<div class="text-body-small mt-5 space-y-3 text-[var(--black-alpha-64)]">
							<div class="flex items-center justify-between gap-4">
								<span>Total</span>
								<span class="text-foreground">{formatINR(order.total)}</span>
							</div>
							<div class="flex items-center justify-between gap-4">
								<span>Payment method</span>
								<span class="text-foreground">{formatStatusLabel(order.paymentMethod)}</span>
							</div>
							<div class="flex items-center justify-between gap-4">
								<span>Payment status</span>
								<span class={`rounded-full border px-2 py-1 ${statusTone(order.paymentStatus)}`}>
									{paymentStatusLabel}
								</span>
							</div>
							<div class="flex items-center justify-between gap-4">
								<span>Shipping</span>
								<span class="text-foreground">{formatINR(order.shipping)}</span>
							</div>
						</div>

						{#if trackingMessage}
							<p
								class={`text-body-small mt-4 flex items-start gap-2 rounded-[14px] border px-4 py-3 ${
									trackingMessageTone === 'error'
										? 'border-red-200 bg-red-50 text-red-700'
										: 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
								}`}
							>
								<CheckCircle2 class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
								<span>{trackingMessage}</span>
							</p>
						{/if}

						<button
							type="button"
							class="motion-press text-label-medium mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:cursor-not-allowed disabled:opacity-60"
							onclick={refreshTracking}
							disabled={!order.shipment || trackingRefreshing}
						>
							<RefreshCw
								class={`size-4 ${trackingRefreshing ? 'animate-spin' : ''}`}
								strokeWidth={2}
							/>
							{trackingRefreshing ? 'Refreshing' : 'Refresh tracking'}
						</button>
						{#if order.shipment?.trackingUrl}
							<button
								type="button"
								class="motion-soft-link text-label-medium mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
								onclick={() => openTrackingUrl(order.shipment?.trackingUrl)}
							>
								Open carrier tracking
								<ExternalLink class="size-4" strokeWidth={2} />
							</button>
						{/if}
					</div>

					<div class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card">
						<div class="flex items-center gap-3">
							<div
								class="flex size-10 items-center justify-center rounded-[14px] bg-[var(--heat-8)] text-[var(--heat-100)]"
							>
								<MapPin class="size-5" strokeWidth={2} />
							</div>
							<div>
								<p class="text-label-large text-foreground">Delivery address</p>
								<p class="text-body-small text-[var(--black-alpha-56)]">
									Locked from checkout snapshot
								</p>
							</div>
						</div>
						<div
							class="mt-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
						>
							<p class="text-label-small text-foreground">{order.shippingName || 'Customer'}</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-64)]">
								{shippingLocation || 'Address pending'}
							</p>
						</div>
					</div>

					<div class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card">
						<div class="flex items-center gap-3">
							<div
								class="flex size-10 items-center justify-center rounded-[14px] bg-[var(--heat-8)] text-[var(--heat-100)]"
							>
								<CreditCard class="size-5" strokeWidth={2} />
							</div>
							<div>
								<p class="text-label-large text-foreground">Payment evidence</p>
								<p class="text-body-small text-[var(--black-alpha-56)]">
									{order.payment?.provider ?? 'Provider pending'}
								</p>
							</div>
						</div>
						<div
							class="mt-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
						>
							<div class="flex items-center justify-between gap-4">
								<span class="text-body-small text-[var(--black-alpha-56)]">Amount</span>
								<span class="text-label-small text-foreground">
									{formatINR(order.payment?.amount ?? order.total)}
								</span>
							</div>
							<div class="mt-3 flex items-center justify-between gap-4">
								<span class="text-body-small text-[var(--black-alpha-56)]">Updated</span>
								<span class="text-label-small text-foreground">
									{new Date(order.updatedAt).toLocaleString('en-IN')}
								</span>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	{:else}
		<div class="rounded-[18px] border border-red-200 bg-red-50 p-5 text-red-700">
			<div class="flex gap-3">
				<CalendarClock class="mt-1 size-5 shrink-0" strokeWidth={2} />
				<p class="text-body-medium">Order not found</p>
			</div>
		</div>
	{/if}
</section>
