import type { Component } from 'svelte';
import type { AppRole } from '$lib/roles';

export type AdminIcon = Component<Record<string, unknown>>;

export type AdminView = 'overview' | 'catalog' | 'operations' | 'users' | 'promos' | 'support';

export type OperationsSection = 'orders' | 'fulfillment' | 'returns';

export type Notice = {
	tone: 'error' | 'success' | 'info';
	text: string;
};

export type AdminRequestIssue = {
	path?: Array<string | number>;
	message?: string;
};

export type AdminErrorBody = {
	error?: string;
	issues?: AdminRequestIssue[];
};

export type AdminAnalytics = {
	orders: number;
	products: number;
	users: number;
	revenue: number;
	deliveredOrders: number;
	pendingFulfillment: number;
	ordersAwaitingConfirmation: number;
	pickupsPending: number;
	lowStock: number;
	openSupport: number;
	estimatedNetMargin: number;
	productCost: number;
	highRiskOrders: number;
	periodReports: Array<{
		id: 'daily' | 'weekly' | 'monthly';
		label: string;
		orders: number;
		revenue: number;
		averageOrderValue: number;
		cancellations: number;
		returns: number;
		refunds: number;
		refundAmount: number;
	}>;
	cancellationReport: {
		total: number;
		pending: number;
		approved: number;
		rejected: number;
		refunded: number;
		cancelledOrders: number;
		latest: Array<{
			id: string;
			orderId: string;
			status: string;
			reason: string | null;
			requestedAt: string;
		}>;
	};
	monthlySeries: Array<{
		month: string;
		orders: number;
		revenue: number;
	}>;
	recentOrders: Array<{
		id: string;
		createdAt: string;
		total: number;
		status: string;
		shippingName: string | null;
	}>;
};

export type AdminProduct = {
	id: string;
	title: string;
	brand: string;
	category: string;
	description: string | null;
	image: string;
	images: string[] | null;
	price: number;
	mrp: number;
	stock: number;
	status: string;
	sku: string | null;
	source_url: string | null;
	compatibility: string | null;
	warranty: string | null;
	highlights: string[] | null;
	search_keywords: string[] | null;
	weight_kg: number | null;
	length_cm: number | null;
	breadth_cm: number | null;
	height_cm: number | null;
	authenticity_grade: 'oem' | 'compatible' | 'refurbished' | 'open_box' | null;
	condition_grade: 'new' | 'open_box' | 'refurbished' | 'used' | null;
	hsn_code: string | null;
	gst_rate: number | null;
	doa_policy_days: number | null;
	local_delivery_eligible: boolean | null;
	cod_eligible: boolean | null;
	cost_price: number | null;
	selling_price: number | null;
	max_discount_pct: number | null;
	cod_allowed: boolean | null;
	returnable: boolean | null;
	is_universal: boolean | null;
	created_at: string | null;
	updated_at: string | null;
};

export type ProductEditorState = {
	id: string | null;
	title: string;
	brand: string;
	category: string;
	description: string;
	image: string;
	imagesText: string;
	price: string;
	costPrice: string;
	maxDiscountPct: string;
	mrp: string;
	stock: string;
	status: 'active' | 'draft' | 'archived';
	sku: string;
	sourceUrl: string;
	compatibility: string;
	warranty: string;
	highlightsText: string;
	searchKeywordsText: string;
	weightKg: string;
	lengthCm: string;
	breadthCm: string;
	heightCm: string;
	authenticityGrade: 'oem' | 'compatible' | 'refurbished' | 'open_box';
	conditionGrade: 'new' | 'open_box' | 'refurbished' | 'used';
	hsnCode: string;
	gstRate: string;
	doaPolicyDays: string;
	localDeliveryEligible: boolean;
	codEligible: boolean;
	codAllowed: boolean;
	returnable: boolean;
	isUniversal: boolean;
	createdAt: string | null;
	updatedAt: string | null;
};

export type ProductStatus = ProductEditorState['status'];
export type ProductStatusFilter = '' | ProductStatus;
export type ProductStockFilter = '' | 'in-stock' | 'low-stock' | 'out-of-stock';
export type ProductQualityFilter =
	| ''
	| 'missing-image'
	| 'missing-sku'
	| 'missing-warranty'
	| 'missing-compatibility';
export type ProductSort =
	| 'updated-desc'
	| 'price-asc'
	| 'price-desc'
	| 'stock-asc'
	| 'stock-desc'
	| 'title-asc';
export type BulkBoolean = '' | 'true' | 'false';

export type BulkProductEditorState = {
	price: string;
	mrp: string;
	stock: string;
	status: ProductStatusFilter;
	category: string;
	warranty: string;
	compatibility: string;
	localDeliveryEligible: BulkBoolean;
	codAllowed: BulkBoolean;
	returnable: BulkBoolean;
};

export type SheetColumnKey =
	| 'title'
	| 'brand'
	| 'sku'
	| 'category'
	| 'price'
	| 'mrp'
	| 'stock'
	| 'status'
	| 'warranty'
	| 'compatibility';
export type SheetColumnKind = 'text' | 'number' | 'select';
export type SheetColumn = {
	key: SheetColumnKey;
	label: string;
	kind: SheetColumnKind;
	width: string;
};
export type SheetCell = {
	productId: string;
	key: SheetColumnKey;
};
export type SheetMode = 'visible' | 'all';
export type SheetSortDirection = 'asc' | 'desc';
export type SheetProgress = {
	loaded: number;
	total: number;
};

export type AdminUserRecord = {
	id: string;
	email: string | null;
	createdAt: string | null;
	lastSignInAt: string | null;
	role: AppRole;
	fullName: string | null;
	phone: string | null;
	orderCount: number;
	totalSpent: number;
};

export type UserEditorState = {
	id: string | null;
	role: AppRole;
	fullName: string;
	phone: string;
};

export type AdminCoupon = {
	id: string;
	code: string;
	description: string | null;
	discountType: 'percent' | 'fixed' | 'free_delivery';
	discountValue: number;
	minimumSubtotal: number;
	firstOrderOnly?: boolean;
	applicableCategories?: string[] | null;
	allowedPincodePrefix?: string | null;
	maxDiscount: number | null;
	startsAt: string | null;
	endsAt: string | null;
	usageLimit: number | null;
	perUserLimit: number;
	usedCount: number;
	discountGiven: number;
	active: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CouponEditorState = {
	id: string | null;
	code: string;
	description: string;
	discountType: AdminCoupon['discountType'];
	discountValue: string;
	minimumSubtotal: string;
	maxDiscount: string;
	usageLimit: string;
	perUserLimit: string;
	active: boolean;
	firstOrderOnly: boolean;
	allowedPincodePrefix: string;
	applicableCategories: string[];
	startsAt: string;
	endsAt: string;
};
