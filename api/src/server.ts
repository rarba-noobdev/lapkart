import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { z } from 'zod';
import { config } from './config.js';
import { autocompleteOlaPlaces, getOlaDeliveryRoute, reverseGeocodeOlaPlace } from './ola-maps.js';
import { createRazorpayOrder, verifyRazorpaySignature } from './payments.js';
import { scoreFraud } from './risk.js';
import {
	assignShiprocketAwb,
	createShiprocketOrder,
	generateShiprocketLabels,
	generateShiprocketManifest,
	getShiprocketPickupLocations,
	getShiprocketDeliveryQuotes,
	getShiprocketTracking,
	getShiprocketToken,
	getShiprocketWalletBalance,
	requestShiprocketPickup,
	type ShiprocketPickupAddress,
	toShiprocketOrderPayload
} from './shiprocket.js';
import { supabaseAdmin } from './supabase.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const apiLimiter = rateLimit({ windowMs: 60_000, limit: 180 });
const paymentLimiter = rateLimit({ windowMs: 60_000, limit: 24 });
const mapLimiter = rateLimit({ windowMs: 60_000, limit: 48 });
const uploadLimiter = rateLimit({ windowMs: 60_000, limit: 12 });
const webhookLimiter = rateLimit({ windowMs: 60_000, limit: 120 });

