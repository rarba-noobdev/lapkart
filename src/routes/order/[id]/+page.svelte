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
		Check,
		ChevronRight,
		CircleDashed,
		Clock,
		Copy,
		CreditCard,
		ExternalLink,
		MapPin,
		Package,
		ReceiptText,
		RefreshCw,
		ShieldCheck,
		Truck,
		XCircle
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	type StepState = 'complete' | 'active' | 'waiting' | 'problem';
	type TimelineStep = { key: string; label: string; detail: string; state: StepState };
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
		return { ...data.order, ...realtimeOrderPatch };
	});
	const auth = getAuthContext();
	let trackingMessage = $state<string | null>(null);
	let trackingRefreshing = $state(false);
	let trackingMessageTone = $state<'info' | 'error'>('info');
	let copiedOrderId = $state(false);

	const PRE_SHIP = ['created', 'awb_assigned', 'pickup_scheduled', 'label_generated', 'manifest_generated'];

	const shortOrderId = $derived(order ? order.id.slice(0, 8).toUpperCase() : '');
	const orderStatusLabel = $derived(order ? formatStatusLabel(order.status) : '');
	const paymentStatusLabel = $derived(order ? formatStatusLabel(order.paymentStatus) : '');
	const courierLabel = $derived(order?.shipment?.courierName || '');
	const awbLabel = $derived(order?.shipment?.awbCode || 'Not assigned');
	const itemCount = $derived(order ? order.items.reduce((sum, item) => sum + item.qty, 0) : 0);
	const subtotal = $derived(
		order
			? order.items.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.qty ?? 0), 0)
			: 0
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

	const closedState = $derived.by<'cancelled' | 'returned' | null>(() => {
		if (!order) return null;
		const status = order.status.toLowerCase();
		if (status === 'returned' || (order.shipment?.status?.toLowerCase() ?? '').startsWith('rto'))
			return 'returned';
		if (['cancelled', 'failed', 'payment_failed', 'refunded'].includes(status)) return 'cancelled';
		return null;
	});

	// Single source of truth for "how far along is this order" (0=placed … 4=delivered).
	const stage = $derived.by(() => {
		if (!order) return 0;
		const o = order.status.toLowerCase();
		const s = order.shipment?.status?.toLowerCase() ?? '';
		if (o === 'delivered' || s === 'delivered') return 4;
		if (o === 'out_for_delivery' || s === 'out_for_delivery') return 3;
		if (['shipped', 'in_transit'].includes(s) || o === 'shipped') return 2;
		if (order.shipment || ['confirmed', 'processing', 'ready_for_delivery'].includes(o)) return 1;
		if (['paid', 'captured', 'verified'].includes(order.paymentStatus.toLowerCase())) return 1;
		return 0;
	});

	const headline = $derived.by(() => {
		if (closedState === 'returned') return 'Order returned';
		if (closedState === 'cancelled') return 'Order cancelled';
		return ['Order received', 'Preparing your order', 'On the way', 'Out for delivery', 'Delivered'][
			stage
		];
	});

	const etaLine = $derived.by(() => {
		if (!order) return '';
		if (closedState === 'cancelled') return 'No delivery is scheduled for this order.';
		if (closedState === 'returned') return 'This order was returned to the seller.';
		if (stage === 4) return 'Your package was delivered.';
		const eta = order.shipment?.expectedDeliveryDate;
		const courier = courierLabel ? ` · ${courierLabel}` : '';
		if (eta) return `Expected by ${formatDate(eta)}${courier}`;
		if (stage >= 2) return courier ? `In transit${courier}` : 'In transit';
		if (stage === 1) return 'We are getting your order ready to ship.';
		return 'We have received your order.';
	});

	const timeline = $derived<TimelineStep[]>(order ? buildTimeline() : []);

	const trackAction = $derived.by(() => {
		if (!order) return { label: 'Awaiting shipment', mode: 'none' as const };
		if (order.shipment?.trackingUrl) return { label: 'Track shipment', mode: 'open' as const };
		if (order.shipment) return { label: 'Refresh tracking', mode: 'refresh' as const };
		return { label: 'Awaiting shipment', mode: 'none' as const };
	});

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
					{ label: 'Courier', value: courierLabel || 'Courier pending' },
					{ label: 'AWB', value: awbLabel },
					{ label: 'ETA', value: order.shipment?.expectedDeliveryDate ? formatDate(order.shipment.expectedDeliveryDate) : 'After dispatch' }
				]
			: []
	);

	function formatStatusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	function formatDate(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
	}

	function stepStateFor(index: number): StepState {
		if (index < stage) return 'complete';
		if (index === stage) return stage === 4 ? 'complete' : 'active';
		return 'waiting';
	}

	function buildTimeline(): TimelineStep[] {
		if (!order) return [];
		const created = new Date(order.createdAt).toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short'
		});
		const s = order.shipment?.status?.toLowerCase() ?? '';

		if (closedState) {
			return [
				{ key: 'placed', label: 'Order placed', detail: created, state: 'complete' },
				{
					key: 'paid',
					label: 'Payment',
					detail: paymentStatusLabel,
					state: ['paid', 'captured', 'verified'].includes(order.paymentStatus.toLowerCase())
						? 'complete'
						: 'problem'
				},
				{
					key: 'closed',
					label: closedState === 'returned' ? 'Returned' : 'Cancelled',
					detail: formatStatusLabel(order.status),
					state: 'problem'
				}
			];
		}

		return [
			{ key: 'placed', label: 'Placed', detail: created, state: 'complete' },
			{
				key: 'confirmed',
				label: 'Confirmed',
				detail: stage >= 1 ? 'Payment verified' : 'Awaiting confirmation',
				state: stepStateFor(1)
			},
			{
				key: 'shipped',
				label: 'Shipped',
				detail: stage >= 2 ? courierLabel || 'Dispatched' : PRE_SHIP.includes(s) ? 'Packed' : 'Pending dispatch',
				state: stepStateFor(2)
			},
			{
				key: 'out_for_delivery',
				label: 'Out for delivery',
				detail: stage >= 3 ? 'With delivery agent' : 'Pending',
				state: stepStateFor(3)
			},
			{
				key: 'delivered',
				label: 'Delivered',
				detail: stage === 4 ? 'Package delivered' : 'Pending',
				state: stepStateFor(4)
			}
		];
	}

	function statusTone(status: string): string {
		const n = status.toLowerCase();
		if (['delivered', 'paid', 'captured', 'verified'].includes(n)) return 'tone-success';
		if (['cancelled', 'failed', 'payment_failed', 'refunded', 'returned'].includes(n))
			return 'tone-danger';
		if (['pending_payment', 'pending', 'cod_pending', 'processing'].includes(n)) return 'tone-warning';
		return 'tone-heat';
	}

	function stepTone(state: StepState): string {
		if (state === 'complete') return 'tone-success';
		if (state === 'active') return 'tone-heat';
		if (state === 'problem') return 'tone-danger';
		return 'tone-muted';
	}

	function stepIcon(state: StepState) {
		if (state === 'complete') return Check;
		if (state === 'active') return CircleDashed;
		return Clock;
	}

	async function copyOrderId() {
		if (!order) return;
		try {
			await navigator.clipboard.writeText(order.id);
			copiedOrderId = true;
			window.setTimeout(() => (copiedOrderId = false), 1400);
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

	function handleTrack() {
		if (trackAction.mode === 'open' && order?.shipment?.trackingUrl) {
			window.open(order.shipment.trackingUrl, '_blank', 'noopener,noreferrer');
			return;
		}
		if (trackAction.mode === 'refresh') void refreshTracking();
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
	<span class={`status-pill ${statusTone(status)}`}>{label}</span>
{/snippet}

{#snippet detailGrid(title: string, icon: typeof Package, details: DetailPair[])}
	{@const Icon = icon}
	<section class="panel p-4">
		<div class="mb-3 flex items-center gap-2.5">
			<div class="icon-box"><Icon class="size-3.5" strokeWidth={2} /></div>
			<h2 class="text-label-small font-semibold text-foreground">{title}</h2>
		</div>
		<div class="grid gap-1.5 sm:grid-cols-2">
			{#each details as detail (detail.label)}
				<div class="detail-cell">
					<p class="cell-label">{detail.label}</p>
					<p class="mt-0.5 text-body-small font-medium break-words text-foreground">{detail.value}</p>
				</div>
			{/each}
		</div>
	</section>
{/snippet}

<section class="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
	{#if order}
		<a href={resolve('/orders')} class="back-link motion-soft-link mb-4">
			<ArrowLeft class="size-3.5" strokeWidth={2} />
			All orders
		</a>

		<div class="motion-section grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
			<!-- Main Column -->
			<div class="min-w-0 space-y-4">
				<!-- Status board (the lede: what's happening + track) -->
				<header class={`board ${closedState ? 'board-closed' : ''}`}>
					<div class="board-top">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span class="order-id">#{shortOrderId}</span>
								<button type="button" class="copy-btn" onclick={copyOrderId} aria-label="Copy full order ID">
									{#if copiedOrderId}
										<Check class="size-3" strokeWidth={2.5} />
									{:else}
										<Copy class="size-3" strokeWidth={2} />
									{/if}
								</button>
								<span class="dot-sep">·</span>
								<span class="placed-on">
									{new Date(order.createdAt).toLocaleDateString('en-IN', {
										day: '2-digit',
										month: 'short',
										year: 'numeric'
									})}
								</span>
							</div>
							<h1 class="headline">{headline}</h1>
							<p class="eta">{etaLine}</p>
						</div>
						<div class="board-meta">
							<div class="flex flex-wrap justify-end gap-1.5">
								{@render statusPill(orderStatusLabel, order.status)}
								{@render statusPill(paymentStatusLabel, order.paymentStatus)}
							</div>
							<span class="board-total">{formatINR(order.total)}</span>
						</div>
					</div>

					<div class="board-actions">
						<button type="button" class="track-btn" onclick={handleTrack} disabled={trackAction.mode === 'none' || trackingRefreshing}>
							{#if trackAction.mode === 'open'}
								<ExternalLink class="size-4" strokeWidth={2} />
							{:else}
								<RefreshCw class={`size-4 ${trackingRefreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
							{/if}
							{trackingRefreshing ? 'Refreshing…' : trackAction.label}
						</button>
						{#if order.shipment?.awbCode}
							<span class="awb-chip">AWB {order.shipment.awbCode}</span>
						{/if}
					</div>

					{#if trackingMessage}
						<p class={`tracking-msg ${trackingMessageTone === 'error' ? 'tone-danger' : 'tone-heat'}`} transition:fade={{ duration: 200 }}>
							{trackingMessage}
						</p>
					{/if}
				</header>

				{#if closedState}
					<div class="closed-banner" role="status">
						<XCircle class="size-4 shrink-0" strokeWidth={2} />
						<div>
							<p class="text-label-small font-semibold">
								{closedState === 'returned' ? 'Order returned' : 'Order cancelled'}
							</p>
							<p class="banner-sub text-body-small">
								{closedState === 'returned'
									? 'This order was returned. No further delivery updates will follow.'
									: 'This order was cancelled. No delivery is scheduled.'}
							</p>
						</div>
					</div>
				{/if}

				<!-- Timeline -->
				<section class="panel p-4 sm:p-5">
					<h2 class="mb-4 text-label-small font-semibold text-foreground">Progress</h2>
					<div class="tl-grid" style={`--tl-count: ${timeline.length}`}>
						{#each timeline as step, index (step.key)}
							{@const Icon = stepIcon(step.state)}
							<div class="tl-step">
								<div class={`tl-dot ${stepTone(step.state)}`}>
									<Icon class="size-3.5" strokeWidth={2.5} />
								</div>
								{#if index < timeline.length - 1}
									<div class="tl-line" class:complete={step.state === 'complete'}></div>
								{/if}
								<div class="tl-text">
									<p class="text-label-x-small font-semibold text-foreground">{step.label}</p>
									<p class="tl-detail text-label-x-small">{step.detail}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Items -->
				<section class="panel overflow-hidden">
					<div class="flex items-center gap-2.5 border-b border-[var(--border-faint)] px-4 py-3">
						<div class="icon-box"><Package class="size-3.5" strokeWidth={2} /></div>
						<h2 class="text-label-small font-semibold text-foreground">
							{itemCount} item{itemCount === 1 ? '' : 's'}
						</h2>
					</div>
					<div class="motion-list divide-y divide-[var(--border-faint)]">
						{#each order.items as item (item.id)}
							<div class="item-row">
								<div class="item-img">
									<img src={item.image} alt={item.title} class="max-h-full w-full object-contain" loading="lazy" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="line-clamp-2 text-body-small font-semibold text-foreground">{item.title}</p>
									<p class="mt-0.5 text-label-x-small text-[var(--black-alpha-56)]">
										{item.brand || 'LapKart'} &middot; Qty {item.qty}
									</p>
								</div>
								<div class="text-right">
									<p class="text-body-small font-semibold text-foreground">{formatINR(item.price * item.qty)}</p>
									{#if item.qty > 1}
										<p class="text-label-x-small text-[var(--black-alpha-56)]">{formatINR(item.price)} ea</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Shipping + Payment -->
				<div class="grid gap-4 xl:grid-cols-2">
					{@render detailGrid('Shipping', Truck, shippingDetails)}
					{@render detailGrid('Payment', CreditCard, paymentDetails)}
				</div>
			</div>

			<!-- Sidebar -->
			<aside class="space-y-3 lg:sticky lg:top-20 lg:h-fit">
				<!-- Cost Summary -->
				<div class="panel p-4">
					<div class="mb-3 flex items-center gap-2.5">
						<div class="icon-box"><ReceiptText class="size-3.5" strokeWidth={2} /></div>
						<h2 class="text-label-small font-semibold text-foreground">Summary</h2>
					</div>
					<div class="space-y-2 text-body-small">
						<div class="flex justify-between text-[var(--black-alpha-56)]">
							<span>Subtotal</span>
							<span class="font-medium text-foreground">{formatINR(subtotal)}</span>
						</div>
						<div class="flex justify-between text-[var(--black-alpha-56)]">
							<span>Shipping</span>
							<span class="font-medium text-foreground">{order.shipping > 0 ? formatINR(order.shipping) : 'Free'}</span>
						</div>
						<div class="flex justify-between border-t border-[var(--border-faint)] pt-2">
							<span class="font-semibold text-foreground">Total</span>
							<span class="text-label-large font-bold text-foreground">{formatINR(order.total)}</span>
						</div>
					</div>
				</div>

				<!-- Address -->
				<div class="panel p-4">
					<div class="mb-3 flex items-center gap-2.5">
						<div class="icon-box"><MapPin class="size-3.5" strokeWidth={2} /></div>
						<h2 class="text-label-small font-semibold text-foreground">Delivery address</h2>
					</div>
					<div class="detail-cell">
						{#each addressLines as line (line)}
							<p class="text-body-small leading-5 text-foreground">{line}</p>
						{/each}
						{#if addressLines.length === 0}
							<p class="text-body-small text-[var(--black-alpha-56)]">Address pending</p>
						{/if}
					</div>
				</div>

				<!-- Trust footer -->
				<div class="trust-footer">
					<ShieldCheck class="size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2} />
					<p>
						<span class="font-semibold text-foreground">Live order record.</span>
						This page updates automatically as your order moves.
					</p>
				</div>
			</aside>
		</div>
	{:else}
		<div class="panel p-5" transition:fade>
			<div class="flex items-center gap-3 text-[var(--accent-crimson)]">
				<XCircle class="size-5 shrink-0" strokeWidth={2} />
				<div>
					<p class="text-label-medium font-semibold">Order not found</p>
					<a
						href={resolve('/orders')}
						class="motion-soft-link mt-1 inline-flex items-center gap-1 text-body-small text-[var(--heat-100)]"
					>
						Back to orders <ChevronRight class="size-3.5" strokeWidth={2} />
					</a>
				</div>
			</div>
		</div>
	{/if}
</section>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>

<style>
	/* ── Panels ── */
	.panel {
		border: 1px solid var(--border-faint);
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.97);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	/* ── Status board ── */
	.board {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--border-faint);
		border-radius: 12px;
		background:
			radial-gradient(120% 140% at 100% 0%, var(--heat-8) 0%, transparent 45%),
			rgba(255, 255, 255, 0.97);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		padding: 18px 18px 16px;
	}
	.board-closed {
		background:
			radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--accent-crimson) 8%, transparent) 0%, transparent 45%),
			rgba(255, 255, 255, 0.97);
	}

	.board-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.order-id {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--black-alpha-72);
	}
	.dot-sep {
		color: var(--black-alpha-32);
	}
	.placed-on {
		font-size: 12px;
		color: var(--black-alpha-56);
	}

	.headline {
		margin-top: 8px;
		font-size: 26px;
		line-height: 30px;
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--fg-strong);
		text-wrap: balance;
	}
	.board-closed .headline {
		color: var(--accent-crimson);
	}
	.eta {
		margin-top: 4px;
		font-size: 13px;
		line-height: 18px;
		color: var(--black-alpha-72);
	}

	.board-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.board-total {
		font-size: 22px;
		line-height: 1;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--fg-strong);
	}

	.board-actions {
		margin-top: 16px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}

	.track-btn {
		display: inline-flex;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border-radius: 8px;
		background: var(--heat-100);
		padding: 8px 18px;
		font-size: 13px;
		font-weight: 600;
		color: white;
		box-shadow:
			0px -6px 12px 0px rgba(255, 0, 0, 0.18) inset,
			0px 2px 4px 0px rgba(255, 77, 0, 0.12);
		transition: transform var(--motion-fast) var(--motion-ease-out), box-shadow var(--motion-standard) var(--motion-ease);
	}
	.track-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow:
			0px -6px 12px 0px rgba(255, 0, 0, 0.18) inset,
			0px 6px 16px 0px rgba(250, 93, 25, 0.28);
	}
	.track-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		box-shadow: none;
		background: var(--black-alpha-12);
		color: var(--black-alpha-56);
	}

	.awb-chip {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 5px 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		color: var(--black-alpha-64);
	}

	/* ── Shared components ── */
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

	.cell-label {
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--black-alpha-56);
	}

	.closed-banner {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--accent-crimson) 30%, transparent);
		background: color-mix(in srgb, var(--accent-crimson) 7%, var(--card));
		padding: 12px 14px;
		color: var(--accent-crimson);
	}
	.closed-banner :global(svg) {
		margin-top: 1px;
	}
	.banner-sub {
		margin-top: 1px;
		color: color-mix(in srgb, var(--accent-crimson) 78%, var(--fg-strong));
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 999px;
		border: 1px solid var(--border-faint);
		background: rgba(255, 255, 255, 0.8);
		padding: 5px 12px;
		font-size: 12px;
		font-weight: 500;
		color: var(--black-alpha-56);
		transition:
			border-color 150ms ease,
			color 150ms ease;
	}
	.back-link:hover {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	.copy-btn {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		color: var(--black-alpha-40);
		transition:
			border-color 150ms ease,
			color 150ms ease;
	}
	.copy-btn:hover {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	.tracking-msg {
		margin-top: 12px;
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
		color: var(--black-alpha-64);
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
		grid-template-columns: repeat(var(--tl-count, 5), minmax(0, 1fr));
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
		height: 2px;
		border-radius: 999px;
		background: var(--border-faint);
	}
	.tl-line.complete {
		background: color-mix(in srgb, var(--accent-forest) 45%, transparent);
	}
	.tl-text {
		padding-top: 8px;
	}
	.tl-detail {
		color: var(--black-alpha-56);
		text-transform: capitalize;
	}

	@media (max-width: 767px) {
		.tl-grid {
			grid-template-columns: 1fr;
			gap: 6px;
		}
		.tl-step {
			display: grid;
			grid-template-columns: 32px 1fr;
			gap: 10px;
			padding-right: 0;
			padding-bottom: 6px;
		}
		.tl-text {
			padding-top: 0;
			align-self: center;
		}
		.tl-line {
			top: 32px;
			bottom: -6px;
			left: 15px;
			right: auto;
			width: 2px;
			height: auto;
		}
	}

	@media (max-width: 640px) {
		.board-top {
			flex-direction: column;
		}
		.board-meta {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			width: 100%;
		}
		.track-btn {
			flex: 1;
		}
	}
</style>
