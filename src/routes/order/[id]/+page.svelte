<script lang="ts">
	import { resolve } from '$app/paths';
	import { apiBase } from '$lib/api-base';
	import { formatINR } from '$lib/catalog';
	import type { OrderSummary } from '$lib/orders';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
	import {
		ArrowLeft,
		CalendarClock,
		Check,
		ChevronRight,
		CircleDashed,
		Copy,
		CreditCard,
		ExternalLink,
		MapPin,
		Package,
		ReceiptText,
		RefreshCw,
		ShieldCheck,
		Truck
	} from '@lucide/svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	type TimelineStep = {
		key: string;
		label: string;
		detail: string;
		state: 'complete' | 'active' | 'waiting' | 'problem';
	};

	type DetailPair = {
		label: string;
		value: string;
	};

	let { data }: { data: { order: OrderSummary } } = $props();
	let order = $derived(data.order);
	let trackingMessage = $state<string | null>(null);
	let trackingRefreshing = $state(false);
	let trackingMessageTone = $state<'info' | 'error'>('info');
	let copiedOrderId = $state(false);

	const shortOrderId = $derived(order ? order.id.slice(0, 8).toUpperCase() : '');
	const orderStatusLabel = $derived(order ? formatStatusLabel(order.status) : '');
	const paymentStatusLabel = $derived(order ? formatStatusLabel(order.paymentStatus) : '');
	const shipmentStatusLabel = $derived(
		order?.shipment?.status ? formatStatusLabel(order.shipment.status) : 'Waiting for dispatch'
	);
	const courierLabel = $derived(order?.shipment?.courierName || 'Courier pending');
	const awbLabel = $derived(order?.shipment?.awbCode || 'Not assigned yet');
	const itemCount = $derived(order ? order.items.reduce((sum, item) => sum + item.qty, 0) : 0);
	const subtotal = $derived(
		order ? order.items.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.qty ?? 0), 0) : 0
	);
	const addressLines = $derived(
		order
			? [
					order.shippingName || 'Customer',
					[order.shippingCity, order.shippingState].filter(Boolean).join(', '),
					order.shippingPincode
				].filter(Boolean)
			: []
	);
	const timeline = $derived(order ? buildTimeline(order) : []);
	const primaryActionLabel = $derived(
		order?.shipment?.trackingUrl
			? 'Open carrier tracking'
			: order?.shipment
				? 'Refresh tracking'
				: 'Waiting for shipment'
	);
	const paymentDetails = $derived<DetailPair[]>(
		order
			? [
					{ label: 'Method', value: formatStatusLabel(order.paymentMethod) },
					{ label: 'Status', value: paymentStatusLabel },
					{ label: 'Provider', value: order.payment?.provider ?? 'Pending' },
					{
						label: 'Reference',
						value: order.payment?.providerPaymentId ?? order.payment?.providerOrderId ?? 'Not available'
					}
				]
			: []
	);
	const shippingDetails = $derived<DetailPair[]>(
		order
			? [
					{ label: 'Service', value: formatStatusLabel(order.shippingServiceType) },
					{ label: 'Courier', value: courierLabel },
					{ label: 'AWB', value: awbLabel },
					{ label: 'ETA', value: order.shipment?.expectedDeliveryDate ?? 'After dispatch' }
				]
			: []
	);

	function formatStatusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	function isComplete(status: string, matches: string[]) {
		return matches.includes(status.toLowerCase());
	}

	function buildTimeline(currentOrder: OrderSummary): TimelineStep[] {
		const orderStatus = currentOrder.status.toLowerCase();
		const paymentStatus = currentOrder.paymentStatus.toLowerCase();
		const shipmentStatus = currentOrder.shipment?.status?.toLowerCase() ?? '';
		const hasShipment = Boolean(currentOrder.shipment);
		const delivered = orderStatus === 'delivered' || shipmentStatus === 'delivered';
		const failed = ['cancelled', 'failed', 'payment_failed', 'refunded', 'returned'].includes(orderStatus);

		return [
			{
				key: 'placed',
				label: 'Order placed',
				detail: new Date(currentOrder.createdAt).toLocaleDateString('en-IN', {
					day: '2-digit',
					month: 'short',
					year: 'numeric'
				}),
				state: 'complete'
			},
			{
				key: 'paid',
				label: 'Payment checked',
				detail: formatStatusLabel(currentOrder.paymentStatus),
				state: isComplete(paymentStatus, ['paid', 'captured', 'verified']) ? 'complete' : failed ? 'problem' : 'active'
			},
			{
				key: 'packed',
				label: 'Packed for courier',
				detail: hasShipment ? courierLabel : 'Operations will assign a courier',
				state: hasShipment ? 'complete' : failed ? 'problem' : 'active'
			},
			{
				key: 'transit',
				label: 'In transit',
				detail: hasShipment ? shipmentStatusLabel : 'Tracking appears after AWB',
				state: delivered ? 'complete' : hasShipment ? 'active' : 'waiting'
			},
			{
				key: 'delivered',
				label: 'Delivered',
				detail: delivered ? 'Package delivered' : 'Final handoff pending',
				state: delivered ? 'complete' : failed ? 'problem' : 'waiting'
			}
		];
	}

	function statusTone(status: string) {
		const normalized = status.toLowerCase();
		if (['delivered', 'paid', 'captured', 'verified'].includes(normalized)) {
			return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		}
		if (['cancelled', 'failed', 'payment_failed', 'refunded', 'returned'].includes(normalized)) {
			return 'border-red-200 bg-red-50 text-red-700';
		}
		if (['pending_payment', 'pending', 'cod_pending', 'processing'].includes(normalized)) {
			return 'border-amber-200 bg-amber-50 text-amber-700';
		}
		return 'border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]';
	}

	function stepClasses(state: TimelineStep['state']) {
		if (state === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
		if (state === 'active') return 'border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]';
		if (state === 'problem') return 'border-red-200 bg-red-50 text-red-700';
		return 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-48)]';
	}

	function stepIcon(state: TimelineStep['state']) {
		if (state === 'complete') return Check;
		if (state === 'active') return CircleDashed;
		return CalendarClock;
	}

	async function copyOrderId() {
		if (!order) return;
		try {
			await navigator.clipboard.writeText(order.id);
			copiedOrderId = true;
			window.setTimeout(() => {
				copiedOrderId = false;
			}, 1400);
		} catch {
			copiedOrderId = false;
		}
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

	function handlePrimaryAction() {
		if (order?.shipment?.trackingUrl) {
			openTrackingUrl(order.shipment.trackingUrl);
			return;
		}
		void refreshTracking();
	}

	function openTrackingUrl(url: string | null | undefined) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>Order #{shortOrderId || 'detail'} - lapkart</title>
</svelte:head>

{#snippet statusPill(label: string, status: string)}
	<span
		class={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase ${statusTone(status)}`}
	>
		{label}
	</span>
{/snippet}

{#snippet detailGrid(title: string, icon: typeof Package, details: DetailPair[])}
	{@const Icon = icon}
	<section class="order-panel p-4 sm:p-5" in:fly={{ y: 12, duration: 360, easing: cubicOut }}>
		<div class="mb-4 flex items-center gap-3">
			<div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
				<Icon class="size-4" strokeWidth={2} />
			</div>
			<h2 class="text-[15px] font-semibold text-foreground">{title}</h2>
		</div>
		<div class="grid gap-2 sm:grid-cols-2">
			{#each details as detail (detail.label)}
				<div class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
					<p class="text-[10px] font-medium tracking-[0.12em] text-[var(--black-alpha-40)] uppercase">
						{detail.label}
					</p>
					<p class="mt-1 text-[13px] font-medium text-foreground">{detail.value}</p>
				</div>
			{/each}
		</div>
	</section>
{/snippet}

<section class="order-page mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
	{#if order}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
			<div class="min-w-0 space-y-5">
				<header class="order-hero overflow-hidden" in:fly={{ y: 14, duration: 420, easing: cubicOut }}>
					<div class="order-hero-grid absolute inset-0 opacity-60"></div>
					<div class="relative p-4 sm:p-6 lg:p-7">
						<a
							href={resolve('/orders')}
							class="mb-6 inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border-faint)] bg-white/80 px-3 text-[13px] font-medium text-[var(--black-alpha-56)] shadow-sm backdrop-blur transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						>
							<ArrowLeft class="size-4" strokeWidth={2} />
							Orders
						</a>

						<div class="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
							<div class="min-w-0">
								<p class="text-[11px] font-semibold tracking-[0.16em] text-[var(--heat-100)] uppercase">
									Live order record
								</p>
								<div class="mt-2 flex flex-wrap items-center gap-2">
									<h1 class="text-[30px] font-semibold tracking-tight text-foreground sm:text-[40px]">
										#{shortOrderId}
									</h1>
									<button
										type="button"
										class="inline-flex size-9 items-center justify-center rounded-full border border-[var(--border-faint)] bg-white text-[var(--black-alpha-48)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={copyOrderId}
										aria-label="Copy full order ID"
									>
										<Copy class="size-4" strokeWidth={2} />
									</button>
								</div>
								<p class="mt-2 max-w-2xl text-[14px] leading-6 text-[var(--black-alpha-56)]">
									Placed {new Date(order.createdAt).toLocaleString('en-IN')}. We keep checkout
									items, payment evidence, and courier state together so this page is easy to scan.
								</p>
								{#if copiedOrderId}
									<p class="mt-2 text-[12px] font-medium text-[var(--heat-100)]" transition:fade>
										Full order ID copied
									</p>
								{/if}
							</div>

							<div class="grid min-w-[220px] gap-2 rounded-lg border border-[var(--border-faint)] bg-white/86 p-3 shadow-sm backdrop-blur">
								<div class="flex items-center justify-between gap-4">
									<span class="text-[11px] tracking-[0.12em] text-[var(--black-alpha-40)] uppercase">
										Total
									</span>
									<span class="text-[22px] font-semibold text-foreground">{formatINR(order.total)}</span>
								</div>
								<div class="flex flex-wrap gap-2">
									{@render statusPill(orderStatusLabel, order.status)}
									{@render statusPill(paymentStatusLabel, order.paymentStatus)}
								</div>
							</div>
						</div>
					</div>
				</header>

				<section class="order-panel p-4 sm:p-5" in:fly={{ y: 12, duration: 420, delay: 70, easing: cubicOut }}>
					<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
						<div>
							<p class="text-[11px] font-semibold tracking-[0.16em] text-[var(--black-alpha-40)] uppercase">
								Progress
							</p>
							<h2 class="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
								Delivery timeline
							</h2>
						</div>
						<div class="rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-1.5 text-[12px] font-medium text-[var(--black-alpha-56)]">
							{shipmentStatusLabel}
						</div>
					</div>

					<div class="timeline-grid">
						{#each timeline as step, index (step.key)}
							{@const Icon = stepIcon(step.state)}
							<div class="timeline-step" in:fly={{ y: 10, duration: 360, delay: 80 + index * 45, easing: cubicOut }}>
								<div class={`timeline-dot ${stepClasses(step.state)}`}>
									<Icon class="size-4" strokeWidth={2} />
								</div>
								{#if index < timeline.length - 1}
									<div class="timeline-line" class:complete={step.state === 'complete'}></div>
								{/if}
								<div class="pt-3">
									<p class="text-[13px] font-semibold text-foreground">{step.label}</p>
									<p class="mt-1 text-[12px] leading-5 text-[var(--black-alpha-48)]">{step.detail}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<section class="order-panel overflow-hidden" in:fly={{ y: 12, duration: 420, delay: 120, easing: cubicOut }}>
					<div class="flex items-center justify-between gap-3 border-b border-[var(--border-faint)] bg-white p-4 sm:p-5">
						<div class="flex items-center gap-3">
							<div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-black)] text-[var(--heat-100)]">
								<Package class="size-4" strokeWidth={2} />
							</div>
							<div>
								<h2 class="text-[15px] font-semibold text-foreground">Items in this order</h2>
								<p class="text-[12px] text-[var(--black-alpha-48)]">{itemCount} item{itemCount === 1 ? '' : 's'} captured at checkout</p>
							</div>
						</div>
					</div>

					<div class="divide-y divide-[var(--border-faint)]">
						{#each order.items as item, index (item.id)}
							<div
								class="grid gap-3 p-4 transition-colors hover:bg-[var(--background-lighter)] sm:grid-cols-[72px_1fr_auto] sm:items-center sm:p-5"
								in:fly={{ y: 10, duration: 320, delay: 160 + index * 35, easing: cubicOut }}
							>
								<div class="flex aspect-square items-center justify-center rounded-md border border-[var(--border-faint)] bg-white p-2">
									<img src={item.image} alt={item.title} class="max-h-full w-full object-contain" loading="lazy" />
								</div>
								<div class="min-w-0">
									<p class="line-clamp-2 text-[14px] font-semibold leading-5 text-foreground">{item.title}</p>
									<div class="mt-2 flex flex-wrap gap-2 text-[12px] text-[var(--black-alpha-48)]">
										<span>{item.brand || 'LapKart part'}</span>
										<span>Qty {item.qty}</span>
									</div>
								</div>
								<div class="flex items-center justify-between gap-4 sm:block sm:text-right">
									<span class="text-[12px] text-[var(--black-alpha-40)] sm:hidden">Line total</span>
									<p class="text-[14px] font-semibold text-foreground">{formatINR(item.price * item.qty)}</p>
									<p class="mt-1 hidden text-[12px] text-[var(--black-alpha-48)] sm:block">
										{formatINR(item.price)} each
									</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<div class="grid gap-5 xl:grid-cols-2">
					{@render detailGrid('Shipping details', Truck, shippingDetails)}
					{@render detailGrid('Payment details', CreditCard, paymentDetails)}
				</div>
			</div>

			<aside class="space-y-4 lg:sticky lg:top-24 lg:h-fit" in:fly={{ x: 16, duration: 420, delay: 140, easing: cubicOut }}>
				<div class="order-panel p-4 sm:p-5">
					<div class="mb-5 flex items-start justify-between gap-4">
						<div>
							<p class="text-[11px] font-semibold tracking-[0.16em] text-[var(--black-alpha-40)] uppercase">
								Next action
							</p>
							<h2 class="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
								{primaryActionLabel}
							</h2>
						</div>
						<div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
							<Truck class="size-5" strokeWidth={2} />
						</div>
					</div>

					<button
						type="button"
						class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--heat-100)] px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
						onclick={handlePrimaryAction}
						disabled={!order.shipment || trackingRefreshing}
					>
						{#if order.shipment?.trackingUrl}
							<ExternalLink class="size-4" strokeWidth={2} />
						{:else}
							<RefreshCw class={`size-4 ${trackingRefreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
						{/if}
						{trackingRefreshing ? 'Refreshing' : primaryActionLabel}
					</button>

					{#if trackingMessage}
						<p
							class={`mt-3 rounded-md border px-3 py-2 text-[12px] leading-5 ${
								trackingMessageTone === 'error'
									? 'border-red-200 bg-red-50 text-red-700'
									: 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
							}`}
							transition:fade
						>
							{trackingMessage}
						</p>
					{/if}
				</div>

				<div class="order-panel p-4 sm:p-5">
					<div class="mb-4 flex items-center gap-3">
						<div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
							<ReceiptText class="size-4" strokeWidth={2} />
						</div>
						<h2 class="text-[15px] font-semibold text-foreground">Cost summary</h2>
					</div>
					<div class="space-y-3 text-[13px]">
						<div class="flex items-center justify-between gap-4 text-[var(--black-alpha-56)]">
							<span>Subtotal</span>
							<span class="font-medium text-foreground">{formatINR(subtotal)}</span>
						</div>
						<div class="flex items-center justify-between gap-4 text-[var(--black-alpha-56)]">
							<span>Shipping</span>
							<span class="font-medium text-foreground">{formatINR(order.shipping)}</span>
						</div>
						<div class="border-t border-[var(--border-faint)] pt-3">
							<div class="flex items-center justify-between gap-4">
								<span class="font-semibold text-foreground">Paid total</span>
								<span class="text-[18px] font-semibold text-foreground">{formatINR(order.total)}</span>
							</div>
						</div>
					</div>
				</div>

				<div class="order-panel p-4 sm:p-5">
					<div class="mb-4 flex items-center gap-3">
						<div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
							<MapPin class="size-4" strokeWidth={2} />
						</div>
						<h2 class="text-[15px] font-semibold text-foreground">Delivery address</h2>
					</div>
					<div class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
						{#each addressLines as line (line)}
							<p class="text-[13px] leading-6 text-foreground">{line}</p>
						{/each}
						{#if addressLines.length === 0}
							<p class="text-[13px] text-[var(--black-alpha-48)]">Address pending</p>
						{/if}
					</div>
				</div>

				<div class="rounded-md border border-[var(--heat-16)] bg-[var(--heat-4)] p-4 text-[13px] leading-6 text-[var(--black-alpha-64)]">
					<div class="mb-2 flex items-center gap-2 font-semibold text-foreground">
						<ShieldCheck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
						Protected order record
					</div>
					This page shows the saved checkout snapshot. If fulfillment changes, refresh tracking to pull the newest courier state.
				</div>
			</aside>
		</div>
	{:else}
		<div class="order-panel p-5 text-red-700" transition:fade>
			<div class="flex gap-3">
				<CalendarClock class="mt-1 size-5 shrink-0" strokeWidth={2} />
				<div>
					<p class="font-semibold">Order not found</p>
					<a href={resolve('/orders')} class="mt-2 inline-flex items-center gap-1 text-[13px] text-[var(--heat-100)]">
						Back to orders
						<ChevronRight class="size-4" strokeWidth={2} />
					</a>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.order-page {
		--order-border: var(--border-faint);
	}

	.order-hero,
	.order-panel {
		border: 1px solid var(--order-border);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 18px 60px rgba(38, 38, 38, 0.06);
	}

	.order-hero {
		position: relative;
		background:
			linear-gradient(135deg, rgba(250, 93, 25, 0.1), rgba(255, 255, 255, 0) 36%),
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 249, 0.98));
	}

	.order-hero-grid {
		background-image:
			linear-gradient(rgba(38, 38, 38, 0.045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(38, 38, 38, 0.045) 1px, transparent 1px);
		background-size: 28px 28px;
		mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.8), transparent 75%);
	}

	.timeline-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0;
	}

	.timeline-step {
		position: relative;
		min-width: 0;
		padding-right: 14px;
	}

	.timeline-dot {
		position: relative;
		z-index: 1;
		display: flex;
		width: 38px;
		height: 38px;
		align-items: center;
		justify-content: center;
		border-width: 1px;
		border-style: solid;
		border-radius: 999px;
	}

	.timeline-line {
		position: absolute;
		top: 18px;
		left: 38px;
		right: 0;
		height: 1px;
		background: var(--border-faint);
	}

	.timeline-line.complete {
		background: color-mix(in srgb, var(--heat-100) 46%, transparent);
	}

	@media (max-width: 767px) {
		.timeline-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.timeline-step {
			display: grid;
			grid-template-columns: 38px 1fr;
			gap: 12px;
			padding-right: 0;
		}

		.timeline-step .pt-3 {
			padding-top: 0;
		}

		.timeline-line {
			top: 38px;
			bottom: -12px;
			left: 18px;
			right: auto;
			width: 1px;
			height: auto;
		}
	}
</style>