app.use(helmet());
app.use(cors({ origin: config.webOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(apiLimiter);

app.get('/health', (_req, res) => {
	res.json({ ok: true, service: 'lapkart-api' });
});

app.post('/fraud/score', async (req, res) => {
	const input = z
		.object({
			failedPayments: z.number().optional(),
			orderValue: z.number().optional(),
			accountAgeDays: z.number().optional()
		})
		.parse(req.body);
	res.json(scoreFraud(input));
});

const createShiprocketShipmentSchema = z.object({
	orderId: z.string().uuid(),
	pickupLocation: z.string().trim().min(1).optional(),
	package: z
		.object({
			weightKg: z.number().positive().optional(),
			lengthCm: z.number().positive().optional(),
			breadthCm: z.number().positive().optional(),
			heightCm: z.number().positive().optional()
		})
		.optional()
});

const assignAwbSchema = z.object({
	shipmentId: z.string().uuid(),
	courierId: z.number().int().positive().optional()
});

const shipmentIdSchema = z.object({
	shipmentId: z.string().uuid()
});

const labelsSchema = z.object({
	shipmentIds: z.array(z.string().uuid()).min(1).max(50)
});

const productIdParamSchema = z.object({
	productId: z.string().uuid()
});

const userIdParamSchema = z.object({
	userId: z.string().uuid()
});

const orderIdParamSchema = z.object({
	orderId: z.string().uuid()
});

const nullableTrimmedString = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((value) => {
			if (value === undefined) return undefined;
			return value.length > 0 ? value : null;
		});

const productCategorySlugs = [
	'ram',
	'ssd',
	'motherboards',
	'batteries',
	'displays',
	'keyboards',
	'processors',
	'cooling',
	'chargers',
	'wifi_cards',
	'dc_jacks',
	'bottom_cases',
	'palmrests',
	'hinges',
	'speakers',
	'hdd_boards'
] as const;

const productUpsertSchema = z.object({
	title: z.string().trim().min(4).max(200),
	brand: z.string().trim().min(2).max(80),
	category: z.enum(productCategorySlugs),
	description: nullableTrimmedString(2000),
	image: z.string().trim().min(1).max(1200),
	images: z.array(z.string().trim().min(1).max(1200)).max(12).optional().default([]),
	price: z.coerce.number().nonnegative().max(10_000_000),
	mrp: z.coerce.number().nonnegative().max(10_000_000),
	stock: z.coerce.number().int().min(0).max(1_000_000),
	status: z.enum(['active', 'draft', 'archived']).optional().default('active'),
	sku: nullableTrimmedString(120),
	sourceUrl: nullableTrimmedString(1200),
	compatibility: nullableTrimmedString(500),
	warranty: nullableTrimmedString(120),
	highlights: z.array(z.string().trim().min(1).max(160)).max(12).optional().default([]),
	searchKeywords: z.array(z.string().trim().min(1).max(80)).max(24).optional().default([]),
	weightKg: z.coerce.number().positive().max(500).nullable().optional(),
	lengthCm: z.coerce.number().positive().max(500).nullable().optional(),
	breadthCm: z.coerce.number().positive().max(500).nullable().optional(),
	heightCm: z.coerce.number().positive().max(500).nullable().optional()
});

const productUpdateSchema = productUpsertSchema
	.partial()
	.refine((value) => Object.keys(value).length > 0, 'At least one product field must be provided');

const adminUserUpdateSchema = z
	.object({
		role: z.enum(['admin', 'user']).optional(),
		fullName: nullableTrimmedString(160),
		phone: nullableTrimmedString(30)
	})
	.refine((value) => Object.keys(value).length > 0, 'At least one user field must be provided');

const adminOrderUpdateSchema = z
	.object({
		status: z.string().trim().min(2).max(60).optional(),
		paymentStatus: z.string().trim().min(2).max(60).optional(),
		shippingServiceType: z.enum(['standard', 'quick']).optional(),
		shippingName: nullableTrimmedString(120),
		shippingPhone: nullableTrimmedString(30),
		shippingEmail: nullableTrimmedString(160),
		shippingLine1: nullableTrimmedString(200),
		shippingLine2: nullableTrimmedString(200),
		shippingCity: nullableTrimmedString(80),
		shippingState: nullableTrimmedString(80),
		shippingPincode: z
			.string()
			.trim()
			.regex(/^[0-9]{6}$/)
			.optional()
			.transform((value) => value ?? undefined),
		reason: z.string().trim().min(12).max(500).optional()
	})
	.refine((value) => Object.keys(value).length > 0, 'At least one order field must be provided');

function canTransitionManualPaymentStatus(currentStatus: string, nextStatus: string) {
	if (currentStatus === nextStatus) return true;
	if (['partially_refunded', 'refunded'].includes(nextStatus)) return false;
	if (['partially_refunded', 'refunded'].includes(currentStatus)) return false;
	if (currentStatus === 'paid') return false;
	if (currentStatus === 'pending') return ['paid', 'failed', 'cod_pending'].includes(nextStatus);
	if (currentStatus === 'cod_pending') {
		return ['paid', 'cod_cancelled', 'failed'].includes(nextStatus);
	}
	if (currentStatus === 'failed') return nextStatus === 'pending';
	if (currentStatus === 'cod_cancelled') return false;
	return false;
}

function isAdminShipmentStarted(shipment?: { status?: string | null } | null) {
	const status = String(shipment?.status ?? '').toLowerCase();
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
	].includes(status);
}

function canTransitionManualOrderStatus(
	currentStatus: string,
	nextStatus: string,
	shipmentStarted: boolean
) {
	if (currentStatus === nextStatus) return true;
	const progressiveStates = [
		'pending',
		'processing',
		'confirmed',
		'packed',
		'shipped',
		'out_for_delivery',
		'delivered'
	];
	const currentIndex = progressiveStates.indexOf(currentStatus);
	const nextIndex = progressiveStates.indexOf(nextStatus);
	if (nextStatus === 'cancelled') return !shipmentStarted;
	if (nextStatus === 'returned') return currentStatus === 'delivered';
	if (currentIndex === -1 || nextIndex === -1) return false;
	return nextIndex > currentIndex;
}

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);
const autocompleteQuerySchema = z.object({
	input: z
		.string()
		.trim()
		.min(3)
		.max(500)
		.transform((value) => value.slice(0, 160)),
	latitude: latitudeSchema.optional(),
	longitude: longitudeSchema.optional()
});
const reverseGeocodeQuerySchema = z.object({
	latitude: latitudeSchema,
	longitude: longitudeSchema
});
const deliveryEstimateQuerySchema = reverseGeocodeQuerySchema.extend({
	pincode: z
		.string()
		.trim()
		.regex(/^[0-9]{6}$/),
	weightKg: z.coerce.number().positive().max(100).optional(),
	declaredValue: z.coerce.number().nonnegative().max(10_000_000).optional()
});

const checkoutItemSchema = z.object({
	id: z.string().uuid(),
	qty: z.number().int().min(1).max(20)
});

const checkoutAddressSchema = z.object({
	fullName: z.string().trim().min(2).max(120),
	phone: z
		.string()
		.trim()
		.min(10)
		.max(30)
		.refine(
			(value) => value.replace(/\D/g, '').length >= 10,
			'A 10 digit phone number is required'
		),
	email: z.string().trim().max(160).optional().default(''),
	line1: z.string().trim().min(6).max(200),
	line2: z.string().trim().max(200).optional().default(''),
	city: z.string().trim().min(2).max(80),
	state: z.string().trim().min(2).max(80),
	pincode: z
		.string()
		.trim()
		.regex(/^[0-9]{6}$/),
	latitude: latitudeSchema,
	longitude: longitudeSchema,
	locationSource: z.string().trim().max(60).nullable().optional(),
	olaPlaceId: z.string().trim().max(200).nullable().optional(),
	formattedAddress: z.string().trim().max(500).optional().default('')
});

const checkoutCreatePaymentOrderSchema = z.object({
	items: z.array(checkoutItemSchema).min(1).max(50),
	address: checkoutAddressSchema,
	selectedQuoteId: z.string().trim().min(1).max(120).nullable().optional(),
	saveAddress: z.boolean().optional().default(true)
});

const checkoutCompletePaymentSchema = z.object({
	razorpay_order_id: z.string().trim().min(1),
	razorpay_payment_id: z.string().trim().min(1),
	razorpay_signature: z.string().trim().min(1)
});

type AuthenticatedUser = {
	id: string;
	email: string | null;
};

type AuthenticatedRequest = express.Request & {
	authUser?: AuthenticatedUser;
};

type CheckoutItem = z.infer<typeof checkoutItemSchema>;
type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
type CourierQuote = Awaited<ReturnType<typeof getShiprocketDeliveryQuotes>>[number];

type CheckoutProductRow = {
	id: string;
	title: string;
	brand: string;
	image: string;
	images: string[] | null;
	price: number | string;
	stock: number | null;
	status: string | null;
	weight_kg: number | string | null;
};

type CheckoutOrderItem = {
	productId: string;
	title: string;
	image: string;
	brand: string;
	price: number;
	qty: number;
};

type CheckoutSummary = {
	items: CheckoutOrderItem[];
	subtotal: number;
	shipping: number;
	total: number;
	amountPaise: number;
	deliveryEstimate: {
		dispatch: {
			pickupLocation: string;
			pincode: string;
		};
		route: Awaited<ReturnType<typeof getOlaDeliveryRoute>>;
		couriers: CourierQuote[];
		generatedAt: string;
	};
	selectedCourier: CourierQuote;
};

type PendingCheckout = CheckoutSummary & {
	userId: string;
	userEmail: string | null;
	address: CheckoutAddress;
	saveAddress: boolean;
	createdAt: number;
};

type OrderItemWithSku = {
	id: string;
	order_id: string;
	title: string;
	image: string;
	brand: string;
	qty: number;
	price?: number | null;
	product_id?: string | null;
	sku: string | null;
};

type LoadedCheckoutSession = {
	checkout: PendingCheckout;
	orderId: string | null;
	status: string;
};

const checkoutSessions = new Map<string, PendingCheckout>();
const checkoutSessionTtlMs = 20 * 60_000;
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function isRazorpayAuthError(error: unknown) {
	if (!error || typeof error !== 'object') return false;
	const statusCode =
		'statusCode' in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
	const httpStatusCode =
		'httpStatusCode' in error
			? Number((error as { httpStatusCode?: unknown }).httpStatusCode)
			: undefined;
	return statusCode === 401 || httpStatusCode === 401;
}

function normalizeShipmentStatus(status: string) {
	const value = status.toLowerCase();
	if (value.includes('delivered') && value.includes('rto')) return 'rto_delivered';
	if (value.includes('rto')) return 'rto_initiated';
	if (value.includes('out') && value.includes('delivery')) return 'out_for_delivery';
	if (value.includes('delivered')) return 'delivered';
	if (value.includes('cancel')) return 'cancelled';
	if (value.includes('return')) return 'returned';
	if (value.includes('lost')) return 'lost';
	if (value.includes('damage')) return 'damaged';
	if (value.includes('pickup')) return 'pickup_scheduled';
	if (value.includes('shipped')) return 'shipped';
	if (value.includes('transit') || value.includes('manifest') || value.includes('assigned'))
		return 'in_transit';
	return 'in_transit';
}

function sha256Hex(value: string) {
	return crypto.createHash('sha256').update(value).digest('hex');
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function toDateOnly(value: unknown) {
	if (!value) return null;
	const date = new Date(String(value));
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function firstString(...values: unknown[]) {
	const value = values.find((item) => typeof item === 'string' && item.trim());
	return typeof value === 'string' ? value : null;
}

function getAwbData(response: Record<string, unknown>) {
	const nestedResponse = asRecord(response.response);
	return Object.keys(asRecord(nestedResponse.data)).length
		? asRecord(nestedResponse.data)
		: nestedResponse;
}

function getPickupData(response: Record<string, unknown>) {
	const nestedResponse = asRecord(response.response);
	return Object.keys(nestedResponse).length ? nestedResponse : response;
}

function trackingActivities(payload: unknown) {
	const trackingData = asRecord(asRecord(payload).tracking_data);
	const activities = Array.isArray(trackingData.shipment_track_activities)
		? trackingData.shipment_track_activities
		: [];
	return activities.slice(0, 8).map((activity) => {
		const row = asRecord(activity);
		return {
			date: firstString(row.date),
			status: firstString(row.status),
			activity: firstString(row.activity),
			location: firstString(row.location)
		};
	});
}

function normalizeTrackingActivity(activity: Record<string, unknown>) {
	return {
		date: firstString(activity.date, activity.status_time, activity.received_at),
		status: firstString(activity.status),
		activity: firstString(activity.activity, activity.message, activity.status),
		location: firstString(activity.location)
	};
}

function groupShipmentEvents(
	events: Array<{
		shipment_id: string | null;
		status: string | null;
		status_time: string | null;
		location: string | null;
		message: string | null;
		received_at: string | null;
	}>
) {
	const grouped = new Map<string, ReturnType<typeof normalizeTrackingActivity>[]>();
	for (const event of events) {
		if (!event.shipment_id) continue;
		const items = grouped.get(event.shipment_id) ?? [];
		items.push(
			normalizeTrackingActivity({
				date: event.status_time,
				status: event.status,
				activity: event.message,
				location: event.location,
				received_at: event.received_at
			})
		);
		grouped.set(event.shipment_id, items);
	}
	return grouped;
}

async function refreshShiprocketTracking(shipment: Record<string, unknown>) {
	if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
	const shiprocketShipmentId = Number(shipment.shiprocket_shipment_id);
	if (!Number.isFinite(shiprocketShipmentId)) {
		throw new Error('Shipment does not have a Shiprocket shipment id');
	}

	const response = await getShiprocketTracking(shiprocketShipmentId);
	const trackingData = asRecord(response.tracking_data);
	const shipmentTrack = Array.isArray(trackingData.shipment_track)
		? asRecord(trackingData.shipment_track[0])
		: {};
	const currentStatus = firstString(shipmentTrack.current_status, trackingData.current_status);
	const awbCode = firstString(shipmentTrack.awb_code, shipment.awb_code);
	const trackingUrl = firstString(trackingData.track_url, shipment.tracking_url);
	const updates: Record<string, unknown> = {
		raw_payload: response,
		last_status_at: new Date().toISOString()
	};
	if (currentStatus) updates.status = normalizeShipmentStatus(currentStatus);
	if (awbCode) updates.awb_code = awbCode;
	if (trackingUrl) updates.tracking_url = trackingUrl;
	const expectedDeliveryDate = toDateOnly(shipmentTrack.edd ?? trackingData.etd);
	if (expectedDeliveryDate) updates.expected_delivery_date = expectedDeliveryDate;

	const { data: updatedShipment, error } = await supabaseAdmin
		.from('shipments')
		.update(updates)
		.eq('id', String(shipment.id))
		.select('*')
		.single();
	if (error) throw error;

	return { shipment: updatedShipment, tracking: response };
}

async function syncShiprocketPickupLocations(addresses: ShiprocketPickupAddress[]) {
	if (!supabaseAdmin || !addresses.length) return;

	const primaryIndex = Math.max(
		0,
		addresses.findIndex((address) => Number(address.is_primary_location) === 1)
	);
	const rows = addresses
		.filter((address) => String(address.pickup_location ?? '').trim())
		.map((address, index) => ({
			provider: 'shiprocket',
			pickup_location: String(address.pickup_location),
			provider_location_id: address.id ? String(address.id) : null,
			contact_name: firstString(address.name, address.contact_name),
			email: firstString(address.email),
			phone: firstString(address.phone),
			address_line1: firstString(address.address, address.address_line1),
			address_line2: firstString(address.address_2, address.address_line2),
			city: firstString(address.city),
			state: firstString(address.state),
			country: firstString(address.country) ?? 'India',
			pincode: firstString(address.pin_code, address.pincode) ?? '',
			latitude: Number.isFinite(Number(address.lat)) ? Number(address.lat) : null,
			longitude: Number.isFinite(Number(address.long)) ? Number(address.long) : null,
			is_default: index === primaryIndex,
			is_active: Number(address.status ?? 1) !== 0,
			raw_payload: address
		}));

	if (!rows.length) return;
	const { error: resetError } = await supabaseAdmin
		.from('shipping_pickup_locations')
		.update({ is_default: false })
		.eq('provider', 'shiprocket');
	if (resetError) throw resetError;

	const { error } = await supabaseAdmin
		.from('shipping_pickup_locations')
		.upsert(rows, { onConflict: 'provider,pickup_location' });
	if (error) throw error;
}

async function getOrderItemsWithSku(orderIds: string[]) {
	const adminDb = getSupabaseAdmin();
	if (orderIds.length === 0) return [] as OrderItemWithSku[];

	const { data: items, error: itemsError } = await adminDb
		.from('order_items')
		.select('id,order_id,title,image,brand,qty,price,product_id')
		.in('order_id', orderIds);
	if (itemsError) throw itemsError;

	const productIds = [
		...new Set(
			(items ?? [])
				.map((item) => item.product_id)
				.filter((value): value is string => Boolean(value))
		)
	];
	const { data: products, error: productsError } = productIds.length
		? await adminDb.from('products').select('id,sku').in('id', productIds)
		: { data: [], error: null };
	if (productsError) throw productsError;

	const skuByProductId = new Map(
		(products ?? []).map((product) => [product.id, product.sku ?? null])
	);
	return ((items ?? []) as Array<Record<string, unknown>>).map((item) => ({
		id: String(item.id ?? crypto.randomUUID()),
		order_id: String(item.order_id ?? ''),
		title: String(item.title ?? 'Item'),
		image: String(item.image ?? ''),
		brand: String(item.brand ?? ''),
		qty: Number(item.qty ?? 0),
		price: item.price === undefined || item.price === null ? null : Number(item.price),
		product_id: firstString(item.product_id),
		sku: firstString(skuByProductId.get(String(item.product_id ?? '')))
	}));
}

function toFulfillmentShipment(
	shipment: Record<string, unknown> | undefined,
	shipmentEvents?: ReturnType<typeof normalizeTrackingActivity>[]
) {
	if (!shipment) return null;
	return {
		id: shipment.id,
		shippingServiceType: shipment.shipping_service_type,
		status: shipment.status,
		shiprocketShipmentId: shipment.shiprocket_shipment_id,
		awbCode: shipment.awb_code,
		courierName: shipment.courier_name,
		pickupScheduledDate: shipment.pickup_scheduled_date,
		expectedDeliveryDate: shipment.expected_delivery_date,
		trackingUrl: shipment.tracking_url,
		manifestUrl: shipment.manifest_url,
		labelUrl: shipment.label_url,
		trackingActivities:
			shipmentEvents && shipmentEvents.length > 0
				? shipmentEvents.slice(0, 8)
				: trackingActivities(shipment.raw_payload)
	};
}

class HttpError extends Error {
	constructor(
		public statusCode: number,
		message: string
	) {
		super(message);
	}
}

function getAuthenticatedUser(req: express.Request) {
	const user = (req as AuthenticatedRequest).authUser;
	if (!user) throw new HttpError(401, 'Authorization bearer token is required');
	return user;
}

function getSupabaseAdmin() {
	if (!supabaseAdmin) throw new HttpError(503, 'Supabase service credentials are not configured');
	return supabaseAdmin;
}

function requireLivePaymentEnvironment() {
	if (config.razorpayKeyId.startsWith('rzp_test_') && !config.allowShiprocketWithTestPayments) {
		throw new HttpError(
			409,
			'Shiprocket fulfillment is blocked while Razorpay is configured in test mode. Switch to live keys or explicitly allow test fulfillment in backend env.'
		);
	}
}

async function requireUser(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) {
	try {
		if (!supabaseAdmin) {
			res.status(503).json({ error: 'Supabase service credentials are not configured' });
			return;
		}

		const authHeader = req.header('authorization') ?? '';
		const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
		if (!token) {
			res.status(401).json({ error: 'Authorization bearer token is required' });
			return;
		}

		const { data, error } = await supabaseAdmin.auth.getUser(token);
		if (error || !data.user) {
			res.status(401).json({ error: 'Invalid authorization token' });
			return;
		}

		(req as AuthenticatedRequest).authUser = {
			id: data.user.id,
			email: data.user.email ?? null
		};
		next();
	} catch (error) {
		next(error);
	}
}

async function requireAdmin(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction
) {
	try {
		if (!supabaseAdmin) {
			res.status(503).json({ error: 'Supabase service credentials are not configured' });
			return;
		}

		const authHeader = req.header('authorization') ?? '';
		const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
		if (!token) {
			res.status(401).json({ error: 'Authorization bearer token is required' });
			return;
		}

		const { data, error } = await supabaseAdmin.auth.getUser(token);
		if (error || !data.user) {
			res.status(401).json({ error: 'Invalid authorization token' });
			return;
		}

		const { data: roleRow, error: roleError } = await supabaseAdmin
			.from('user_roles')
			.select('role')
			.eq('user_id', data.user.id)
			.maybeSingle();

		if (roleError) throw roleError;
		if (roleRow?.role !== 'admin' && roleRow?.role !== 'owner') {
			res.status(403).json({ error: 'Admin role is required' });
			return;
		}

		(req as AuthenticatedRequest).authUser = {
			id: data.user.id,
			email: data.user.email ?? null
		};
		next();
	} catch (error) {
		next(error);
	}
}

function pruneCheckoutSessions() {
	const now = Date.now();
	for (const [orderId, checkout] of checkoutSessions.entries()) {
		if (now - checkout.createdAt > checkoutSessionTtlMs) checkoutSessions.delete(orderId);
	}
}

async function storeCheckoutSession(razorpayOrderId: string, checkout: PendingCheckout) {
	checkoutSessions.set(razorpayOrderId, checkout);
	if (!supabaseAdmin) return;

	const { error } = await supabaseAdmin.from('checkout_sessions').insert({
		user_id: checkout.userId,
		razorpay_order_id: razorpayOrderId,
		amount_paise: checkout.amountPaise,
		currency: 'INR',
		subtotal: checkout.subtotal,
		shipping: checkout.shipping,
		total: checkout.total,
		items: checkout.items,
		address: checkout.address,
		delivery_estimate: checkout.deliveryEstimate,
		selected_courier: checkout.selectedCourier,
		save_address: checkout.saveAddress,
		status: 'pending',
		expires_at: new Date(checkout.createdAt + checkoutSessionTtlMs).toISOString()
	});
	if (error) {
		console.warn('Could not persist checkout session; using memory fallback', error.message);
	}
}

async function loadCheckoutSession(razorpayOrderId: string): Promise<LoadedCheckoutSession | null> {
	pruneCheckoutSessions();
	const memorySession = checkoutSessions.get(razorpayOrderId);
	if (memorySession) {
		return { checkout: memorySession, orderId: null, status: 'pending' };
	}
	if (!supabaseAdmin) return null;

	const { data, error } = await supabaseAdmin
		.from('checkout_sessions')
		.select('*')
		.eq('razorpay_order_id', razorpayOrderId)
		.maybeSingle();
	if (error) {
		console.warn('Could not load checkout session', error.message);
		return null;
	}
	if (!data) return null;

	const status = String(data.status ?? 'pending');
	const orderId = typeof data.order_id === 'string' ? data.order_id : null;
	const expiresAt = new Date(String(data.expires_at ?? '')).getTime();
	if (status !== 'paid' && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
		await supabaseAdmin
			.from('checkout_sessions')
			.update({ status: 'expired', updated_at: new Date().toISOString() })
			.eq('razorpay_order_id', razorpayOrderId);
		return null;
	}

	return {
		checkout: {
			userId: String(data.user_id),
			userEmail: null,
			items: data.items as CheckoutOrderItem[],
			subtotal: Number(data.subtotal),
			shipping: Number(data.shipping),
			total: Number(data.total),
			amountPaise: Number(data.amount_paise),
			deliveryEstimate: data.delivery_estimate as PendingCheckout['deliveryEstimate'],
			selectedCourier: data.selected_courier as CourierQuote,
			address: data.address as CheckoutAddress,
			saveAddress: Boolean(data.save_address),
			createdAt: new Date(String(data.created_at)).getTime()
		},
		orderId,
		status
	};
}

async function markCheckoutSessionProcessing(razorpayOrderId: string) {
	if (!supabaseAdmin) return true;
	const { data, error } = await supabaseAdmin
		.from('checkout_sessions')
		.update({ status: 'processing', updated_at: new Date().toISOString() })
		.eq('razorpay_order_id', razorpayOrderId)
		.eq('status', 'pending')
		.select('id')
		.maybeSingle();
	if (error) {
		console.warn('Could not mark checkout session processing', error.message);
		return true;
	}
	return Boolean(data);
}

async function markCheckoutSessionPaid(razorpayOrderId: string, orderId: string) {
	checkoutSessions.delete(razorpayOrderId);
	if (!supabaseAdmin) return;
	const { error } = await supabaseAdmin
		.from('checkout_sessions')
		.update({ status: 'paid', order_id: orderId, updated_at: new Date().toISOString() })
		.eq('razorpay_order_id', razorpayOrderId);
	if (error) console.warn('Could not mark checkout session paid', error.message);
}

function assertUploadIsSafeImage(file: Express.Multer.File) {
	if (!allowedImageMimeTypes.has(file.mimetype)) {
		throw new HttpError(400, 'Only JPEG, PNG, WebP, or AVIF images are allowed');
	}
}

function roundMoney(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeCheckoutItems(items: CheckoutItem[]) {
	const quantities = new Map<string, number>();
	for (const item of items) {
		const qty = (quantities.get(item.id) ?? 0) + item.qty;
		if (qty > 20) throw new HttpError(400, 'A single product cannot exceed 20 units per checkout');
		quantities.set(item.id, qty);
	}
	return [...quantities.entries()].map(([id, qty]) => ({ id, qty }));
}

function phoneDigits(phone: string) {
	const value = phone.replace(/\D/g, '').slice(-10);
	if (value.length !== 10) throw new HttpError(400, 'A valid 10 digit phone number is required');
	return value;
}

function getProductImage(product: CheckoutProductRow) {
	return product.images?.[0] ?? product.image;
}

function buildShippingAddress(address: CheckoutAddress) {
	return [
		address.line1,
		address.line2,
		`${address.city}, ${address.state} ${address.pincode}`,
		'India'
	]
		.filter(Boolean)
		.join('\n');
}

async function buildCheckoutSummary(input: z.infer<typeof checkoutCreatePaymentOrderSchema>) {
	if (!supabaseAdmin) throw new HttpError(503, 'Supabase service credentials are not configured');

	const items = normalizeCheckoutItems(input.items);
	const productIds = items.map((item) => item.id);
	const { data: products, error } = await supabaseAdmin
		.from('products')
		.select('id,title,brand,image,images,price,stock,status,weight_kg')
		.in('id', productIds);
	if (error) throw error;

	const productRows = (products as CheckoutProductRow[] | null) ?? [];
	const productsById = new Map(productRows.map((product) => [product.id, product]));
	if (productsById.size !== productIds.length) {
		throw new HttpError(400, 'One or more cart items are no longer available');
	}

	const orderItems: CheckoutOrderItem[] = items.map((item) => {
		const product = productsById.get(item.id);
		if (!product) throw new HttpError(400, 'One or more cart items are no longer available');
		if (product.status && product.status !== 'active') {
			throw new HttpError(400, `${product.title} is not available for checkout`);
		}
		if (typeof product.stock === 'number' && product.stock < item.qty) {
			throw new HttpError(400, `${product.title} only has ${product.stock} unit(s) in stock`);
		}
		const price = roundMoney(Number(product.price));
		if (!Number.isFinite(price) || price < 0) {
			throw new HttpError(400, `${product.title} has an invalid price`);
		}
		return {
			productId: product.id,
			title: product.title,
			image: getProductImage(product),
			brand: product.brand,
			price,
			qty: item.qty
		};
	});

	const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.price * item.qty, 0));
	const weightKg = Math.max(
		config.shiprocketDefaultWeightKg,
		roundMoney(
			items.reduce((sum, item) => {
				const product = productsById.get(item.id);
				const weight = Number(product?.weight_kg ?? config.shiprocketDefaultWeightKg);
				return (
					sum +
					(Number.isFinite(weight) && weight > 0 ? weight : config.shiprocketDefaultWeightKg) *
						item.qty
				);
			}, 0)
		)
	);

	const [route, couriers] = await Promise.all([
		getOlaDeliveryRoute({
			latitude: input.address.latitude,
			longitude: input.address.longitude
		}),
		getShiprocketDeliveryQuotes({
			deliveryPincode: input.address.pincode,
			deliveryLatitude: input.address.latitude,
			deliveryLongitude: input.address.longitude,
			weightKg,
			declaredValue: subtotal
		})
	]);

	if (!couriers.length) {
		throw new HttpError(400, 'No courier currently services this delivery location');
	}
	const fallbackCourier = couriers[0];
	if (!fallbackCourier) {
		throw new HttpError(400, 'No courier currently services this delivery location');
	}
	const selectedCourier =
		couriers.find((courier) => courier.quoteId === input.selectedQuoteId) ??
		couriers.find((courier) => courier.recommended) ??
		fallbackCourier;
	const selectedRate = Number(selectedCourier.rate);
	if (!Number.isFinite(selectedRate) || selectedRate < 0) {
		throw new HttpError(400, 'Selected courier returned an invalid shipping rate');
	}

	const shipping = subtotal > 999 ? 0 : roundMoney(selectedRate);
	const total = roundMoney(subtotal + shipping);
	const amountPaise = Math.round(total * 100);

	return {
		items: orderItems,
		subtotal,
		shipping,
		total,
		amountPaise,
		deliveryEstimate: {
			dispatch: {
				pickupLocation: config.shiprocketPickupLocation,
				pincode: config.lapkartDispatchPincode
			},
			route,
			couriers,
			generatedAt: new Date().toISOString()
		},
		selectedCourier
	} satisfies CheckoutSummary;
}

app.post('/api/create-order', paymentLimiter, (_req, res) => {
	res
		.status(410)
		.json({ error: 'Use /checkout/create-payment-order so the server can verify cart pricing' });
});

app.post('/payments/razorpay/order', paymentLimiter, (_req, res) => {
	res
		.status(410)
		.json({ error: 'Use /checkout/create-payment-order so the server can verify cart pricing' });
});

app.post('/api/verify-payment', paymentLimiter, (_req, res) => {
	res
		.status(410)
		.json({ error: 'Use /checkout/complete-payment so the server can create the paid order' });
});

app.post('/payments/razorpay/verify', paymentLimiter, (_req, res) => {
	res
		.status(410)
		.json({ error: 'Use /checkout/complete-payment so the server can create the paid order' });
});

app.post('/checkout/create-payment-order', paymentLimiter, requireUser, async (req, res, next) => {
	try {
		const user = getAuthenticatedUser(req);
		const input = checkoutCreatePaymentOrderSchema.parse(req.body);
		pruneCheckoutSessions();

		const summary = await buildCheckoutSummary(input);
		const razorpayOrder = await createRazorpayOrder(
			summary.amountPaise,
			`lk_${Date.now()}_${user.id.slice(0, 8)}`,
			'INR'
		);

		await storeCheckoutSession(razorpayOrder.order_id, {
			...summary,
			userId: user.id,
			userEmail: user.email,
			address: input.address,
			saveAddress: input.saveAddress,
			createdAt: Date.now()
		});

		res.json({ razorpayOrder, summary });
	} catch (error) {
		if (isRazorpayAuthError(error)) {
			res.status(401).json({ error: 'Razorpay authentication failed' });
			return;
		}
		if (error instanceof Error && error.message === 'Razorpay credentials are not configured') {
			res.status(503).json({ error: error.message });
			return;
		}
		next(error);
	}
});

app.post('/checkout/complete-payment', paymentLimiter, requireUser, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new HttpError(503, 'Supabase service credentials are not configured');
		const user = getAuthenticatedUser(req);
		const input = checkoutCompletePaymentSchema.parse(req.body);
		const loadedSession = await loadCheckoutSession(input.razorpay_order_id);
		if (!loadedSession) {
			throw new HttpError(409, 'Checkout session expired. Please create a new payment order.');
		}
		if (loadedSession.orderId && loadedSession.status === 'paid') {
			res.json({ verified: true, orderId: loadedSession.orderId });
			return;
		}
		if (loadedSession.status !== 'pending') {
			throw new HttpError(409, 'Checkout session is already being processed');
		}
		const checkout = loadedSession.checkout;
		if (checkout.userId !== user.id) {
			throw new HttpError(403, 'Checkout session belongs to another user');
		}

		const verified = verifyRazorpaySignature({
			orderId: input.razorpay_order_id,
			paymentId: input.razorpay_payment_id,
			signature: input.razorpay_signature
		});
		if (!verified) throw new HttpError(400, 'Razorpay signature verification failed');
		const { data: existingPayment, error: existingPaymentError } = await supabaseAdmin
			.from('payments')
			.select('order_id')
			.eq('provider_order_id', input.razorpay_order_id)
			.maybeSingle();
		if (existingPaymentError) throw existingPaymentError;
		if (existingPayment?.order_id) {
			await markCheckoutSessionPaid(input.razorpay_order_id, existingPayment.order_id);
			res.json({ verified: true, orderId: existingPayment.order_id });
			return;
		}
		const locked = await markCheckoutSessionProcessing(input.razorpay_order_id);
		if (!locked) {
			throw new HttpError(409, 'Checkout session is already being processed');
		}

		const orderId = crypto.randomUUID();
		const address = checkout.address;
		const phone = phoneDigits(address.phone);
		const shippingAddress = buildShippingAddress(address);
		const tracking = [
			{
				label: 'Order placed',
				at: new Date().toISOString(),
				razorpay_order_id: input.razorpay_order_id,
				razorpay_payment_id: input.razorpay_payment_id,
				verified_by: 'server'
			}
		];

		const { data: completedOrderId, error: completeError } = await supabaseAdmin.rpc(
			'complete_checkout_payment',
			{
				p_order_id: orderId,
				p_user_id: user.id,
				p_order_payload: {
					status: 'confirmed',
					payment_status: 'paid',
					payment_method: 'razorpay',
					subtotal: checkout.subtotal,
					shipping: checkout.shipping,
					total: checkout.total,
					shipping_name: address.fullName,
					shipping_phone: phone,
					shipping_email: address.email || checkout.userEmail,
					shipping_address: shippingAddress,
					shipping_line1: address.line1,
					shipping_line2: address.line2 || null,
					shipping_city: address.city,
					shipping_state: address.state,
					shipping_pincode: address.pincode,
					shipping_country: 'India',
					shipping_latitude: address.latitude,
					shipping_longitude: address.longitude,
					shipping_location_source: address.locationSource ?? null,
					shipping_place_id: address.olaPlaceId ?? null,
					shipping_formatted_address: address.formattedAddress || null,
					shipping_route_distance_meters: checkout.deliveryEstimate.route.distanceMeters,
					shipping_route_duration_seconds: checkout.deliveryEstimate.route.durationSeconds,
					shipping_estimate: checkout.deliveryEstimate,
					shipping_courier_company_id: checkout.selectedCourier.courierCompanyId,
					shipping_courier_name: checkout.selectedCourier.courierName,
					shipping_service_type: checkout.selectedCourier.serviceType,
					shipping_expected_delivery_date: checkout.selectedCourier.expectedDeliveryDate,
					shipping_charge_estimate: checkout.selectedCourier.rate,
					tracking
				},
				p_items: checkout.items.map((item) => ({
					product_id: item.productId,
					title: item.title,
					image: item.image,
					brand: item.brand,
					price: item.price,
					unit_price: item.price,
					qty: item.qty
				})),
				p_payment_payload: {
					provider: 'razorpay',
					method: 'razorpay',
					amount: checkout.total,
					status: 'paid',
					provider_order_id: input.razorpay_order_id,
					provider_payment_id: input.razorpay_payment_id,
					provider_signature: input.razorpay_signature,
					raw_payload: {
						razorpay_order_id: input.razorpay_order_id,
						razorpay_payment_id: input.razorpay_payment_id,
						amount: checkout.amountPaise
					}
				},
				p_address_payload: {
					full_name: address.fullName,
					phone,
					line1: address.line1,
					line2: address.line2 || null,
					city: address.city,
					state: address.state,
					pincode: address.pincode,
					latitude: address.latitude,
					longitude: address.longitude,
					location_source: address.locationSource ?? null,
					ola_place_id: address.olaPlaceId ?? null,
					formatted_address: address.formattedAddress || null
				},
				p_save_address: checkout.saveAddress,
				p_checkout_session_razorpay_order_id: input.razorpay_order_id
			}
		);
		if (completeError) throw completeError;

		await markCheckoutSessionPaid(input.razorpay_order_id, String(completedOrderId ?? orderId));
		res.json({ verified: true, orderId: String(completedOrderId ?? orderId) });
	} catch (error) {
		if (error instanceof Error && error.message === 'Razorpay credentials are not configured') {
			res.status(503).json({ error: error.message });
			return;
		}
		next(error);
	}
});

