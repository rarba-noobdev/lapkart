<script lang="ts">
	import { onMount } from 'svelte';
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
			const [accountResponse, queueResponse] = await Promise.all([
				requestAdmin<ShiprocketAccount>('/shiprocket/account'),
				requestAdmin<{ orders: FulfillmentOrder[] }>('/admin/fulfillment/orders')
			]);
			account = accountResponse;
			const nextOrders = queueResponse.orders ?? [];
			orders = nextOrders;
			syncQueueState(nextOrders);
		} catch (requestError) {
			error =
				requestError instanceof Error
					? requestError.message
					: 'Could not load Shiprocket fulfillment';
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

	onMount(() => {
		void refresh();
		const channel = auth.supabase
			.channel('admin-fulfillment-queue')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_events' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_packages' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipping_batches' }, scheduleFulfillmentRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipping_batch_items' }, scheduleFulfillmentRefresh)
			.subscribe();

		return () => {
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="space-y-6">
	<section class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
		<div class="mb-4">
			<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
				Fulfillment desk
			</p>
			<p class="text-label-large mt-2 text-foreground">Shiprocket queue</p>
			<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
				Review paid orders, generate shipments, assign AWBs, and keep courier tracking current.
			</p>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap gap-3">
				<div
					class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Wallet balance
					</p>
					<p class="text-label-medium mt-2 text-foreground">
						{account ? formatINR(account.walletBalance) : 'Loading'}
					</p>
				</div>
				<div
					class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Pickup location
					</p>
					<p class="text-label-medium mt-2 text-foreground">
						{account?.configuredPickupLocation || 'Loading'}
					</p>
					{#if account && !account.pickupLocationVerified}
						<p class="text-body-small mt-1 text-red-700">
							Configured pickup location is not synced in Shiprocket.
						</p>
					{/if}
				</div>
				<div
					class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Order queue
					</p>
					<p class="text-label-medium mt-2 text-foreground">
						{orders.length} order{orders.length === 1 ? '' : 's'}
					</p>
				</div>
			</div>

			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={loading}
				onclick={() => void refresh()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		<div
			class="mt-4 flex flex-wrap items-center gap-2 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
		>
			<span class="text-mono-x-small mr-1 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
				{selectedOrderIds.length} selected / {selectedOrdersWithoutShipment.length} need shipment
			</span>

			<button
				type="button"
				class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
				disabled={!selectedOrderIds.length || activeAction !== null}
				onclick={() => void runBulkCreateShipments()}
			>
				{activeAction === 'bulk:create_orders' ? 'Creating...' : 'Bulk create shipments'}
			</button>

			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('assign_awb')}
			>
				{activeAction === 'bulk:assign_awb' ? 'Assigning...' : 'Bulk AWB'}
			</button>

			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('schedule_pickup')}
			>
				{activeAction === 'bulk:schedule_pickup' ? 'Scheduling...' : 'Bulk pickup'}
			</button>

			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('generate_labels')}
			>
				{activeAction === 'bulk:generate_labels' ? 'Generating...' : 'Bulk labels'}
			</button>

			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('refresh_tracking')}
			>
				{activeAction === 'bulk:refresh_tracking' ? 'Refreshing...' : 'Bulk tracking'}
			</button>
		</div>

		{#if error}
			<div
				class="text-body-small mt-4 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
			>
				{error}
			</div>
		{/if}

		<div class="mt-5 overflow-x-auto">
			<table class="w-full min-w-[980px] border-collapse text-left">
				<thead>
					<tr
						class="text-mono-x-small border-b border-[var(--border-faint)] tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
					>
						<th class="w-10 px-3 py-3 font-normal">
							<input
								type="checkbox"
								checked={allVisibleOrdersSelected}
								onchange={toggleAllVisibleOrders}
								aria-label="Select all visible orders"
								class="size-4 accent-[var(--heat-100)]"
							/>
						</th>
						<th class="px-3 py-3 font-normal">Order</th>
						<th class="px-3 py-3 font-normal">Delivery</th>
						<th class="px-3 py-3 font-normal">Shipment</th>
						<th class="px-3 py-3 font-normal">Tracking</th>
						<th class="px-3 py-3 font-normal">Actions</th>
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

						<tr
							class={`border-b border-[var(--border-faint)] align-top transition-colors last:border-b-0 ${
								detailOrderId === order.id
									? 'bg-[var(--heat-4)]'
									: 'hover:bg-[var(--background-lighter)]'
							}`}
						>
							<td class="px-3 py-4">
								<input
									type="checkbox"
									checked={selectedOrderSet.has(order.id)}
									onchange={() => toggleOrderSelection(order.id)}
									aria-label={`Select order ${order.id.slice(0, 8)}`}
									class="size-4 accent-[var(--heat-100)]"
								/>
							</td>
							<td class="px-3 py-4">
								<button type="button" class="group text-left" onclick={() => openDetails(order.id)}>
									<p class="text-label-small text-foreground">
										#{order.id.slice(0, 8).toUpperCase()}
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										{order.shippingName || 'Customer'}
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										{formatINR(Number(order.total ?? 0))}
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										Placed {new Date(order.createdAt).toLocaleString('en-IN')}
									</p>
									<p
										class="text-mono-x-small mt-2 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										{order.items.length} item{order.items.length === 1 ? '' : 's'}
									</p>
								</button>
							</td>
							<td class="px-3 py-4">
								<p class="text-label-small text-foreground capitalize">{serviceType}</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{[order.shippingCity, order.shippingState, order.shippingPincode]
										.filter(Boolean)
										.join(', ') || 'Address pending'}
								</p>
							</td>
							<td class="px-3 py-4">
								<p class="text-label-small text-foreground capitalize">
									{shipment?.status?.replaceAll('_', ' ') || 'Not created'}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{shipment?.awbCode ? `AWB ${shipment.awbCode}` : 'AWB pending'}
								</p>
								{#if shipment?.courierName}
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										{shipment.courierName}
									</p>
								{/if}
							</td>
							<td class="px-3 py-4">
								<p class="text-body-small max-w-[240px] text-[var(--black-alpha-72)]">
									{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
								</p>
								{#if latest?.location}
									<p class="text-body-small mt-1 text-[var(--black-alpha-48)]">{latest.location}</p>
								{/if}
								{#if shipment?.trackingUrl}
									<button
										type="button"
										class="text-label-small mt-2 inline-block text-[var(--heat-100)] hover:underline"
										onclick={() => openExternal(shipment.trackingUrl)}
									>
										Live tracking
									</button>
								{/if}
							</td>
							<td class="px-3 py-4">
								<div class="flex max-w-[300px] flex-wrap gap-2">
									<button
										type="button"
										class="text-label-small inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openDetails(order.id)}
									>
										View details
									</button>

									{#if !shipment}
										<button
											type="button"
											class="button button-primary text-label-small inline-flex h-9 items-center justify-center rounded-md px-3 text-white disabled:opacity-60"
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

									{#if shipment && !shipment.awbCode}
										<button
											type="button"
											class="text-label-small inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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
													? 'Assign AWB and rider'
													: 'Assign AWB'}
										</button>
									{/if}

									{#if shipment?.awbCode && serviceType === 'standard' && !shipment.pickupScheduledDate}
										<button
											type="button"
											class="text-label-small inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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

									{#if shipment?.shiprocketShipmentId}
										<button
											type="button"
											class="text-label-small inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
											disabled={busy}
											onclick={() =>
												void runAction(
													trackingKey,
													`/shipments/shiprocket/${shipment.id}/tracking`
												)}
										>
											{activeAction === trackingKey ? 'Refreshing...' : 'Refresh tracking'}
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if !loading && !orders.length}
				<p
					class="text-body-small rounded-[16px] border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] py-8 text-center text-[var(--black-alpha-56)]"
				>
					No paid orders are waiting for fulfillment.
				</p>
			{/if}
		</div>
	</section>

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

		<div class="fixed inset-0 z-50">
			<button
				type="button"
				class="motion-backdrop absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
				aria-label="Close fulfillment details"
				onclick={closeDetails}
			></button>

			<div class="pointer-events-none absolute inset-0 overflow-y-auto p-3 sm:p-6">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="fulfillment-detail-title"
					class="motion-dialog pointer-events-auto mx-auto grid w-full max-w-6xl gap-6 rounded-[24px] border border-[var(--border-faint)] bg-[var(--background-base)] p-4 shadow-[var(--shadow-pop)] sm:p-6 lg:grid-cols-[1.15fr_0.85fr]"
				>
					<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Fulfillment detail
								</p>
								<h2 id="fulfillment-detail-title" class="text-title-h5 mt-1 text-foreground">
									#{detailOrder.id.slice(0, 8).toUpperCase()}
								</h2>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{detailOrder.shippingName || 'Customer'} / {formatINR(
										Number(detailOrder.total ?? 0)
									)}
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="text-label-small inline-flex h-9 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
									onclick={closeDetails}
								>
									Close
								</button>
								<span
									class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses('neutral')}`}
								>
									{serviceType}
								</span>
								<span
									class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(shipment?.status || 'pending'))}`}
								>
									{shipment?.status || 'not_created'}
								</span>
							</div>
						</div>

						<div class="mt-5 space-y-3">
							{#each detailOrder.items as item (item.id)}
								<div
									class="grid gap-3 rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center"
								>
									<img
										src={item.image}
										alt={item.title}
										class="h-24 w-24 rounded-md border border-[var(--border-faint)] bg-white object-contain p-2"
									/>
									<div class="min-w-0">
										<p class="text-label-medium line-clamp-2 text-foreground">{item.title}</p>
										<div
											class="text-mono-x-small mt-2 flex flex-wrap gap-2 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>
											<span>{item.brand || 'Brand pending'}</span>
											<span>SKU {item.sku || 'pending'}</span>
										</div>
									</div>
									<div
										class="rounded-[12px] border border-[var(--border-faint)] bg-white px-3 py-2 text-center"
									>
										<p
											class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>
											Qty
										</p>
										<p class="text-label-large mt-1 text-foreground">{item.qty}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="space-y-4">
						<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5">
							<p class="text-label-small text-foreground">Delivery</p>
							<p class="text-body-small mt-3 text-[var(--black-alpha-72)]">
								{[detailOrder.shippingCity, detailOrder.shippingState, detailOrder.shippingPincode]
									.filter(Boolean)
									.join(', ') || 'Address pending'}
							</p>
							<p
								class="text-mono-x-small mt-2 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>
								Service {serviceType}
							</p>
						</div>

						<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5">
							<p class="text-label-small text-foreground">Shipment</p>
							<div class="mt-4 grid gap-3 sm:grid-cols-2">
								<div
									class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
								>
									<p
										class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										Status
									</p>
									<p class="text-body-small mt-2 text-foreground">
										{shipment?.status?.replaceAll('_', ' ') || 'Not created'}
									</p>
								</div>
								<div
									class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
								>
									<p
										class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										AWB
									</p>
									<p class="text-body-small mt-2 text-foreground">
										{shipment?.awbCode || 'Pending'}
									</p>
								</div>
								<div
									class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
								>
									<p
										class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										Courier
									</p>
									<p class="text-body-small mt-2 text-foreground">
										{shipment?.courierName || 'Pending'}
									</p>
								</div>
								<div
									class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
								>
									<p
										class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										Pickup
									</p>
									<p class="text-body-small mt-2 text-foreground">
										{shipment?.pickupScheduledDate || 'Not scheduled'}
									</p>
								</div>
							</div>
						</div>

						<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5">
							<p class="text-label-small text-foreground">Tracking</p>
							<p class="text-body-small mt-3 text-[var(--black-alpha-72)]">
								{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
							</p>
							{#if latest?.location}
								<p class="text-body-small mt-1 text-[var(--black-alpha-48)]">{latest.location}</p>
							{/if}
							{#if shipment?.trackingUrl}
								<button
									type="button"
									class="text-label-small mt-3 inline-block text-[var(--heat-100)] hover:underline"
									onclick={() => openExternal(shipment.trackingUrl)}
								>
									Open live tracking
								</button>
							{/if}
						</div>

						<div class="rounded-[18px] border border-[var(--heat-20)] bg-white p-5">
							<p class="text-label-small text-foreground">Fulfillment actions</p>
							<div class="mt-3 flex flex-wrap gap-2">
								{#if !shipment}
									<button
										type="button"
										class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
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
								{#if shipment && !shipment.awbCode}
									<button
										type="button"
										class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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
												? 'Assign AWB and rider'
												: 'Assign AWB'}
									</button>
								{/if}
								{#if shipment?.awbCode && serviceType === 'standard' && !shipment.pickupScheduledDate}
									<button
										type="button"
										class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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
								{#if shipment?.shiprocketShipmentId}
									<button
										type="button"
										class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
										disabled={busy}
										onclick={() =>
											void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)}
									>
										{activeAction === trackingKey ? 'Refreshing...' : 'Refresh tracking'}
									</button>
								{/if}
								{#if shipment?.manifestUrl}
									<button
										type="button"
										class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openExternal(shipment.manifestUrl)}
									>
										Open manifest
									</button>
								{/if}
								{#if shipment?.labelUrl}
									<button
										type="button"
										class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openExternal(shipment.labelUrl)}
									>
										Open labels
									</button>
								{/if}
								<button
									type="button"
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
									onclick={closeDetails}
								>
									Close details
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
