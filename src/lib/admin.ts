import { apiBase } from '$lib/api-base';
import { getAuthorizationHeaders } from '$lib/supabase-auth';

export type TrackingActivity = {
	date: string | null;
	status: string | null;
	activity: string | null;
	location: string | null;
};

export type FulfillmentShipment = {
	id: string;
	shippingServiceType: 'standard' | 'quick';
	status: string;
	shiprocketShipmentId: number | null;
	awbCode: string | null;
	courierName: string | null;
	pickupScheduledDate: string | null;
	expectedDeliveryDate: string | null;
	trackingUrl: string | null;
	manifestUrl: string | null;
	labelUrl: string | null;
	trackingActivities: TrackingActivity[];
};

export type FulfillmentOrder = {
	id: string;
	createdAt: string;
	status: string;
	total: number;
	shippingName: string | null;
	shippingCity: string | null;
	shippingState: string | null;
	shippingPincode: string | null;
	shippingServiceType: 'standard' | 'quick';
	items: Array<{
		id: string;
		title: string;
		image: string;
		brand: string;
		qty: number;
		sku: string | null;
	}>;
	shipment: FulfillmentShipment | null;
};

export type ShiprocketAccount = {
	walletBalance: number;
	configuredPickupLocation: string;
	pickupLocationVerified: boolean;
	pickupLocations: Array<{
		id: number | null;
		pickupLocation: string | null;
		pincode: string | null;
		city: string | null;
		state: string | null;
		latitude: number | null;
		longitude: number | null;
		primary: boolean;
		active: boolean;
	}>;
};

export type AdminProductQuestion = {
	id: string;
	question: string;
	answer: string | null;
	status: 'pending' | 'published' | 'rejected';
	created_at: string;
	answered_at: string | null;
	products: {
		id: string;
		title: string;
		brand: string;
		image: string;
	} | null;
};

export type AdminStockNotificationEvent = {
	id: string;
	email: string;
	status: 'pending' | 'sent' | 'failed' | 'cancelled';
	payload: Record<string, unknown>;
	created_at: string;
	processed_at: string | null;
	products: {
		id: string;
		title: string;
		brand: string;
		image: string;
	} | null;
};

export type AdminOrderRecord = {
	id: string;
	userId: string;
	userEmail: string | null;
	createdAt: string;
	updatedAt: string;
	status: string;
	paymentStatus: string;
	paymentMethod: string;
	subtotal: number;
	shipping: number;
	codFee: number;
	total: number;
	rtoRisk: number;
	holdReason: string | null;
	shippingName: string | null;
	shippingPhone: string | null;
	shippingEmail: string | null;
	shippingLine1: string | null;
	shippingLine2: string | null;
	shippingCity: string | null;
	shippingState: string | null;
	shippingPincode: string | null;
	shippingServiceType: 'standard' | 'quick';
	shippingCourierName: string | null;
	itemSummary: string;
	items: Array<{
		id: string;
		title: string;
		image: string | null;
		brand: string | null;
		qty: number;
		price: number;
	}>;
	shipment: {
		status: string;
		awbCode: string | null;
		courierName: string | null;
		trackingUrl: string | null;
		expectedDeliveryDate: string | null;
	} | null;
	payment: {
		id: string;
		provider: string;
		status: string;
		amount: number;
		providerPaymentId: string | null;
		providerOrderId: string | null;
	} | null;
	cancellationRequest: {
		id: string;
		status: string;
		reason: string;
		admin_note: string | null;
		requested_at: string;
		resolved_at: string | null;
		refund_id: string | null;
	} | null;
	returnRequest: {
		id: string;
		status: string;
		reason: string;
		condition_notes: string | null;
		photos: string[] | null;
		videos: string[] | null;
		admin_note: string | null;
		requested_at: string;
		resolved_at: string | null;
		received_at: string | null;
		reverse_shipment_id: string | null;
		refund_id: string | null;
	} | null;
	refund: {
		id: string;
		amount: number;
		status: string;
		provider_refund_id: string | null;
		created_at: string;
		cancellation_request_id: string | null;
		return_request_id: string | null;
	} | null;
	refunds: Array<{
		id: string;
		amount: number;
		status: string;
		reason: string | null;
		speed: 'normal' | 'optimum';
		providerRefundId: string | null;
		createdAt: string;
		processedAt: string | null;
		cancellationRequestId: string | null;
		returnRequestId: string | null;
	}>;
	refundSummary: {
		paidAmount: number;
		refundedAmount: number;
		refundableAmount: number;
	};
	invoice: {
		invoice_number: string;
		invoice_url: string | null;
		status: string;
		generated_at: string;
	} | null;
	adminEvents: Array<{
		id: string;
		eventType: string;
		reason: string;
		createdAt: string;
		adminUserId: string | null;
		adminEmail: string | null;
		fromState: Record<string, unknown>;
		toState: Record<string, unknown>;
	}>;
};