app.get('/maps/autocomplete', mapLimiter, requireUser, async (req, res, next) => {
	try {
		const input = autocompleteQuerySchema.parse(req.query);
		const suggestions = await autocompleteOlaPlaces(
			input.input,
			input.latitude !== undefined && input.longitude !== undefined
				? { latitude: input.latitude, longitude: input.longitude }
				: undefined
		);
		res.json({ suggestions });
	} catch (error) {
		next(error);
	}
});

app.get('/maps/reverse-geocode', mapLimiter, requireUser, async (req, res, next) => {
	try {
		const input = reverseGeocodeQuerySchema.parse(req.query);
		res.json(await reverseGeocodeOlaPlace(input.latitude, input.longitude));
	} catch (error) {
		next(error);
	}
});

app.get('/maps/delivery-estimate', mapLimiter, requireUser, async (req, res, next) => {
	try {
		const input = deliveryEstimateQuerySchema.parse(req.query);
		const [route, couriers] = await Promise.all([
			getOlaDeliveryRoute(input),
			getShiprocketDeliveryQuotes({
				deliveryPincode: input.pincode,
				deliveryLatitude: input.latitude,
				deliveryLongitude: input.longitude,
				weightKg: input.weightKg,
				declaredValue: input.declaredValue
			})
		]);
		res.json({
			dispatch: {
				pickupLocation: config.shiprocketPickupLocation,
				pincode: config.lapkartDispatchPincode
			},
			route,
			couriers,
			generatedAt: new Date().toISOString()
		});
	} catch (error) {
		next(error);
	}
});

