<script lang="ts">
	import { onMount } from 'svelte';
	import { formatINR } from '$lib/catalog';
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

	async function loadOrders() {
		try {
			loading = true;
			error = null;
			const response = await requestAdmin<{ orders: AdminOrderRecord[] }>('/admin/orders');
			const nextOrders = response.orders ?? [];
			orders = nextOrders;
			syncSelection(nextOrders);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not load orders';
		} finally {
			loading = false;
		}
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
			await requestAdmin(`/admin/orders/${editor.id}`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			});
			confirmingManualState = false;
			await loadOrders();
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
			await loadOrders();
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
			await loadOrders();
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
	});
</script>

<div class="grid items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
	<section class="flex flex-col gap-4 xl:sticky xl:top-8 xl:self-start">
		<div class="flex items-center justify-between gap-3">
			<div>
				<h2 class="text-xl font-semibold text-zinc-900">Orders</h2>
				<p class="mt-1 text-sm text-zinc-500">Review shipments, returns, and refunds.</p>
			</div>
			<button
				type="button"
				class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50"
				disabled={loading}
				onclick={() => void loadOrders()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		<input
			bind:value={search}
			class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
			placeholder="Search order, customer, email, or city"
		/>

		<div class="flex max-h-[calc(100vh-240px)] flex-col gap-2 overflow-y-auto pr-2 pb-10">
			{#if loading && !orders.length}
				<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
					Loading orders...
				</div>
			{:else if !filteredOrders.length}
				<div
					class="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500"
				>
					No orders match the current search.
				</div>
			{:else}
				{#each filteredOrders as order (order.id)}
					<button
						type="button"
						class={`flex w-full flex-col gap-3 rounded-lg border p-4 text-left transition-all ${
							order.id === selectedId
								? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
								: order.status.toLowerCase() === 'cancelled'
									? 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50'
									: 'border-zinc-200 bg-white shadow-sm hover:border-zinc-300 hover:bg-zinc-50'
						}`}
						onclick={() => selectOrder(order)}
					>
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="flex items-center gap-2">
									<p class="font-medium text-zinc-900">
										#{order.id.slice(0, 8).toUpperCase()}
									</p>
									{#if isTerminalOrder(order)}
										<span
											class="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-700 uppercase"
											>locked</span
										>
									{/if}
								</div>
								<p class="mt-0.5 text-xs text-zinc-500">
									{new Date(order.createdAt).toLocaleString('en-IN', {
										month: 'short',
										day: 'numeric',
										hour: 'numeric',
										minute: 'numeric'
									})}
								</p>
							</div>
							<div class="text-right">
								<p class="font-medium text-zinc-900">{formatINR(order.total)}</p>
							</div>
						</div>

						<div class="flex flex-wrap gap-1.5">
							<span
								class={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
							>
								{order.status}
							</span>
							<span
								class={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}
							>
								{order.paymentStatus}
							</span>
							{#if order.cancellationRequest}
								<span
									class="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-red-700 uppercase"
									>cancel {order.cancellationRequest.status}</span
								>
							{/if}
						</div>

						<div class="mt-1 text-xs text-zinc-500">
							<span class="font-medium text-zinc-700"
								>{order.shippingName || order.userEmail || 'Customer'}</span
							>
							• {[order.shippingCity, order.shippingState].filter(Boolean).join(', ') ||
								'Address pending'}
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</section>

	<section
		class="flex flex-col gap-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
	>
		<div class="border-b border-zinc-200 bg-zinc-50/50 p-6">
			<h3 class="text-lg font-semibold text-zinc-900">Order Details</h3>
		</div>

		<div class="mt-6 space-y-8 p-6 pt-0">
			{#if error}
				<div class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			{/if}

			{#if selectedOrder}
				{#if selectedOrderLocked}
					<div class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
						This order is in a terminal state. Status and payment edits are locked in the admin app.
						Use the database only for an exceptional correction.
					</div>
				{/if}

				<div class="grid gap-4 sm:grid-cols-3">
					<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
						<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Order</p>
						<p class="mt-1 font-medium text-zinc-900">
							#{selectedOrder.id.slice(0, 8).toUpperCase()}
						</p>
					</div>
					<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
						<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Customer</p>
						<p class="mt-1 font-medium text-zinc-900">{selectedOrder.shippingName || 'Customer'}</p>
					</div>
					<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
						<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Total</p>
						<p class="mt-1 font-medium text-zinc-900">{formatINR(selectedOrder.total)}</p>
					</div>
				</div>

				<section>
					<h4 class="mb-4 text-sm font-semibold text-zinc-900">Current State</h4>
					<div class="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<div class="mb-4 flex items-center gap-3">
							<span
								class={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
							>
								{selectedOrder.status}
							</span>
							<span
								class={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${selectedOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}
							>
								{selectedOrder.paymentStatus}
							</span>
						</div>

						<div class="flex flex-wrap gap-2">
							{#if nextOrderStatus}
								<button
									type="button"
									class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
									disabled={selectedOrderLocked}
									onclick={() => {
										editor = { ...editor, status: nextOrderStatus };
										confirmingManualState = false;
									}}
								>
									Mark {statusOptionLabel(nextOrderStatus)}
								</button>
							{/if}

							<button
								type="button"
								class="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-50"
								disabled={!canCancelSelectedOrder}
								onclick={() => {
									editor = { ...editor, status: 'cancelled' };
									confirmingManualState = false;
								}}
							>
								Prepare cancellation
							</button>

							<button
								type="button"
								class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
								disabled={!canReturnSelectedOrder}
								onclick={() => {
									editor = { ...editor, status: 'returned' };
									confirmingManualState = false;
								}}
							>
								Mark returned
							</button>
						</div>

						{#if !canCancelSelectedOrder && !selectedOrderLocked}
							<p class="mt-4 text-xs text-zinc-500">
								Cancellation is disabled after shipment starts. Use the return workflow for
								delivered orders.
							</p>
						{/if}
					</div>
				</section>

				<section>
					<h4 class="mb-4 text-sm font-semibold text-zinc-900">Manual State Override</h4>
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
						<div class="grid gap-x-6 gap-y-5 sm:grid-cols-2">
							<label>
								<span class="mb-1.5 block text-xs font-medium text-zinc-700">Order Status</span>
								<select
									bind:value={editor.status}
									class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
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
								<span class="mb-1.5 block text-xs font-medium text-zinc-700">Payment Status</span>
								<select
									bind:value={editor.paymentStatus}
									class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
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
							<label class="mt-4 block">
								<span class="mb-1.5 block text-xs font-medium text-zinc-700">Reason for change</span
								>
								<textarea
									bind:value={editor.reason}
									class="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
									disabled={selectedOrderLocked}
									placeholder="Required. Example: Customer requested..."
								></textarea>
							</label>
						{:else}
							<p class="mt-4 text-xs text-zinc-500">
								Routine order and payment corrections do not require a reason.
							</p>
						{/if}

						{#if needsManualStateConfirmation && confirmingManualState}
							<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								This will mark the order as {editor.status.replaceAll('_', ' ')}. Confirm only after
								checking details.
							</div>
						{/if}

						<div class="mt-4 flex flex-wrap gap-3">
							<button
								type="button"
								class="inline-flex h-9 items-center justify-center rounded-md bg-[var(--heat-100)] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--heat-100)]/90 disabled:opacity-50"
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
									class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
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

				{#if selectedOrder.cancellationRequest}
					<section>
						<h4 class="mb-4 text-sm font-semibold text-zinc-900">Cancellation Request</h4>
						<div class="rounded-lg border border-red-200 bg-red-50/50 p-5 shadow-sm">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium text-zinc-900">
										{selectedOrder.cancellationRequest.reason}
									</p>
									<div class="mt-2 space-y-1 text-xs text-zinc-500">
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
								<div class="flex flex-wrap gap-2">
									<span
										class="rounded border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-red-700 uppercase shadow-sm"
									>
										{selectedOrder.cancellationRequest.status}
									</span>

									{#if selectedOrder.cancellationRequest.status === 'pending'}
										<button
											type="button"
											class="inline-flex h-8 items-center justify-center rounded-md bg-red-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
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
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
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

									{#if ['approved', 'refund_pending'].includes(selectedOrder.cancellationRequest.status) && !selectedOrder.cancellationRequest.refund_id}
										<button
											type="button"
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
											disabled={refundableAmount <= 0}
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

				{#if selectedOrder.returnRequest}
					<section>
						<h4 class="mb-4 text-sm font-semibold text-zinc-900">Return Request</h4>
						<div class="rounded-lg border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<p class="text-sm font-medium text-zinc-900">
										{selectedOrder.returnRequest.reason}
									</p>
									<div class="mt-2 space-y-1 text-xs text-zinc-500">
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
								<div class="flex flex-wrap gap-2">
									<span
										class="rounded border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-700 uppercase shadow-sm"
									>
										{selectedOrder.returnRequest.status}
									</span>

									{#if selectedOrder.returnRequest.status === 'pending'}
										<button
											type="button"
											class="inline-flex h-8 items-center justify-center rounded-md bg-amber-600 px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
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
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
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
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
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
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
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

									{#if ['received', 'refund_pending'].includes(selectedOrder.returnRequest.status) && !selectedOrder.returnRequest.refund_id}
										<button
											type="button"
											class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50"
											disabled={refundableAmount <= 0}
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

				<section>
					<h4 class="mb-4 text-sm font-semibold text-zinc-900">Refund Handling</h4>
					<div class="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="text-xs text-zinc-500">
									Refunds are created against the captured payment. Partial refunds keep the payment
									as partially refunded until the balance reaches zero.
								</p>
							</div>
							<span
								class={`rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${refundableAmount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
							>
								{formatINR(refundableAmount)} refundable
							</span>
						</div>

						<div class="mt-5 grid gap-4 sm:grid-cols-3">
							<div class="rounded-md border border-zinc-200 bg-zinc-50 p-3">
								<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Paid</p>
								<p class="mt-1 font-medium text-zinc-900">
									{formatINR(selectedOrder.refundSummary.paidAmount)}
								</p>
							</div>
							<div class="rounded-md border border-zinc-200 bg-zinc-50 p-3">
								<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
									Refunded
								</p>
								<p class="mt-1 font-medium text-zinc-900">
									{formatINR(selectedOrder.refundSummary.refundedAmount)}
								</p>
							</div>
							<div class="rounded-md border border-zinc-200 bg-zinc-50 p-3">
								<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
									Remaining
								</p>
								<p class="mt-1 font-medium text-zinc-900">{formatINR(refundableAmount)}</p>
							</div>
						</div>

						<div class="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
							<label>
								<span class="mb-1.5 block text-xs font-medium text-zinc-700">Refund amount</span>
								<input
									bind:value={refundEditor.amount}
									class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
									disabled={refundSaving || refundableAmount <= 0}
									inputmode="decimal"
									type="number"
								/>
							</label>
							<label>
								<span class="mb-1.5 block text-xs font-medium text-zinc-700">Refund speed</span>
								<select
									bind:value={refundEditor.speed}
									class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
									disabled={refundSaving || refundableAmount <= 0}
								>
									<option value="normal">Normal</option>
									<option value="optimum">Optimum / instant if available</option>
								</select>
							</label>
						</div>

						<label class="mt-4 block">
							<span class="mb-1.5 block text-xs font-medium text-zinc-700">Reason</span>
							<textarea
								bind:value={refundEditor.reason}
								class="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								placeholder="Reason for this refund"
								disabled={refundSaving || refundableAmount <= 0}
							></textarea>
						</label>

						<div class="mt-4 flex flex-wrap gap-2">
							<button
								type="button"
								class="inline-flex h-9 items-center justify-center rounded-md bg-[var(--heat-100)] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--heat-100)]/90 disabled:opacity-50"
								disabled={refundSaving || refundableAmount <= 0}
								onclick={() => void createRefund()}
							>
								{refundSaving ? 'Creating refund...' : 'Create refund'}
							</button>
						</div>
					</div>
				</section>

				<section class="grid gap-6 lg:grid-cols-2">
					<div>
						<h4 class="mb-4 text-sm font-semibold text-zinc-900">Customer Details</h4>
						<div
							class="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm"
						>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Email</span
								>
								<span class="text-sm text-zinc-900"
									>{selectedOrder.shippingEmail || 'Not captured'}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Phone</span
								>
								<span class="text-sm text-zinc-900"
									>{selectedOrder.shippingPhone || 'Not captured'}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Service</span
								>
								<span class="text-sm text-zinc-900"
									>{selectedOrder.shippingServiceType.replaceAll('_', ' ')}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Courier</span
								>
								<span class="text-sm text-zinc-900"
									>{selectedOrder.shipment?.courierName ||
										selectedOrder.shippingCourierName ||
										'Not assigned'}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Address</span
								>
								<span class="text-sm text-zinc-900">
									{[
										selectedOrder.shippingLine1,
										selectedOrder.shippingLine2,
										selectedOrder.shippingCity,
										selectedOrder.shippingState,
										selectedOrder.shippingPincode
									]
										.filter(Boolean)
										.join(', ') || 'Address pending'}
								</span>
							</div>
						</div>
					</div>

					<div>
						<h4 class="mb-4 text-sm font-semibold text-zinc-900">Operational Detail</h4>
						<div
							class="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white shadow-sm"
						>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Placed</span
								>
								<span class="text-sm text-zinc-900"
									>{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Last updated</span
								>
								<span class="text-sm text-zinc-900"
									>{new Date(selectedOrder.updatedAt).toLocaleString('en-IN')}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Payment method</span
								>
								<span class="text-sm text-zinc-900">{selectedOrder.paymentMethod}</span>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Shipment</span
								>
								<span class="text-sm text-zinc-900"
									>{selectedOrder.shipment?.status || 'Shipment not created'}</span
								>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Invoice</span
								>
								<div class="flex items-center gap-2">
									<span class="text-sm text-zinc-900"
										>{selectedOrder.invoice?.invoice_number || 'Not generated'}</span
									>
									{#if selectedOrder.invoice?.invoice_url}
										<button
											type="button"
											class="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
											onclick={() => openExternal(selectedOrder.invoice?.invoice_url)}
										>
											Open invoice
										</button>
									{/if}
								</div>
							</div>
							<div class="flex flex-col gap-1 p-4">
								<span class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase"
									>Tracking</span
								>
								{#if selectedOrder.shipment?.trackingUrl}
									<button
										type="button"
										class="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
										onclick={() => openExternal(selectedOrder.shipment?.trackingUrl)}
									>
										Open live tracking
									</button>
								{:else}
									<span class="text-sm text-zinc-900">Tracking not available yet</span>
								{/if}
							</div>
						</div>
					</div>
				</section>

				<section>
					<h4 class="mb-4 text-sm font-semibold text-zinc-900">Items</h4>
					<div
						class="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
					>
						{#each selectedOrder.items as item (item.id)}
							<div class="flex items-center gap-4 p-4">
								{#if item.image}
									<div
										class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 p-2"
									>
										<img
											src={item.image}
											alt={item.title}
											class="max-h-full max-w-full object-contain mix-blend-multiply"
										/>
									</div>
								{:else}
									<div
										class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-400"
									>
										No img
									</div>
								{/if}

								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-zinc-900">{item.title}</p>
									<p class="mt-1 text-xs text-zinc-500">
										{item.brand || 'Brand pending'} • {formatINR(item.price)}
									</p>
								</div>

								<div class="shrink-0 pr-2 text-right">
									<p class="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">Qty</p>
									<p class="mt-0.5 text-sm font-medium text-zinc-900">{item.qty}</p>
								</div>
							</div>
						{/each}
					</div>
				</section>

				{#if selectedOrder.refunds.length || selectedOrder.adminEvents.length}
					<section class="grid gap-6 pb-10 lg:grid-cols-2">
						<div>
							<h4 class="mb-4 text-sm font-semibold text-zinc-900">Refund History</h4>
							{#if !selectedOrder.refunds.length}
								<div
									class="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-center text-sm text-zinc-500"
								>
									No refunds created yet.
								</div>
							{:else}
								<div class="space-y-3">
									{#each selectedOrder.refunds as refund (refund.id)}
										<div class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
											<div class="flex items-center justify-between gap-3">
												<p class="text-sm font-semibold text-zinc-900">
													{formatINR(refund.amount)}
												</p>
												<span
													class={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${refund.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-700'}`}
												>
													{refund.status}
												</span>
											</div>
											<p class="mt-2 text-sm text-zinc-700">
												{refund.reason || 'No reason captured'}
											</p>
											<p class="mt-2 text-xs text-zinc-500">
												{new Date(refund.createdAt).toLocaleString('en-IN')}
											</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div>
							<h4 class="mb-4 text-sm font-semibold text-zinc-900">Admin History</h4>
							{#if !selectedOrder.adminEvents.length}
								<div
									class="rounded-lg border border-zinc-200 bg-zinc-50 p-5 text-center text-sm text-zinc-500"
								>
									No admin events logged yet.
								</div>
							{:else}
								<div class="space-y-3">
									{#each selectedOrder.adminEvents as event (event.id)}
										<div class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
											<div class="flex items-center justify-between gap-3">
												<p class="text-sm font-medium text-zinc-900">
													{event.eventType.replaceAll('_', ' ')}
												</p>
												<p class="text-[10px] text-zinc-500">
													{new Date(event.createdAt).toLocaleString('en-IN')}
												</p>
											</div>
											<p class="mt-2 text-sm text-zinc-700">{event.reason}</p>
											{#if event.adminEmail}
												<p class="mt-1 text-xs text-zinc-500">
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
					class="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500"
				>
					Select an order to manage its workflow.
				</div>
			{/if}
		</div>
	</section>
</div>
