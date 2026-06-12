<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
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
				requestError instanceof Error
					? requestError.message
					: 'Could not load fulfillment queue';
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

<div class="space-y-4">
	<section class="rounded-lg border border-[var(--border-faint)] bg-white p-5">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
					Fulfillment desk
				</p>
				<p class="mt-1 text-[16px] font-medium text-foreground">Manual dispatch queue</p>
			</div>

			<div class="flex flex-wrap items-center gap-4">
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>Provider</span
					>
					<span class="text-[14px] font-medium text-foreground"
						>{account ? `Shiprocket ${formatINR(account.walletBalance)}` : 'Manual'}</span
					>
				</div>
				<div class="h-4 w-px bg-[var(--border-faint)]"></div>
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>Pickup</span
					>
					<span class="text-[14px] font-medium text-foreground"
						>{account?.configuredPickupLocation || 'Daily courier pickup'}</span
					>
					{#if account && !account.pickupLocationVerified}
						<span class="text-[10px] text-[var(--accent-crimson)]">Not synced</span>
					{/if}
				</div>
				<div class="h-4 w-px bg-[var(--border-faint)]"></div>
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
						>Queue</span
					>
					<span class="text-[14px] font-medium text-foreground">{orders.length}</span>
				</div>
				<button
					type="button"
					class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
					disabled={loading}
					onclick={() => void refresh()}
				>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		</div>

		<div class="mb-3 flex flex-wrap gap-2">
			{#each stageChips as chip (chip.id)}
				<span
					class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium
						{chip.count > 0 && chip.hot
						? 'border-[var(--heat-20)] bg-[var(--heat-4)] text-[var(--heat-100)]'
						: 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}"
				>
					<span class="font-mono tabular-nums">{chip.count}</span>
					{chip.label}
				</span>
			{/each}
		</div>

		<div
			class="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2"
		>
			<span class="mr-1 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
				{selectedOrderIds.length} selected / {selectedOrdersWithoutShipment.length} need shipment
			</span>

			<button
				type="button"
				class="button button-primary inline-flex h-8 items-center justify-center rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-50"
				disabled={!selectedOrderIds.length || activeAction !== null}
				onclick={() => void runBulkCreateShipments()}
			>
				{activeAction === 'bulk:create_orders' ? 'Creating...' : 'Bulk create shipments'}
			</button>

			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('assign_awb')}
			>
				{activeAction === 'bulk:assign_awb' ? 'Assigning...' : 'Bulk AWB'}
			</button>

			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('schedule_pickup')}
			>
				{activeAction === 'bulk:schedule_pickup' ? 'Scheduling...' : 'Bulk pickup'}
			</button>

			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('generate_labels')}
			>
				{activeAction === 'bulk:generate_labels' ? 'Generating...' : 'Bulk labels'}
			</button>

			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
				disabled={!selectedShipmentIds.length || activeAction !== null}
				onclick={() => void runBulkAction('refresh_tracking')}
			>
				{activeAction === 'bulk:refresh_tracking' ? 'Refreshing...' : 'Bulk tracking'}
			</button>
		</div>

		{#if error}
			<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
				{error}
			</div>
		{/if}

		<div class="mt-4 overflow-x-auto">
			<table class="w-full min-w-[980px] border-collapse text-left text-[12px]">
				<thead>
					<tr
						class="border-b border-[var(--border-faint)] text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
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
						{@const shipmentCancelled =
							shipment?.status === 'cancelled' || (shipment?.status?.startsWith('rto') ?? false)}

						<tr
							class={`border-b border-[var(--border-faint)] align-top transition-colors last:border-b-0 ${
								detailOrderId === order.id
									? 'bg-[var(--heat-4)]'
									: 'hover:bg-[var(--background-lighter)]'
							}`}
						>
							<td class="px-3 py-3">
								<input
									type="checkbox"
									checked={selectedOrderSet.has(order.id)}
									onchange={() => toggleOrderSelection(order.id)}
									aria-label={`Select order ${order.id.slice(0, 8)}`}
									class="size-4 accent-[var(--heat-100)]"
								/>
							</td>
							<td class="px-3 py-3">
								<button type="button" class="group text-left" onclick={() => openDetails(order.id)}>
									<p class="text-[12px] font-medium text-foreground">
										#{order.id.slice(0, 8).toUpperCase()}
									</p>
									<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
										{order.shippingName || 'Customer'}
									</p>
									<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
										{formatINR(Number(order.total ?? 0))}
									</p>
									<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
										Placed {new Date(order.createdAt).toLocaleString('en-IN')}
									</p>
									<p
										class="mt-1 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										{order.items.length} item{order.items.length === 1 ? '' : 's'}
									</p>
								</button>
							</td>
							<td class="px-3 py-3">
								<p class="text-[12px] font-medium text-foreground capitalize">{serviceType}</p>
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
									{[order.shippingCity, order.shippingState, order.shippingPincode]
										.filter(Boolean)
										.join(', ') || 'Address pending'}
								</p>
							</td>
							<td class="px-3 py-3">
								<p class="text-[12px] font-medium text-foreground capitalize">
									{shipment?.status?.replaceAll('_', ' ') || 'Not created'}
								</p>
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
									{shipment?.awbCode ? `AWB ${shipment.awbCode}` : 'AWB pending'}
								</p>
								{#if shipment?.courierName}
									<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
										{shipment.courierName}
									</p>
								{/if}
							</td>
							<td class="px-3 py-3">
								<p class="max-w-[240px] text-[12px] text-[var(--black-alpha-72)]">
									{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
								</p>
								{#if latest?.location}
									<p class="mt-0.5 text-[12px] text-[var(--black-alpha-48)]">{latest.location}</p>
								{/if}
								{#if shipment?.trackingUrl && !shipmentCancelled}
									<button
										type="button"
										class="mt-1 inline-block text-[12px] font-medium text-[var(--heat-100)] hover:underline"
										onclick={() => openExternal(shipment.trackingUrl)}
									>
										Live tracking
									</button>
								{/if}
							</td>
							<td class="px-3 py-3">
								<div class="flex max-w-[300px] flex-wrap gap-1.5">
									<button
										type="button"
										class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--border-muted)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openDetails(order.id)}
									>
										Details
									</button>

									{#if shipmentCancelled}
										<span
											class="inline-flex h-7 items-center rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/8 px-2.5 text-[10px] tracking-[0.14em] text-[var(--accent-crimson)] uppercase"
										>
											Cancelled
										</span>
									{:else if !shipment}
										<button
											type="button"
											class="button button-primary inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[12px] font-medium text-white disabled:opacity-50"
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
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
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
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
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
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
											disabled={busy}
											onclick={() =>
												void runAction(
													trackingKey,
													`/shipments/shiprocket/${shipment.id}/tracking`
												)}
										>
											{activeAction === trackingKey ? 'Refreshing...' : 'Tracking'}
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
					class="rounded-md border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] py-8 text-center text-[12px] text-[var(--black-alpha-56)]"
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
		{@const shipmentCancelled =
			shipment?.status === 'cancelled' || (shipment?.status?.startsWith('rto') ?? false)}

		<div class="fixed inset-0 z-50">
			<button
				type="button"
				class="absolute inset-0 cursor-default bg-black/30 backdrop-blur-[2px]"
				aria-label="Close fulfillment details"
				onclick={closeDetails}
				transition:fade={{ duration: 180 }}
			></button>

			<div class="pointer-events-none absolute inset-0 overflow-y-auto p-3 sm:p-6">
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="fulfillment-detail-title"
					class="pointer-events-auto mx-auto grid w-full max-w-6xl gap-5 rounded-lg border border-[var(--border-faint)] bg-[var(--background-base)] p-4 shadow-lg sm:p-5 lg:grid-cols-[1.15fr_0.85fr]"
					transition:fly={{ y: 24, duration: 250 }}
				>
					<div class="rounded-lg border border-[var(--border-faint)] bg-white p-5">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
									Fulfillment detail
								</p>
								<h2
									id="fulfillment-detail-title"
									class="mt-1 text-[18px] font-semibold text-foreground"
								>
									#{detailOrder.id.slice(0, 8).toUpperCase()}
								</h2>
								<p class="mt-1 text-[12px] text-[var(--black-alpha-56)]">
									{detailOrder.shippingName || 'Customer'} / {formatINR(
										Number(detailOrder.total ?? 0)
									)}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
									onclick={closeDetails}
								>
									Close
								</button>
								<span
									class="rounded-full border border-[var(--border-muted)] bg-[var(--background-lighter)] px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase"
								>
									{serviceType}
								</span>
								{#if shipment?.status === 'delivered'}
									<span
										class="rounded-full border border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/8 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[var(--accent-forest)] uppercase"
									>
										{shipment.status}
									</span>
								{:else if shipment?.status === 'cancelled' || shipment?.status === 'rto'}
									<span
										class="rounded-full border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/8 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[var(--accent-crimson)] uppercase"
									>
										{shipment.status}
									</span>
								{:else if shipment?.status}
									<span
										class="rounded-full border border-[var(--accent-honey)]/20 bg-[var(--accent-honey)]/8 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[var(--accent-honey)] uppercase"
									>
										{shipment.status.replaceAll('_', ' ')}
									</span>
								{:else}
									<span
										class="rounded-full border border-[var(--border-muted)] bg-[var(--background-lighter)] px-2.5 py-1 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										not created
									</span>
								{/if}
							</div>
						</div>

						<div class="mt-4 space-y-2.5">
							{#each detailOrder.items as item (item.id)}
								<div
									class="grid gap-3 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 sm:grid-cols-[80px_1fr_auto] sm:items-center"
								>
									<img
										src={item.image}
										alt={item.title}
										class="h-20 w-20 rounded-md border border-[var(--border-faint)] bg-white object-contain p-1.5"
									/>
									<div class="min-w-0">
										<p class="line-clamp-2 text-[14px] font-medium text-foreground">{item.title}</p>
										<div
											class="mt-1.5 flex flex-wrap gap-2 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
										>
											<span>{item.brand || 'Brand pending'}</span>
											<span>SKU {item.sku || 'pending'}</span>
										</div>
									</div>
									<div
										class="rounded-md border border-[var(--border-faint)] bg-white px-3 py-1.5 text-center"
									>
										<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
											Qty
										</p>
										<p class="mt-0.5 text-[16px] font-medium text-foreground">{item.qty}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="space-y-3">
						<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
							<p class="text-[12px] font-medium text-foreground">Delivery</p>
							<p class="mt-2 text-[12px] text-[var(--black-alpha-72)]">
								{[detailOrder.shippingCity, detailOrder.shippingState, detailOrder.shippingPincode]
									.filter(Boolean)
									.join(', ') || 'Address pending'}
							</p>
							<p
								class="mt-1.5 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
							>
								Service {serviceType}
							</p>
						</div>

						<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
							<p class="text-[12px] font-medium text-foreground">Shipment</p>
							<div class="mt-3 grid gap-2.5 sm:grid-cols-2">
								<div
									class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
								>
									<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
										Status
									</p>
									<p class="mt-1.5 text-[12px] text-foreground">
										{shipment?.status?.replaceAll('_', ' ') || 'Not created'}
									</p>
								</div>
								<div
									class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
								>
									<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
										AWB
									</p>
									<p class="mt-1.5 text-[12px] text-foreground">
										{shipment?.awbCode || 'Pending'}
									</p>
								</div>
								<div
									class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
								>
									<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
										Courier
									</p>
									<p class="mt-1.5 text-[12px] text-foreground">
										{shipment?.courierName || 'Pending'}
									</p>
								</div>
								<div
									class="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
								>
									<p class="text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">
										Pickup
									</p>
									<p class="mt-1.5 text-[12px] text-foreground">
										{shipment?.pickupScheduledDate || 'Not scheduled'}
									</p>
								</div>
							</div>
						</div>

						<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
							<p class="text-[12px] font-medium text-foreground">Tracking</p>
							<p class="mt-2 text-[12px] text-[var(--black-alpha-72)]">
								{latest?.activity || latest?.status || 'Tracking starts after AWB assignment'}
							</p>
							{#if latest?.location}
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-48)]">{latest.location}</p>
							{/if}
							{#if shipment?.trackingUrl && !shipmentCancelled}
								<button
									type="button"
									class="mt-2 inline-block text-[12px] font-medium text-[var(--heat-100)] hover:underline"
									onclick={() => openExternal(shipment.trackingUrl)}
								>
									Open live tracking
								</button>
							{/if}
						</div>

						<div class="rounded-lg border border-[var(--heat-20)] bg-white p-4">
							<p class="text-[12px] font-medium text-foreground">Fulfillment actions</p>
							<div class="mt-2.5 flex flex-wrap gap-1.5">
								{#if shipmentCancelled}
									<span
										class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/8 px-3 py-1.5 text-[12px] text-[var(--accent-crimson)]"
									>
										Shipment cancelled — no further actions.
									</span>
								{:else if !shipment}
									<button
										type="button"
										class="button button-primary inline-flex h-8 items-center justify-center rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-50"
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
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
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
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
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
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
										disabled={busy}
										onclick={() =>
											void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)}
									>
										{activeAction === trackingKey ? 'Refreshing...' : 'Refresh tracking'}
									</button>
								{/if}
								{#if shipment?.manifestUrl && !shipmentCancelled}
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openExternal(shipment.manifestUrl)}
									>
										Open manifest
									</button>
								{/if}
								{#if shipment?.labelUrl && !shipmentCancelled}
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
										onclick={() => openExternal(shipment.labelUrl)}
									>
										Open labels
									</button>
								{/if}
								<button
									type="button"
									class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
									onclick={closeDetails}
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