app.get('/shiprocket/status', requireAdmin, async (req, res, next) => {
	try {
		const verify = req.query.verify === '1' || req.query.verify === 'true';
		if (!verify) {
			res.json({
				configured: Boolean(
					config.shiprocketEmail && config.shiprocketPassword && config.shiprocketPickupLocation
				),
				pickupLocationConfigured: Boolean(config.shiprocketPickupLocation)
			});
			return;
		}

		await getShiprocketToken({ forceRefresh: true });
		res.json({ configured: true, authenticated: true });
	} catch (error) {
		next(error);
	}
});

app.get('/shiprocket/account', requireAdmin, async (_req, res, next) => {
	try {
		const [walletBalance, pickupResponse] = await Promise.all([
			getShiprocketWalletBalance(),
			getShiprocketPickupLocations()
		]);
		const pickupLocations = pickupResponse.data?.shipping_address ?? [];
		await syncShiprocketPickupLocations(pickupLocations);
		const configuredPickup = pickupLocations.find(
			(location) => String(location.pickup_location ?? '') === config.shiprocketPickupLocation
		);

		res.json({
			walletBalance,
			configuredPickupLocation: config.shiprocketPickupLocation,
			pickupLocationVerified: Boolean(configuredPickup),
			pickupLocations: pickupLocations.map((location) => ({
				id: location.id ?? null,
				pickupLocation: location.pickup_location ?? null,
				pincode: location.pin_code ?? null,
				city: location.city ?? null,
				state: location.state ?? null,
				latitude: location.lat ?? null,
				longitude: location.long ?? null,
				primary: Number(location.is_primary_location) === 1,
				active: Number(location.status ?? 1) !== 0
			}))
		});
	} catch (error) {
		next(error);
	}
});

