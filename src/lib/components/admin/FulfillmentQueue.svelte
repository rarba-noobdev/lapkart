<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Truck, RotateCcw, Check, X, ExternalLink, PackageSearch, MapPin } from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import {
		orderCanCreateShipment,
		postJson,
		requestAdmin,
		toneClasses,
		statusTone,
		type FulfillmentOrder,
		type ShiprocketAccount
	} from '$lib/admin';

	const auth = getAuthContext();

	let orders = $state<FulfillmentOrder[]>([]);
	let account = $state<ShiprocketAccount | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeAction = $state<string | null>(null);
	let detailOrderId = $state<string | null>(null);
	let detailModalOpen = $state(false);
	let selectedOrderIds = $state<string[]>([]);
	let realtimeRefreshTimer: number | null = null;

	const detailOrder = $derived(orders.find((order) => order.id === detailOrderId) ?? null);
	const selectedOrderSet = $derived(new Set(selectedOrderIds));
	const selectableOrderIds = $derived(orders.map((order) => order.id));
	const selectedOrders = $derived(orders.filter((order) => selectedOrderSet.has(order.id)));
	const selectedShipmentIds = $derived(
		selectedOrders.map((order) => order.shipment?.id).filter((id): id is string => Boolean(id))
	);
	const selectedOrdersWithoutShipment = $derived(selectedOrders.filter((order) => !order.shipment));
	const allVisibleOrdersSelected = $derived(
		selectableOrderIds.length > 0 &&
			selectableOrderIds.every((orderId) => selectedOrderSet.has(orderId))
	);

	function syncQueueState(nextOrders: FulfillmentOrder[]) {
		if (!nextOrders.length) {
			detailOrderId = null;
			detailModalOpen = false;
			selectedOrderIds = [];
			return;
		}

		const stillVisible = detailOrderId
			? nextOrders.some((order) => order.id === detailOrderId)
			: false;
		if (detailOrderId && !stillVisible) {
			detailOrderId = null;
			detailModalOpen = false;
		}
		selectedOrderIds = selectedOrderIds.filter((orderId) =>
			nextOrders.some((order) => order.id === orderId)
		);
	}

	async function refresh(showLoading = orders.length === 0) {
		try {
			if (showLoading) loading = true;
			error = null;
			const [accountResponse, queueResponse] = await Promise.allSettled([
				requestAdmin<ShiprocketAccount>('/shiprocket/account'),
				requestAdmin<{ orders: FulfillmentOrder[] }>('/admin/fulfillment/orders')
			]);
			if (queueResponse.status === 'rejected') throw queueResponse.reason;
			account = accountResponse.status === 'fulfilled' ? accountResponse.value : null;
			const nextOrders = queueResponse.value.orders ?? [];
			orders = nextOrders;
			syncQueueState(nextOrders);
		} catch (requestError) {
			error =
				requestError instanceof Error ? requestError.message : 'Could not load fulfillment queue';
		} finally {
			if (showLoading) loading = false;
		}
	}

	function scheduleFulfillmentRefresh() {
		if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
		realtimeRefreshTimer = window.setTimeout(() => {
			void refresh(false);
		}, 350);
	}

	async function runAction(key: string, path: string, init?: RequestInit) {
		try {
			activeAction = key;
			error = null;
			await requestAdmin(path, init);
			await refresh(false);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Fulfillment action failed';
		} finally {
			activeAction = null;
		}
	}

	function toggleOrderSelection(orderId: string) {
		selectedOrderIds = selectedOrderIds.includes(orderId)
			? selectedOrderIds.filter((id) => id !== orderId)
			: [...selectedOrderIds, orderId];
	}

	function toggleAllVisibleOrders() {
		selectedOrderIds = allVisibleOrdersSelected ? [] : [...selectableOrderIds];
	}

	function openDetails(orderId: string) {
		detailOrderId = orderId;
		detailModalOpen = true;
	}

	function closeDetails() {
		detailModalOpen = false;
		detailOrderId = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && detailModalOpen) {
			closeDetails();
		}
	}

	function openExternal(url: string | null | undefined) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	async function runBulkCreateShipments() {
		if (!selectedOrderIds.length) {
			error = 'Select orders first.';
			return;
		}

		const creatableOrderIds = selectedOrders
			.filter((order) => orderCanCreateShipment(order))
			.map((order) => order.id);

		if (!creatableOrderIds.length) {
			error = 'Selected orders already have shipments or are not eligible.';
			return;
		}

		await runAction(
			'bulk:create_orders',
			'/shipments/shiprocket/bulk',
			postJson({ action: 'create_orders', orderIds: creatableOrderIds })
		);
		selectedOrderIds = [];
	}

	async function runBulkAction(
		action: 'assign_awb' | 'schedule_pickup' | 'generate_labels' | 'refresh_tracking'
	) {
		if (!selectedShipmentIds.length) {
			error = 'Select orders that already have shipments.';
			return;
		}

		await runAction(
			`bulk:${action}`,
			'/shipments/shiprocket/bulk',
			postJson({ action, shipmentIds: selectedShipmentIds })
		);
		selectedOrderIds = [];
	}

	function latestTracking(order: FulfillmentOrder) {
		return order.shipment?.trackingActivities[0] ?? null;
	}

	function shipmentStage(order: FulfillmentOrder): {
		label: string;
		tone: 'ok' | 'warn' | 'bad' | 'muted';
	} {
		const status = order.shipment?.status;
		if (!status) return { label: 'Not created', tone: 'muted' };
		if (status === 'delivered') return { label: status, tone: 'ok' };
		if (status === 'cancelled' || status.startsWith('rto'))
			return { label: status.replaceAll('_', ' '), tone: 'bad' };
		return { label: status.replaceAll('_', ' '), tone: 'warn' };
	}

	// Queue broken down by next required step, so the desk can see at a glance
	// where the work is stuck.
	const stageCounts = $derived.by(() => {
		let needsShipment = 0;
		let awbPending = 0;
		let pickupPending = 0;
		let moving = 0;
		for (const order of orders) {
			const shipment = order.shipment;
			if (!shipment) needsShipment++;
			else if (!shipment.awbCode) awbPending++;
			else if (!shipment.pickupScheduledDate) pickupPending++;
			else moving++;
		}
		return { needsShipment, awbPending, pickupPending, moving };
	});

	const stageChips = $derived([
		{ id: 'create', label: 'Need shipment', count: stageCounts.needsShipment, hot: true },
		{ id: 'awb', label: 'AWB pending', count: stageCounts.awbPending, hot: true },
		{ id: 'pickup', label: 'Pickup pending', count: stageCounts.pickupPending, hot: false },
		{ id: 'moving', label: 'Moving', count: stageCounts.moving, hot: false }
	]);

	onMount(() => {
		void refresh();
		const channel = auth.supabase
			.channel('admin-fulfillment-queue')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'orders' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'order_items' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'payments' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipments' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipment_events' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipment_packages' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipping_batches' },
				scheduleFulfillmentRefresh
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'shipping_batch_items' },
				scheduleFulfillmentRefresh
			)
			.subscribe();

		return () => {
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fq-board">
	<!-- Toolbar -->
	<div class="fq-toolbar">
		<div class="fq-toolbar-main">
			<div class="fq-toolbar-icon">
				<Truck class="size-[18px]" strokeWidth={2} />
			</div>
			<div>
				<h2 class="fq-title">Fulfillment desk</h2>
				<p class="fq-subtitle">Manual dispatch queue</p>
			</div>
		</div>
		<div class="fq-toolbar-stats">
			<div class="fq-stat">
				<span class="fq-stat-label">Provider</span>
				<span class="fq-stat-value">
					{account ? `Shiprocket ${formatINR(account.walletBalance)}` : 'Manual'}
				</span>
			</div>
			<div class="fq-stat">
				<span class="fq-stat-label">Pickup</span>
				<span class="fq-stat-value">
					{account?.configuredPickupLocation || 'Daily courier pickup'}
				</span>
				{#if account && !account.pickupLocationVerified}
					<span class="fq-stat-warn">Not synced</span>
				{/if}
			</div>
			<div class="fq-stat">
				<span class="fq-stat-label">Queue</span>
				<span class="fq-stat-value">{orders.length}</span>
			</div>
			<button type="button" class="fq-btn" disabled={loading} onclick={() => void refresh()}>
				<RotateCcw class="size-3.5" strokeWidth={2} />
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>
	</div>

	<!-- Stage chips -->
	<div class="fq-chips">
		{#each stageChips as chip (chip.id)}
			<span class="fq-chip {chip.count > 0 && chip.hot ? 'hot' : ''}">
				<span class="fq-chip-num">{chip.count}</span>
				{chip.label}
			</span>
		{/each}
	</div>

	<!-- Bulk action bar -->
	<div class="fq-bulkbar">
		<span class="fq-bulk-label">
			{selectedOrderIds.length} selected / {selectedOrdersWithoutShipment.length} need shipment
		</span>
		<div class="fq-bulk-actions">
			<button
				type="button"
				class="button button-primary fq-btn-primary"
				disabled={!selectedOrderIds.length || activeAction !== null}
				onclick={() => void runBulkCreateShipments()}
			>
				{activeAction === 'bulk:create_orders' ? 'Creating...' : 'Bulk create shipments'}
			</button>
			<button
				type="button"
				class="fq-btn"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('assign_awb')}
			>
				{activeAction === 'bulk:assign_awb' ? 'Assigning...' : 'Bulk AWB'}
			</button>
			<button
				type="button"
				class="fq-btn"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('schedule_pickup')}
			>
				{activeAction === 'bulk:schedule_pickup' ? 'Scheduling...' : 'Bulk pickup'}
			</button>
			<button
				type="button"
				class="fq-btn"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('generate_labels')}
			>
				{activeAction === 'bulk:generate_labels' ? 'Generating...' : 'Bulk labels'}
			</button>
			<button
				type="button"
				class="fq-btn"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('refresh_tracking')}
			>
				{activeAction === 'bulk:refresh_tracking' ? 'Refreshing...' : 'Bulk tracking'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="fq-error">{error}</div>
	{/if}

	<!-- Queue table -->
	<div class="fq-table-wrap">
		<table class="fq-table">
			<thead>
				<tr>
					<th class="fq-check-col">
						<button
							type="button"
							class="fq-check {allVisibleOrdersSelected ? 'active' : ''}"
							aria-label="Select all visible orders"
							aria-pressed={allVisibleOrdersSelected}
							disabled={!orders.length}
							onclick={toggleAllVisibleOrders}
						>
							{#if allVisibleOrdersSelected}
								<Check class="size-3.5" strokeWidth={2.6} />
							{/if}
						</button>
					</th>
					<th>Order</th>
					<th>Delivery</th>
					<th>Shipment</th>
					<th>Tracking</th>
					<th class="fq-act-col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each orders as order (order.id)}
					{@const shipment = order.shipment}
					{@const serviceType =
						shipment?.shippingServiceType ?? order.shippingServiceType ?? 'standard'}
					{@const createKey = `${order.id}:create`}
					{@const awbKey = `${order.id}:awb`}
					{@const pickupKey = `${order.id}:pickup`}
					{@const trackingKey = `${order.id}:tracking`}
					{@const busy = activeAction?.startsWith(order.id) ?? false}
					{@const latest = latestTracking(order)}
					{@const stage = shipmentStage(order)}
					{@const shipmentCancelled =
						shipment?.status === 'cancelled' || (shipment?.status?.startsWith('rto') ?? false)}

					<tr
						class="fq-row {detailOrderId === order.id ? 'is-active' : ''}"
						tabindex="0"
						role="button"
						aria-label={`Open order ${order.id.slice(0, 8)}`}
						onclick={() => openDetails(order.id)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								openDetails(order.id);
							}
						}}
					>
						<td class="fq-check-col" onclick={(event) => event.stopPropagation()}>
							<button
								type="button"
								class="fq-check {selectedOrderSet.has(order.id) ? 'active' : ''}"
								aria-label={`Select order ${order.id.slice(0, 8)}`}
								aria-pressed={selectedOrderSet.has(order.id)}
								onclick={() => toggleOrderSelection(order.id)}
							>
								{#if selectedOrderSet.has(order.id)}
									<Check class="size-3.5" strokeWidth={2.6} />
								{/if}
							</button>
						</td>
						<td>
							<div class="fq-order">
								<div class="fq-thumb">
									{#if order.items[0]?.image}
										<img src={order.items[0].image} alt="" loading="lazy" />
									{:else}
										<PackageSearch class="size-4 text-[var(--black-alpha-24)]" strokeWidth={1.8} />
									{/if}
									{#if order.items.length > 1}
										<span class="fq-thumb-count">+{order.items.length - 1}</span>
									{/if}
								</div>
								<div class="min-w-0">
									<p class="fq-order-id">#{order.id.slice(0, 8).toUpperCase()}</p>
									<p class="fq-order-name">{order.shippingName || 'Customer'}</p>
									<p class="fq-order-meta">
										{formatINR(Number(order.total ?? 0))} · {order.items.length} item{order.items
											.length === 1
											? ''
											: 's'}
									</p>
									<p class="fq-order-date">
										{new Date(order.createdAt).toLocaleDateString('en-IN', {
											day: '2-digit',
											month: 'short',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</p>
								</div>
							</div>
						</td>
						<td>
							<p class="fq-cell-strong capitalize">{serviceType}</p>
							<p class="fq-cell-muted">
								{[order.shippingCity, order.shippingState, order.shippingPincode]
									.filter(Boolean)
									.join(', ') || 'Address pending'}
							</p>
						</td>
						<td>
							<span class="fq-pill {stage.tone}">{stage.label}</span>
							<p class="fq-cell-muted mt-1">
								{shipment?.awbCode ? `AWB ${shipment.awbCode}` : 'AWB pending'}
							</p>
							{#if shipment?.courierName}
								<p class="fq-cell-muted">{shipment.courierName}</p>
							{/if}
						</td>
						<td>
							<p class="fq-cell-track">
								{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
							</p>
							{#if latest?.location}
								<p class="fq-cell-muted">{latest.location}</p>
							{/if}
							{#if shipment?.trackingUrl && !shipmentCancelled}
								<button
									type="button"
									class="fq-link"
									onclick={(event) => {
										event.stopPropagation();
										openExternal(shipment.trackingUrl);
									}}
								>
									Live tracking
								</button>
							{/if}
						</td>
						<td class="fq-act-col" onclick={(event) => event.stopPropagation()}>
							<div class="fq-row-actions">
								{#if shipmentCancelled}
									<span class="fq-pill bad">Cancelled</span>
								{:else if !shipment}
									<button
										type="button"
										class="button button-primary fq-btn-primary fq-btn-sm"
										disabled={busy}
										onclick={() =>
											void runAction(
												createKey,
												'/shipments/shiprocket/create',
												postJson({ orderId: order.id })
											)}
									>
										{activeAction === createKey ? 'Creating...' : 'Create shipment'}
									</button>
								{/if}

								{#if shipment && !shipment.awbCode && !shipmentCancelled}
									<button
										type="button"
										class="fq-btn fq-btn-sm"
										disabled={busy}
										onclick={() =>
											void runAction(
												awbKey,
												'/shipments/shiprocket/assign-awb',
												postJson({ shipmentId: shipment.id })
											)}
									>
										{activeAction === awbKey
											? 'Assigning...'
											: serviceType === 'quick'
												? 'AWB + rider'
												: 'Assign AWB'}
									</button>
								{/if}

								{#if shipment?.awbCode && serviceType === 'standard' && !shipment.pickupScheduledDate && !shipmentCancelled}
									<button
										type="button"
										class="fq-btn fq-btn-sm"
										disabled={busy}
										onclick={() =>
											void runAction(
												pickupKey,
												'/shipments/shiprocket/pickup',
												postJson({ shipmentId: shipment.id })
											)}
									>
										{activeAction === pickupKey ? 'Scheduling...' : 'Pickup'}
									</button>
								{/if}

								{#if shipment?.shiprocketShipmentId && !shipmentCancelled}
									<button
										type="button"
										class="fq-btn fq-btn-sm"
										disabled={busy}
										onclick={() =>
											void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)}
									>
										{activeAction === trackingKey ? 'Refreshing...' : 'Tracking'}
									</button>
								{/if}

								<button
									type="button"
									class="fq-btn fq-btn-sm"
									onclick={() => openDetails(order.id)}
								>
									Details
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if !loading && !orders.length}
			<p class="fq-empty">No paid orders are waiting for fulfillment.</p>
		{/if}
	</div>
</div>

{#if detailModalOpen && detailOrder}
	{@const shipment = detailOrder.shipment}
	{@const serviceType =
		shipment?.shippingServiceType ?? detailOrder.shippingServiceType ?? 'standard'}
	{@const createKey = `${detailOrder.id}:create`}
	{@const awbKey = `${detailOrder.id}:awb`}
	{@const pickupKey = `${detailOrder.id}:pickup`}
	{@const trackingKey = `${detailOrder.id}:tracking`}
	{@const latest = latestTracking(detailOrder)}
	{@const busy = activeAction?.startsWith(detailOrder.id) ?? false}
	{@const stage = shipmentStage(detailOrder)}
	{@const shipmentCancelled =
		shipment?.status === 'cancelled' || (shipment?.status?.startsWith('rto') ?? false)}

	<button
		type="button"
		class="fq-drawer-backdrop"
		aria-label="Close fulfillment details"
		onclick={closeDetails}
		transition:fade={{ duration: 150 }}
	></button>

	<div
		class="fq-drawer"
		role="dialog"
		aria-modal="true"
		aria-labelledby="fulfillment-detail-title"
		transition:fly={{ x: 520, duration: 280, easing: cubicOut }}
	>
		<div class="fq-drawer-head">
			<div class="min-w-0">
				<p class="fq-drawer-kicker">Fulfillment detail</p>
				<h2 id="fulfillment-detail-title" class="fq-drawer-title">
					#{detailOrder.id.slice(0, 8).toUpperCase()}
				</h2>
				<p class="fq-drawer-sub">
					{detailOrder.shippingName || 'Customer'} · {formatINR(Number(detailOrder.total ?? 0))}
				</p>
			</div>
			<button type="button" class="fq-drawer-close" aria-label="Close" onclick={closeDetails}>
				<X class="size-4" strokeWidth={2.2} />
			</button>
		</div>

		<div class="fq-drawer-body">
			<div class="fq-drawer-badges">
				<span class="fq-pill muted">{serviceType}</span>
				<span class="fq-pill {stage.tone}">{stage.label}</span>
			</div>

			<div class="fq-card">
				<p class="fq-card-title">Items</p>
				<div class="mt-2 space-y-2">
					{#each detailOrder.items as item (item.id)}
						<div class="fq-item">
							<img src={item.image} alt={item.title} class="fq-item-img" loading="lazy" />
							<div class="min-w-0">
								<p class="fq-item-title">{item.title}</p>
								<p class="fq-item-meta">
									{item.brand || 'Brand pending'} · SKU {item.sku || 'pending'}
								</p>
							</div>
							<div class="fq-item-qty">
								<span>Qty</span>
								<strong>{item.qty}</strong>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="fq-card">
				<p class="fq-card-title">
					<MapPin class="size-3.5" strokeWidth={2} />
					Delivery
				</p>
				<p class="fq-card-text">
					{[detailOrder.shippingCity, detailOrder.shippingState, detailOrder.shippingPincode]
						.filter(Boolean)
						.join(', ') || 'Address pending'}
				</p>
				<p class="fq-card-sub">Service {serviceType}</p>
			</div>

			<div class="fq-card">
				<p class="fq-card-title">Shipment</p>
				<div class="fq-meta-grid">
					<div class="fq-meta">
						<span>Status</span>
						<strong>{shipment?.status?.replaceAll('_', ' ') || 'Not created'}</strong>
					</div>
					<div class="fq-meta">
						<span>AWB</span>
						<strong>{shipment?.awbCode || 'Pending'}</strong>
					</div>
					<div class="fq-meta">
						<span>Courier</span>
						<strong>{shipment?.courierName || 'Pending'}</strong>
					</div>
					<div class="fq-meta">
						<span>Pickup</span>
						<strong>{shipment?.pickupScheduledDate || 'Not scheduled'}</strong>
					</div>
				</div>
			</div>

			<div class="fq-card">
				<p class="fq-card-title">Tracking</p>
				<p class="fq-card-text">
					{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
				</p>
				{#if latest?.location}
					<p class="fq-card-sub">{latest.location}</p>
				{/if}
				{#if shipment?.trackingUrl && !shipmentCancelled}
					<button
						type="button"
						class="fq-link mt-2"
						onclick={() => openExternal(shipment.trackingUrl)}
					>
						<ExternalLink class="size-3.5" strokeWidth={2} />
						Open live tracking
					</button>
				{/if}
			</div>

			<div class="fq-card fq-card-actions">
				<p class="fq-card-title">Fulfillment actions</p>
				<div class="mt-2.5 flex flex-wrap gap-2">
					{#if shipmentCancelled}
						<span class="fq-pill bad">Shipment cancelled — no further actions.</span>
					{:else if !shipment}
						<button
							type="button"
							class="button button-primary fq-btn-primary"
							disabled={busy}
							onclick={() =>
								void runAction(
									createKey,
									'/shipments/shiprocket/create',
									postJson({ orderId: detailOrder.id })
								)}
						>
							{activeAction === createKey ? 'Creating...' : 'Create shipment'}
						</button>
					{/if}
					{#if shipment && !shipment.awbCode && !shipmentCancelled}
						<button
							type="button"
							class="fq-btn"
							disabled={busy}
							onclick={() =>
								void runAction(
									awbKey,
									'/shipments/shiprocket/assign-awb',
									postJson({ shipmentId: shipment.id })
								)}
						>
							{activeAction === awbKey
								? 'Assigning...'
								: serviceType === 'quick'
									? 'Assign AWB + rider'
									: 'Assign AWB'}
						</button>
					{/if}
					{#if shipment?.awbCode && serviceType === 'standard' && !shipment.pickupScheduledDate && !shipmentCancelled}
						<button
							type="button"
							class="fq-btn"
							disabled={busy}
							onclick={() =>
								void runAction(
									pickupKey,
									'/shipments/shiprocket/pickup',
									postJson({ shipmentId: shipment.id })
								)}
						>
							{activeAction === pickupKey ? 'Scheduling...' : 'Schedule pickup'}
						</button>
					{/if}
					{#if shipment?.shiprocketShipmentId && !shipmentCancelled}
						<button
							type="button"
							class="fq-btn"
							disabled={busy}
							onclick={() =>
								void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)}
						>
							{activeAction === trackingKey ? 'Refreshing...' : 'Refresh tracking'}
						</button>
					{/if}
					{#if shipment?.manifestUrl && !shipmentCancelled}
						<button type="button" class="fq-btn" onclick={() => openExternal(shipment.manifestUrl)}>
							<ExternalLink class="size-3.5" strokeWidth={2} />
							Manifest
						</button>
					{/if}
					{#if shipment?.labelUrl && !shipmentCancelled}
						<button type="button" class="fq-btn" onclick={() => openExternal(shipment.labelUrl)}>
							<ExternalLink class="size-3.5" strokeWidth={2} />
							Labels
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.fq-board {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.fq-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 14px 16px;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
	}

	.fq-toolbar-main {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.fq-toolbar-icon {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		border-radius: 10px;
		border: 1px solid var(--border-faint);
		background: linear-gradient(135deg, var(--heat-4), white);
		color: var(--heat-100);
	}

	.fq-title {
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
	}

	.fq-subtitle {
		font-size: 11px;
		color: var(--black-alpha-40);
	}

	.fq-toolbar-stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
	}

	.fq-stat {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.fq-stat-label {
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--black-alpha-40);
	}

	.fq-stat-value {
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
	}

	.fq-stat-warn {
		font-size: 10px;
		color: var(--accent-crimson);
	}

	.fq-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.fq-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 999px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 5px 12px;
		font-size: 11px;
		font-weight: 500;
		color: var(--black-alpha-48);
	}

	.fq-chip.hot {
		border-color: var(--heat-20);
		background: var(--heat-4);
		color: var(--heat-100);
	}

	.fq-chip-num {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.fq-bulkbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		border-radius: 10px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 8px 12px;
	}

	.fq-bulk-label {
		margin-right: 4px;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
	}

	.fq-bulk-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.fq-btn {
		display: inline-flex;
		height: 32px;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 8px;
		border: 1px solid var(--border-muted);
		background: white;
		padding: 0 12px;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
		transition:
			border-color 140ms ease,
			color 140ms ease,
			background-color 140ms ease;
	}

	.fq-btn:hover:not(:disabled) {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	.fq-btn:disabled,
	.fq-btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fq-btn-primary {
		height: 32px;
		border-radius: 8px;
		padding: 0 14px;
		font-size: 12px;
		font-weight: 600;
	}

	.fq-btn-sm {
		height: 28px;
		padding: 0 10px;
		font-size: 11px;
	}

	.fq-error {
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--accent-crimson) 24%, white);
		background: color-mix(in srgb, var(--accent-crimson) 6%, white);
		padding: 10px 12px;
		font-size: 12px;
		color: var(--accent-crimson);
	}

	.fq-table-wrap {
		overflow-x: auto;
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.fq-table {
		width: 100%;
		min-width: 980px;
		border-collapse: collapse;
		font-size: 12px;
		text-align: left;
	}

	.fq-table thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--background-lighter);
		border-bottom: 1px solid var(--border-faint);
		padding: 10px 14px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
		white-space: nowrap;
	}

	.fq-table tbody td {
		padding: 12px 14px;
		border-bottom: 1px solid var(--border-faint);
		vertical-align: top;
	}

	.fq-table tbody tr:last-child td {
		border-bottom: 0;
	}

	.fq-check-col {
		width: 44px;
	}

	.fq-act-col {
		width: 220px;
	}

	.fq-row {
		cursor: pointer;
		outline: none;
		transition: background-color 140ms ease;
	}

	.fq-row:hover {
		background: var(--heat-4);
	}

	.fq-row:focus-visible {
		background: var(--heat-4);
		box-shadow: inset 2px 0 0 var(--heat-100);
	}

	.fq-row.is-active {
		background: var(--heat-8);
	}

	.fq-check {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 6px;
		border: 1.5px solid var(--black-alpha-24);
		background: white;
		color: white;
		transition:
			background-color 140ms ease,
			border-color 140ms ease;
	}

	.fq-check:hover:not(:disabled) {
		border-color: var(--heat-100);
	}

	.fq-check.active {
		border-color: var(--heat-100);
		background: var(--heat-100);
	}

	.fq-check:disabled {
		opacity: 0.4;
	}

	.fq-order {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}

	.fq-thumb {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 3px;
		overflow: hidden;
	}

	.fq-thumb img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.fq-thumb-count {
		position: absolute;
		right: -4px;
		bottom: -4px;
		display: grid;
		place-items: center;
		min-width: 16px;
		height: 16px;
		padding: 0 3px;
		border-radius: 999px;
		background: var(--heat-100);
		color: white;
		font-size: 9px;
		font-weight: 700;
	}

	.fq-order-id {
		font-family: ui-monospace, monospace;
		font-size: 12px;
		font-weight: 600;
		color: var(--foreground);
	}

	.fq-order-name {
		margin-top: 1px;
		font-size: 12px;
		color: var(--black-alpha-64);
	}

	.fq-order-meta {
		margin-top: 1px;
		font-size: 11px;
		color: var(--black-alpha-48);
		font-variant-numeric: tabular-nums;
	}

	.fq-order-date {
		margin-top: 1px;
		font-size: 10px;
		color: var(--black-alpha-32);
	}

	.fq-cell-strong {
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.fq-cell-muted {
		font-size: 12px;
		color: var(--black-alpha-48);
	}

	.fq-cell-track {
		max-width: 240px;
		font-size: 12px;
		color: var(--black-alpha-72);
	}

	.fq-pill {
		display: inline-block;
		border-radius: 6px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		text-transform: capitalize;
		letter-spacing: 0.02em;
	}

	.fq-pill.ok {
		background: color-mix(in srgb, var(--accent-forest) 12%, white);
		color: var(--accent-forest);
	}

	.fq-pill.warn {
		background: color-mix(in srgb, var(--accent-honey) 14%, white);
		color: var(--accent-honey);
	}

	.fq-pill.bad {
		background: color-mix(in srgb, var(--accent-crimson) 10%, white);
		color: var(--accent-crimson);
	}

	.fq-pill.muted {
		background: var(--background-lighter);
		border: 1px solid var(--border-faint);
		color: var(--black-alpha-56);
	}

	.fq-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--heat-100);
	}

	.fq-link:hover {
		text-decoration: underline;
	}

	.fq-row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		max-width: 220px;
	}

	.fq-empty {
		margin: 10px;
		border-radius: 10px;
		border: 1px dashed var(--border-muted);
		background: var(--background-lighter);
		padding: 32px;
		text-align: center;
		font-size: 12px;
		color: var(--black-alpha-56);
	}

	/* ── Detail drawer ── */
	.fq-drawer-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(15, 15, 15, 0.32);
		backdrop-filter: blur(1.5px);
		border: 0;
	}

	.fq-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 61;
		width: min(600px, 100vw);
		display: flex;
		flex-direction: column;
		background: white;
		border-left: 1px solid var(--border-faint);
		box-shadow: -16px 0 48px rgba(0, 0, 0, 0.16);
	}

	.fq-drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-shrink: 0;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border-faint);
		background: var(--background-lighter);
	}

	.fq-drawer-kicker {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--heat-100);
	}

	.fq-drawer-title {
		margin-top: 2px;
		font-family: ui-monospace, monospace;
		font-size: 16px;
		font-weight: 700;
		color: var(--foreground);
	}

	.fq-drawer-sub {
		margin-top: 2px;
		font-size: 12px;
		color: var(--black-alpha-56);
	}

	.fq-drawer-close {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex-shrink: 0;
		border-radius: 8px;
		border: 1px solid var(--border-muted);
		background: white;
		color: var(--black-alpha-56);
		transition:
			color 140ms ease,
			border-color 140ms ease;
	}

	.fq-drawer-close:hover {
		border-color: var(--accent-crimson);
		color: var(--accent-crimson);
	}

	.fq-drawer-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.fq-drawer-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.fq-card {
		border-radius: 10px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 14px;
	}

	.fq-card-actions {
		border-color: var(--heat-20);
		background: linear-gradient(180deg, var(--heat-4), white 60%);
	}

	.fq-card-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: var(--foreground);
	}

	.fq-card-text {
		margin-top: 8px;
		font-size: 12px;
		color: var(--black-alpha-72);
	}

	.fq-card-sub {
		margin-top: 4px;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
	}

	.fq-item {
		display: grid;
		grid-template-columns: 56px 1fr auto;
		gap: 10px;
		align-items: center;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 8px;
	}

	.fq-item-img {
		width: 56px;
		height: 56px;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		object-fit: contain;
		padding: 4px;
	}

	.fq-item-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.fq-item-meta {
		margin-top: 2px;
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
	}

	.fq-item-qty {
		text-align: center;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 4px 10px;
	}

	.fq-item-qty span {
		display: block;
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
	}

	.fq-item-qty strong {
		font-size: 15px;
		font-weight: 600;
		color: var(--foreground);
	}

	.fq-meta-grid {
		margin-top: 10px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.fq-meta {
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 8px 10px;
	}

	.fq-meta span {
		display: block;
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
	}

	.fq-meta strong {
		display: block;
		margin-top: 3px;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
		text-transform: capitalize;
	}

	@media (max-width: 640px) {
		.fq-drawer {
			width: 100vw;
		}
	}
</style>