export type OrderEditorState = {
	id: string | null;
	status: string;
	paymentStatus: string;
	reason: string;
};

export type RefundEditorState = {
	amount: string;
	reason: string;
	speed: 'normal' | 'optimum';
	cancellationRequestId: string | null;
	returnRequestId: string | null;
};

export const manualOrderStatusOptions = [
	{ value: 'pending', label: 'Pending' },
	{ value: 'processing', label: 'Processing' },
	{ value: 'confirmed', label: 'Paid' },
	{ value: 'on_hold', label: 'On hold' },
	{ value: 'out_for_delivery', label: 'Out for delivery' },
	{ value: 'delivered', label: 'Delivered' },
	{ value: 'cancelled', label: 'Cancelled' },
	{ value: 'returned', label: 'Returned' },
	{ value: 'rto', label: 'RTO' }
] as const;

export const manualOrderStatusValues = new Set(
	manualOrderStatusOptions.map((option) => option.value)
);

export const paymentStatusOptions = [
	{ value: 'pending', label: 'Pending' },
	{ value: 'paid', label: 'Paid' },
	{ value: 'cod_pending', label: 'COD Pending' },
	{ value: 'cod_cancelled', label: 'COD Cancelled' },
	{ value: 'failed', label: 'Failed' },
	{ value: 'partially_refunded', label: 'Partially refunded' },
	{ value: 'refunded', label: 'Refunded' }
] as const;

const terminalOrderStatuses = new Set(['cancelled', 'refunded', 'returned', 'rto']);
const terminalPaymentStatuses = new Set(['refunded', 'cod_cancelled']);
const blockedFulfillmentStatuses = new Set([
	'cancelled',
	'cancellation_requested',
	'on_hold',
	'rto',
	'return_requested',
	'refunded'
]);

export async function requestAdmin<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${apiBase}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(await getAuthorizationHeaders()),
			...init?.headers
		}
	});

	const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
	if (!response.ok) throw new Error(body?.error ?? 'Admin request failed');
	return (body ?? {}) as T;
}

export type AdminImageUploadResponse = {
	bucket: string;
	path: string;
	image_url: string;
	uploaded_at: string;
};

export async function uploadAdminImage(
	bucket: 'products' | 'users',
	file: File
): Promise<AdminImageUploadResponse> {
	const formData = new FormData();
	formData.append('file', file);

	const response = await fetch(`${apiBase}/storage/upload/${bucket}`, {
		method: 'POST',
		headers: await getAuthorizationHeaders(),
		body: formData
	});

	const body = (await response.json().catch(() => null)) as
		| (AdminImageUploadResponse & { error?: string })
		| null;
	if (!response.ok) throw new Error(body?.error ?? 'Image upload failed');
	return body as AdminImageUploadResponse;
}

export function postJson(body: Record<string, unknown>) {
	return { method: 'POST', body: JSON.stringify(body) } satisfies RequestInit;
}

export function roundMoney(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function emptyOrderEditor(): OrderEditorState {
	return {
		id: null,
		status: 'confirmed',
		paymentStatus: 'paid',
		reason: ''
	};
}

export function mapOrderToEditor(order: AdminOrderRecord): OrderEditorState {
	return {
		id: order.id,
		status: order.status,
		paymentStatus: order.paymentStatus,
		reason: ''
	};
}

export function emptyRefundEditor(): RefundEditorState {
	return {
		amount: '',
		reason: '',
		speed: 'normal',
		cancellationRequestId: null,
		returnRequestId: null
	};
}

export function mapOrderToRefundEditor(order: AdminOrderRecord): RefundEditorState {
	return {
		amount:
			order.refundSummary.refundableAmount > 0 ? String(order.refundSummary.refundableAmount) : '',
		reason: '',
		speed: 'normal',
		cancellationRequestId:
			order.cancellationRequest &&
			['approved', 'refund_pending'].includes(order.cancellationRequest.status) &&
			!order.cancellationRequest.refund_id
				? order.cancellationRequest.id
				: null,
		returnRequestId:
			order.returnRequest &&
			['received', 'refund_pending'].includes(order.returnRequest.status) &&
			!order.returnRequest.refund_id
				? order.returnRequest.id
				: null
	};
}

export function isTerminalOrder(order: Pick<AdminOrderRecord, 'status' | 'paymentStatus'>) {
	return (
		terminalOrderStatuses.has(order.status.toLowerCase()) ||
		terminalPaymentStatuses.has(order.paymentStatus.toLowerCase())
	);
}

export function statusTone(value: string): 'heat' | 'warning' | 'neutral' | 'danger' | 'success' {
	const normalized = value.toLowerCase();

	if (
		['cancelled', 'failed', 'rejected', 'cod_cancelled'].some((state) => normalized.includes(state))
	) {
		return 'danger';
	}

	if (normalized.includes('partially_refunded')) return 'warning';
	if (normalized.includes('hold') || normalized.includes('rto')) return 'warning';

	if (
		['paid', 'delivered', 'completed', 'approved', 'sent', 'processed', 'refunded'].some((state) =>
			normalized.includes(state)
		)
	) {
		return 'success';
	}

	if (
		['pending', 'requested', 'return', 'refund', 'pickup'].some((state) =>
			normalized.includes(state)
		)
	) {
		return 'warning';
	}

	return 'neutral';
}

export function toneClasses(tone: ReturnType<typeof statusTone>) {
	if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700';
	if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
	if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
	if (tone === 'heat') return 'border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]';
	return 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-56)]';
}