app.get('/admin/fulfillment/orders', requireAdmin, async (_req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		const { data: orders, error: ordersError } = await supabaseAdmin
			.from('orders')
			.select(
				'id,created_at,status,total,shipping_name,shipping_city,shipping_state,shipping_pincode,shipping_service_type'
			)
			.order('created_at', { ascending: false })
			.limit(100);
		if (ordersError) throw ordersError;

		const orderIds = (orders ?? []).map((order) => order.id);
		const { data: shipments, error: shipmentsError } = orderIds.length
			? await supabaseAdmin
					.from('shipments')
					.select('*')
					.in('order_id', orderIds)
					.eq('provider', 'shiprocket')
			: { data: [], error: null };
		if (shipmentsError) throw shipmentsError;

		const shipmentIds = (shipments ?? []).map((shipment) => String(shipment.id));
		const { data: events, error: eventsError } = shipmentIds.length
			? await supabaseAdmin
					.from('shipment_events')
					.select('shipment_id,status,status_time,location,message,received_at')
					.in('shipment_id', shipmentIds)
					.order('status_time', { ascending: false })
			: { data: [], error: null };
		if (eventsError) throw eventsError;

		const items = await getOrderItemsWithSku(orderIds);

		const shipmentsByOrder = new Map(
			(shipments ?? []).map((shipment) => [shipment.order_id, shipment])
		);
		const shipmentEventsByShipment = groupShipmentEvents(events ?? []);
		const itemsByOrder = new Map<
			string,
			Array<{
				id: string;
				title: string;
				image: string;
				brand: string;
				qty: number;
				sku: string | null;
			}>
		>();

		for (const item of items) {
			const orderId = item.order_id;
			if (!orderId) continue;
			const rows = itemsByOrder.get(orderId) ?? [];
			rows.push({
				id: item.id,
				title: item.title,
				image: item.image,
				brand: item.brand,
				qty: item.qty,
				sku: item.sku
			});
			itemsByOrder.set(orderId, rows);
		}

		res.json({
			orders: (orders ?? []).map((order) => ({
				id: order.id,
				createdAt: order.created_at,
				status: order.status,
				total: order.total,
				shippingName: order.shipping_name,
				shippingCity: order.shipping_city,
				shippingState: order.shipping_state,
				shippingPincode: order.shipping_pincode,
				shippingServiceType: order.shipping_service_type,
				items: itemsByOrder.get(order.id) ?? [],
				shipment: toFulfillmentShipment(
					shipmentsByOrder.get(order.id),
					shipmentEventsByShipment.get(String(shipmentsByOrder.get(order.id)?.id ?? ''))
				)
			}))
		});
	} catch (error) {
		next(error);
	}
});

app.get('/orders/:orderId/tracking', requireUser, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const user = getAuthenticatedUser(req);
		const { orderId } = orderIdParamSchema.parse(req.params);

		const { data: order, error: orderError } = await adminDb
			.from('orders')
			.select(
				`
        id,
        user_id,
        total,
        subtotal,
        shipping,
        status,
        payment_status,
        shipping_name,
        shipping_address,
        shipping_courier_name,
        shipping_expected_delivery_date,
        shipping_route_distance_meters,
        shipping_route_duration_seconds,
        shipping_service_type,
        created_at
      `
			)
			.eq('id', orderId)
			.maybeSingle();
		if (orderError) throw orderError;
		if (!order || String(order.user_id) !== user.id) {
			res.status(404).json({ error: 'Order not found' });
			return;
		}

		const [{ data: items, error: itemsError }, { data: shipment, error: shipmentError }] =
			await Promise.all([
				adminDb
					.from('order_items')
					.select('id,title,image,brand,price,qty')
					.eq('order_id', orderId),
				adminDb
					.from('shipments')
					.select('*')
					.eq('order_id', orderId)
					.eq('provider', 'shiprocket')
					.maybeSingle()
			]);
		if (itemsError) throw itemsError;
		if (shipmentError) throw shipmentError;

		const { data: events, error: eventsError } = shipment?.id
			? await adminDb
					.from('shipment_events')
					.select('shipment_id,status,status_time,location,message,received_at')
					.eq('shipment_id', String(shipment.id))
					.order('status_time', { ascending: false })
			: { data: [], error: null };
		if (eventsError) throw eventsError;

		const groupedEvents = groupShipmentEvents(events ?? []);

		res.json({
			order: {
				id: order.id,
				total: Number(order.total ?? 0),
				subtotal: Number(order.subtotal ?? 0),
				shipping: Number(order.shipping ?? 0),
				status: String(order.status ?? ''),
				payment_status: String(order.payment_status ?? ''),
				shipping_name: String(order.shipping_name ?? ''),
				shipping_address: String(order.shipping_address ?? ''),
				shipping_courier_name: firstString(order.shipping_courier_name),
				shipping_expected_delivery_date: firstString(order.shipping_expected_delivery_date),
				shipping_route_distance_meters:
					order.shipping_route_distance_meters === null
						? null
						: Number(order.shipping_route_distance_meters),
				shipping_route_duration_seconds:
					order.shipping_route_duration_seconds === null
						? null
						: Number(order.shipping_route_duration_seconds),
				shipping_service_type: String(order.shipping_service_type ?? 'standard'),
				created_at: String(order.created_at)
			},
			items: (items ?? []).map((item) => ({
				id: item.id,
				title: item.title,
				image: item.image,
				brand: item.brand,
				price: Number(item.price ?? 0),
				qty: Number(item.qty ?? 0)
			})),
			shipment: toFulfillmentShipment(
				shipment as Record<string, unknown> | undefined,
				groupedEvents.get(String(shipment?.id ?? ''))
			)
		});
	} catch (error) {
		next(error);
	}
});

app.post('/shipments/shiprocket/create', requireAdmin, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		requireLivePaymentEnvironment();
		const input = createShiprocketShipmentSchema.parse(req.body);

		const { data: order, error: orderError } = await supabaseAdmin
			.from('orders')
			.select('*')
			.eq('id', input.orderId)
			.maybeSingle();
		if (orderError) throw orderError;
		if (!order) {
			res.status(404).json({ error: 'Order not found' });
			return;
		}

		const items = await getOrderItemsWithSku([input.orderId]);
		if (!items?.length) {
			res.status(400).json({ error: 'Order has no items' });
			return;
		}

		const { data: existingShipment, error: existingShipmentError } = await supabaseAdmin
			.from('shipments')
			.select('*')
			.eq('order_id', input.orderId)
			.eq('provider', 'shiprocket')
			.maybeSingle();
		if (existingShipmentError) throw existingShipmentError;
		if (existingShipment) {
			res.status(409).json({
				error: 'Shiprocket shipment already exists for this order',
				shipment: existingShipment
			});
			return;
		}

		const payload = toShiprocketOrderPayload({
			order,
			items,
			package: input.package,
			pickupLocation: input.pickupLocation
		});
		const { data: pickupLocation, error: pickupLocationError } = await supabaseAdmin
			.from('shipping_pickup_locations')
			.select('id')
			.eq('provider', 'shiprocket')
			.eq('pickup_location', payload.pickup_location)
			.eq('is_active', true)
			.maybeSingle();
		if (pickupLocationError) throw pickupLocationError;
		if (!pickupLocation) {
			res.status(400).json({ error: 'Shiprocket pickup location is not synced or active' });
			return;
		}

		const response = await createShiprocketOrder(payload);
		const shiprocketOrderId = Number(response.order_id ?? response.orderId);
		const shiprocketShipmentId = Number(response.shipment_id ?? response.shipmentId);

		const { data: shipment, error: shipmentError } = await supabaseAdmin
			.from('shipments')
			.insert({
				order_id: input.orderId,
				provider: 'shiprocket',
				pickup_location_id: pickupLocation.id,
				shipping_service_type: order.shipping_service_type ?? 'standard',
				status: shiprocketShipmentId ? 'created' : 'pending',
				shiprocket_order_id: Number.isFinite(shiprocketOrderId) ? shiprocketOrderId : null,
				shiprocket_shipment_id: Number.isFinite(shiprocketShipmentId) ? shiprocketShipmentId : null,
				shiprocket_channel_order_id: String(order.id),
				courier_company_id: order.shipping_courier_company_id ?? null,
				courier_name: order.shipping_courier_name ?? null,
				shipping_charge: order.shipping_charge_estimate ?? 0,
				expected_delivery_date: order.shipping_expected_delivery_date ?? null,
				request_payload: payload,
				raw_create_response: response,
				raw_payload: response
			})
			.select('*')
			.single();
		if (shipmentError) throw shipmentError;

		await supabaseAdmin.from('shipment_packages').insert({
			shipment_id: shipment.id,
			package_number: 1,
			weight_kg: payload.weight,
			length_cm: payload.length,
			breadth_cm: payload.breadth,
			height_cm: payload.height,
			declared_value: payload.sub_total,
			item_count: payload.order_items.reduce((sum, item) => sum + item.units, 0),
			sku_summary: payload.order_items
				.map((item) => item.sku)
				.join(', ')
				.slice(0, 500),
			order_item_ids: items.map((item) => item.id),
			raw_payload: payload
		});

		res.json({ shipment, shiprocket: response });
	} catch (error) {
		next(error);
	}
});

app.post('/shipments/shiprocket/assign-awb', requireAdmin, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		requireLivePaymentEnvironment();
		const input = assignAwbSchema.parse(req.body);

		const { data: shipment, error: shipmentError } = await supabaseAdmin
			.from('shipments')
			.select('*')
			.eq('id', input.shipmentId)
			.maybeSingle();
		if (shipmentError) throw shipmentError;
		if (!shipment?.shiprocket_shipment_id) {
			res.status(400).json({ error: 'Shipment does not have a Shiprocket shipment id' });
			return;
		}

		const response = await assignShiprocketAwb({
			shipment_id: shipment.shiprocket_shipment_id,
			courier_id: input.courierId ?? shipment.courier_company_id ?? undefined
		});
		const awbData = getAwbData(response);
		if (Number(response.awb_assign_status ?? 1) !== 1) {
			throw new Error(
				firstString(awbData.awb_assign_error, response.message) ??
					'Shiprocket AWB assignment failed'
			);
		}
		const awbCode = firstString(awbData.awb_code, shipment.awb_code);
		const courierName = firstString(awbData.courier_name, shipment.courier_name);
		const courierCompanyId = Number(
			awbData.courier_company_id ?? input.courierId ?? shipment.courier_company_id
		);

		const { data: updatedShipment, error: updateError } = await supabaseAdmin
			.from('shipments')
			.update({
				status: 'awb_assigned',
				awb_code: awbCode,
				courier_company_id: Number.isFinite(courierCompanyId) ? courierCompanyId : null,
				courier_name: courierName,
				raw_awb_response: response,
				raw_payload: response,
				last_status_at: new Date().toISOString()
			})
			.eq('id', input.shipmentId)
			.select('*')
			.single();
		if (updateError) throw updateError;

		let tracking = null;
		if (shipment.shipping_service_type === 'quick') {
			try {
				tracking = await refreshShiprocketTracking(updatedShipment);
			} catch {
				tracking = null;
			}
		}

		res.json({
			shipment: tracking?.shipment ?? updatedShipment,
			shiprocket: response,
			tracking: tracking?.tracking ?? null,
			dispatchMode:
				shipment.shipping_service_type === 'quick'
					? 'quick_rider_requested'
					: 'standard_awb_assigned'
		});
	} catch (error) {
		next(error);
	}
});

