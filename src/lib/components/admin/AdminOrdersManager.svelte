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
		statusTone,
		toneClasses,
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

	onMount(() => {
		void loadOrders();
	});
</script>

<div class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
	<section class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
					Order control
				</p>
				<p class="text-label-large text-foreground">Orders</p>
				<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
					Manual state correction, cancellation and return handling, and refund creation.
				</p>
			</div>
			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
				disabled={loading}
				onclick={() => void loadOrders()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		<input
			bind:value={search}
			class="input-field mt-5"
			placeholder="Search order, customer, email, or city"
		/>

		<div class="mt-5 space-y-3">
			{#if loading && !orders.length}
				<div
					class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
				>
					Loading orders...
				</div>
			{:else if !filteredOrders.length}
				<div
					class="text-body-small rounded-[16px] border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-[var(--black-alpha-56)]"
				>
					No orders match the current search.
				</div>
			{:else}
				{#each filteredOrders as order (order.id)}
					<button
						type="button"
						class={`w-full rounded-[16px] border p-4 text-left transition-colors ${
							order.id === selectedId
								? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
								: order.status.toLowerCase() === 'cancelled'
									? 'border-red-200 bg-red-50/55 hover:border-red-300'
									: 'border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)] hover:bg-[var(--background-lighter)]'
						}`}
						onclick={() => selectOrder(order)}
					>
						<div class="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.9fr_auto]">
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<p class="text-label-medium text-foreground">
										#{order.id.slice(0, 8).toUpperCase()}
									</p>
									{#if isTerminalOrder(order)}
										<span
											class={`text-mono-x-small rounded-full border px-2 py-1 tracking-[0.16em] uppercase ${toneClasses('danger')}`}
										>
											locked
										</span>
									{/if}
								</div>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Placed {new Date(order.createdAt).toLocaleString('en-IN')}
								</p>
								<div class="mt-3 flex flex-wrap gap-2">
									<span
										class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(order.status))}`}
									>
										{order.status}
									</span>
									<span
										class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(order.paymentStatus))}`}
									>
										{order.paymentStatus}
									</span>
									{#if order.cancellationRequest}
										<span
											class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(order.cancellationRequest.status))}`}
										>
											cancel {order.cancellationRequest.status}
										</span>
									{/if}
									{#if order.refund}
										<span
											class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(order.refund.status))}`}
										>
											refund {order.refund.status}
										</span>
									{/if}
								</div>
							</div>

							<div>
								<p class="text-label-small text-foreground">
									{order.shippingName || order.userEmail || 'Customer'}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{order.userEmail || 'Email not captured'}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{[order.shippingCity, order.shippingState, order.shippingPincode]
										.filter(Boolean)
										.join(', ') || 'Address pending'}
								</p>
							</div>

							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Ordered
								</p>
								<div class="mt-2 space-y-1">
									{#each order.items.slice(0, 3) as item (item.id)}
										<p class="text-body-small line-clamp-1 text-foreground">
											{item.title}
											<span class="text-[var(--black-alpha-48)]"> x{item.qty}</span>
										</p>
									{/each}
									{#if order.items.length > 3}
										<p class="text-body-small text-[var(--black-alpha-56)]">
											+{order.items.length - 3} more item{order.items.length - 3 === 1 ? '' : 's'}
										</p>
									{/if}
								</div>
							</div>

							<div class="xl:text-right">
								<p class="text-label-large text-foreground">{formatINR(order.total)}</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{order.shipment?.awbCode
										? `AWB ${order.shipment.awbCode}`
										: order.shipment?.courierName ||
											order.shippingCourierName ||
											'Shipment pending'}
								</p>
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</section>

	<section class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
		<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
			Order editor
		</p>
		{#if error}
			<div
				class="text-body-small mb-5 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
			>
				{error}
			</div>
		{/if}

		{#if selectedOrder}
			{#if selectedOrderLocked}
				<div
					class="text-body-small mb-5 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
				>
					This order is in a terminal state. Status and payment edits are locked in the admin app.
					Use the database only for an exceptional correction.
				</div>
			{/if}

			<div class="grid gap-3 sm:grid-cols-3">
				<div
					class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Order
					</p>
					<p class="text-label-small mt-2 text-foreground">
						#{selectedOrder.id.slice(0, 8).toUpperCase()}
					</p>
				</div>
				<div
					class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Customer
					</p>
					<p class="text-label-small mt-2 text-foreground">
						{selectedOrder.shippingName || 'Customer'}
					</p>
				</div>
				<div
					class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
				>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Total
					</p>
					<p class="text-label-small mt-2 text-foreground">{formatINR(selectedOrder.total)}</p>
				</div>
			</div>

			<section class="mt-5 rounded-[16px] border border-[var(--border-faint)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="text-label-small text-foreground">Current state</p>
						<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
							Use quick actions for normal order progress. Use manual correction only when the order
							or payment state was recorded incorrectly.
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<span
							class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(selectedOrder.status))}`}
						>
							{selectedOrder.status}
						</span>
						<span
							class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(selectedOrder.paymentStatus))}`}
						>
							{selectedOrder.paymentStatus}
						</span>
					</div>
				</div>

				<div class="mt-4 flex flex-wrap gap-2">
					{#if nextOrderStatus}
						<button
							type="button"
							class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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
						class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-red-200 bg-red-50 px-4 text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:opacity-60"
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
						class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
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
					<p class="text-body-small mt-3 text-[var(--black-alpha-56)]">
						Cancellation is disabled after shipment starts. Use the return workflow for delivered
						orders.
					</p>
				{/if}
			</section>

			<section class="mt-5 rounded-[16px] border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<label>
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Order status</span
						>
						<select
							bind:value={editor.status}
							class="input-field"
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
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Payment status</span
						>
						<select
							bind:value={editor.paymentStatus}
							class="input-field"
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
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Reason for change</span
						>
						<textarea
							bind:value={editor.reason}
							class="input-field min-h-28 py-3"
							disabled={selectedOrderLocked}
							placeholder="Required. Example: Customer called support and asked to cancel before packing."
						></textarea>
					</label>
				{:else}
					<p class="text-body-small mt-4 text-[var(--black-alpha-56)]">
						Routine order and payment corrections do not require a reason. Refund states should
						still be handled through the refund workflow below.
					</p>
				{/if}

				{#if needsManualStateConfirmation && confirmingManualState}
					<div
						class="text-body-small mt-3 rounded-[14px] border border-red-200 bg-red-50 p-3 text-red-700"
					>
						This will mark the order as {editor.status.replaceAll('_', ' ')}. Confirm only after
						checking shipment state, customer request, and refund eligibility.
					</div>
				{/if}

				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
						disabled={saving ||
							selectedOrderLocked ||
							!hasManualStateChange ||
							(reasonRequiredForEdit && editor.reason.trim().length < 12)}
						onclick={() => void saveOrder()}
					>
						{#if saving}
							Saving...
						{:else if needsManualStateConfirmation}
							{confirmingManualState
								? `Confirm ${editor.status.replaceAll('_', ' ')}`
								: `Review ${editor.status.replaceAll('_', ' ')}`}
						{:else}
							Save state correction
						{/if}
					</button>

					{#if hasManualStateChange}
						<button
							type="button"
							class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-60"
							disabled={saving}
							onclick={() => {
								editor = mapOrderToEditor(selectedOrder);
								confirmingManualState = false;
							}}
						>
							Reset change
						</button>
					{/if}
				</div>
			</section>

			{#if selectedOrder.cancellationRequest}
				<section class="mt-5 rounded-[16px] border border-[var(--border-faint)] p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Cancellation
							</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-72)]">
								{selectedOrder.cancellationRequest.reason}
							</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								Requested {new Date(selectedOrder.cancellationRequest.requested_at).toLocaleString(
									'en-IN'
								)}
							</p>
							{#if selectedOrder.cancellationRequest.resolved_at}
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Resolved {new Date(selectedOrder.cancellationRequest.resolved_at).toLocaleString(
										'en-IN'
									)}
								</p>
							{/if}
						</div>
						<div class="flex flex-wrap gap-2">
							<span
								class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(selectedOrder.cancellationRequest.status))}`}
							>
								{selectedOrder.cancellationRequest.status}
							</span>

							{#if selectedOrder.cancellationRequest.status === 'pending'}
								<button
									type="button"
									class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
				</section>
			{/if}

			{#if selectedOrder.returnRequest}
				<section class="mt-5 rounded-[16px] border border-[var(--border-faint)] p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Return
							</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-72)]">
								{selectedOrder.returnRequest.reason}
							</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								Requested {new Date(selectedOrder.returnRequest.requested_at).toLocaleString(
									'en-IN'
								)}
							</p>
							{#if selectedOrder.returnRequest.received_at}
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Received {new Date(selectedOrder.returnRequest.received_at).toLocaleString(
										'en-IN'
									)}
								</p>
							{/if}
							{#if selectedOrder.returnRequest.reverse_shipment_id}
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Reverse pickup #{selectedOrder.returnRequest.reverse_shipment_id.slice(0, 8)}
								</p>
							{/if}
						</div>
						<div class="flex flex-wrap gap-2">
							<span
								class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(selectedOrder.returnRequest.status))}`}
							>
								{selectedOrder.returnRequest.status}
							</span>

							{#if selectedOrder.returnRequest.status === 'pending'}
								<button
									type="button"
									class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
									class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
				</section>
			{/if}

			<section class="mt-5 rounded-[16px] border border-[var(--border-faint)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="text-label-small text-foreground">Refund handling</p>
						<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
							Refunds are created against the captured payment. Partial refunds keep the payment as
							partially refunded until the remaining balance reaches zero.
						</p>
					</div>
					<span
						class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(refundableAmount > 0 ? 'warning' : 'success')}`}
					>
						{formatINR(refundableAmount)} refundable
					</span>
				</div>

				<div class="mt-4 grid gap-3 sm:grid-cols-3">
					<div
						class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
					>
						<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
							Paid
						</p>
						<p class="text-label-small mt-2 text-foreground">
							{formatINR(selectedOrder.refundSummary.paidAmount)}
						</p>
					</div>
					<div
						class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
					>
						<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
							Refunded
						</p>
						<p class="text-label-small mt-2 text-foreground">
							{formatINR(selectedOrder.refundSummary.refundedAmount)}
						</p>
					</div>
					<div
						class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
					>
						<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
							Remaining
						</p>
						<p class="text-label-small mt-2 text-foreground">{formatINR(refundableAmount)}</p>
					</div>
				</div>

				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					<label>
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Refund amount</span
						>
						<input
							bind:value={refundEditor.amount}
							class="input-field"
							disabled={refundSaving || refundableAmount <= 0}
							inputmode="decimal"
							type="number"
						/>
					</label>
					<label>
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Refund speed</span
						>
						<select
							bind:value={refundEditor.speed}
							class="input-field"
							disabled={refundSaving || refundableAmount <= 0}
						>
							<option value="normal">Normal</option>
							<option value="optimum">Optimum / instant if available</option>
						</select>
					</label>
				</div>

				<label class="mt-4 block">
					<span
						class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
						>Reason</span
					>
					<textarea
						bind:value={refundEditor.reason}
						class="input-field min-h-28 py-3"
						placeholder="Reason for this refund"
					></textarea>
				</label>

				<div class="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
						disabled={refundSaving || refundableAmount <= 0}
						onclick={() => void createRefund()}
					>
						{refundSaving ? 'Creating refund...' : 'Create refund'}
					</button>
				</div>
			</section>

			<section class="mt-5 grid gap-4 lg:grid-cols-2">
				<div class="rounded-[16px] border border-[var(--border-faint)] p-4">
					<p class="text-label-small text-foreground">Customer and delivery</p>
					<div class="mt-4 grid gap-3">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Email
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.shippingEmail || 'Not captured'}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Phone
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.shippingPhone || 'Not captured'}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Service
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.shippingServiceType.replaceAll('_', ' ')}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Courier
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.shipment?.courierName ||
									selectedOrder.shippingCourierName ||
									'Not assigned'}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Address
							</p>
							<p class="text-body-small mt-1 text-foreground">
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

				<div class="rounded-[16px] border border-[var(--border-faint)] p-4">
					<p class="text-label-small text-foreground">Operational detail</p>
					<div class="mt-4 grid gap-3">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Placed
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Last updated
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{new Date(selectedOrder.updatedAt).toLocaleString('en-IN')}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Payment method
							</p>
							<p class="text-body-small mt-1 text-foreground">{selectedOrder.paymentMethod}</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Shipment
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.shipment?.status || 'Shipment not created'}
							</p>
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Invoice
							</p>
							<p class="text-body-small mt-1 text-foreground">
								{selectedOrder.invoice?.invoice_number || 'Not generated'}
							</p>
							{#if selectedOrder.invoice?.invoice_url}
								<a
									href={selectedOrder.invoice.invoice_url}
									target="_blank"
									rel="noreferrer"
									class="text-label-small mt-1 inline-block text-[var(--heat-100)] hover:underline"
								>
									Open invoice
								</a>
							{/if}
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Tracking
							</p>
							{#if selectedOrder.shipment?.trackingUrl}
								<a
									href={selectedOrder.shipment.trackingUrl}
									target="_blank"
									rel="noreferrer"
									class="text-label-small mt-1 inline-block text-[var(--heat-100)] hover:underline"
								>
									Open live tracking
								</a>
							{:else}
								<p class="text-body-small mt-1 text-foreground">Tracking not available yet</p>
							{/if}
						</div>
					</div>
				</div>
			</section>

			<section class="mt-5 rounded-[16px] border border-[var(--border-faint)] p-4">
				<p class="text-label-small text-foreground">Items</p>
				<div class="mt-4 space-y-3">
					{#each selectedOrder.items as item (item.id)}
						<div
							class="grid gap-3 rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center"
						>
							{#if item.image}
								<img
									src={item.image}
									alt={item.title}
									class="h-18 w-18 rounded-md border border-[var(--border-faint)] bg-white object-contain p-1.5"
								/>
							{:else}
								<div
									class="grid h-18 w-18 place-items-center rounded-md border border-[var(--border-faint)] bg-white text-[var(--black-alpha-40)]"
								>
									No image
								</div>
							{/if}
							<div class="min-w-0">
								<p class="text-label-small line-clamp-2 text-foreground">{item.title}</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{item.brand || 'Brand pending'} / {formatINR(item.price)}
								</p>
							</div>
							<div
								class="rounded-[12px] border border-[var(--border-faint)] bg-white px-3 py-2 text-center"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Qty
								</p>
								<p class="text-label-small mt-1 text-foreground">{item.qty}</p>
							</div>
						</div>
					{/each}
				</div>
			</section>

			{#if selectedOrder.refunds.length || selectedOrder.adminEvents.length}
				<section class="mt-5 grid gap-4 xl:grid-cols-2">
					<div class="rounded-[16px] border border-[var(--border-faint)] p-4">
						<p class="text-label-small text-foreground">Refund history</p>
						<div class="mt-4 space-y-3">
							{#if !selectedOrder.refunds.length}
								<p class="text-body-small text-[var(--black-alpha-56)]">No refunds created yet.</p>
							{:else}
								{#each selectedOrder.refunds as refund (refund.id)}
									<div
										class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
									>
										<div class="flex flex-wrap items-center justify-between gap-3">
											<p class="text-label-small text-foreground">{formatINR(refund.amount)}</p>
											<span
												class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses(statusTone(refund.status))}`}
											>
												{refund.status}
											</span>
										</div>
										<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
											{refund.reason || 'No reason captured'}
										</p>
										<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
											{new Date(refund.createdAt).toLocaleString('en-IN')}
										</p>
									</div>
								{/each}
							{/if}
						</div>
					</div>

					<div class="rounded-[16px] border border-[var(--border-faint)] p-4">
						<p class="text-label-small text-foreground">Admin history</p>
						<div class="mt-4 space-y-3">
							{#if !selectedOrder.adminEvents.length}
								<p class="text-body-small text-[var(--black-alpha-56)]">
									No admin events logged yet.
								</p>
							{:else}
								{#each selectedOrder.adminEvents as event (event.id)}
									<div
										class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
									>
										<div class="flex flex-wrap items-center justify-between gap-3">
											<p class="text-label-small text-foreground">
												{event.eventType.replaceAll('_', ' ')}
											</p>
											<p class="text-body-small text-[var(--black-alpha-56)]">
												{new Date(event.createdAt).toLocaleString('en-IN')}
											</p>
										</div>
										<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">{event.reason}</p>
										{#if event.adminEmail}
											<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
												{event.adminEmail}
											</p>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</section>
			{/if}
		{:else}
			<div
				class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
			>
				Select an order to manage its workflow.
			</div>
		{/if}
	</section>
</div>
