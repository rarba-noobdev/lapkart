<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { apiBase } from '$lib/api-base';
	import { getAuthContext } from '$lib/auth-context';
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
	import { onMount } from 'svelte';
	import { cubicOut, quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';

	type TimelineStep = {
		key: string;
		label: string;
		detail: string;
		state: 'complete' | 'active' | 'waiting' | 'problem';
	};

	type DetailPair = { label: string; value: string };
	type OrderRealtimePatch = {
		id: string;
		status?: string;
		paymentStatus?: string;
		updatedAt?: string;
	};

	let { data }: { data: { order: OrderSummary } } = $props();
	let realtimeOrderPatch = $state<OrderRealtimePatch | null>(null);
	let order = $derived.by(() => {
		if (!realtimeOrderPatch || realtimeOrderPatch.id !== data.order.id) return data.order;
		return {
			...data.order,
			...realtimeOrderPatch
		};
	});
	const auth = getAuthContext();
	let trackingMessage = $state<string | null>(null);
	let trackingRefreshing = $state(false);
	let trackingMessageTone = $state<'info' | 'error'>('info');
	let copiedOrderId = $state(false);

	const shortOrderId = $derived(order ? order.id.slice(0, 8).toUpperCase() : '');
	const orderStatusLabel = $derived(order ? formatStatusLabel(order.status) : '');
	const paymentStatusLabel = $derived(order ? formatStatusLabel(order.paymentStatus) : '');
	const shipmentStatusLabel = $derived(
		order?.shipment?.status ? formatStatusLabel(order.shipment.status) : 'Awaiting dispatch'
	);
	const courierLabel = $derived(order?.shipment?.courierName || 'Courier pending');
	const awbLabel = $derived(order?.shipment?.awbCode || 'Not assigned');
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
			? 'Track shipment'
			: order?.shipment
				? 'Refresh tracking'
				: 'Awaiting shipment'
	);
	const paymentDetails = $derived<DetailPair[]>(
		order
			? [
					{ label: 'Method', value: formatStatusLabel(order.paymentMethod) },
					{ label: 'Status', value: paymentStatusLabel },
					{ label: 'Provider', value: order.payment?.provider ?? 'Pending' },
					{
						label: 'Reference',
						value: order.payment?.providerPaymentId ?? order.payment?.providerOrderId ?? 'N/A'
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
				label: 'Payment verified',
				detail: formatStatusLabel(currentOrder.paymentStatus),
				state: isComplete(paymentStatus, ['paid', 'captured', 'verified']) ? 'complete' : failed ? 'problem' : 'active'
			},
			{
				key: 'packed',
				label: 'Packed',
				detail: hasShipment ? courierLabel : 'Awaiting courier',
				state: hasShipment ? 'complete' : failed ? 'problem' : 'active'
			},
			{
				key: 'transit',
				label: 'In transit',
				detail: hasShipment ? shipmentStatusLabel : 'Pending AWB',
				state: delivered ? 'complete' : hasShipment ? 'active' : 'waiting'
			},
			{
				key: 'delivered',
				label: 'Delivered',
				detail: delivered ? 'Package delivered' : 'Pending',
				state: delivered ? 'complete' : failed ? 'problem' : 'waiting'
			}
		];
	}

	function statusTone(status: string): string {
		const normalized = status.toLowerCase();
		if (['delivered', 'paid', 'captured', 'verified'].includes(normalized))
			return 'tone-success';
		if (['cancelled', 'failed', 'payment_failed', 'refunded', 'returned'].includes(normalized))
			return 'tone-danger';
		if (['pending_payment', 'pending', 'cod_pending', 'processing'].includes(normalized))
			return 'tone-warning';
		return 'tone-heat';
	}

	function stepTone(state: TimelineStep['state']): string {
		if (state === 'complete') return 'tone-success';
		if (state === 'active') return 'tone-heat';
		if (state === 'problem') return 'tone-danger';
		return 'tone-muted';
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
			void invalidate(`order:${order.id}`);
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
			window.open(order.shipment.trackingUrl, '_blank', 'noopener,noreferrer');
			return;
		}
		void refreshTracking();
	}

	function applyRealtimeOrderRow(row: Record<string, unknown>) {
		if (row.id !== data.order.id) return;
		const currentOrder = order;

		realtimeOrderPatch = {
			id: data.order.id,
			status: typeof row.status === 'string' ? row.status : currentOrder.status,
			paymentStatus:
				typeof row.payment_status === 'string' ? row.payment_status : currentOrder.paymentStatus,
			updatedAt: typeof row.updated_at === 'string' ? row.updated_at : currentOrder.updatedAt
		};
	}

	onMount(() => {
		const orderId = order?.id;
		if (!orderId) return;

		let refreshTimer: number | null = null;
		let fallbackTimer: number | null = null;
		let subscriptionWatchdog: number | null = null;
		let subscribed = false;
		const refreshOrder = () => {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(() => {
				refreshTimer = null;
				void invalidate(`order:${orderId}`);
			}, 250);
		};
		const stopFallbackRefresh = () => {
			if (!fallbackTimer) return;
			window.clearInterval(fallbackTimer);
			fallbackTimer = null;
		};
		const startFallbackRefresh = () => {
			if (fallbackTimer) return;
			fallbackTimer = window.setInterval(() => {
				if (!document.hidden) refreshOrder();
			}, 15000);
		};
		const handleVisibilityRefresh = () => {
			if (!document.hidden) refreshOrder();
		};

		const channel = auth.supabase
			.channel(`order:${orderId}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
				(payload) => {
					if (payload.eventType !== 'DELETE' && payload.new) {
						applyRealtimeOrderRow(payload.new as Record<string, unknown>);
					}
					refreshOrder();
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` },
				refreshOrder
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'payments', filter: `order_id=eq.${orderId}` },
				refreshOrder
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipments', filter: `order_id=eq.${orderId}` },
				refreshOrder
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					subscribed = true;
					stopFallbackRefresh();
					return;
				}
				if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
					startFallbackRefresh();
				}
			});

		window.addEventListener('focus', refreshOrder);
		document.addEventListener('visibilitychange', handleVisibilityRefresh);
		subscriptionWatchdog = window.setTimeout(() => {
			if (!subscribed) startFallbackRefresh();
		}, 3500);

		return () => {
			if (refreshTimer) window.clearTimeout(refreshTimer);
			if (subscriptionWatchdog) window.clearTimeout(subscriptionWatchdog);
			stopFallbackRefresh();
			window.removeEventListener('focus', refreshOrder);
			document.removeEventListener('visibilitychange', handleVisibilityRefresh);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Order #{shortOrderId || 'detail'} - lapkart</title>
</svelte:head>

{#snippet statusPill(label: string, status: string)}
	<span class={`status-pill ${statusTone(status)}`}>
		{label}
	</span>
{/snippet}

{#snippet detailGrid(title: string, icon: typeof Package, details: DetailPair[], delay: number)}
	{@const Icon = icon}
	<section class="panel" in:fly={{ y: 10, duration: 380, delay, easing: quintOut }}>
		<div class="mb-3 flex items-center gap-2.5">
			<div class="icon-box">
				<Icon class="size-3.5" strokeWidth={2} />
			</div>
			<h2 class="text-[13px] font-semibold text-foreground">{title}</h2>
		</div>
		<div class="grid gap-1.5 sm:grid-cols-2">
			{#each details as detail (detail.label)}
				<div class="detail-cell">
					<p class="text-[9px] font-semibold tracking-[0.14em] text-[var(--black-alpha-40)] uppercase">
						{detail.label}
					</p>
					<p class="mt-0.5 text-[12px] font-medium text-foreground">{detail.value}</p>
				</div>
			{/each}
		</div>
	</section>
{/snippet}

<section class="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
	{#if order}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
			<!-- Main Column -->
			<div class="min-w-0 space-y-4">
				<!-- Hero -->
				<header class="hero" in:fly={{ y: 12, duration: 400, easing: quintOut }}>
					<div class="hero-grain"></div>
					<div class="relative p-4 sm:p-5">
						<a
							href={resolve('/orders')}
							class="back-link"
						>
							<ArrowLeft class="size-3.5" strokeWidth={2} />
							Orders
						</a>

						<div class="mt-4 flex flex-wrap items-end justify-between gap-4">
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<h1 class="text-[28px] font-bold tracking-tight text-foreground sm:text-[34px]">
										#{shortOrderId}
									</h1>
									<button
										type="button"
										class="copy-btn"
										onclick={copyOrderId}
										aria-label="Copy full order ID"
									>
										<Copy class="size-3.5" strokeWidth={2} />
									</button>
								</div>
								{#if copiedOrderId}
									<p class="mt-1 text-[11px] font-medium text-[var(--heat-100)]" transition:fade={{ duration: 200 }}>
										Copied
									</p>
								{/if}
								<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">
									{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
								</p>
							</div>

							<div class="flex flex-wrap items-center gap-3">
								<div class="flex flex-wrap gap-1.5">
									{@render statusPill(orderStatusLabel, order.status)}
									{@render statusPill(paymentStatusLabel, order.paymentStatus)}
								</div>
								<span class="text-[22px] font-bold text-foreground">{formatINR(order.total)}</span>
							</div>
						</div>
					</div>
				</header>

				<!-- Timeline -->
				<section class="panel p-4 sm:p-5" in:fly={{ y: 10, duration: 400, delay: 60, easing: quintOut }}>
					<div class="mb-4 flex items-center justify-between gap-3">
						<h2 class="text-[13px] font-semibold text-foreground">Delivery timeline</h2>
						<span class="rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-2.5 py-1 text-[10px] font-medium text-[var(--black-alpha-48)]">
							{shipmentStatusLabel}
						</span>
					</div>

					<div class="tl-grid">
						{#each timeline as step, index (step.key)}
							{@const Icon = stepIcon(step.state)}
							<div class="tl-step" in:fly={{ y: 8, duration: 340, delay: 80 + index * 50, easing: quintOut }}>
								<div class={`tl-dot ${stepTone(step.state)}`}>
									<Icon class="size-3.5" strokeWidth={2.5} />
								</div>
								{#if index < timeline.length - 1}
									<div class="tl-line" class:complete={step.state === 'complete'}></div>
								{/if}
								<div class="tl-text">
									<p class="text-[12px] font-semibold text-foreground">{step.label}</p>
									<p class="text-[11px] text-[var(--black-alpha-48)]">{step.detail}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Items -->
				<section class="panel overflow-hidden" in:fly={{ y: 10, duration: 400, delay: 100, easing: quintOut }}>
					<div class="flex items-center gap-2.5 border-b border-[var(--border-faint)] px-4 py-3">
						<div class="icon-box">
							<Package class="size-3.5" strokeWidth={2} />
						</div>
						<h2 class="text-[13px] font-semibold text-foreground">
							{itemCount} item{itemCount === 1 ? '' : 's'}
						</h2>
					</div>

					<div class="divide-y divide-[var(--border-faint)]">
						{#each order.items as item, index (item.id)}
							<div
								class="item-row"
								in:fly={{ y: 8, duration: 300, delay: 130 + index * 40, easing: quintOut }}
							>
								<div class="item-img">
									<img src={item.image} alt={item.title} class="max-h-full w-full object-contain" loading="lazy" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="line-clamp-2 text-[13px] font-semibold leading-5 text-foreground">{item.title}</p>
									<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
										{item.brand || 'LapKart'} &middot; Qty {item.qty}
									</p>
								</div>
								<div class="text-right">
									<p class="text-[13px] font-semibold text-foreground">{formatINR(item.price * item.qty)}</p>
									{#if item.qty > 1}
										<p class="text-[11px] text-[var(--black-alpha-40)]">{formatINR(item.price)} ea</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Shipping + Payment -->
				<div class="grid gap-4 xl:grid-cols-2">
					{@render detailGrid('Shipping', Truck, shippingDetails, 140)}
					{@render detailGrid('Payment', CreditCard, paymentDetails, 170)}
				</div>
			</div>

			<!-- Sidebar -->
			<aside class="space-y-3 lg:sticky lg:top-20 lg:h-fit" in:fly={{ x: 14, duration: 420, delay: 80, easing: quintOut }}>
				<!-- Primary Action -->
				<div class="panel p-4">
					<div class="mb-3 flex items-center justify-between gap-3">
						<h2 class="text-[13px] font-semibold text-foreground">{primaryActionLabel}</h2>
						<div class="icon-box">
							<Truck class="size-3.5" strokeWidth={2} />
						</div>
					</div>

					<button
						type="button"
						class="primary-action-btn"
						onclick={handlePrimaryAction}
						disabled={!order.shipment || trackingRefreshing}
					>
						{#if order.shipment?.trackingUrl}
							<ExternalLink class="size-4" strokeWidth={2} />
						{:else}
							<RefreshCw class={`size-4 ${trackingRefreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
						{/if}
						{trackingRefreshing ? 'Refreshing...' : primaryActionLabel}
					</button>

					{#if trackingMessage}
						<p
							class={`tracking-msg ${trackingMessageTone === 'error' ? 'tone-danger' : 'tone-heat'}`}
							transition:fade={{ duration: 200 }}
						>
							{trackingMessage}
						</p>
					{/if}
				</div>

				<!-- Cost Summary -->
				<div class="panel p-4">
					<div class="mb-3 flex items-center gap-2.5">
						<div class="icon-box">
							<ReceiptText class="size-3.5" strokeWidth={2} />
						</div>
						<h2 class="text-[13px] font-semibold text-foreground">Summary</h2>
					</div>
					<div class="space-y-2 text-[12px]">
						<div class="flex justify-between text-[var(--black-alpha-48)]">
							<span>Subtotal</span>
							<span class="font-medium text-foreground">{formatINR(subtotal)}</span>
						</div>
						<div class="flex justify-between text-[var(--black-alpha-48)]">
							<span>Shipping</span>
							<span class="font-medium text-foreground">{formatINR(order.shipping)}</span>
						</div>
						<div class="flex justify-between border-t border-[var(--border-faint)] pt-2">
							<span class="font-semibold text-foreground">Total</span>
							<span class="text-[16px] font-bold text-foreground">{formatINR(order.total)}</span>
						</div>
					</div>
				</div>

				<!-- Address -->
				<div class="panel p-4">
					<div class="mb-3 flex items-center gap-2.5">
						<div class="icon-box">
							<MapPin class="size-3.5" strokeWidth={2} />
						</div>
						<h2 class="text-[13px] font-semibold text-foreground">Delivery address</h2>
					</div>
					<div class="detail-cell">
						{#each addressLines as line (line)}
							<p class="text-[12px] leading-5 text-foreground">{line}</p>
						{/each}
						{#if addressLines.length === 0}
							<p class="text-[12px] text-[var(--black-alpha-48)]">Address pending</p>
						{/if}
					</div>
				</div>

				<!-- Trust footer -->
				<div class="trust-footer">
					<ShieldCheck class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2} />
					<p>
						<span class="font-semibold text-foreground">Protected record.</span>
						Refresh tracking to pull latest courier state.
					</p>
				</div>
			</aside>
		</div>
	{:else}
		<div class="panel p-5" transition:fade>
			<div class="flex items-center gap-3 text-[var(--accent-crimson)]">
				<CalendarClock class="size-5 shrink-0" strokeWidth={2} />
				<div>
					<p class="text-[14px] font-semibold">Order not found</p>
					<a href={resolve('/orders')} class="mt-1 inline-flex items-center gap-1 text-[12px] text-[var(--heat-100)]">
						Back to orders <ChevronRight class="size-3.5" strokeWidth={2} />
					</a>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	/* ── Panels ── */
	.panel {
		border: 1px solid var(--border-faint);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.97);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	.hero {
		position: relative;
		border: 1px solid var(--border-faint);
		border-radius: 10px;
		background:
			linear-gradient(135deg, rgba(250, 93, 25, 0.07) 0%, transparent 40%),
			rgba(255, 255, 255, 0.97);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		overflow: hidden;
	}

	.hero-grain {
		position: absolute;
		inset: 0;
		opacity: 0.5;
		background-image:
			linear-gradient(rgba(38, 38, 38, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(38, 38, 38, 0.035) 1px, transparent 1px);
		background-size: 24px 24px;
		mask-image: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, transparent 60%);
		pointer-events: none;
	}

	/* ── Shared Components ── */
	.icon-box {
		display: flex;
		width: 30px;
		height: 30px;
		align-items: center;
		justify-content: center;
		border-radius: 7px;
		background: var(--heat-8);
		color: var(--heat-100);
		flex-shrink: 0;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		border: 1px solid;
		border-radius: 999px;
		padding: 3px 10px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		line-height: 1.4;
	}

	.detail-cell {
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 8px 10px;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 999px;
		border: 1px solid var(--border-faint);
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(6px);
		padding: 5px 12px;
		font-size: 12px;
		font-weight: 500;
		color: var(--black-alpha-56);
		transition: all 0.15s ease;
	}
	.back-link:hover {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	.copy-btn {
		display: inline-flex;
		width: 32px;
		height: 32px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid var(--border-faint);
		background: white;
		color: var(--black-alpha-40);
		transition: all 0.15s ease;
	}
	.copy-btn:hover {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	.primary-action-btn {
		display: inline-flex;
		width: 100%;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border-radius: 8px;
		background: var(--heat-100);
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		color: white;
		transition: all 0.2s ease;
	}
	.primary-action-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(250, 93, 25, 0.25);
	}
	.primary-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tracking-msg {
		margin-top: 10px;
		border-radius: 6px;
		border: 1px solid;
		padding: 8px 10px;
		font-size: 11px;
		line-height: 1.5;
	}

	.trust-footer {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		border-radius: 8px;
		border: 1px solid var(--heat-16);
		background: var(--heat-4);
		padding: 12px;
		font-size: 11px;
		line-height: 1.5;
		color: var(--black-alpha-56);
	}

	/* ── Tone classes ── */
	.tone-success {
		border-color: color-mix(in srgb, var(--accent-forest) 30%, transparent);
		background: color-mix(in srgb, var(--accent-forest) 8%, transparent);
		color: var(--accent-forest);
	}

	.tone-danger {
		border-color: color-mix(in srgb, var(--accent-crimson) 30%, transparent);
		background: color-mix(in srgb, var(--accent-crimson) 8%, transparent);
		color: var(--accent-crimson);
	}

	.tone-warning {
		border-color: color-mix(in srgb, var(--accent-honey) 40%, transparent);
		background: color-mix(in srgb, var(--accent-honey) 10%, transparent);
		color: color-mix(in srgb, var(--accent-honey) 80%, black);
	}

	.tone-heat {
		border-color: var(--heat-16);
		background: var(--heat-4);
		color: var(--heat-100);
	}

	.tone-muted {
		border-color: var(--border-faint);
		background: var(--background-lighter);
		color: var(--black-alpha-48);
	}

	/* ── Items ── */
	.item-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		transition: background 0.12s ease;
	}
	.item-row:hover {
		background: var(--background-lighter);
	}

	.item-img {
		width: 52px;
		height: 52px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 4px;
		flex-shrink: 0;
	}

	/* ── Timeline ── */
	.tl-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}

	.tl-step {
		position: relative;
		padding-right: 10px;
	}

	.tl-dot {
		position: relative;
		z-index: 1;
		display: flex;
		width: 32px;
		height: 32px;
		align-items: center;
		justify-content: center;
		border-width: 1px;
		border-style: solid;
		border-radius: 999px;
	}

	.tl-line {
		position: absolute;
		top: 15px;
		left: 32px;
		right: 0;
		height: 1px;
		background: var(--border-faint);
	}

	.tl-line.complete {
		background: color-mix(in srgb, var(--heat-100) 40%, transparent);
	}

	.tl-text {
		padding-top: 8px;
	}

	@media (max-width: 767px) {
		.tl-grid {
			grid-template-columns: 1fr;
			gap: 8px;
		}

		.tl-step {
			display: grid;
			grid-template-columns: 32px 1fr;
			gap: 10px;
			padding-right: 0;
		}

		.tl-text {
			padding-top: 0;
			align-self: center;
		}

		.tl-line {
			top: 32px;
			bottom: -8px;
			left: 15px;
			right: auto;
			width: 1px;
			height: auto;
		}
	}
</style>