app.post('/shipments/shiprocket/pickup', requireAdmin, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		requireLivePaymentEnvironment();
		const input = shipmentIdSchema.parse(req.body);
		const { data: shipment, error: shipmentError } = await supabaseAdmin
			.from('shipments')
			.select('*')
			.eq('id', input.shipmentId)
			.maybeSingle();
		if (shipmentError) throw shipmentError;
		if (!shipment?.shiprocket_shipment_id) {
			res.status(400).json({ error: 'Shipment does not have a Shiprocket shipment id' });
			return;
		}
		if (shipment.shipping_service_type === 'quick') {
			res
				.status(400)
				.json({ error: 'Shiprocket Quick rider assignment is triggered during AWB assignment' });
			return;
		}
		if (!shipment.awb_code) {
			res.status(400).json({ error: 'Assign an AWB before scheduling pickup' });
			return;
		}

		const pickup = await requestShiprocketPickup(shipment.shiprocket_shipment_id);
		if (Number(pickup.pickup_status ?? 1) !== 1) {
			throw new Error(firstString(pickup.message) ?? 'Shiprocket pickup scheduling failed');
		}
		const pickupData = getPickupData(pickup);
		let manifest: Record<string, unknown> | null = null;
		let manifestError: string | null = null;
		try {
			manifest = await generateShiprocketManifest([shipment.shiprocket_shipment_id]);
		} catch (error) {
			manifestError =
				error instanceof Error ? error.message : 'Could not generate Shiprocket manifest';
		}
		const manifestUrl = firstString(
			pickupData.manifest_url,
			pickup.manifest_url,
			manifest?.manifest_url
		);
		const pickupScheduledDate = toDateOnly(
			pickupData.pickup_scheduled_date ?? pickup.pickup_scheduled_date ?? new Date().toISOString()
		);

		const { data: updatedShipment, error: updateError } = await supabaseAdmin
			.from('shipments')
			.update({
				status: manifestUrl ? 'manifest_generated' : 'pickup_scheduled',
				pickup_scheduled_date: pickupScheduledDate,
				manifest_url: manifestUrl,
				raw_payload: { pickup, manifest },
				last_status_at: new Date().toISOString()
			})
			.eq('id', input.shipmentId)
			.select('*')
			.single();
		if (updateError) throw updateError;

		res.json({ shipment: updatedShipment, pickup, manifest, manifestError });
	} catch (error) {
		next(error);
	}
});

app.get('/shipments/shiprocket/:shipmentId/tracking', requireAdmin, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		const input = shipmentIdSchema.parse(req.params);
		const { data: shipment, error: shipmentError } = await supabaseAdmin
			.from('shipments')
			.select('*')
			.eq('id', input.shipmentId)
			.maybeSingle();
		if (shipmentError) throw shipmentError;
		if (!shipment) {
			res.status(404).json({ error: 'Shipment not found' });
			return;
		}
		res.json(await refreshShiprocketTracking(shipment));
	} catch (error) {
		next(error);
	}
});

app.post('/shipments/shiprocket/labels', requireAdmin, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		const input = labelsSchema.parse(req.body);
		const { data: shipments, error } = await supabaseAdmin
			.from('shipments')
			.select('id,shiprocket_shipment_id')
			.in('id', input.shipmentIds);
		if (error) throw error;

		const shiprocketShipmentIds = (shipments ?? [])
			.map((shipment) => shipment.shiprocket_shipment_id)
			.filter((id): id is number => typeof id === 'number');

		if (!shiprocketShipmentIds.length) {
			res.status(400).json({ error: 'No Shiprocket shipment ids found' });
			return;
		}

		const response = await generateShiprocketLabels(shiprocketShipmentIds);
		const labelUrl = typeof response.label_url === 'string' ? response.label_url : undefined;

		if (labelUrl) {
			await supabaseAdmin
				.from('shipments')
				.update({
					status: 'label_generated',
					label_url: labelUrl,
					raw_payload: response,
					last_status_at: new Date().toISOString()
				})
				.in('id', input.shipmentIds);
		}

		res.json({ shiprocket: response });
	} catch (error) {
		next(error);
	}
});

app.post('/logistics/events', webhookLimiter, async (req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		if (!config.shiprocketWebhookToken) {
			res.status(503).json({
				error: 'SHIPROCKET_WEBHOOK_TOKEN is required before accepting logistics webhooks'
			});
			return;
		}
		// Header-only: a token in req.query.token would leak the secret into
		// access logs and Referer headers. Constant-time compare avoids leaking
		// the token via response timing.
		const token = req.header('x-lapkart-logistics-token') ?? '';
		const expected = config.shiprocketWebhookToken;
		const tokenDigest = crypto.createHash('sha256').update(token).digest();
		const expectedDigest = crypto.createHash('sha256').update(expected).digest();
		if (!crypto.timingSafeEqual(tokenDigest, expectedDigest)) {
			res.status(401).json({ error: 'Invalid webhook token' });
			return;
		}

		const body = req.body as Record<string, unknown>;
		const awb = String(body.awb ?? body.awb_code ?? body.awbCode ?? '').trim() || null;
		const shiprocketShipmentId = Number(body.shipment_id ?? body.shipmentId);
		const status = String(body.current_status ?? body.status ?? body.shipment_status ?? 'updated');
		const statusTime = String(body.event_time ?? body.status_time ?? body.updated_at ?? '');
		const providerEventId = String(body.event_id ?? body.eventId ?? body.id ?? '').trim() || null;
		const idempotencySeed =
			providerEventId ??
			[
				awb ?? '',
				Number.isFinite(shiprocketShipmentId) ? String(shiprocketShipmentId) : '',
				status,
				statusTime
			].join('|');
		const idempotencyKey = sha256Hex(idempotencySeed);

		let shipmentId: string | null = null;
		if (awb || Number.isFinite(shiprocketShipmentId)) {
			let query = supabaseAdmin.from('shipments').select('id').limit(1);
			if (awb) query = query.eq('awb_code', awb);
			else query = query.eq('shiprocket_shipment_id', shiprocketShipmentId);
			const { data } = await query.maybeSingle();
			shipmentId = data?.id ?? null;
		}

		const { data: webhookEvent, error: webhookEventError } = await supabaseAdmin
			.from('provider_webhook_events')
			.insert({
				provider: 'shiprocket',
				provider_event_id: providerEventId,
				event_type: status,
				signature_valid: true,
				idempotency_key: idempotencyKey,
				related_shipment_id: shipmentId,
				payload: body
			})
			.select('id')
			.single();
		if (webhookEventError) {
			if (webhookEventError.code === '23505') {
				res.json({ ok: true, duplicate: true });
				return;
			}
			throw webhookEventError;
		}

		await supabaseAdmin.from('shipment_events').insert({
			shipment_id: shipmentId,
			provider: 'shiprocket',
			awb_code: awb,
			status,
			status_code: Number.isFinite(Number(body.current_status_id ?? body.status_code))
				? Number(body.current_status_id ?? body.status_code)
				: null,
			status_time: statusTime ? new Date(statusTime).toISOString() : null,
			location: body.location ? String(body.location) : null,
			message: body.message ? String(body.message) : null,
			raw_payload: body
		});

		if (shipmentId) {
			await supabaseAdmin
				.from('shipments')
				.update({
					status: normalizeShipmentStatus(status),
					last_status_at: new Date().toISOString(),
					raw_payload: body
				})
				.eq('id', shipmentId);
		}

		await supabaseAdmin
			.from('provider_webhook_events')
			.update({
				processing_status: shipmentId ? 'processed' : 'ignored',
				related_shipment_id: shipmentId,
				processed_at: new Date().toISOString()
			})
			.eq('id', webhookEvent.id);

		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.post(
	'/storage/upload/:bucket',
	uploadLimiter,
	requireAdmin,
	upload.single('file'),
	async (req, res, next) => {
		try {
			if (!req.file) return res.status(400).json({ error: 'file is required' });
			if (!supabaseAdmin)
				return res.status(503).json({ error: 'Supabase service credentials are not configured' });
			assertUploadIsSafeImage(req.file);
			const bucket = z.enum(['products', 'users']).parse(req.params.bucket);
			const path = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
			const { error } = await supabaseAdmin.storage.from(bucket).upload(path, req.file.buffer, {
				contentType: req.file.mimetype,
				upsert: false
			});
			if (error) throw error;
			const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
			res.json({ bucket, path, image_url: data.publicUrl, uploaded_at: new Date().toISOString() });
		} catch (error) {
			next(error);
		}
	}
);

app.get('/admin/analytics', requireAdmin, async (_req, res, next) => {
	try {
		if (!supabaseAdmin) throw new Error('Supabase service credentials are not configured');
		const [orders, products, users] = await Promise.all([
			supabaseAdmin.from('orders').select('id,total,status,created_at,shipping_name'),
			supabaseAdmin.from('products').select('id,stock', { count: 'exact', head: false }).limit(100),
			supabaseAdmin.from('profiles').select('id', { count: 'exact', head: false }).limit(100)
		]);

		if (orders.error) throw orders.error;
		if (products.error) throw products.error;
		if (users.error) throw users.error;

		const orderRows = orders.data ?? [];
		const revenue = orderRows.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
		const deliveredOrders = orderRows.filter(
			(order) => String(order.status ?? '').toLowerCase() === 'delivered'
		).length;
		const pendingFulfillment = orderRows.filter((order) =>
			['confirmed', 'packed', 'pending', 'processing'].includes(
				String(order.status ?? '').toLowerCase()
			)
		).length;
		const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
		const today = new Date();
		const monthlySeries = Array.from({ length: 6 }, (_, index) => {
			const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
			const key = `${date.getFullYear()}-${date.getMonth()}`;
			return {
				key,
				month: monthFormatter.format(date),
				revenue: 0,
				orders: 0
			};
		});
		const monthIndex = new Map(monthlySeries.map((row) => [row.key, row]));
		for (const order of orderRows) {
			const createdAt = new Date(String(order.created_at));
			if (Number.isNaN(createdAt.getTime())) continue;
			const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
			const bucket = monthIndex.get(key);
			if (!bucket) continue;
			bucket.orders += 1;
			bucket.revenue += Number(order.total ?? 0);
		}

		res.json({
			orders: orderRows.length,
			products: products.count ?? 0,
			users: users.count ?? 0,
			revenue,
			deliveredOrders,
			pendingFulfillment,
			monthlySeries,
			recentOrders: orderRows
				.slice()
				.sort(
					(left, right) =>
						new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
				)
				.slice(0, 6)
				.map((order) => ({
					id: order.id,
					createdAt: order.created_at,
					total: Number(order.total ?? 0),
					status: String(order.status ?? 'pending'),
					shippingName: order.shipping_name ? String(order.shipping_name) : null
				}))
		});
	} catch (error) {
		next(error);
	}
});

app.get('/admin/products', requireAdmin, async (_req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const { data, error } = await adminDb
			.from('products')
			.select('*')
			.order('updated_at', { ascending: false })
			.limit(250);
		if (error) throw error;
		res.json({ products: data ?? [] });
	} catch (error) {
		next(error);
	}
});

app.post('/admin/products', requireAdmin, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const input = productUpsertSchema.parse(req.body);
		const payload = {
			title: input.title,
			brand: input.brand,
			category: input.category,
			description: input.description ?? null,
			image: input.image,
			images: input.images.length > 0 ? input.images : null,
			price: input.price,
			mrp: input.mrp,
			stock: input.stock,
			status: input.status,
			sku: input.sku ?? null,
			source_url: input.sourceUrl ?? null,
			compatibility: input.compatibility ?? null,
			warranty: input.warranty ?? null,
			highlights: input.highlights.length > 0 ? input.highlights : null,
			search_keywords: input.searchKeywords.length > 0 ? input.searchKeywords : null,
			weight_kg: input.weightKg ?? null,
			length_cm: input.lengthCm ?? null,
			breadth_cm: input.breadthCm ?? null,
			height_cm: input.heightCm ?? null
		};

		const { data, error } = await adminDb.from('products').insert(payload).select('*').single();
		if (error) throw error;
		res.status(201).json({ product: data });
	} catch (error) {
		next(error);
	}
});

