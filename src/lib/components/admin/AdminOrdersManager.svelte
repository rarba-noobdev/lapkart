<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import {
		adminReasonRequired,
		adminShipmentStarted,
		canAdminCancelOrder,
		canAdminReturnOrder,
		canTransitionManualOrderStatusClient,
		emptyOrderEditor,
		emptyRefundEditor,
		isTerminalOrder,
		manualOrderStatusOptions,
		manualOrderStatusValues,
		mapOrderToEditor,
		mapOrderToRefundEditor,
		nextProgressiveOrderStatus,
		paymentStatusOptions,
		paymentStatusOptionsForOrder,
		requestAdmin,
		roundMoney,
		statusOptionLabel,
		type AdminOrderRecord,
		type OrderEditorState,
		type RefundEditorState
	} from '$lib/admin';

	const auth = getAuthContext();

	type AdminOrderPatch = {
		id: string;
		status?: string | null;
		paymentStatus?: string | null;
		updatedAt?: string | null;
	};

	let orders = $state<AdminOrderRecord[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let refundSaving = $state(false);
	let workflowAction = $state<string | null>(null);
	let search = $state('');
	let selectedId = $state<string | null>(null);
	let editor = $state<OrderEditorState>(emptyOrderEditor());
	let refundEditor = $state<RefundEditorState>(emptyRefundEditor());
	let confirmingManualState = $state(false);
	let realtimeRefreshTimer: number | null = null;

	const filteredOrders = $derived.by(() =>
		orders.filter((order) =>
			`${order.id} ${order.userEmail ?? ''} ${order.shippingName ?? ''} ${order.shippingCity ?? ''}`
				.toLowerCase()
				.includes(search.toLowerCase())
		)
	);

	const selectedOrder = $derived(orders.find((order) => order.id === selectedId) ?? null);
	const selectedOrderLocked = $derived(selectedOrder ? isTerminalOrder(selectedOrder) : false);
	const refundableAmount = $derived(selectedOrder?.refundSummary.refundableAmount ?? 0);
	const orderStatusChanged = $derived(
		Boolean(selectedOrder && editor.status !== selectedOrder.status)
	);
	const paymentStatusChanged = $derived(
		Boolean(selectedOrder && editor.paymentStatus !== selectedOrder.paymentStatus)
	);
	const hasManualStateChange = $derived(orderStatusChanged || paymentStatusChanged);
	const reasonRequiredForEdit = $derived(adminReasonRequired(editor.status));
	const needsManualStateConfirmation = $derived(
		Boolean(
			selectedOrder && orderStatusChanged && ['cancelled', 'returned'].includes(editor.status)
		)
	);
	const nextOrderStatus = $derived(
		selectedOrder ? nextProgressiveOrderStatus(selectedOrder) : null
	);
	const canCancelSelectedOrder = $derived(
		selectedOrder ? canAdminCancelOrder(selectedOrder) : false
	);
	const canReturnSelectedOrder = $derived(
		selectedOrder ? canAdminReturnOrder(selectedOrder) : false
	);
	const allowedOrderStatusOptions = $derived(
		selectedOrder
			? manualOrderStatusOptions.map((option) => ({
					...option,
					disabled: !canTransitionManualOrderStatusClient(selectedOrder, option.value)
				}))
			: manualOrderStatusOptions.map((option) => ({ ...option, disabled: false }))
	);
	const allowedPaymentStatusOptions = $derived(
		selectedOrder
			? paymentStatusOptionsForOrder(selectedOrder)
			: paymentStatusOptions.map((option) => ({ ...option, disabled: false }))
	);

	function syncSelection(nextOrders: AdminOrderRecord[]) {
		if (!nextOrders.length) {
			selectedId = null;
			editor = emptyOrderEditor();
			refundEditor = emptyRefundEditor();
			confirmingManualState = false;
			return;
		}

		const nextOrder = nextOrders.find((order) => order.id === selectedId) ?? nextOrders[0];
		if (!nextOrder) return;

		selectedId = nextOrder.id;
		editor = mapOrderToEditor(nextOrder);
		refundEditor = mapOrderToRefundEditor(nextOrder);
		confirmingManualState = false;
	}

	async function loadOrders(showLoading = orders.length === 0) {
		try {
			if (showLoading) loading = true;
			error = null;
			const response = await requestAdmin<{ orders: AdminOrderRecord[] }>('/admin/orders');
			const nextOrders = response.orders ?? [];
			orders = nextOrders;
			syncSelection(nextOrders);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not load orders';
		} finally {
			if (showLoading) loading = false;
		}
	}

	function scheduleOrdersRefresh(delay = 350) {
		if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
		realtimeRefreshTimer = window.setTimeout(() => {
			void loadOrders(false);
		}, delay);
	}

	function patchOrderInMemory(patch: AdminOrderPatch, syncEditor = true) {
		let patched = false;
		const nextOrders = orders.map((order) => {
			if (order.id !== patch.id) return order;
			patched = true;
			return {
				...order,
				status: patch.status ?? order.status,
				paymentStatus: patch.paymentStatus ?? order.paymentStatus,
				updatedAt: patch.updatedAt ?? order.updatedAt
			};
		});

		if (!patched) return false;

		orders = nextOrders;
		if (syncEditor && selectedId === patch.id) {
			const nextOrder = nextOrders.find((order) => order.id === patch.id);
			if (nextOrder) {
				editor = mapOrderToEditor(nextOrder);
				refundEditor = mapOrderToRefundEditor(nextOrder);
				confirmingManualState = false;
			}
		}
		return true;
	}

	function handleOrderRealtimeChange(payload: {
		eventType?: string;
		new?: Record<string, unknown>;
		old?: Record<string, unknown>;
	}) {
		if (payload.eventType !== 'UPDATE' || !payload.new) {
			scheduleOrdersRefresh();
			return;
		}

		const row = payload.new;
		const id = typeof row.id === 'string' ? row.id : null;
		if (!id) {
			scheduleOrdersRefresh();
			return;
		}

		const patched = patchOrderInMemory(
			{
				id,
				status: typeof row.status === 'string' ? row.status : null,
				paymentStatus: typeof row.payment_status === 'string' ? row.payment_status : null,
				updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null
			},
			!saving
		);

		if (!patched) scheduleOrdersRefresh();
	}

	async function saveOrder() {
		if (!editor.id) return;
		if (selectedOrderLocked) {
			error =
				'Terminal orders are locked. Change them in the database only for exceptional recovery.';
			return;
		}
		if (selectedOrder && !canTransitionManualOrderStatusClient(selectedOrder, editor.status)) {
			error = 'That order transition is not allowed anymore.';
			return;
		}
		if (reasonRequiredForEdit && editor.reason.trim().length < 12) {
			error = 'Add a clear cancellation or return reason before saving.';
			return;
		}
		if (needsManualStateConfirmation && !confirmingManualState) {
			confirmingManualState = true;
			error = `Review the reason, then confirm ${editor.status.replaceAll('_', ' ')}.`;
			return;
		}

		const payload: Record<string, unknown> = {};
		if (selectedOrder && editor.status !== selectedOrder.status) {
			if (
				!manualOrderStatusValues.has(
					editor.status as (typeof manualOrderStatusOptions)[number]['value']
				)
			) {
				error = 'This order status is controlled by a workflow action.';
				return;
			}
			payload.status = editor.status;
		}
		if (selectedOrder && editor.paymentStatus !== selectedOrder.paymentStatus) {
			payload.paymentStatus = editor.paymentStatus;
		}
		if (editor.reason.trim()) payload.reason = editor.reason.trim();

		if (!('status' in payload) && !('paymentStatus' in payload)) {
			error = 'Change order status or payment status before saving.';
			return;
		}

		try {
			saving = true;
			error = null;
			const response = await requestAdmin<{ order?: AdminOrderPatch }>(`/admin/orders/${editor.id}`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			});
			confirmingManualState = false;
			if (response.order) {
				patchOrderInMemory(response.order);
				scheduleOrdersRefresh(1200);
			} else {
				scheduleOrdersRefresh();
			}
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not update order';
		} finally {
			saving = false;
		}
	}

	async function runWorkflowAction(
		key: string,
		path: string,
		body: Record<string, unknown>,
		successReason?: string
	) {
		try {
			workflowAction = key;
			error = null;
			await requestAdmin(path, {
				method: 'POST',
				body: JSON.stringify(body)
			});
			if (successReason) error = null;
			await loadOrders(false);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Workflow action failed';
		} finally {
			workflowAction = null;
		}
	}

	function prepareRefund({
		amount,
		reason,
		cancellationRequestId = null,
		returnRequestId = null
	}: {
		amount?: number;
		reason: string;
		cancellationRequestId?: string | null;
		returnRequestId?: string | null;
	}) {
		refundEditor = {
			amount: String(roundMoney(Math.min(amount ?? refundableAmount, refundableAmount))),
			reason: reason.slice(0, 500),
			speed: 'normal',
			cancellationRequestId,
			returnRequestId
		};
	}

	async function createRefund() {
		if (!selectedOrder) return;
		const amount = Number(refundEditor.amount);

		if (!Number.isFinite(amount) || amount <= 0) {
			error = 'Enter a valid refund amount.';
			return;
		}
		if (amount > refundableAmount) {
			error = `Refund cannot exceed ${formatINR(refundableAmount)} remaining.`;
			return;
		}
		if (refundEditor.reason.trim().length < 12) {
			error = 'Add a clear refund reason before creating the refund.';
			return;
		}

		try {
			refundSaving = true;
			error = null;
			await requestAdmin('/admin/refunds', {
				method: 'POST',
				body: JSON.stringify({
					orderId: selectedOrder.id,
					amount,
					reason: refundEditor.reason.trim(),
					speed: refundEditor.speed,
					cancellationRequestId: refundEditor.cancellationRequestId ?? undefined,
					returnRequestId: refundEditor.returnRequestId ?? undefined
				})
			});
			await loadOrders(false);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not create refund';
		} finally {
			refundSaving = false;
		}
	}

	function selectOrder(order: AdminOrderRecord) {
		selectedId = order.id;
		editor = mapOrderToEditor(order);
		refundEditor = mapOrderToRefundEditor(order);
		confirmingManualState = false;
		error = null;
	}

	function openExternal(url: string | null | undefined) {
		if (!url) return;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	onMount(() => {
		void loadOrders();
		const channel = auth.supabase
			.channel('admin-orders-manager')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'orders' },
				handleOrderRealtimeChange
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'shipment_events' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'order_invoices' }, () =>
				scheduleOrdersRefresh()
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'order_cancellation_requests' },
				() => scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'return_requests' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, () =>
				scheduleOrdersRefresh()
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'admin_order_events' }, () =>
				scheduleOrdersRefresh()
			)
			.subscribe();

		return () => {
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<div class="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
	<!-- ==================== SIDEBAR ==================== -->
	<section class="flex flex-col gap-3 xl:sticky xl:top-8 xl:self-start">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h2 class="text-[13px] font-medium text-foreground">Orders</h2>
				<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">Shipments, returns, refunds.</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)] hover:text-foreground disabled:opacity-50"
				disabled={loading}
				onclick={() => void loadOrders()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		<input
			bind:value={search}
			class="input-field !h-8 !text-[12px]"
			placeholder="Search order, customer, email, or city"
		/>

		<div class="flex max-h-[calc(100vh-220px)] flex-col gap-1.5 overflow-y-auto pr-1 pb-10">
			{#if loading && !orders.length}
				<div class="rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-3 text-[12px] text-[var(--black-alpha-48)]">
					Loading orders...
				</div>
			{:else if !filteredOrders.length}
				<div
					class="rounded-lg border border-dashed border-[var(--black-alpha-24)] bg-[var(--background-lighter)] p-4 text-center text-[12px] text-[var(--black-alpha-48)]"
				>
					No orders match the current search.
				</div>
			{:else}
				{#each filteredOrders as order (order.id)}
					<button
						type="button"
						class={`flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-all ${
							order.id === selectedId
								? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
								: order.status.toLowerCase() === 'cancelled'
									? 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/4 hover:border-[var(--accent-crimson)]/30 hover:bg-[var(--accent-crimson)]/6'
									: 'border-[var(--border-muted)] bg-white shadow-sm hover:border-[var(--black-alpha-24)] hover:bg-[var(--background-lighter)]'
						}`}
						onclick={() => selectOrder(order)}
					>
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="flex items-center gap-1.5">
									<p class="text-[12px] font-medium text-foreground">
										#{order.id.slice(0, 8).toUpperCase()}
									</p>
									{#if isTerminalOrder(order)}
										<span
											class="rounded bg-[var(--background-lighter)] px-1 py-px text-[10px] font-semibold tracking-wider text-[var(--black-alpha-48)] uppercase"
											>locked</span
										>
									{/if}
								</div>
								<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
									{new Date(order.createdAt).toLocaleString('en-IN', {
										month: 'short',
										day: 'numeric',
										hour: 'numeric',
										minute: 'numeric'
									})}
								</p>
							</div>
							<p class="text-[12px] font-medium text-foreground">{formatINR(order.total)}</p>
						</div>

						<div class="flex flex-wrap gap-1">
							<span
								class={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
									order.status === 'cancelled'
										? 'bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
										: order.status === 'delivered'
											? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
											: 'bg-[var(--accent-honey)]/12 text-[var(--accent-honey)]'
								}`}
							>
								{order.status}
							</span>
							<span
								class={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
									order.paymentStatus === 'paid'
										? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
										: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'
								}`}
							>
								{order.paymentStatus}
							</span>
							{#if order.cancellationRequest}
								<span
									class="rounded-md bg-[var(--accent-crimson)]/8 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--accent-crimson)] uppercase"
									>cancel {order.cancellationRequest.status}</span
								>
							{/if}
						</div>

						<div class="text-[11px] text-[var(--black-alpha-48)]">
							<span class="font-medium text-[var(--black-alpha-64)]"
								>{order.shippingName || order.userEmail || 'Customer'}</span
							>
							&middot; {[order.shippingCity, order.shippingState].filter(Boolean).join(', ') ||
								'Address pending'}
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</section>

	<!-- ==================== DETAIL PANEL ==================== -->
	<section class="flex flex-col gap-5 overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-sm">
		<div class="border-b border-[var(--border-muted)] bg-[var(--background-lighter)]/50 px-5 py-4">
			<h3 class="text-[13px] font-medium text-foreground">Order Details</h3>
		</div>

		<div class="space-y-6 px-5 pb-6">
			{#if error}
				<div class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]">
					{error}
				</div>
			{/if}

			{#if selectedOrder}
				{#if selectedOrderLocked}
					<div class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]">
						This order is in a terminal state. Status and payment edits are locked in the admin app.
						Use the database only for an exceptional correction.
					</div>
				{/if}

				<!-- Compact header row -->
				<div class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-3" in:fly={{ y: 8, duration: 200 }}>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Order</p>
						<p class="text-[13px] font-medium text-foreground">#{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
					</div>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Customer</p>
						<p class="text-[13px] font-medium text-foreground">{selectedOrder.shippingName || 'Customer'}</p>
					</div>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Total</p>
						<p class="text-[13px] font-medium text-foreground">{formatINR(selectedOrder.total)}</p>
					</div>
					<div class="flex flex-wrap items-center gap-1.5 ml-auto">
						<span
							class={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
								selectedOrder.status === 'cancelled'
									? 'bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
									: selectedOrder.status === 'delivered'
										? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
										: 'bg-[var(--accent-honey)]/12 text-[var(--accent-honey)]'
							}`}
						>
							{selectedOrder.status}
						</span>
						<span
							class={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
								selectedOrder.paymentStatus === 'paid'
									? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
									: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'
							}`}
						>
							{selectedOrder.paymentStatus}
						</span>
					</div>
				</div>

				<!-- Order Status (merged Current State + Manual Override) -->
				<section in:fly={{ y: 8, duration: 200 }}>
					<h4 class="mb-3 text-[13px] font-medium text-foreground">Order status</h4>
					<div class="rounded-lg border border-[var(--border-muted)] bg-white p-4 shadow-sm">
						<!-- Quick action buttons - only shown when applicable -->
						{#if (nextOrderStatus && !selectedOrderLocked) || canCancelSelectedOrder || canReturnSelectedOrder}
							<div class="mb-4 flex flex-wrap gap-2">
								{#if nextOrderStatus && !selectedOrderLocked}
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:bg-[var(--background-lighter)]"
										onclick={() => {
											editor = { ...editor, status: nextOrderStatus };
											confirmingManualState = false;
										}}
									>
										Mark {statusOptionLabel(nextOrderStatus)}
									</button>
								{/if}

								{#if canCancelSelectedOrder}
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 px-3 text-[12px] font-medium text-[var(--accent-crimson)] transition-colors hover:bg-[var(--accent-crimson)]/10"
										onclick={() => {
											editor = { ...editor, status: 'cancelled' };
											confirmingManualState = false;
										}}
									>
										Prepare cancellation
									</button>
								{/if}

								{#if canReturnSelectedOrder}
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:bg-[var(--background-lighter)]"
										onclick={() => {
											editor = { ...editor, status: 'returned' };
											confirmingManualState = false;
										}}
									>
										Mark returned
									</button>
								{/if}
							</div>
						{/if}

						{#if !canCancelSelectedOrder && !selectedOrderLocked}
							<p class="mb-4 text-[11px] text-[var(--black-alpha-48)]">
								Cancellation is disabled after shipment starts. Use the return workflow for
								delivered orders.
							</p>
						{/if}

						<!-- Manual override controls -->
						<div class="grid gap-x-4 gap-y-3 sm:grid-cols-2">
							<label>
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Order Status</span>
								<select
									bind:value={editor.status}
									class="input-field mt-1 !h-8 !text-[12px]"
									disabled={selectedOrderLocked}
									onchange={() => (confirmingManualState = false)}
								>
									{#if !manualOrderStatusValues.has(editor.status as (typeof manualOrderStatusOptions)[number]['value'])}
										<option value={editor.status}>
											{editor.status.replaceAll('_', ' ')} (workflow state)
										</option>
									{/if}
									{#each allowedOrderStatusOptions as option (option.value)}
										<option value={option.value} disabled={option.disabled}>{option.label}</option>
									{/each}
								</select>
							</label>

							<label>
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Payment Status</span>
								<select
									bind:value={editor.paymentStatus}
									class="input-field mt-1 !h-8 !text-[12px]"
									disabled={selectedOrderLocked}
									onchange={() => (confirmingManualState = false)}
								>
									{#each allowedPaymentStatusOptions as option (option.value)}
										<option value={option.value} disabled={option.disabled}>{option.label}</option>
									{/each}
								</select>
							</label>
						</div>

						{#if reasonRequiredForEdit}
							<label class="mt-3 block">
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Reason for change</span>
								<textarea
									bind:value={editor.reason}
									class="input-field mt-1 !h-auto min-h-[64px] !text-[12px] py-2"
									disabled={selectedOrderLocked}
									placeholder="Required. Example: Customer requested..."
								></textarea>
							</label>
						{:else}
							<p class="mt-3 text-[11px] text-[var(--black-alpha-48)]">
								Routine order and payment corrections do not require a reason.
							</p>
						{/if}

						{#if needsManualStateConfirmation && confirmingManualState}
							<div class="mt-3 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-2.5 text-[12px] text-[var(--accent-crimson)]">
								This will mark the order as {editor.status.replaceAll('_', ' ')}. Confirm only after
								checking details.
							</div>
						{/if}

						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-md bg-[var(--heat-100)] px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--heat-100)]/90 disabled:opacity-50"
								disabled={saving ||
									selectedOrderLocked ||
									!hasManualStateChange ||
									(reasonRequiredForEdit && editor.reason.trim().length < 12)}
								onclick={() => void saveOrder()}
							>
								{#if saving}
									Saving...
								{:else if needsManualStateConfirmation}
									{confirmingManualState ? `Confirm ${editor.status}` : `Review ${editor.status}`}
								{:else}
									Save state override
								{/if}
							</button>

							{#if hasManualStateChange}
								<button
									type="button"
									class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)]"
									disabled={saving}
									onclick={() => {
										editor = mapOrderToEditor(selectedOrder);
										confirmingManualState = false;
									}}
								>
									Reset
								</button>
							{/if}
						</div>
					</div>
				</section>

				<!-- Cancellation Request -->
				{#if selectedOrder.cancellationRequest}
					<section in:fly={{ y: 8, duration: 200 }}>
						<h4 class="mb-3 text-[13px] font-medium text-foreground">Cancellation Request</h4>
						<div class="rounded-lg border border-[var(--accent-crimson)]/15 bg-[var(--accent-crimson)]/4 p-4 shadow-sm">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p class="text-[12px] font-medium text-foreground">
										{selectedOrder.cancellationRequest.reason}
									</p>
									<div class="mt-1.5 space-y-0.5 text-[11px] text-[var(--black-alpha-48)]">
										<p>
											Requested: {new Date(
												selectedOrder.cancellationRequest.requested_at
											).toLocaleString('en-IN')}
										</p>
										{#if selectedOrder.cancellationRequest.resolved_at}
											<p>
												Resolved: {new Date(
													selectedOrder.cancellationRequest.resolved_at
												).toLocaleString('en-IN')}
											</p>
										{/if}
									</div>
								</div>
								<div class="flex flex-wrap gap-1.5">
									<span
										class="rounded-md border border-[var(--accent-crimson)]/15 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--accent-crimson)] uppercase shadow-sm"
									>
										{selectedOrder.cancellationRequest.status}
									</span>

									{#if selectedOrder.cancellationRequest.status === 'pending'}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md bg-[var(--accent-crimson)] px-2.5 text-[11px] font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
											disabled={workflowAction !== null || adminShipmentStarted(selectedOrder)}
											onclick={() =>
												void runWorkflowAction(
													'cancel-approve',
													`/admin/cancellation-requests/${selectedOrder.cancellationRequest?.id}`,
													{ action: 'approve', note: 'Approved from Svelte admin order panel' }
												)}
										>
											{workflowAction === 'cancel-approve' ? 'Approving...' : 'Approve'}
										</button>
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-50"
											disabled={workflowAction !== null}
											onclick={() =>
												void runWorkflowAction(
													'cancel-reject',
													`/admin/cancellation-requests/${selectedOrder.cancellationRequest?.id}`,
													{ action: 'reject', note: 'Rejected from Svelte admin order panel' }
												)}
										>
											{workflowAction === 'cancel-reject' ? 'Rejecting...' : 'Reject'}
										</button>
									{/if}

									{#if ['approved', 'refund_pending'].includes(selectedOrder.cancellationRequest.status) && !selectedOrder.cancellationRequest.refund_id && refundableAmount > 0}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)]"
											onclick={() => {
												if (!selectedOrder.cancellationRequest) return;
												prepareRefund({
													amount: refundableAmount,
													cancellationRequestId: selectedOrder.cancellationRequest.id,
													reason: `Approved cancellation: ${selectedOrder.cancellationRequest.reason}`
												});
											}}
										>
											Prepare refund
										</button>
									{/if}
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Return Request -->
				{#if selectedOrder.returnRequest}
					<section in:fly={{ y: 8, duration: 200 }}>
						<h4 class="mb-3 text-[13px] font-medium text-foreground">Return Request</h4>
						<div class="rounded-lg border border-[var(--accent-honey)]/20 bg-[var(--accent-honey)]/6 p-4 shadow-sm">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p class="text-[12px] font-medium text-foreground">
										{selectedOrder.returnRequest.reason}
									</p>
									<div class="mt-1.5 space-y-0.5 text-[11px] text-[var(--black-alpha-48)]">
										<p>
											Requested: {new Date(selectedOrder.returnRequest.requested_at).toLocaleString(
												'en-IN'
											)}
										</p>
										{#if selectedOrder.returnRequest.received_at}
											<p>
												Received: {new Date(selectedOrder.returnRequest.received_at).toLocaleString(
													'en-IN'
												)}
											</p>
										{/if}
										{#if selectedOrder.returnRequest.reverse_shipment_id}
											<p>
												Reverse pickup: #{selectedOrder.returnRequest.reverse_shipment_id.slice(
													0,
													8
												)}
											</p>
										{/if}
									</div>
								</div>
								<div class="flex flex-wrap gap-1.5">
									<span
										class="rounded-md border border-[var(--accent-honey)]/20 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--accent-honey)] uppercase shadow-sm"
									>
										{selectedOrder.returnRequest.status}
									</span>

									{#if selectedOrder.returnRequest.status === 'pending'}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md bg-[var(--accent-honey)] px-2.5 text-[11px] font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
											disabled={workflowAction !== null}
											onclick={() =>
												void runWorkflowAction(
													'return-approve',
													`/admin/return-requests/${selectedOrder.returnRequest?.id}`,
													{ action: 'approve', note: 'Approved from Svelte admin order panel' }
												)}
										>
											{workflowAction === 'return-approve' ? 'Approving...' : 'Approve'}
										</button>
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-50"
											disabled={workflowAction !== null}
											onclick={() =>
												void runWorkflowAction(
													'return-reject',
													`/admin/return-requests/${selectedOrder.returnRequest?.id}`,
													{ action: 'reject', note: 'Rejected from Svelte admin order panel' }
												)}
										>
											{workflowAction === 'return-reject' ? 'Rejecting...' : 'Reject'}
										</button>
									{/if}

									{#if selectedOrder.returnRequest.status === 'approved' && !selectedOrder.returnRequest.reverse_shipment_id}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-50"
											disabled={workflowAction !== null}
											onclick={() =>
												void runWorkflowAction('return-pickup', '/shipments/shiprocket/return', {
													returnRequestId: selectedOrder.returnRequest?.id
												})}
										>
											{workflowAction === 'return-pickup' ? 'Creating...' : 'Create reverse pickup'}
										</button>
									{/if}

									{#if ['approved', 'reverse_pickup_scheduled'].includes(selectedOrder.returnRequest.status)}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-50"
											disabled={workflowAction !== null}
											onclick={() =>
												void runWorkflowAction(
													'return-receive',
													`/admin/return-requests/${selectedOrder.returnRequest?.id}`,
													{ action: 'receive', note: 'Returned item received' }
												)}
										>
											{workflowAction === 'return-receive' ? 'Saving...' : 'Mark received'}
										</button>
									{/if}

									{#if ['received', 'refund_pending'].includes(selectedOrder.returnRequest.status) && !selectedOrder.returnRequest.refund_id && refundableAmount > 0}
										<button
											type="button"
											class="inline-flex h-7 items-center justify-center rounded-md border border-[var(--black-alpha-24)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] shadow-sm transition-colors hover:bg-[var(--background-lighter)]"
											onclick={() => {
												if (!selectedOrder.returnRequest) return;
												prepareRefund({
													amount: refundableAmount,
													returnRequestId: selectedOrder.returnRequest.id,
													reason: `Approved return after receipt: ${selectedOrder.returnRequest.reason}`
												});
											}}
										>
											Prepare refund
										</button>
									{/if}
								</div>
							</div>
						</div>
					</section>
				{/if}

				<!-- Refund Handling - hidden when nothing refundable and no history -->
				{#if refundableAmount > 0 || selectedOrder.refunds.length > 0}
					<section in:fly={{ y: 8, duration: 200 }}>
						<h4 class="mb-3 text-[13px] font-medium text-foreground">Refund Handling</h4>
						<div class="rounded-lg border border-[var(--border-muted)] bg-white p-4 shadow-sm">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="text-[11px] text-[var(--black-alpha-48)]">
									Refunds against the captured payment. Partial refunds keep the payment
									as partially refunded until balance reaches zero.
								</p>
								<span
									class={`rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
										refundableAmount > 0
											? 'bg-[var(--accent-honey)]/12 text-[var(--accent-honey)]'
											: 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
									}`}
								>
									{formatINR(refundableAmount)} refundable
								</span>
							</div>

							<div class="mt-4 grid gap-3 sm:grid-cols-3">
								<div class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5">
									<p class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase">Paid</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">
										{formatINR(selectedOrder.refundSummary.paidAmount)}
									</p>
								</div>
								<div class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5">
									<p class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase">Refunded</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">
										{formatINR(selectedOrder.refundSummary.refundedAmount)}
									</p>
								</div>
								<div class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5">
									<p class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase">Remaining</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">{formatINR(refundableAmount)}</p>
								</div>
							</div>

							{#if refundableAmount > 0}
								<div class="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
									<label>
										<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Refund amount</span>
										<input
											bind:value={refundEditor.amount}
											class="input-field mt-1 !h-8 !text-[12px]"
											disabled={refundSaving}
											inputmode="decimal"
											type="number"
										/>
									</label>
									<label>
										<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Refund speed</span>
										<select
											bind:value={refundEditor.speed}
											class="input-field mt-1 !h-8 !text-[12px]"
											disabled={refundSaving}
										>
											<option value="normal">Normal</option>
											<option value="optimum">Optimum / instant if available</option>
										</select>
									</label>
								</div>

								<label class="mt-3 block">
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Reason</span>
									<textarea
										bind:value={refundEditor.reason}
										class="input-field mt-1 !h-auto min-h-[56px] !text-[12px] py-2"
										placeholder="Reason for this refund"
										disabled={refundSaving}
									></textarea>
								</label>

								<div class="mt-3">
									<button
										type="button"
										class="inline-flex h-8 items-center justify-center rounded-md bg-[var(--heat-100)] px-3 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-[var(--heat-100)]/90 disabled:opacity-50"
										disabled={refundSaving}
										onclick={() => void createRefund()}
									>
										{refundSaving ? 'Creating refund...' : 'Create refund'}
									</button>
								</div>
							{/if}
						</div>
					</section>
				{/if}

				<!-- Customer Details & Operational Detail - compact grid -->
				<section class="grid gap-5 lg:grid-cols-2" in:fly={{ y: 8, duration: 200 }}>
					<div>
						<h4 class="mb-3 text-[13px] font-medium text-foreground">Customer Details</h4>
						<div class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm">
							<div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Email</span>
									<p class="text-[12px] text-foreground">{selectedOrder.shippingEmail || 'Not captured'}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Phone</span>
									<p class="text-[12px] text-foreground">{selectedOrder.shippingPhone || 'Not captured'}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Service</span>
									<p class="text-[12px] text-foreground">{selectedOrder.shippingServiceType.replaceAll('_', ' ')}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Courier</span>
									<p class="text-[12px] text-foreground">{selectedOrder.shipment?.courierName || selectedOrder.shippingCourierName || 'Not assigned'}</p>
								</div>
								<div class="col-span-2">
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Address</span>
									<p class="text-[12px] text-foreground">
										{[
											selectedOrder.shippingLine1,
											selectedOrder.shippingLine2,
											selectedOrder.shippingCity,
											selectedOrder.shippingState,
											selectedOrder.shippingPincode
										]
											.filter(Boolean)
											.join(', ') || 'Address pending'}
									</p>
								</div>
							</div>
						</div>
					</div>

					<div>
						<h4 class="mb-3 text-[13px] font-medium text-foreground">Operational Detail</h4>
						<div class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm">
							<div class="grid grid-cols-2 gap-x-4 gap-y-2.5">
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Placed</span>
									<p class="text-[12px] text-foreground">{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Last updated</span>
									<p class="text-[12px] text-foreground">{new Date(selectedOrder.updatedAt).toLocaleString('en-IN')}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Payment method</span>
									<p class="text-[12px] text-foreground">{selectedOrder.paymentMethod}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Shipment</span>
									<p class="text-[12px] text-foreground">{selectedOrder.shipment?.status || 'Not created'}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Invoice</span>
									<div class="flex items-center gap-1.5">
										<p class="text-[12px] text-foreground">{selectedOrder.invoice?.invoice_number || 'Not generated'}</p>
										{#if selectedOrder.invoice?.invoice_url}
											<button
												type="button"
												class="text-[11px] text-[var(--heat-100)] hover:text-[var(--heat-120)] hover:underline"
												onclick={() => openExternal(selectedOrder.invoice?.invoice_url)}
											>
												Open
											</button>
										{/if}
									</div>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Tracking</span>
									{#if selectedOrder.shipment?.trackingUrl}
										<button
											type="button"
											class="block text-[12px] text-[var(--heat-100)] hover:text-[var(--heat-120)] hover:underline"
											onclick={() => openExternal(selectedOrder.shipment?.trackingUrl)}
										>
											Open live tracking
										</button>
									{:else}
										<p class="text-[12px] text-foreground">Not available yet</p>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- Items -->
				<section in:fly={{ y: 8, duration: 200 }}>
					<h4 class="mb-3 text-[13px] font-medium text-foreground">Items</h4>
					<div
						class="divide-y divide-[var(--border-muted)] overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white shadow-sm"
					>
						{#each selectedOrder.items as item (item.id)}
							<div class="flex items-center gap-3 p-3">
								{#if item.image}
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-1.5"
									>
										<img
											src={item.image}
											alt={item.title}
											class="max-h-full max-w-full object-contain mix-blend-multiply"
										/>
									</div>
								{:else}
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-[10px] text-[var(--black-alpha-32)]"
									>
										No img
									</div>
								{/if}

								<div class="min-w-0 flex-1">
									<p class="truncate text-[12px] font-medium text-foreground">{item.title}</p>
									<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
										{item.brand || 'Brand pending'} &middot; {formatINR(item.price)}
									</p>
								</div>

								<div class="shrink-0 pr-1 text-right">
									<p class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase">Qty</p>
									<p class="mt-0.5 text-[12px] font-medium text-foreground">{item.qty}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				<!-- Refund History & Admin History -->
				{#if selectedOrder.refunds.length || selectedOrder.adminEvents.length}
					<section class="grid gap-5 pb-8 lg:grid-cols-2" in:fly={{ y: 8, duration: 200 }}>
						<div>
							<h4 class="mb-3 text-[13px] font-medium text-foreground">Refund History</h4>
							{#if !selectedOrder.refunds.length}
								<div
									class="rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-4 text-center text-[12px] text-[var(--black-alpha-48)]"
								>
									No refunds created yet.
								</div>
							{:else}
								<div class="space-y-2">
									{#each selectedOrder.refunds as refund (refund.id)}
										<div class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm">
											<div class="flex items-center justify-between gap-2">
												<p class="text-[12px] font-semibold text-foreground">
													{formatINR(refund.amount)}
												</p>
												<span
													class={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
														refund.status === 'success'
															? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
															: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'
													}`}
												>
													{refund.status}
												</span>
											</div>
											<p class="mt-1.5 text-[12px] text-[var(--black-alpha-64)]">
												{refund.reason || 'No reason captured'}
											</p>
											<p class="mt-1 text-[11px] text-[var(--black-alpha-48)]">
												{new Date(refund.createdAt).toLocaleString('en-IN')}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<h4 class="mb-3 text-[13px] font-medium text-foreground">Admin History</h4>
							{#if !selectedOrder.adminEvents.length}
								<div
									class="rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-4 text-center text-[12px] text-[var(--black-alpha-48)]"
								>
									No admin events logged yet.
								</div>
							{:else}
								<div class="space-y-2">
									{#each selectedOrder.adminEvents as event (event.id)}
										<div class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm">
											<div class="flex items-center justify-between gap-2">
												<p class="text-[12px] font-medium text-foreground">
													{event.eventType.replaceAll('_', ' ')}
												</p>
												<p class="text-[10px] text-[var(--black-alpha-48)]">
													{new Date(event.createdAt).toLocaleString('en-IN')}
												</p>
											</div>
											<p class="mt-1.5 text-[12px] text-[var(--black-alpha-64)]">{event.reason}</p>
											{#if event.adminEmail}
												<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
													{event.adminEmail}
												</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</section>
				{/if}
			{:else}
				<div
					class="rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-center text-[12px] text-[var(--black-alpha-48)]"
				>
					Select an order to manage its workflow.
				</div>
			{/if}
		</div>
	</section>
</div>