export function adminShipmentStarted(order: AdminOrderRecord) {
	const shipmentStatus = String(order.shipment?.status ?? '').toLowerCase();
	return [
		'awb_assigned',
		'pickup_scheduled',
		'label_generated',
		'manifest_generated',
		'shipped',
		'in_transit',
		'out_for_delivery',
		'delivered',
		'returned',
		'rto_initiated',
		'rto_delivered'
	].includes(shipmentStatus);
}

export function canTransitionManualOrderStatusClient(order: AdminOrderRecord, nextStatus: string) {
	const currentStatus = order.status.toLowerCase();
	if (currentStatus === nextStatus) return true;

	const progressiveStates = ['pending', 'processing', 'confirmed', 'out_for_delivery', 'delivered'];
	const currentProgressStatus = ['ready_for_delivery', 'packed', 'shipped'].includes(currentStatus)
		? 'confirmed'
		: currentStatus;

	const currentIndex = progressiveStates.indexOf(currentProgressStatus);
	const nextIndex = progressiveStates.indexOf(nextStatus);

	if (nextStatus === 'on_hold') {
		return !['cancelled', 'returned', 'delivered', 'rto'].includes(currentStatus);
	}
	if (currentStatus === 'on_hold') return ['confirmed', 'cancelled'].includes(nextStatus);
	if (nextStatus === 'cancelled')
		return !['out_for_delivery', 'delivered'].includes(currentStatus);
	if (nextStatus === 'returned') return currentStatus === 'delivered';
	if (nextStatus === 'rto')
		return ['ready_for_delivery', 'packed', 'shipped', 'out_for_delivery'].includes(currentStatus);
	if (currentIndex === -1 || nextIndex === -1) return false;
	return nextIndex > currentIndex;
}

export function canAdminCancelOrder(order: AdminOrderRecord) {
	const status = order.status.toLowerCase();
	return !isTerminalOrder(order) && !['out_for_delivery', 'delivered'].includes(status);
}

export function canAdminReturnOrder(order: AdminOrderRecord) {
	return !isTerminalOrder(order) && order.status.toLowerCase() === 'delivered';
}

export function nextProgressiveOrderStatus(order: AdminOrderRecord) {
	const progressiveStates = ['pending', 'processing', 'confirmed', 'out_for_delivery', 'delivered'];
	const currentStatus = order.status.toLowerCase();
	if (currentStatus === 'on_hold') return null;
	if (['ready_for_delivery', 'packed', 'shipped'].includes(currentStatus)) return 'out_for_delivery';

	const currentIndex = progressiveStates.indexOf(currentStatus);
	if (currentIndex === -1 || currentIndex >= progressiveStates.length - 1) return null;
	return progressiveStates[currentIndex + 1];
}

export function paymentStatusOptionsForOrder(order: AdminOrderRecord) {
	const currentPaymentStatus = order.paymentStatus.toLowerCase();
	const paymentMethod = order.paymentMethod.toLowerCase();

	return paymentStatusOptions.map((option) => {
		const value = option.value;
		let disabled = false;

		if (['partially_refunded', 'refunded'].includes(value) && value !== currentPaymentStatus) {
			disabled = true;
		}

		if (
			value === 'failed' &&
			['paid', 'partially_refunded', 'refunded'].includes(currentPaymentStatus)
		) {
			disabled = true;
		}

		if (
			value === 'cod_cancelled' &&
			currentPaymentStatus !== 'cod_pending' &&
			currentPaymentStatus !== 'cod_cancelled' &&
			!paymentMethod.includes('cod')
		) {
			disabled = true;
		}

		return { ...option, disabled };
	});
}

export function statusOptionLabel(value: string) {
	return manualOrderStatusOptions.find((option) => option.value === value)?.label ?? value;
}

export function adminReasonRequired(nextStatus: string) {
	return ['cancelled', 'returned', 'on_hold', 'rto'].includes(nextStatus);
}

export function orderCanCreateShipment(order: FulfillmentOrder) {
	return !order.shipment && !blockedFulfillmentStatuses.has(order.status.toLowerCase());
}