app.patch('/admin/products/:productId', requireAdmin, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const { productId } = productIdParamSchema.parse(req.params);
		const input = productUpdateSchema.parse(req.body);
		const payload: Record<string, unknown> = {};

		if ('title' in input) payload.title = input.title;
		if ('brand' in input) payload.brand = input.brand;
		if ('category' in input) payload.category = input.category;
		if ('description' in input) payload.description = input.description ?? null;
		if ('image' in input) payload.image = input.image;
		if ('images' in input)
			payload.images = input.images && input.images.length > 0 ? input.images : null;
		if ('price' in input) payload.price = input.price;
		if ('mrp' in input) payload.mrp = input.mrp;
		if ('stock' in input) payload.stock = input.stock;
		if ('status' in input) payload.status = input.status;
		if ('sku' in input) payload.sku = input.sku ?? null;
		if ('sourceUrl' in input) payload.source_url = input.sourceUrl ?? null;
		if ('compatibility' in input) payload.compatibility = input.compatibility ?? null;
		if ('warranty' in input) payload.warranty = input.warranty ?? null;
		if ('highlights' in input)
			payload.highlights =
				input.highlights && input.highlights.length > 0 ? input.highlights : null;
		if ('searchKeywords' in input)
			payload.search_keywords =
				input.searchKeywords && input.searchKeywords.length > 0 ? input.searchKeywords : null;
		if ('weightKg' in input) payload.weight_kg = input.weightKg ?? null;
		if ('lengthCm' in input) payload.length_cm = input.lengthCm ?? null;
		if ('breadthCm' in input) payload.breadth_cm = input.breadthCm ?? null;
		if ('heightCm' in input) payload.height_cm = input.heightCm ?? null;

		const { data, error } = await adminDb
			.from('products')
			.update(payload)
			.eq('id', productId)
			.select('*')
			.single();
		if (error) throw error;
		res.json({ product: data });
	} catch (error) {
		next(error);
	}
});

app.delete('/admin/products/:productId', requireAdmin, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const { productId } = productIdParamSchema.parse(req.params);
		const { count, error: usageError } = await adminDb
			.from('order_items')
			.select('id', { count: 'exact', head: true })
			.eq('product_id', productId);
		if (usageError) throw usageError;

		if ((count ?? 0) > 0) {
			const { data, error } = await adminDb
				.from('products')
				.update({ status: 'archived' })
				.eq('id', productId)
				.select('id,status')
				.single();
			if (error) throw error;
			res.json({
				archived: true,
				product: data,
				message: 'Product has order history, so it was archived instead of deleted.'
			});
			return;
		}

		const { error } = await adminDb.from('products').delete().eq('id', productId);
		if (error) throw error;
		res.json({ deleted: true, productId });
	} catch (error) {
		next(error);
	}
});

app.get('/admin/users', requireAdmin, async (_req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const [
			{ data: authUsersData, error: authUsersError },
			profilesResult,
			rolesResult,
			ordersResult
		] = await Promise.all([
			adminDb.auth.admin.listUsers({ page: 1, perPage: 200 }),
			adminDb.from('profiles').select('id,full_name,phone,created_at,updated_at'),
			adminDb.from('user_roles').select('user_id,role'),
			adminDb.from('orders').select('user_id,total,created_at')
		]);
		if (authUsersError) throw authUsersError;
		if (profilesResult.error) throw profilesResult.error;
		if (rolesResult.error) throw rolesResult.error;
		if (ordersResult.error) throw ordersResult.error;

		const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
		const roles = new Map(
			(rolesResult.data ?? []).map((roleRow) => [roleRow.user_id, roleRow.role])
		);
		const orderStats = new Map<string, { orderCount: number; totalSpent: number }>();

		for (const order of ordersResult.data ?? []) {
			const stats = orderStats.get(order.user_id) ?? { orderCount: 0, totalSpent: 0 };
			stats.orderCount += 1;
			stats.totalSpent += Number(order.total ?? 0);
			orderStats.set(order.user_id, stats);
		}

		const users = (authUsersData.users ?? [])
			.map((authUser) => {
				const profile = profiles.get(authUser.id);
				const stats = orderStats.get(authUser.id) ?? { orderCount: 0, totalSpent: 0 };
				return {
					id: authUser.id,
					email: authUser.email ?? null,
					createdAt: authUser.created_at ?? profile?.created_at ?? null,
					lastSignInAt: authUser.last_sign_in_at ?? null,
					role: roles.get(authUser.id) ?? 'user',
					fullName: profile?.full_name ?? null,
					phone: profile?.phone ?? null,
					orderCount: stats.orderCount,
					totalSpent: stats.totalSpent
				};
			})
			.sort((left, right) => {
				const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
				const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
				return rightTime - leftTime;
			});

		res.json({ users });
	} catch (error) {
		next(error);
	}
});

app.patch('/admin/users/:userId', requireAdmin, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const actor = getAuthenticatedUser(req);
		const { userId } = userIdParamSchema.parse(req.params);
		const input = adminUserUpdateSchema.parse(req.body);

		if (input.role && actor.id === userId && input.role !== 'admin') {
			throw new HttpError(400, 'Use another admin account before removing your own admin role.');
		}

		const [currentProfileResult, currentRoleResult, orderCountResult] = await Promise.all([
			adminDb.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle(),
			adminDb.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
			adminDb.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId)
		]);
		if (currentProfileResult.error) throw currentProfileResult.error;
		if (currentRoleResult.error) throw currentRoleResult.error;
		if (orderCountResult.error) throw orderCountResult.error;

		const currentState = {
			role: currentRoleResult.data?.role === 'admin' ? 'admin' : 'user',
			fullName: currentProfileResult.data?.full_name ?? null,
			phone: currentProfileResult.data?.phone ?? null
		};
		const nextState = {
			role: input.role ?? currentState.role,
			fullName: 'fullName' in input ? (input.fullName ?? null) : currentState.fullName,
			phone: 'phone' in input ? (input.phone ?? null) : currentState.phone
		};
		const hasOrderHistory = (orderCountResult.count ?? 0) > 0;

		if ('phone' in input && hasOrderHistory && nextState.phone !== currentState.phone) {
			throw new HttpError(409, 'Phone number is locked after this customer has placed an order.');
		}

		if (input.role) {
			if (currentState.role === 'admin' && input.role !== 'admin') {
				const { count, error: adminCountError } = await adminDb
					.from('user_roles')
					.select('user_id', { count: 'exact', head: true })
					.eq('role', 'admin');
				if (adminCountError) throw adminCountError;
				if ((count ?? 0) <= 1) {
					throw new HttpError(400, 'At least one admin account must remain.');
				}
			}

			const { error: roleUpdateError } = await adminDb
				.from('user_roles')
				.upsert({ user_id: userId, role: input.role }, { onConflict: 'user_id' });
			if (roleUpdateError) throw roleUpdateError;
		}

		if ('fullName' in input || 'phone' in input) {
			const profilePatch: Record<string, unknown> = { id: userId };
			if ('fullName' in input) profilePatch.full_name = input.fullName ?? null;
			if ('phone' in input) profilePatch.phone = input.phone ?? null;
			const { error: profileError } = await adminDb
				.from('profiles')
				.upsert(profilePatch, { onConflict: 'id' });
			if (profileError) throw profileError;
		}

		const changedFields = (Object.keys(nextState) as Array<keyof typeof nextState>).filter(
			(field) => nextState[field] !== currentState[field]
		);

		if (changedFields.length) {
			const { error: auditError } = await adminDb.from('admin_user_events').insert({
				target_user_id: userId,
				admin_user_id: actor.id,
				event_type: changedFields.includes('role') ? 'role_update' : 'profile_update',
				reason: `Admin updated user ${changedFields.join(', ')}`,
				from_state: currentState,
				to_state: nextState,
				metadata: {
					changedFields,
					orderCount: orderCountResult.count ?? 0
				}
			});
			if (auditError) throw auditError;
		}

		const [{ data: profile }, { data: roleRow }] = await Promise.all([
			adminDb.from('profiles').select('full_name,phone').eq('id', userId).maybeSingle(),
			adminDb.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
		]);

		res.json({
			user: {
				id: userId,
				role: roleRow?.role ?? 'user',
				fullName: profile?.full_name ?? null,
				phone: profile?.phone ?? null
			}
		});
	} catch (error) {
		next(error);
	}
});

