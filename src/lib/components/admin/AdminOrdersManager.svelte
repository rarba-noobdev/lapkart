<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { ChevronRight, Filter, Package, RotateCcw, Search, X } from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import {
		adminReasonRequired,
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

	let {
		initialFilter = null,
		initialSearch = null,
		initialSelectId = null,
		title = 'Orders',
		subtitle = 'Shipments, returns, refunds'
	}: {
		initialFilter?: string | null;
		initialSearch?: string | null;
		initialSelectId?: string | null;
		title?: string;
		subtitle?: string;
	} = $props();

	const HeadingIcon = $derived(title.toLowerCase().includes('return') ? RotateCcw : Package);

	type OrderStatusFilter =
		| 'all'
		| 'needs-action'
		| 'returns'
		| 'in-transit'
		| 'delivered'
		| 'cancelled';

	const statusFilters: Array<{ id: OrderStatusFilter; label: string }> = [
		{ id: 'all', label: 'All' },
		{ id: 'needs-action', label: 'Needs action' },
		{ id: 'returns', label: 'Returns' },
		{ id: 'in-transit', label: 'In transit' },
		{ id: 'delivered', label: 'Delivered' },
		{ id: 'cancelled', label: 'Cancelled' }
	];

	const statusFilterGroups: Record<Exclude<OrderStatusFilter, 'all'>, string[]> = {
		'needs-action': [
			'pending',
			'processing',
			'on_hold',
			'confirmed',
			'cancellation_requested',
			'return_requested'
		],
		returns: ['return_requested', 'returned', 'rto', 'refunded'],
		'in-transit': ['ready_for_delivery', 'shipped', 'out_for_delivery'],
		delivered: ['delivered'],
		cancelled: ['cancelled', 'returned', 'rto', 'refunded']
	};

	type AdminOrderPatch = {
		id: string;
		status?: string | null;
		paymentStatus?: string | null;
		rtoRisk?: number | null;
		holdReason?: string | null;
		codFee?: number | null;
		updatedAt?: string | null;
	};

	let orders = $state<AdminOrderRecord[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let refundSaving = $state(false);
	let workflowAction = $state<string | null>(null);
	let search = $state('');
	let statusFilter = $state<OrderStatusFilter>('all');
	let appliedInitialFilter: string | null = null;
	let selectedId = $state<string | null>(null);
	let page = $state(1);
	let total = $state(0);
	let totalPages = $state(1);
	let searchTimer: number | null = null;
	const ORDERS_PAGE_SIZE = 50;

	$effect(() => {
		if (initialFilter !== appliedInitialFilter) {
			appliedInitialFilter = initialFilter;
			if (initialFilter && statusFilters.some((filter) => filter.id === initialFilter)) {
				statusFilter = initialFilter as OrderStatusFilter;
				page = 1;
				void loadOrders(false);
			}
		}
	});

	// Deep-link from the command palette: apply a search term and pre-select a
	// specific order once it appears in the results.
	let appliedInitialSearch: string | null = null;
	$effect(() => {
		if (initialSearch !== appliedInitialSearch) {
			appliedInitialSearch = initialSearch;
			if (initialSearch !== null) {
				search = initialSearch;
				statusFilter = 'all';
				page = 1;
				if (initialSelectId) selectedId = initialSelectId;
				void loadOrders(false);
			}
		}
	});
	let editor = $state<OrderEditorState>(emptyOrderEditor());
	let refundEditor = $state<RefundEditorState>(emptyRefundEditor());
	let confirmingManualState = $state(false);
	let realtimeRefreshTimer: number | null = null;

	// Search and status filtering run server-side so the full order history is
	// reachable, not just the first page held in memory.
	const filteredOrders = $derived(orders);

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

	const ORDER_TIMELINE = [
		{ id: 'confirmed', label: 'Paid' },
		{ id: 'out_for_delivery', label: 'Out for delivery' },
		{ id: 'delivered', label: 'Delivered' }
	];
	const timelineIndex = $derived.by(() => {
		if (!selectedOrder) return -1;
		const status = String(selectedOrder.status ?? '').toLowerCase();
		if (['pending', 'processing', 'on_hold', 'confirmed'].includes(status)) return 0;
		if (['ready_for_delivery', 'packed', 'shipped'].includes(status)) return 1;
		return ORDER_TIMELINE.findIndex((step) => step.id === status);
	});
	const timelineTerminal = $derived(
		selectedOrder
			? [
					'cancelled',
					'returned',
					'rto',
					'refunded',
					'cancellation_requested',
					'return_requested'
				].includes(String(selectedOrder.status ?? '').toLowerCase())
			: false
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
			const params = new URLSearchParams({
				page: String(page),
				pageSize: String(ORDERS_PAGE_SIZE)
			});
			const q = search.trim();
			if (q) params.set('q', q);
			if (statusFilter !== 'all')
				params.set('statuses', statusFilterGroups[statusFilter].join(','));
			const response = await requestAdmin<{
				orders: AdminOrderRecord[];
				pagination?: { page: number; total: number; totalPages: number };
			}>(`/admin/orders?${params}`);
			const nextOrders = response.orders ?? [];
			orders = nextOrders;
			total = response.pagination?.total ?? nextOrders.length;
			totalPages = response.pagination?.totalPages ?? 1;
			if (page > totalPages) page = totalPages;
			syncSelection(nextOrders);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not load orders';
		} finally {
			if (showLoading) loading = false;
		}
	}

	function queueSearch() {
		if (searchTimer) window.clearTimeout(searchTimer);
		searchTimer = window.setTimeout(() => {
			searchTimer = null;
			page = 1;
			void loadOrders(false);
		}, 300);
	}

	function setStatusFilter(next: OrderStatusFilter) {
		if (next === statusFilter) return;
		statusFilter = next;
		page = 1;
		void loadOrders(false);
	}

	function setPage(next: number) {
		const target = Math.min(Math.max(1, next), totalPages);
		if (target === page) return;
		page = target;
		void loadOrders(false);
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
				rtoRisk: patch.rtoRisk ?? order.rtoRisk,
				holdReason: patch.holdReason ?? order.holdReason,
				codFee: patch.codFee ?? order.codFee,
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
				rtoRisk: Number.isFinite(Number(row.rto_risk)) ? Number(row.rto_risk) : null,
				holdReason: typeof row.hold_reason === 'string' ? row.hold_reason : null,
				codFee: Number.isFinite(Number(row.cod_fee)) ? Number(row.cod_fee) : null,
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
			const response = await requestAdmin<{ order?: AdminOrderPatch }>(
				`/admin/orders/${editor.id}`,
				{
					method: 'PATCH',
					body: JSON.stringify(payload)
				}
			);
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

	function closeDetail() {
		selectedId = null;
	}

	// Lock body scroll + close the detail drawer on Escape while it is open.
	$effect(() => {
		if (!selectedId) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeDetail();
			}
		};
		window.addEventListener('keydown', onKeydown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKeydown);
		};
	});

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
			if (searchTimer) window.clearTimeout(searchTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<div class="orders-board">
	<!-- ==================== HEADER ==================== -->
	<div class="orders-toolbar">
		<div class="flex min-w-0 items-center gap-2.5">
			<div class="orders-toolbar-icon">
				<HeadingIcon class="size-[18px]" strokeWidth={2} />
			</div>
			<div class="min-w-0">
				<h2 class="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
				<p class="text-[11px] text-[var(--black-alpha-40)]">
					Showing {orders.length.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}
					{title.toLowerCase()}
				</p>
			</div>
		</div>
		<button
			type="button"
			class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3.5 text-[13px] font-medium text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
			disabled={loading}
			onclick={() => void loadOrders()}
		>
			<RotateCcw class="size-3.5" strokeWidth={2} />
			{loading ? 'Refreshing...' : 'Refresh'}
		</button>
	</div>

	<!-- ==================== CONTROLS ==================== -->
	<div class="orders-controls">
		<div class="orders-search-row">
			<label class="orders-search-field">
				<Search class="size-3.5 text-[var(--black-alpha-32)]" strokeWidth={2} />
				<input
					bind:value={search}
					oninput={queueSearch}
					class="orders-search-input"
					placeholder="Search customer, phone, email, city, or pincode"
				/>
			</label>
		</div>
		<div class="orders-filter-card">
			<div class="orders-filter-head">
				<div class="flex items-center gap-1.5">
					<Filter class="size-3.5 text-[var(--black-alpha-40)]" strokeWidth={2} />
					<span>Filters</span>
				</div>
				{#if statusFilter !== 'all'}
					<button type="button" onclick={() => setStatusFilter('all')}>Clear</button>
				{/if}
			</div>
			<div class="flex flex-wrap gap-1.5">
				{#each statusFilters as filter (filter.id)}
					<button
						type="button"
						class="inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors {statusFilter ===
						filter.id
							? 'border-[var(--heat-100)] bg-[var(--heat-100)] text-white'
							: 'border-[var(--border-muted)] bg-white text-[var(--black-alpha-56)] hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]'}"
						onclick={() => setStatusFilter(filter.id)}
					>
						{filter.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- ==================== TABLE ==================== -->
	<div class="orders-table-wrap">
		{#if loading && !orders.length}
			<div class="px-6 py-10 text-center text-[12px] text-[var(--black-alpha-48)]">
				Loading {title.toLowerCase()}...
			</div>
		{:else if !filteredOrders.length}
			<div class="px-6 py-12 text-center">
				<HeadingIcon class="mx-auto size-9 text-[var(--black-alpha-24)]" strokeWidth={1.5} />
				<p class="mt-2.5 text-[13px] font-medium text-foreground">No {title.toLowerCase()} found</p>
				<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">
					Nothing matches the current search and filters.
				</p>
			</div>
		{:else}
			<table class="orders-table">
				<thead>
					<tr>
						<th>Order</th>
						<th class="ord-cust-col">Customer</th>
						<th class="ord-date-col">Date</th>
						<th class="ord-num-col">Total</th>
						<th class="ord-pay-col">Payment</th>
						<th class="ord-status-col">Status</th>
						<th class="ord-act-col">View</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredOrders as order, idx (order.id)}
						<tr
							class="orders-trow {order.id === selectedId ? 'is-selected' : ''}"
							in:fly={{ y: 6, duration: 180, delay: Math.min(idx * 14, 260) }}
							onclick={() => selectOrder(order)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									selectOrder(order);
								}
							}}
							tabindex="0"
							role="button"
							aria-label={`View order ${order.id.slice(0, 8).toUpperCase()}`}
						>
							<td>
								<div class="flex items-center gap-1.5">
									<span class="font-mono text-[12px] font-medium text-foreground">
										#{order.id.slice(0, 8).toUpperCase()}
									</span>
									{#if isTerminalOrder(order)}
										<span class="ord-pill ord-pill-muted">Locked</span>
									{/if}
								</div>
								<div class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
									{[order.shippingCity, order.shippingState].filter(Boolean).join(', ') ||
										'Address pending'}
								</div>
							</td>
							<td class="ord-cust-col">
								<span class="block truncate text-[13px] text-foreground">
									{order.shippingName || order.userEmail || 'Customer'}
								</span>
							</td>
							<td class="ord-date-col">
								<span class="text-[12px] text-[var(--black-alpha-56)]">
									{new Date(order.createdAt).toLocaleString('en-IN', {
										month: 'short',
										day: 'numeric',
										year: '2-digit'
									})}
								</span>
							</td>
							<td class="ord-num-col">
								<span class="text-[13px] font-semibold text-foreground">
									{formatINR(order.total)}
								</span>
							</td>
							<td class="ord-pay-col">
								<span
									class={`ord-pill ${
										order.paymentStatus === 'paid' ? 'ord-pill-forest' : 'ord-pill-muted'
									}`}
								>
									{order.paymentStatus}
								</span>
							</td>
							<td class="ord-status-col">
								<div class="flex flex-wrap items-center gap-1">
									<span
										class={`ord-pill ${
											order.status === 'cancelled'
												? 'ord-pill-crimson'
												: order.status === 'delivered'
													? 'ord-pill-forest'
													: 'ord-pill-honey'
										}`}
									>
										{order.status.replaceAll('_', ' ')}
									</span>
									{#if order.cancellationRequest}
										<span class="ord-pill ord-pill-crimson">
											cancel {order.cancellationRequest.status}
										</span>
									{/if}
								</div>
							</td>
							<td class="ord-act-col">
								<span class="orders-view-btn" aria-hidden="true">
									<ChevronRight class="size-4" strokeWidth={2} />
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	{#if totalPages > 1 || total > orders.length}
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				class="inline-flex h-8 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
				disabled={page <= 1}
				onclick={() => setPage(page - 1)}
			>
				Prev
			</button>
			<span class="text-[11px] text-[var(--black-alpha-48)]">
				Page {page} of {totalPages} · {total}
				{title.toLowerCase()}
			</span>
			<button
				type="button"
				class="inline-flex h-8 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
				disabled={page >= totalPages}
				onclick={() => setPage(page + 1)}
			>
				Next
			</button>
		</div>
	{/if}
</div>

<!-- ==================== DETAIL DRAWER ==================== -->
{#if selectedOrder}
	<div
		class="orders-drawer-backdrop"
		onclick={closeDetail}
		role="presentation"
		in:fade={{ duration: 160 }}
		out:fade={{ duration: 140 }}
	></div>
	<aside
		class="orders-drawer"
		aria-label="Order details"
		in:fly={{ x: 32, duration: 260, easing: quintOut }}
		out:fly={{ x: 24, duration: 180, easing: quintOut }}
	>
		<div class="orders-drawer-head">
			<div class="min-w-0">
				<p
					class="text-[10px] font-semibold tracking-[0.12em] text-[var(--black-alpha-40)] uppercase"
				>
					{title} detail
				</p>
				<h3 class="font-mono text-[14px] font-semibold text-foreground">
					#{selectedOrder.id.slice(0, 8).toUpperCase()}
				</h3>
			</div>
			<button
				type="button"
				class="grid size-9 place-items-center rounded-full text-[var(--black-alpha-56)] transition-colors hover:bg-[var(--black-alpha-4)] hover:text-foreground"
				aria-label="Close details"
				onclick={closeDetail}
			>
				<X class="size-[18px]" strokeWidth={2} />
			</button>
		</div>

		<div class="orders-drawer-body space-y-6 px-5 pb-6">
			{#if error}
				<div
					class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]"
				>
					{error}
				</div>
			{/if}

			{#if selectedOrder}
				{#if selectedOrderLocked}
					<div
						class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]"
					>
						This order is in a terminal state. Status and payment edits are locked in the admin app.
						Use the database only for an exceptional correction.
					</div>
				{/if}

				<!-- Compact header row -->
				<div
					class="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[var(--border-muted)] bg-[var(--background-lighter)] p-3"
					in:fly={{ y: 8, duration: 200 }}
				>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Order</p>
						<p class="text-[13px] font-medium text-foreground">
							#{selectedOrder.id.slice(0, 8).toUpperCase()}
						</p>
					</div>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Customer</p>
						<p class="text-[13px] font-medium text-foreground">
							{selectedOrder.shippingName || 'Customer'}
						</p>
					</div>
					<div>
						<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Total</p>
						<p class="text-[13px] font-medium text-foreground">{formatINR(selectedOrder.total)}</p>
					</div>
					{#if selectedOrder.codFee > 0 || selectedOrder.rtoRisk > 0}
						<div>
							<p class="text-[11px] font-medium text-[var(--black-alpha-48)]">Risk</p>
							<p class="text-[13px] font-medium text-foreground">
								{selectedOrder.rtoRisk}/100
								{#if selectedOrder.codFee > 0}
									<span class="text-[var(--black-alpha-40)]">
										· COD {formatINR(selectedOrder.codFee)}</span
									>
								{/if}
							</p>
						</div>
					{/if}
					<div class="ml-auto flex flex-wrap items-center gap-1.5">
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
						{#if selectedOrder.holdReason}
							<span
								class="rounded-md bg-[var(--accent-honey)]/12 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--accent-honey)] uppercase"
							>
								Review hold
							</span>
						{/if}
					</div>
				</div>

				{#if selectedOrder.holdReason}
					<div
						class="rounded-lg border border-[var(--accent-honey)]/20 bg-[var(--accent-honey)]/8 p-3 text-[12px] text-[var(--black-alpha-72)]"
					>
						<span class="font-medium text-foreground">Hold reason:</span>
						{selectedOrder.holdReason}
					</div>
				{/if}

				<!-- Fulfilment progress timeline -->
				{#if !timelineTerminal && timelineIndex >= 0}
					<div
						class="rounded-lg border border-[var(--border-muted)] bg-white px-4 py-3.5 shadow-sm"
						in:fly={{ y: 8, duration: 200 }}
					>
						<div class="flex items-center">
							{#each ORDER_TIMELINE as step, idx (step.id)}
								<div class="flex items-center {idx < ORDER_TIMELINE.length - 1 ? 'flex-1' : ''}">
									<div class="flex flex-col items-center gap-1.5">
										<span
											class="flex size-4 items-center justify-center rounded-full border-2 transition-colors
												{idx < timelineIndex
												? 'border-[var(--heat-100)] bg-[var(--heat-100)]'
												: idx === timelineIndex
													? 'border-[var(--heat-100)] bg-white'
													: 'border-[var(--border-muted)] bg-white'}"
										>
											{#if idx === timelineIndex}
												<span class="size-1.5 animate-pulse rounded-full bg-[var(--heat-100)]"
												></span>
											{/if}
										</span>
										<span
											class="text-[9px] font-medium tracking-wide whitespace-nowrap uppercase
												{idx <= timelineIndex ? 'text-foreground' : 'text-[var(--black-alpha-32)]'}"
										>
											{step.label}
										</span>
									</div>
									{#if idx < ORDER_TIMELINE.length - 1}
										<span
											class="mx-1.5 mb-4 h-[2px] flex-1 rounded-full
												{idx < timelineIndex ? 'bg-[var(--heat-100)]' : 'bg-[var(--border-muted)]'}"
										></span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

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
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
									>Order Status</span
								>
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
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
									>Payment Status</span
								>
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
								<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
									>Reason for change</span
								>
								<textarea
									bind:value={editor.reason}
									class="input-field mt-1 !h-auto min-h-[64px] py-2 !text-[12px]"
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
							<div
								class="mt-3 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-2.5 text-[12px] text-[var(--accent-crimson)]"
							>
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
						<div
							class="rounded-lg border border-[var(--accent-crimson)]/15 bg-[var(--accent-crimson)]/4 p-4 shadow-sm"
						>
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
											disabled={workflowAction !== null || !canAdminCancelOrder(selectedOrder)}
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
						<div
							class="rounded-lg border border-[var(--accent-honey)]/20 bg-[var(--accent-honey)]/6 p-4 shadow-sm"
						>
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
										{#if selectedOrder.returnRequest.condition_notes}
											<p>Condition: {selectedOrder.returnRequest.condition_notes}</p>
										{/if}
									</div>
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#each selectedOrder.returnRequest.photos ?? [] as photoUrl, index (photoUrl)}
											<a
												href={photoUrl}
												target="_blank"
												rel="noreferrer"
												class="rounded-md border border-[var(--border-muted)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--black-alpha-64)] hover:text-[var(--heat-100)]"
											>
												Photo {index + 1}
											</a>
										{/each}
										{#each selectedOrder.returnRequest.videos ?? [] as videoUrl, index (videoUrl)}
											<a
												href={videoUrl}
												target="_blank"
												rel="noreferrer"
												class="rounded-md border border-[var(--border-muted)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--black-alpha-64)] hover:text-[var(--heat-100)]"
											>
												Video {index + 1}
											</a>
										{/each}
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
										<span
											class="rounded-md border border-[var(--border-muted)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
										>
											Manual return pickup
										</span>
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
									Refunds against the captured payment. Partial refunds keep the payment as
									partially refunded until balance reaches zero.
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
								<div
									class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5"
								>
									<p
										class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase"
									>
										Paid
									</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">
										{formatINR(selectedOrder.refundSummary.paidAmount)}
									</p>
								</div>
								<div
									class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5"
								>
									<p
										class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase"
									>
										Refunded
									</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">
										{formatINR(selectedOrder.refundSummary.refundedAmount)}
									</p>
								</div>
								<div
									class="rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] p-2.5"
								>
									<p
										class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase"
									>
										Remaining
									</p>
									<p class="mt-0.5 text-[13px] font-medium text-foreground">
										{formatINR(refundableAmount)}
									</p>
								</div>
							</div>

							{#if refundableAmount > 0}
								<div class="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
									<label>
										<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
											>Refund amount</span
										>
										<input
											bind:value={refundEditor.amount}
											class="input-field mt-1 !h-8 !text-[12px]"
											disabled={refundSaving}
											inputmode="decimal"
											type="number"
										/>
									</label>
									<label>
										<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
											>Refund speed</span
										>
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
										class="input-field mt-1 !h-auto min-h-[56px] py-2 !text-[12px]"
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
									<p class="text-[12px] text-foreground">
										{selectedOrder.shippingEmail || 'Not captured'}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Phone</span>
									<p class="text-[12px] text-foreground">
										{selectedOrder.shippingPhone || 'Not captured'}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Service</span>
									<p class="text-[12px] text-foreground">
										{selectedOrder.shippingServiceType.replaceAll('_', ' ')}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Courier</span>
									<p class="text-[12px] text-foreground">
										{selectedOrder.shipment?.courierName ||
											selectedOrder.shippingCourierName ||
											'Not assigned'}
									</p>
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
									<p class="text-[12px] text-foreground">
										{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
										>Last updated</span
									>
									<p class="text-[12px] text-foreground">
										{new Date(selectedOrder.updatedAt).toLocaleString('en-IN')}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]"
										>Payment method</span
									>
									<p class="text-[12px] text-foreground">{selectedOrder.paymentMethod}</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Shipment</span>
									<p class="text-[12px] text-foreground">
										{selectedOrder.shipment?.status || 'Not created'}
									</p>
								</div>
								<div>
									<span class="text-[11px] font-medium text-[var(--black-alpha-48)]">Invoice</span>
									<div class="flex items-center gap-1.5">
										<p class="text-[12px] text-foreground">
											{selectedOrder.invoice?.invoice_number || 'Not generated'}
										</p>
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
									<p
										class="text-[10px] font-medium tracking-wider text-[var(--black-alpha-48)] uppercase"
									>
										Qty
									</p>
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
										<div
											class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm"
										>
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
										<div
											class="rounded-lg border border-[var(--border-muted)] bg-white p-3 shadow-sm"
										>
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
	</aside>
{/if}

<style>
	.orders-board {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.orders-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.orders-toolbar-icon {
		display: grid;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		place-items: center;
		border-radius: 10px;
		border: 1px solid var(--border-faint);
		background: linear-gradient(135deg, var(--heat-4), white);
		color: var(--heat-100);
	}

	.orders-controls {
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 12px;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
	}

	.orders-search-row {
		display: flex;
	}

	.orders-search-field {
		display: flex;
		min-width: 0;
		height: 36px;
		flex: 1;
		align-items: center;
		gap: 8px;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 0 10px;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;
	}

	.orders-search-field:focus-within {
		border-color: var(--heat-40);
		box-shadow: 0 0 0 3px var(--heat-8);
	}

	.orders-search-input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--foreground);
		font-size: 13px;
		outline: none;
	}

	.orders-search-input::placeholder {
		color: var(--black-alpha-32);
	}

	.orders-filter-card {
		margin-top: 8px;
		border-radius: 7px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 8px;
	}

	.orders-filter-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
		color: var(--black-alpha-56);
		font-size: 11px;
		font-weight: 600;
	}

	.orders-filter-head button {
		border: 0;
		background: transparent;
		color: var(--heat-100);
		font-size: 11px;
		font-weight: 600;
	}

	/* ── Table ── */
	.orders-table-wrap {
		overflow-x: auto;
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.orders-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.orders-table thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--background-lighter);
		border-bottom: 1px solid var(--border-faint);
		padding: 10px 14px;
		text-align: left;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--black-alpha-48);
		white-space: nowrap;
	}

	.orders-table tbody td {
		padding: 11px 14px;
		border-bottom: 1px solid var(--border-faint);
		vertical-align: middle;
	}

	.orders-table tbody tr:last-child td {
		border-bottom: 0;
	}

	.ord-cust-col {
		max-width: 200px;
	}
	.ord-date-col {
		width: 96px;
	}
	.ord-num-col,
	.orders-table th.ord-num-col {
		width: 120px;
		text-align: right;
	}
	.ord-pay-col {
		width: 110px;
	}
	.ord-status-col {
		width: 180px;
	}
	.ord-act-col,
	.orders-table th.ord-act-col {
		width: 72px;
		text-align: right;
	}

	.orders-trow {
		cursor: pointer;
		outline: none;
		transition: background-color 140ms ease;
	}

	.orders-trow:hover {
		background: var(--heat-4);
	}

	.orders-trow:focus-visible {
		background: var(--heat-4);
		box-shadow: inset 2px 0 0 var(--heat-100);
	}

	.orders-trow.is-selected {
		background: var(--heat-8);
	}

	.orders-view-btn {
		display: inline-grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: 7px;
		border: 1px solid var(--border-faint);
		background: white;
		color: var(--black-alpha-48);
		transition:
			border-color 140ms ease,
			color 140ms ease;
	}

	.orders-trow:hover .orders-view-btn {
		border-color: var(--heat-100);
		color: var(--heat-100);
	}

	/* ── Status pills ── */
	.ord-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 6px;
		padding: 2px 7px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.ord-pill-muted {
		background: var(--background-lighter);
		color: var(--black-alpha-48);
	}

	.ord-pill-forest {
		background: color-mix(in srgb, var(--accent-forest) 10%, transparent);
		color: var(--accent-forest);
	}

	.ord-pill-honey {
		background: color-mix(in srgb, var(--accent-honey) 16%, transparent);
		color: var(--accent-honey);
	}

	.ord-pill-crimson {
		background: color-mix(in srgb, var(--accent-crimson) 10%, transparent);
		color: var(--accent-crimson);
	}

	/* ── Detail drawer ── */
	.orders-drawer-backdrop {
		position: fixed;
		inset: 0;
		z-index: 70;
		background: var(--black-alpha-32);
		backdrop-filter: blur(2px);
	}

	.orders-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 71;
		display: flex;
		width: min(560px, 100vw);
		flex-direction: column;
		background: white;
		box-shadow: -24px 0 60px -24px rgba(0, 0, 0, 0.35);
	}

	.orders-drawer-head {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-bottom: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: max(12px, env(safe-area-inset-top)) 16px 12px;
	}

	.orders-drawer-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding-top: 20px;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	@media (max-width: 640px) {
		.orders-drawer {
			width: 100vw;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.orders-trow {
			transition: none;
		}
	}
</style>