app.get('/admin/orders', requireAdmin, async (_req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const [{ data: orders, error: ordersError }, authUsersResult] = await Promise.all([
			adminDb
				.from('orders')
				.select(
					`
          id,
          user_id,
          created_at,
          updated_at,
          status,
          payment_status,
          payment_method,
          subtotal,
          shipping,
          total,
          shipping_name,
          shipping_phone,
          shipping_email,
          shipping_line1,
          shipping_line2,
          shipping_city,
          shipping_state,
          shipping_pincode,
          shipping_service_type,
          shipping_courier_name
        `
				)
				.order('created_at', { ascending: false })
				.limit(200),
			adminDb.auth.admin.listUsers({ page: 1, perPage: 200 })
		]);
		if (ordersError) throw ordersError;
		if (authUsersResult.error) throw authUsersResult.error;

		const orderIds = (orders ?? []).map((order) => order.id);
		const userEmailById = new Map(
			(authUsersResult.data.users ?? []).map((user) => [user.id, user.email ?? null])
		);
		const [itemsResult, shipmentsResult, paymentsResult] = orderIds.length
			? await Promise.all([
					adminDb.from('order_items').select('order_id,title,qty').in('order_id', orderIds),
					adminDb
						.from('shipments')
						.select('order_id,status,awb_code,courier_name,tracking_url,expected_delivery_date')
						.in('order_id', orderIds),
					adminDb
						.from('payments')
						.select('order_id,status,provider_payment_id,provider_order_id,created_at')
						.in('order_id', orderIds)
				])
			: [
					{ data: [], error: null },
					{ data: [], error: null },
					{ data: [], error: null }
				];

		if (itemsResult.error) throw itemsResult.error;
		if (shipmentsResult.error) throw shipmentsResult.error;
		if (paymentsResult.error) throw paymentsResult.error;

		const itemSummaryByOrder = new Map<string, string>();
		for (const item of itemsResult.data ?? []) {
			const existing = itemSummaryByOrder.get(item.order_id) ?? '';
			const nextItem = `${item.title} x${item.qty}`;
			itemSummaryByOrder.set(item.order_id, existing ? `${existing}, ${nextItem}` : nextItem);
		}

		const shipmentByOrder = new Map(
			(shipmentsResult.data ?? []).map((shipment) => [shipment.order_id, shipment])
		);
		const paymentByOrder = new Map(
			(paymentsResult.data ?? [])
				.slice()
				.sort(
					(left, right) =>
						new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
				)
				.map((payment) => [payment.order_id, payment])
		);

		res.json({
			orders: (orders ?? []).map((order) => {
				const shipment = shipmentByOrder.get(order.id);
				const payment = paymentByOrder.get(order.id);
				return {
					id: order.id,
					userId: order.user_id,
					userEmail: userEmailById.get(order.user_id) ?? order.shipping_email ?? null,
					createdAt: order.created_at,
					updatedAt: order.updated_at,
					status: order.status,
					paymentStatus: order.payment_status,
					paymentMethod: order.payment_method,
					subtotal: Number(order.subtotal ?? 0),
					shipping: Number(order.shipping ?? 0),
					total: Number(order.total ?? 0),
					shippingName: order.shipping_name,
					shippingPhone: order.shipping_phone,
					shippingEmail: order.shipping_email,
					shippingLine1: order.shipping_line1,
					shippingLine2: order.shipping_line2,
					shippingCity: order.shipping_city,
					shippingState: order.shipping_state,
					shippingPincode: order.shipping_pincode,
					shippingServiceType: order.shipping_service_type,
					shippingCourierName: order.shipping_courier_name,
					itemSummary: itemSummaryByOrder.get(order.id) ?? '',
					shipment: shipment
						? {
								status: shipment.status,
								awbCode: shipment.awb_code,
								courierName: shipment.courier_name,
								trackingUrl: shipment.tracking_url,
								expectedDeliveryDate: shipment.expected_delivery_date
							}
						: null,
					payment: payment
						? {
								status: payment.status,
								providerPaymentId: payment.provider_payment_id,
								providerOrderId: payment.provider_order_id
							}
						: null
				};
			})
		});
	} catch (error) {
		next(error);
	}
});

app.patch('/admin/orders/:orderId', requireAdmin, async (req, res, next) => {
	try {
		const adminDb = getSupabaseAdmin();
		const { orderId } = orderIdParamSchema.parse(req.params);
		const input = adminOrderUpdateSchema.parse(req.body);

		const [existingOrderResult, shipmentResult] = await Promise.all([
			adminDb
				.from('orders')
				.select(
					`
        id,
        status,
        payment_status,
        shipping_service_type,
        shipping_name,
        shipping_phone,
        shipping_email,
        shipping_line1,
        shipping_line2,
        shipping_city,
        shipping_state,
        shipping_pincode,
        shipping_address
      `
				)
				.eq('id', orderId)
				.single(),
			adminDb
				.from('shipments')
				.select('status')
				.eq('order_id', orderId)
				.eq('shipping_direction', 'outbound')
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle()
		]);
		const { data: existingOrder, error: existingOrderError } = existingOrderResult;
		const { data: shipment, error: shipmentError } = shipmentResult;
		if (existingOrderError) throw existingOrderError;
		if (shipmentError) throw shipmentError;

		const currentOrderStatus = String(existingOrder.status ?? '').toLowerCase();
		const currentPaymentStatus = String(existingOrder.payment_status ?? '').toLowerCase();
		if (
			['cancelled', 'refunded', 'returned'].includes(currentOrderStatus) ||
			['refunded', 'cod_cancelled'].includes(currentPaymentStatus)
		) {
			throw new HttpError(409, 'Terminal orders are locked from the admin app');
		}
		const readOnlyFieldsTouched = [
			'shippingServiceType',
			'shippingName',
			'shippingPhone',
			'shippingEmail',
			'shippingLine1',
			'shippingLine2',
			'shippingCity',
			'shippingState',
			'shippingPincode'
		].some((field) => field in input);
		if (readOnlyFieldsTouched) {
			throw new HttpError(
				400,
				'Customer and delivery fields are read-only in the admin order editor'
			);
		}

		const payload: Record<string, unknown> = {};
		if ('status' in input) payload.status = input.status?.toLowerCase();
		if ('paymentStatus' in input) payload.payment_status = input.paymentStatus?.toLowerCase();
		const nextOrderStatus = String(payload.status ?? currentOrderStatus);
		if (
			'status' in payload &&
			!canTransitionManualOrderStatus(
				currentOrderStatus,
				nextOrderStatus,
				isAdminShipmentStarted(shipment)
			)
		) {
			throw new HttpError(
				409,
				isAdminShipmentStarted(shipment) && nextOrderStatus === 'cancelled'
					? 'Shipped orders cannot be cancelled from the admin editor'
					: `Order cannot move from ${currentOrderStatus.replaceAll('_', ' ')} to ${nextOrderStatus.replaceAll('_', ' ')}`
			);
		}
		if (
			'payment_status' in payload &&
			!canTransitionManualPaymentStatus(
				currentPaymentStatus,
				String(payload.payment_status ?? currentPaymentStatus)
			)
		) {
			throw new HttpError(409, 'Use the payment or refund workflow for this payment state change');
		}
		if (['cancelled', 'returned'].includes(nextOrderStatus) && !input.reason?.trim()) {
			throw new HttpError(400, 'Add a clear reason for cancellation or return changes');
		}

		if (payload.status === 'cancelled') {
			if ('payment_status' in payload) {
				throw new HttpError(400, 'Use the cancellation workflow before changing payment state');
			}
			const adminUser = (req as AuthenticatedRequest).authUser;
			if (!adminUser) {
				throw new HttpError(401, 'Admin session is missing');
			}
			const { error: cancellationError } = await adminDb.rpc('admin_cancel_order', {
				p_order_id: orderId,
				p_admin_user_id: adminUser.id,
				p_reason: input.reason?.trim(),
				p_metadata: {
					source: 'admin_order_editor'
				}
			});
			if (cancellationError) throw cancellationError;
			const { data: cancelledOrder, error: cancelledOrderError } = await adminDb
				.from('orders')
				.select(
					`
        id,
        status,
        payment_status,
        shipping_service_type,
        shipping_name,
        shipping_phone,
        shipping_email,
        shipping_line1,
        shipping_line2,
        shipping_city,
        shipping_state,
        shipping_pincode,
        shipping_address,
        updated_at
      `
				)
				.eq('id', orderId)
				.single();
			if (cancelledOrderError) throw cancelledOrderError;

			res.json({
				order: {
					id: cancelledOrder.id,
					status: cancelledOrder.status,
					paymentStatus: cancelledOrder.payment_status,
					shippingServiceType: cancelledOrder.shipping_service_type,
					shippingName: cancelledOrder.shipping_name,
					shippingPhone: cancelledOrder.shipping_phone,
					shippingEmail: cancelledOrder.shipping_email,
					shippingLine1: cancelledOrder.shipping_line1,
					shippingLine2: cancelledOrder.shipping_line2,
					shippingCity: cancelledOrder.shipping_city,
					shippingState: cancelledOrder.shipping_state,
					shippingPincode: cancelledOrder.shipping_pincode,
					shippingAddress: cancelledOrder.shipping_address,
					updatedAt: cancelledOrder.updated_at
				}
			});
			return;
		}

		const { data, error } = await adminDb
			.from('orders')
			.update(payload)
			.eq('id', orderId)
			.select(
				`
        id,
        status,
        payment_status,
        shipping_service_type,
        shipping_name,
        shipping_phone,
        shipping_email,
        shipping_line1,
        shipping_line2,
        shipping_city,
        shipping_state,
        shipping_pincode,
        shipping_address,
        updated_at
      `
			)
			.single();
		if (error) throw error;

		res.json({
			order: {
				id: data.id,
				status: data.status,
				paymentStatus: data.payment_status,
				shippingServiceType: data.shipping_service_type,
				shippingName: data.shipping_name,
				shippingPhone: data.shipping_phone,
				shippingEmail: data.shipping_email,
				shippingLine1: data.shipping_line1,
				shippingLine2: data.shipping_line2,
				shippingCity: data.shipping_city,
				shippingState: data.shipping_state,
				shippingPincode: data.shipping_pincode,
				shippingAddress: data.shipping_address,
				updatedAt: data.updated_at
			}
		});
	} catch (error) {
		next(error);
	}
});

app.use(
	(error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		if (error instanceof z.ZodError) {
			res.status(400).json({ error: 'Invalid request', issues: error.issues });
			return;
		}
		if (error instanceof HttpError) {
			res.status(error.statusCode).json({ error: error.message });
			return;
		}
		const message = error instanceof Error ? error.message : 'Unknown server error';
		res.status(500).json({ error: message });
	}
);

app.listen(config.port, () => {
	console.log(`LapKart API listening on ${config.port}`);
});
