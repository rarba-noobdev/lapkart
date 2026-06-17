<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminCommandPalette from '$lib/components/admin/AdminCommandPalette.svelte';
	import AdminSupportManager from '$lib/components/admin/AdminSupportManager.svelte';
	import AdminGrievanceManager from '$lib/components/admin/AdminGrievanceManager.svelte';
	import AdminPromotionsManager from '$lib/components/admin/AdminPromotionsManager.svelte';
	import AdminOperationsPanel from '$lib/components/admin/AdminOperationsPanel.svelte';
	import AdminOverviewPanel from '$lib/components/admin/AdminOverviewPanel.svelte';
	import { uploadAdminImage, type AdminOrderRecord } from '$lib/admin';
	import { apiBase } from '$lib/api-base';
	import { allCategories, formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import { nativeImpact, pickImageFile } from '$lib/native/capacitor';
	import { isStaffRole, roleLabel, staffRoles, type AppRole } from '$lib/roles';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
	import {
		Activity,
		ArrowUpRight,
		Bell,
		Boxes,
		Check,
		Filter,
		Flame,
		LayoutDashboard,
		LifeBuoy,
		Minimize2,
		Package,
		ImagePlus,
		Pencil,
		Plus,
		RotateCcw,
		Save,
		Search,
		ShieldAlert,
		Tag,
		Table2,
		Trash2,
		TrendingUp,
		Truck,
		Users,
		X
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	type AdminView = 'overview' | 'catalog' | 'operations' | 'users' | 'promos' | 'support';

	type OperationsSection = 'orders' | 'fulfillment' | 'returns';

	type Notice = {
		tone: 'error' | 'success' | 'info';
		text: string;
	};

	type AdminRequestIssue = {
		path?: Array<string | number>;
		message?: string;
	};

	type AdminErrorBody = {
		error?: string;
		issues?: AdminRequestIssue[];
	};

	type AdminAnalytics = {
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

	type AdminProduct = {
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

	type ProductEditorState = {
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

	type ProductStatus = ProductEditorState['status'];
	type ProductStatusFilter = '' | ProductStatus;
	type ProductStockFilter = '' | 'in-stock' | 'low-stock' | 'out-of-stock';
	type ProductQualityFilter =
		| ''
		| 'missing-image'
		| 'missing-sku'
		| 'missing-warranty'
		| 'missing-compatibility';
	type ProductSort =
		| 'updated-desc'
		| 'price-asc'
		| 'price-desc'
		| 'stock-asc'
		| 'stock-desc'
		| 'title-asc';
	type BulkBoolean = '' | 'true' | 'false';

	type BulkProductEditorState = {
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

	type SheetColumnKey =
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
	type SheetColumnKind = 'text' | 'number' | 'select';
	type SheetColumn = {
		key: SheetColumnKey;
		label: string;
		kind: SheetColumnKind;
		width: string;
	};
	type SheetCell = {
		productId: string;
		key: SheetColumnKey;
	};
	type SheetMode = 'visible' | 'all';
	type SheetSortDirection = 'asc' | 'desc';
	type SheetProgress = {
		loaded: number;
		total: number;
	};

	type AdminUserRecord = {
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

	type UserEditorState = {
		id: string | null;
		role: AppRole;
		fullName: string;
		phone: string;
	};

	type AdminCoupon = {
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
		active: boolean;
		createdAt: string;
		updatedAt: string;
		usedCount: number;
		discountGiven: number;
	};

	type CouponEditorState = {
		id: string | null;
		code: string;
		description: string;
		discountType: 'percent' | 'fixed' | 'free_delivery';
		discountValue: string;
		minimumSubtotal: string;
		maxDiscount: string;
		startsAt: string;
		endsAt: string;
		usageLimit: string;
		perUserLimit: string;
		firstOrderOnly: boolean;
		applicableCategories: string[];
		allowedPincodePrefix: string;
		active: boolean;
	};

	const tabs: Array<{ id: AdminView; label: string; icon: typeof LayoutDashboard }> = [
		{ id: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ id: 'operations', label: 'Fulfillment', icon: Truck },
		{ id: 'catalog', label: 'Catalog', icon: Boxes },
		{ id: 'users', label: 'Users', icon: Users },
		{ id: 'promos', label: 'Promos', icon: Tag },
		{ id: 'support', label: 'Support', icon: LifeBuoy }
	];

	const navGroups: Array<{ label: string; ids: AdminView[] }> = [
		{ label: 'Monitor', ids: ['overview'] },
		{ label: 'Commerce', ids: ['operations', 'catalog', 'promos'] },
		{ label: 'People', ids: ['users', 'support'] }
	];

	const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
	const tabHint = (id: AdminView) => String(tabs.findIndex((tab) => tab.id === id) + 1);

	const viewDescriptions: Record<AdminView, string> = {
		overview: 'Store health, revenue, and what needs attention',
		operations: 'Orders, dispatch, returns, and refunds',
		catalog: 'Products, pricing, stock, and catalog search',
		users: 'Customer accounts and staff roles',
		promos: 'Coupons and discounts',
		support: 'Complaints, deletion requests, and product Q&A'
	};

	const operationsSections: Array<{
		id: OperationsSection;
		label: string;
		icon: typeof LayoutDashboard;
	}> = [
		{ id: 'orders', label: 'Orders', icon: Package },
		{ id: 'fulfillment', label: 'Dispatch', icon: Truck },
		{ id: 'returns', label: 'Returns', icon: RotateCcw }
	];

	const overviewIcons: Record<string, typeof TrendingUp> = {
		orders: Package,
		products: Boxes,
		users: Users,
		revenue: TrendingUp,
		margin: TrendingUp
	};

	const categoryOptions = allCategories.map((category) => ({
		value: category.slug,
		label: category.name
	}));
	const productStatusOptions: Array<{ value: ProductStatus; label: string }> = [
		{ value: 'active', label: 'Active' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'archived', label: 'Archived' }
	];
	const productSortOptions: Array<{ value: ProductSort; label: string }> = [
		{ value: 'updated-desc', label: 'Recently updated' },
		{ value: 'title-asc', label: 'Title A-Z' },
		{ value: 'price-asc', label: 'Price low-high' },
		{ value: 'price-desc', label: 'Price high-low' },
		{ value: 'stock-asc', label: 'Low stock first' },
		{ value: 'stock-desc', label: 'High stock first' }
	];
	const productStockFilterOptions: Array<{ value: ProductStockFilter; label: string }> = [
		{ value: '', label: 'Any stock' },
		{ value: 'in-stock', label: 'In stock' },
		{ value: 'low-stock', label: 'Low stock' },
		{ value: 'out-of-stock', label: 'Out of stock' }
	];
	const productQualityFilterOptions: Array<{ value: ProductQualityFilter; label: string }> = [
		{ value: '', label: 'All records' },
		{ value: 'missing-image', label: 'Missing image' },
		{ value: 'missing-sku', label: 'Missing SKU' },
		{ value: 'missing-warranty', label: 'Missing warranty' },
		{ value: 'missing-compatibility', label: 'Missing compatibility' }
	];
	const sheetColumns: SheetColumn[] = [
		{ key: 'title', label: 'Title', kind: 'text', width: '360px' },
		{ key: 'brand', label: 'Brand', kind: 'text', width: '140px' },
		{ key: 'sku', label: 'SKU', kind: 'text', width: '160px' },
		{ key: 'category', label: 'Category', kind: 'select', width: '160px' },
		{ key: 'price', label: 'Selling price', kind: 'number', width: '120px' },
		{ key: 'mrp', label: 'MRP', kind: 'number', width: '110px' },
		{ key: 'stock', label: 'Stock', kind: 'number', width: '90px' },
		{ key: 'status', label: 'Status', kind: 'select', width: '120px' },
		{ key: 'warranty', label: 'Warranty', kind: 'text', width: '190px' },
		{ key: 'compatibility', label: 'Compatibility', kind: 'text', width: '460px' }
	];
	const defaultCategory = categoryOptions[0]?.value ?? '';
	const categoryNameBySlug = new Map(
		allCategories.map((category) => [category.slug, category.name])
	);
	const currentUser = $derived(page.data.user ?? null);
	const currentRole = $derived(page.data.role ?? null);
	const auth = getAuthContext();
	const initialProductSearch = page.url.searchParams.get('q')?.trim() ?? '';

	let booting = $state(true);
	let loading = $state(false);
	let initializedForUserId: string | null = null;
	const initialView = viewFromSearch(page.url.searchParams.get('section'));
	let view = $state<AdminView>(initialView);
	let prevView = $state<AdminView>(initialView);
	let operationsSection = $state<OperationsSection>('orders');
	let ordersInitialFilter = $state<string | null>(null);
	let ordersInitialSearch = $state<string | null>(null);
	let ordersInitialSelectId = $state<string | null>(null);
	let paletteOpen = $state(false);
	let notifOpen = $state(false);
	let mountedViews = $state<AdminView[]>(
		initialView === 'overview' ? ['overview'] : ['overview', initialView]
	);
	let realtimeRefreshTimer: number | null = null;
	let pendingRealtimeRefresh = {
		analytics: false,
		products: false,
		users: false,
		coupons: false
	};
	let productsLoaded = $state(false);
	let usersLoaded = $state(false);
	let couponsLoaded = $state(false);
	let productsLoading = $state(false);
	let usersLoading = $state(false);
	let couponsLoading = $state(false);

	let analytics = $state<AdminAnalytics | null>(null);
	let products = $state<AdminProduct[]>([]);
	let users = $state<AdminUserRecord[]>([]);
	let coupons = $state<AdminCoupon[]>([]);

	let overviewError = $state<string | null>(null);
	let productsError = $state<string | null>(null);
	let usersError = $state<string | null>(null);
	let couponsError = $state<string | null>(null);

	let productSearch = $state(initialProductSearch);
	let productCategoryFilter = $state('');
	let productStatusFilter = $state<ProductStatusFilter>('');
	let productStockFilter = $state<ProductStockFilter>('');
	let productQualityFilter = $state<ProductQualityFilter>('');
	let productSort = $state<ProductSort>('updated-desc');
	let productPage = $state(1);
	let productTotal = $state(0);
	let productTotalPages = $state(1);
	let productSearchTimer: number | null = null;
	const PRODUCT_PAGE_SIZE = 60;
	const SHEET_ALL_PAGE_SIZE = 100;
	let selectedProductId = $state<string | 'new' | null>(null);
	let productEditor = $state<ProductEditorState>(emptyProductEditor());
	let productSaving = $state(false);
	let productImageUploading = $state(false);
	let productImageUploadError = $state('');
	let productDeleting = $state(false);
	let productNotice = $state<Notice | null>(null);
	let drawerOpen = $state(false);
	let rowDeletingId = $state<string | null>(null);
	let selectedProductIds = $state<string[]>([]);
	let bulkEditor = $state<BulkProductEditorState>(emptyBulkProductEditor());
	let bulkSaving = $state(false);
	let bulkNotice = $state<Notice | null>(null);
	let spreadsheetOpen = $state(true);
	let sheetFullscreen = $state(false);
	let sheetMode = $state<SheetMode>('visible');
	let sheetProducts = $state.raw<AdminProduct[]>([]);
	let sheetAllProductsLoading = $state(false);
	let sheetAllProgress = $state<SheetProgress>({ loaded: 0, total: 0 });
	let sheetNextPage = $state(1);
	let sheetTotalPages = $state(1);
	let sheetFilterSignature = $state('');
	let sheetFrameElement = $state<HTMLDivElement | null>(null);
	let sheetLoadMoreError = $state<string | null>(null);
	let sheetSortKey = $state<SheetColumnKey | null>(null);
	let sheetSortDirection = $state<SheetSortDirection>('asc');
	let sheetDrafts = $state<Record<string, Partial<Record<SheetColumnKey, string>>>>({});
	let activeSheetCell = $state<SheetCell | null>(null);
	let sheetSaving = $state(false);
	let sheetNotice = $state<Notice | null>(null);
	let timelineNow = $state(Date.now());
	const sheetSourceProducts = $derived(sheetMode === 'all' ? sheetProducts : products);
	const sheetRows = $derived.by(() => {
		const rows = sheetSourceProducts;
		if (!sheetSortKey) return rows;
		return [...rows].sort((left, right) => compareSheetProducts(left, right));
	});
	const selectedSheetProducts = $derived(
		sheetRows.filter((product) => selectedProductIds.includes(product.id))
	);
	const selectedProducts = $derived(
		products.filter((product) => selectedProductIds.includes(product.id))
	);
	const allVisibleProductsSelected = $derived(
		products.length > 0 && products.every((product) => selectedProductIds.includes(product.id))
	);
	const activeCatalogFilterCount = $derived(
		[
			productSearch.trim(),
			productCategoryFilter,
			productStatusFilter,
			productStockFilter,
			productQualityFilter
		].filter(Boolean).length
	);
	const dirtySheetProducts = $derived(sheetRows.filter((product) => sheetRowDirty(product)));
	const dirtySheetCellCount = $derived(
		sheetRows.reduce((count, product) => {
			return count + sheetColumns.filter((column) => sheetCellDirty(product, column.key)).length;
		}, 0)
	);
	const activeSheetProduct = $derived.by(() => {
		const cell = activeSheetCell;
		return cell ? (sheetRows.find((product) => product.id === cell.productId) ?? null) : null;
	});
	const activeSheetColumnIndex = $derived.by(() => {
		const cell = activeSheetCell;
		return cell ? sheetColumns.findIndex((column) => column.key === cell.key) : -1;
	});
	const activeSheetColumn = $derived(
		activeSheetColumnIndex >= 0 ? sheetColumns[activeSheetColumnIndex] : null
	);
	const activeSheetRowIndex = $derived(
		activeSheetProduct ? sheetRows.findIndex((product) => product.id === activeSheetProduct.id) : -1
	);
	const activeSheetAddress = $derived(
		activeSheetRowIndex >= 0 && activeSheetColumnIndex >= 0
			? `${sheetColumnLabel(activeSheetColumnIndex)}${activeSheetRowIndex + 1}`
			: '-'
	);
	const activeSheetValue = $derived(
		activeSheetProduct && activeSheetCell
			? sheetCellValue(activeSheetProduct, activeSheetCell.key)
			: ''
	);
	const sheetFillTargetCount = $derived(
		activeSheetProduct
			? selectedSheetProducts.filter((product) => product.id !== activeSheetProduct.id).length
			: 0
	);
	const sheetCanLoadMore = $derived(
		sheetMode === 'all' &&
			sheetNextPage <= sheetTotalPages &&
			sheetProducts.length < Math.max(sheetAllProgress.total, sheetProducts.length)
	);
	const productKeywordCount = $derived(
		parseSearchKeywords(productEditor.searchKeywordsText).length
	);
	const productKeywordOverflowCount = $derived(
		Math.max(0, parseLines(productEditor.searchKeywordsText).length - 24)
	);

	$effect(() => {
		if (!sheetFullscreen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	let userSearch = $state('');
	let selectedUserId = $state<string | null>(null);
	let userEditor = $state<UserEditorState>(emptyUserEditor());
	let userSaving = $state(false);
	let userNotice = $state<Notice | null>(null);

	let selectedCouponId = $state<string | 'new' | null>(null);
	let couponEditor = $state<CouponEditorState>(emptyCouponEditor());
	let couponSaving = $state(false);
	let couponDeleting = $state(false);
	let couponNotice = $state<Notice | null>(null);

	const flyDirection = $derived.by(() => {
		const currentIdx = tabs.findIndex((t) => t.id === view);
		const prevIdx = tabs.findIndex((t) => t.id === prevView);
		return currentIdx >= prevIdx ? 1 : -1;
	});

	const filteredUsers = $derived.by(() =>
		users.filter((user) =>
			`${user.email ?? ''} ${user.fullName ?? ''} ${user.phone ?? ''}`
				.toLowerCase()
				.includes(userSearch.toLowerCase())
		)
	);

	const selectedUser = $derived(users.find((user) => user.id === selectedUserId) ?? null);
	const selectedUserPhoneLocked = $derived(Boolean(selectedUser && selectedUser.orderCount > 0));
	const selectedUserIsCurrentAdmin = $derived(
		Boolean(selectedUser && selectedUser.id === currentUser?.id)
	);

	const selectedCoupon = $derived(
		typeof selectedCouponId === 'string' && selectedCouponId !== 'new'
			? (coupons.find((coupon) => coupon.id === selectedCouponId) ?? null)
			: null
	);
	const overviewCards = $derived([
		{ id: 'orders', label: 'Total Orders', value: analytics?.orders ?? 0 },
		{ id: 'products', label: 'Products', value: analytics?.products ?? 0 },
		{ id: 'users', label: 'Customers', value: analytics?.users ?? 0 },
		{ id: 'revenue', label: 'Revenue', value: formatINR(analytics?.revenue ?? 0) },
		{ id: 'margin', label: 'Est. net margin', value: formatINR(analytics?.estimatedNetMargin ?? 0) }
	]);

	const maxMonthlyRevenue = $derived(
		Math.max(...(analytics?.monthlySeries ?? []).map((m) => m.revenue), 1)
	);

	const needsActionCards = $derived(
		[
			{
				id: 'confirm',
				label: 'Orders to confirm',
				count: analytics?.ordersAwaitingConfirmation ?? 0,
				hint: 'Awaiting confirmation',
				action: () => openOperations('orders', 'needs-action')
			},
			{
				id: 'pickups',
				label: 'Pickups pending',
				count: analytics?.pickupsPending ?? 0,
				hint: 'AWB assigned, not picked up',
				action: () => openOperations('fulfillment')
			},
			{
				id: 'cancellations',
				label: 'Cancellations to review',
				count: analytics?.cancellationReport.pending ?? 0,
				hint: 'Pending approval',
				action: () => openOperations('orders', 'needs-action')
			},
			{
				id: 'stock',
				label: 'Low stock',
				count: analytics?.lowStock ?? 0,
				hint: '5 units or fewer',
				action: () => setView('catalog')
			},
			{
				id: 'support',
				label: 'Open support',
				count: analytics?.openSupport ?? 0,
				hint: 'Unanswered questions',
				action: () => setView('support')
			},
			{
				id: 'rto',
				label: 'High RTO risk',
				count: analytics?.highRiskOrders ?? 0,
				hint: 'Review before dispatch',
				action: () => openOperations('orders', 'needs-action')
			}
		].filter((card) => card.count > 0)
	);

	const notifCount = $derived(needsActionCards.reduce((sum, card) => sum + card.count, 0));

	type AdminNotification = {
		id: string;
		category: string;
		severity: string;
		title: string;
		body: string | null;
		order_id: string | null;
		entity_type: string | null;
		entity_id: string | null;
		action_url: string | null;
		created_at: string;
	};

	let persistentNotifs = $state<AdminNotification[]>([]);
	let notifReadIds = $state<Set<string>>(new Set());
	let notifLoading = $state(false);

	const persistentUnread = $derived(
		persistentNotifs.filter((notification) => !notifReadIds.has(notification.id)).length
	);
	const notifTotal = $derived(persistentUnread + notifCount);

	async function loadNotifications() {
		if (!currentUser) return;
		notifLoading = true;
		try {
			const [rowsResult, readsResult] = await Promise.all([
				auth.supabase
					.from('admin_notifications')
					.select(
						'id,category,severity,title,body,order_id,entity_type,entity_id,action_url,created_at'
					)
					.order('created_at', { ascending: false })
					.limit(40),
				auth.supabase
					.from('admin_notification_reads')
					.select('notification_id')
					.eq('user_id', currentUser.id)
			]);
			persistentNotifs = (rowsResult.data as AdminNotification[] | null) ?? [];
			notifReadIds = new Set((readsResult.data ?? []).map((row) => row.notification_id));
		} catch {
			// Feed is best-effort; the derived needs-action signals remain as fallback.
		} finally {
			notifLoading = false;
		}
	}

	function handleIncomingNotification(row: AdminNotification) {
		if (persistentNotifs.some((notification) => notification.id === row.id)) return;
		persistentNotifs = [row, ...persistentNotifs].slice(0, 60);
	}

	async function markNotificationRead(notification: AdminNotification) {
		if (!currentUser || notifReadIds.has(notification.id)) return;
		const next = new Set(notifReadIds);
		next.add(notification.id);
		notifReadIds = next;
		await auth.supabase
			.from('admin_notification_reads')
			.upsert({ notification_id: notification.id, user_id: currentUser.id })
			.then(
				() => undefined,
				() => undefined
			);
	}

	async function markAllNotificationsRead() {
		if (!currentUser) return;
		const unread = persistentNotifs.filter((notification) => !notifReadIds.has(notification.id));
		if (!unread.length) return;
		const next = new Set(notifReadIds);
		for (const notification of unread) next.add(notification.id);
		notifReadIds = next;
		await auth.supabase
			.from('admin_notification_reads')
			.upsert(
				unread.map((notification) => ({
					notification_id: notification.id,
					user_id: currentUser.id
				}))
			)
			.then(
				() => undefined,
				() => undefined
			);
	}

	function openNotification(notification: AdminNotification) {
		notifOpen = false;
		void markNotificationRead(notification);
		if (notification.order_id) {
			ordersInitialFilter = null;
			ordersInitialSearch = '';
			ordersInitialSelectId = notification.order_id;
			operationsSection = notification.category === 'return' ? 'returns' : 'orders';
			setView('operations');
			return;
		}
		switch (notification.category) {
			case 'return':
				openOperations('returns');
				break;
			case 'fulfillment':
				openOperations('fulfillment');
				break;
			case 'order':
			case 'cancellation':
			case 'refund':
				openOperations('orders');
				break;
			case 'stock':
				setView('catalog');
				break;
			case 'support':
				setView('support');
				break;
			default:
				setView('overview');
		}
	}

	function runNotification(action: () => void) {
		notifOpen = false;
		action();
	}

	function emptyProductEditor(): ProductEditorState {
		return {
			id: null,
			title: '',
			brand: '',
			category: defaultCategory,
			description: '',
			image: '',
			imagesText: '',
			price: '',
			costPrice: '',
			maxDiscountPct: '0',
			mrp: '',
			stock: '0',
			status: 'draft',
			sku: '',
			sourceUrl: '',
			compatibility: '',
			warranty: '',
			highlightsText: '',
			searchKeywordsText: '',
			weightKg: '',
			lengthCm: '',
			breadthCm: '',
			heightCm: '',
			authenticityGrade: 'compatible',
			conditionGrade: 'new',
			hsnCode: '',
			gstRate: '18',
			doaPolicyDays: '7',
			localDeliveryEligible: true,
			codEligible: true,
			codAllowed: true,
			returnable: true,
			isUniversal: false,
			createdAt: null,
			updatedAt: null
		};
	}

	function emptyBulkProductEditor(): BulkProductEditorState {
		return {
			price: '',
			mrp: '',
			stock: '',
			status: '',
			category: '',
			warranty: '',
			compatibility: '',
			localDeliveryEligible: '',
			codAllowed: '',
			returnable: ''
		};
	}

	function normalizeProductStatus(status: string): ProductEditorState['status'] {
		if (status === 'active' || status === 'draft' || status === 'archived') return status;
		return 'active';
	}

	function mapProductToEditor(product: AdminProduct): ProductEditorState {
		return {
			id: product.id,
			title: product.title,
			brand: product.brand,
			category: categoryNameBySlug.has(product.category) ? product.category : defaultCategory,
			description: product.description ?? '',
			image: product.image,
			imagesText: (product.images ?? []).join('\n'),
			price: String(Number(product.selling_price ?? product.price ?? 0)),
			costPrice: String(Number(product.cost_price ?? 0)),
			maxDiscountPct: String(Number(product.max_discount_pct ?? 0)),
			mrp: String(Number(product.mrp ?? 0)),
			stock: String(Number(product.stock ?? 0)),
			status: normalizeProductStatus(product.status),
			sku: product.sku ?? '',
			sourceUrl: product.source_url ?? '',
			compatibility: product.compatibility ?? '',
			warranty: product.warranty ?? '',
			highlightsText: (product.highlights ?? []).join('\n'),
			searchKeywordsText: (product.search_keywords ?? []).join('\n'),
			weightKg: product.weight_kg === null ? '' : String(product.weight_kg),
			lengthCm: product.length_cm === null ? '' : String(product.length_cm),
			breadthCm: product.breadth_cm === null ? '' : String(product.breadth_cm),
			heightCm: product.height_cm === null ? '' : String(product.height_cm),
			authenticityGrade: product.authenticity_grade ?? 'compatible',
			conditionGrade: product.condition_grade ?? 'new',
			hsnCode: product.hsn_code ?? '',
			gstRate: product.gst_rate === null ? '18' : String(product.gst_rate),
			doaPolicyDays: product.doa_policy_days === null ? '7' : String(product.doa_policy_days),
			localDeliveryEligible: product.local_delivery_eligible !== false,
			codEligible: product.cod_eligible !== false,
			codAllowed: product.cod_allowed !== false,
			returnable: product.returnable !== false,
			isUniversal: product.is_universal === true,
			createdAt: product.created_at ?? null,
			updatedAt: product.updated_at ?? null
		};
	}

	function emptyUserEditor(): UserEditorState {
		return { id: null, role: 'user', fullName: '', phone: '' };
	}

	function mapUserToEditor(user: AdminUserRecord): UserEditorState {
		return {
			id: user.id,
			role: user.role,
			fullName: user.fullName ?? '',
			phone: user.phone ?? ''
		};
	}

	function emptyCouponEditor(): CouponEditorState {
		return {
			id: null,
			code: '',
			description: '',
			discountType: 'percent',
			discountValue: '',
			minimumSubtotal: '0',
			maxDiscount: '',
			startsAt: '',
			endsAt: '',
			usageLimit: '',
			perUserLimit: '1',
			firstOrderOnly: false,
			applicableCategories: [],
			allowedPincodePrefix: '',
			active: true
		};
	}

	function mapCouponToEditor(coupon: AdminCoupon): CouponEditorState {
		return {
			id: coupon.id,
			code: coupon.code,
			description: coupon.description ?? '',
			discountType: coupon.discountType,
			discountValue: String(coupon.discountValue),
			minimumSubtotal: String(coupon.minimumSubtotal),
			maxDiscount: coupon.maxDiscount === null ? '' : String(coupon.maxDiscount),
			startsAt: toDateTimeInput(coupon.startsAt),
			endsAt: toDateTimeInput(coupon.endsAt),
			usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
			perUserLimit: String(coupon.perUserLimit),
			firstOrderOnly: coupon.firstOrderOnly ?? false,
			applicableCategories: coupon.applicableCategories ?? [],
			allowedPincodePrefix: coupon.allowedPincodePrefix ?? '',
			active: coupon.active
		};
	}

	function parseLines(input: string) {
		return input
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	}

	function parseSearchKeywords(input: string) {
		const seen = new Set<string>();
		const keywords: string[] = [];
		for (const line of parseLines(input)) {
			const keyword = line.slice(0, 80);
			const key = keyword.toLocaleLowerCase('en-IN');
			if (seen.has(key)) continue;
			seen.add(key);
			keywords.push(keyword);
			if (keywords.length >= 24) break;
		}
		return keywords;
	}

	function normalizeAdminNumberText(input: string) {
		return input.trim().replace(/[\u20b9,\s]/gi, '');
	}

	function payloadNumber(input: string, label = 'Value') {
		const value = normalizeAdminNumberText(input);
		if (!value) return null;
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number.`);
		return parsed;
	}

	function requiredPayloadNumber(input: string, label: string, integer = false) {
		const parsed = payloadNumber(input, label);
		if (parsed === null) throw new Error(`${label} cannot be empty.`);
		if (parsed < 0 || (integer && !Number.isInteger(parsed))) {
			throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'}.`);
		}
		return parsed;
	}

	function optionalNonnegativePayloadNumber(input: string, label: string, integer = false) {
		const parsed = payloadNumber(input, label);
		if (parsed === null) return null;
		if (parsed < 0 || (integer && !Number.isInteger(parsed))) {
			throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'}.`);
		}
		return parsed;
	}

	function optionalPositivePayloadNumber(input: string, label: string) {
		const parsed = payloadNumber(input, label);
		if (parsed === null || parsed === 0) return null;
		if (parsed < 0) throw new Error(`${label} must be greater than 0.`);
		return parsed;
	}

	function optionalBulkNumber(input: string, label: string, integer = false) {
		const value = input.trim();
		if (!value) return null;

		const parsed = Number(normalizeAdminNumberText(value));
		if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
			throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'}.`);
		}

		return parsed;
	}

	function bulkBoolean(value: BulkBoolean) {
		if (!value) return undefined;
		return value === 'true';
	}

	function bulkProductUpdatePayload() {
		const update: Record<string, unknown> = {};
		const price = optionalBulkNumber(bulkEditor.price, 'Selling price');
		const mrp = optionalBulkNumber(bulkEditor.mrp, 'MRP');
		const stock = optionalBulkNumber(bulkEditor.stock, 'Stock', true);
		const localDeliveryEligible = bulkBoolean(bulkEditor.localDeliveryEligible);
		const codAllowed = bulkBoolean(bulkEditor.codAllowed);
		const returnable = bulkBoolean(bulkEditor.returnable);

		if (price !== null) {
			update.price = price;
			update.sellingPrice = price;
		}
		if (mrp !== null) update.mrp = mrp;
		if (stock !== null) update.stock = stock;
		if (bulkEditor.status) update.status = bulkEditor.status;
		if (bulkEditor.category) update.category = bulkEditor.category;
		if (bulkEditor.warranty.trim()) update.warranty = bulkEditor.warranty.trim();
		if (bulkEditor.compatibility.trim()) update.compatibility = bulkEditor.compatibility.trim();
		if (localDeliveryEligible !== undefined) update.localDeliveryEligible = localDeliveryEligible;
		if (codAllowed !== undefined) update.codAllowed = codAllowed;
		if (returnable !== undefined) update.returnable = returnable;

		if (Object.keys(update).length === 0) {
			throw new Error('Fill at least one bulk field before applying.');
		}

		return update;
	}

	function productSheetBaseValue(product: AdminProduct, key: SheetColumnKey) {
		if (key === 'title') return product.title;
		if (key === 'brand') return product.brand;
		if (key === 'sku') return product.sku ?? '';
		if (key === 'category') return product.category;
		if (key === 'price') return String(Number(product.selling_price ?? product.price ?? 0));
		if (key === 'mrp') return String(Number(product.mrp ?? 0));
		if (key === 'stock') return String(Number(product.stock ?? 0));
		if (key === 'status') return normalizeProductStatus(product.status);
		if (key === 'warranty') return product.warranty ?? '';
		return product.compatibility ?? '';
	}

	function sheetCellValue(product: AdminProduct, key: SheetColumnKey) {
		return sheetDrafts[product.id]?.[key] ?? productSheetBaseValue(product, key);
	}

	function sheetCellDirty(product: AdminProduct, key: SheetColumnKey) {
		return sheetCellValue(product, key) !== productSheetBaseValue(product, key);
	}

	function sheetRowDirty(product: AdminProduct) {
		return sheetColumns.some((column) => sheetCellDirty(product, column.key));
	}

	function sheetColumnOptions(column: SheetColumn) {
		if (column.key === 'category') return categoryOptions;
		if (column.key === 'status') return productStatusOptions;
		return [];
	}

	function sheetColumnLabel(index: number) {
		let value = index + 1;
		let label = '';
		while (value > 0) {
			const remainder = (value - 1) % 26;
			label = String.fromCharCode(65 + remainder) + label;
			value = Math.floor((value - 1) / 26);
		}
		return label;
	}

	function sheetColumnName(key: SheetColumnKey | null) {
		return key ? (sheetColumns.find((column) => column.key === key)?.label ?? key) : 'Manual';
	}

	function sheetSortGlyph(key: SheetColumnKey) {
		if (sheetSortKey !== key) return '↕';
		return sheetSortDirection === 'asc' ? '↑' : '↓';
	}

	function sheetSortValue(product: AdminProduct, key: SheetColumnKey) {
		const value = sheetCellValue(product, key);
		if (key === 'price' || key === 'mrp' || key === 'stock') {
			const parsed = Number(normalizeAdminNumberText(value));
			return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
		}
		if (key === 'category') return categoryNameBySlug.get(value) ?? value;
		if (key === 'status')
			return productStatusOptions.find((option) => option.value === value)?.label ?? value;
		return value.toLocaleLowerCase('en-IN');
	}

	function compareSheetProducts(left: AdminProduct, right: AdminProduct) {
		if (!sheetSortKey) return 0;
		const leftValue = sheetSortValue(left, sheetSortKey);
		const rightValue = sheetSortValue(right, sheetSortKey);
		let result =
			typeof leftValue === 'number' && typeof rightValue === 'number'
				? leftValue - rightValue
				: String(leftValue).localeCompare(String(rightValue), 'en-IN', {
						numeric: true,
						sensitivity: 'base'
					});
		if (result === 0)
			result = left.title.localeCompare(right.title, 'en-IN', { sensitivity: 'base' });
		return sheetSortDirection === 'asc' ? result : -result;
	}

	function toggleSheetSort(key: SheetColumnKey) {
		if (sheetSortKey === key) {
			sheetSortDirection = sheetSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sheetSortKey = key;
			sheetSortDirection = 'asc';
		}
	}

	function clearSheetSort() {
		sheetSortKey = null;
		sheetSortDirection = 'asc';
	}

	function applyUpdatedProducts(updatedProducts: AdminProduct[]) {
		if (updatedProducts.length === 0) return;
		const updatedById = new Map(updatedProducts.map((product) => [product.id, product]));
		products = products.map((product) => updatedById.get(product.id) ?? product);
		if (sheetProducts.length > 0) {
			sheetProducts = sheetProducts.map((product) => updatedById.get(product.id) ?? product);
		}
		if (productEditor.id && updatedById.has(productEditor.id)) {
			productEditor = mapProductToEditor(updatedById.get(productEditor.id)!);
		}
	}

	function setActiveSheetCell(product: AdminProduct, key: SheetColumnKey) {
		activeSheetCell = { productId: product.id, key };
		sheetNotice = null;
	}

	function setSheetCell(product: AdminProduct, key: SheetColumnKey, value: string) {
		const base = productSheetBaseValue(product, key);
		const currentDraft = { ...(sheetDrafts[product.id] ?? {}) };
		if (value === base) {
			delete currentDraft[key];
		} else {
			currentDraft[key] = value;
		}

		const nextDrafts = { ...sheetDrafts };
		if (Object.keys(currentDraft).length > 0) {
			nextDrafts[product.id] = currentDraft;
		} else {
			delete nextDrafts[product.id];
		}
		sheetDrafts = nextDrafts;
		sheetNotice = null;
	}

	function setActiveSheetValue(value: string) {
		if (!activeSheetProduct || !activeSheetCell) return;
		setSheetCell(
			activeSheetProduct,
			activeSheetCell.key,
			normalizeSheetPasteValue(activeSheetCell.key, value)
		);
	}

	function resetActiveSheetCell() {
		if (!activeSheetProduct || !activeSheetCell) return;
		setSheetCell(
			activeSheetProduct,
			activeSheetCell.key,
			productSheetBaseValue(activeSheetProduct, activeSheetCell.key)
		);
	}

	function clearActiveSheetCell() {
		if (!activeSheetProduct || !activeSheetCell || !activeSheetColumn) return;
		if (activeSheetColumn.kind === 'select') {
			resetActiveSheetCell();
			return;
		}
		setSheetCell(activeSheetProduct, activeSheetCell.key, '');
	}

	function resetSheetRow(productId: string) {
		const nextDrafts = { ...sheetDrafts };
		delete nextDrafts[productId];
		sheetDrafts = nextDrafts;
		sheetNotice = null;
	}

	function resetSheetDrafts() {
		sheetDrafts = {};
		activeSheetCell = null;
		sheetNotice = null;
	}

	function fillActiveCellToSelectedRows() {
		if (!activeSheetProduct || !activeSheetCell) return;
		const targets = selectedSheetProducts.filter((product) => product.id !== activeSheetProduct.id);
		if (targets.length === 0) {
			sheetNotice = {
				tone: 'error',
				text: 'Select at least one other product row before filling.'
			};
			return;
		}

		const value = sheetCellValue(activeSheetProduct, activeSheetCell.key);
		for (const product of targets) {
			setSheetCell(product, activeSheetCell.key, value);
		}
		sheetNotice = {
			tone: 'success',
			text: `Filled ${targets.length} selected row${targets.length === 1 ? '' : 's'}.`
		};
	}

	function normalizeSheetPasteValue(key: SheetColumnKey, value: string) {
		const text = value.replace(/\r/g, '').trim();
		if (key === 'category') {
			const match = categoryOptions.find(
				(option) =>
					option.value.toLowerCase() === text.toLowerCase() ||
					option.label.toLowerCase() === text.toLowerCase()
			);
			return match?.value ?? text;
		}
		if (key === 'status') {
			const match = productStatusOptions.find(
				(option) =>
					option.value.toLowerCase() === text.toLowerCase() ||
					option.label.toLowerCase() === text.toLowerCase()
			);
			return match?.value ?? text.toLowerCase();
		}
		if (key === 'price' || key === 'mrp' || key === 'stock') return normalizeAdminNumberText(text);
		return text;
	}

	function handleSheetPaste(event: ClipboardEvent, rowIndex: number, columnIndex: number) {
		const text = event.clipboardData?.getData('text/plain') ?? '';
		if (!text.includes('\t') && !text.includes('\n')) return;

		event.preventDefault();
		const rows = text.replace(/\r/g, '').split('\n').filter(Boolean);
		for (const [rowOffset, rowText] of rows.entries()) {
			const product = sheetRows[rowIndex + rowOffset];
			if (!product) break;
			const cells = rowText.split('\t');
			for (const [cellOffset, cellText] of cells.entries()) {
				const column = sheetColumns[columnIndex + cellOffset];
				if (!column) break;
				setSheetCell(product, column.key, normalizeSheetPasteValue(column.key, cellText));
			}
		}
	}

	function focusSheetCell(rowIndex: number, columnIndex: number) {
		if (sheetRows.length === 0) return;
		const nextRow = Math.min(Math.max(rowIndex, 0), sheetRows.length - 1);
		const nextColumn = Math.min(Math.max(columnIndex, 0), sheetColumns.length - 1);
		requestAnimationFrame(() => {
			const target = document.querySelector<HTMLElement>(
				`[data-sheet-row="${nextRow}"][data-sheet-col="${nextColumn}"]`
			);
			target?.focus();
			if (target instanceof HTMLInputElement) target.select();
		});
	}

	function shouldMoveHorizontal(event: KeyboardEvent, direction: -1 | 1) {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) return true;
		const start = target.selectionStart ?? 0;
		const end = target.selectionEnd ?? 0;
		if (start !== end) return false;
		return direction < 0 ? start === 0 : end === target.value.length;
	}

	function handleSheetCellKeydown(event: KeyboardEvent, rowIndex: number, columnIndex: number) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			fillActiveCellToSelectedRows();
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			resetActiveSheetCell();
			focusSheetCell(rowIndex, columnIndex);
			return;
		}

		if (event.key === 'Tab') {
			event.preventDefault();
			focusSheetCell(rowIndex, columnIndex + (event.shiftKey ? -1 : 1));
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			focusSheetCell(rowIndex + (event.shiftKey ? -1 : 1), columnIndex);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			focusSheetCell(rowIndex - 1, columnIndex);
			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			focusSheetCell(rowIndex + 1, columnIndex);
			return;
		}

		if (event.key === 'ArrowLeft' && shouldMoveHorizontal(event, -1)) {
			event.preventDefault();
			focusSheetCell(rowIndex, columnIndex - 1);
			return;
		}

		if (event.key === 'ArrowRight' && shouldMoveHorizontal(event, 1)) {
			event.preventDefault();
			focusSheetCell(rowIndex, columnIndex + 1);
		}
	}

	function sheetNumber(input: string, label: string, integer = false) {
		const value = normalizeAdminNumberText(input);
		if (!value) throw new Error(`${label} cannot be empty.`);
		const parsed = Number(value);
		if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
			throw new Error(`${label} must be a valid ${integer ? 'whole number' : 'amount'}.`);
		}
		return parsed;
	}

	function sheetText(input: string, label: string, min: number, max: number) {
		const value = input.trim();
		if (value.length < min) throw new Error(`${label} must be at least ${min} characters.`);
		if (value.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
		return value;
	}

	function sheetOptionalText(input: string, label: string, max: number) {
		const value = input.trim();
		if (value.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
		return value;
	}

	function sheetPayloadFromDraft(product: AdminProduct) {
		const payload: Record<string, unknown> = {};

		for (const column of sheetColumns) {
			if (!sheetCellDirty(product, column.key)) continue;
			const value = sheetCellValue(product, column.key);

			if (column.key === 'title') payload.title = sheetText(value, 'Title', 4, 200);
			if (column.key === 'brand') payload.brand = sheetText(value, 'Brand', 2, 80);
			if (column.key === 'sku') payload.sku = sheetOptionalText(value, 'SKU', 120);
			if (column.key === 'category') {
				if (!categoryOptions.some((option) => option.value === value)) {
					throw new Error(`Category is not valid for ${product.title}.`);
				}
				payload.category = value;
			}
			if (column.key === 'price') {
				const price = sheetNumber(value, 'Selling price');
				payload.price = price;
				payload.sellingPrice = price;
			}
			if (column.key === 'mrp') payload.mrp = sheetNumber(value, 'MRP');
			if (column.key === 'stock') payload.stock = sheetNumber(value, 'Stock', true);
			if (column.key === 'status') {
				if (!productStatusOptions.some((option) => option.value === value)) {
					throw new Error(`Status is not valid for ${product.title}.`);
				}
				payload.status = value;
			}
			if (column.key === 'warranty') payload.warranty = sheetOptionalText(value, 'Warranty', 120);
			if (column.key === 'compatibility') {
				payload.compatibility = sheetOptionalText(value, 'Compatibility', 500);
			}
		}

		return payload;
	}

	function toDateTimeInput(value: string | null) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toISOString().slice(0, 16);
	}

	function fromDateTimeInput(value: string) {
		if (!value) return null;
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date.toISOString();
	}

	function noticeClasses(tone: Notice['tone']) {
		if (tone === 'error')
			return 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]';
		if (tone === 'success')
			return 'border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/6 text-[var(--accent-forest)]';
		return 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-72)]';
	}

	function formatRelativeTime(value: string | null | undefined) {
		if (!value) return 'not recorded';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'not recorded';

		const diffMs = date.getTime() - timelineNow;
		const absMs = Math.abs(diffMs);
		const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
			['year', 365 * 24 * 60 * 60 * 1000],
			['month', 30 * 24 * 60 * 60 * 1000],
			['week', 7 * 24 * 60 * 60 * 1000],
			['day', 24 * 60 * 60 * 1000],
			['hour', 60 * 60 * 1000],
			['minute', 60 * 1000],
			['second', 1000]
		];
		const formatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
		const fallbackUnit = units[units.length - 1]!;
		const [unit, unitMs] = units.find(([, size]) => absMs >= size) ?? fallbackUnit;
		return formatter.format(Math.round(diffMs / unitMs), unit);
	}

	function formatAdminDateTime(value: string | null | undefined) {
		if (!value) return 'Not recorded';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'Not recorded';
		return date.toLocaleString('en-IN', {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function adminIssueMessage(issue: AdminRequestIssue) {
		const path = issue.path && issue.path.length > 0 ? issue.path.join('.') : 'request';
		return issue.message ? `${path}: ${issue.message}` : path;
	}

	function adminErrorMessage(body: AdminErrorBody | null) {
		const base = body?.error ?? 'Admin request failed';
		if (!body?.issues?.length) return base;
		return `${base}: ${body.issues.slice(0, 3).map(adminIssueMessage).join('; ')}`;
	}

	async function requestAdmin<T>(path: string, init?: RequestInit): Promise<T> {
		const response = await fetch(`${apiBase}${path}`, {
			...init,
			headers: {
				'Content-Type': 'application/json',
				...(await getAuthorizationHeaders()),
				...init?.headers
			}
		});
		const body = (await response.json().catch(() => null)) as (T & AdminErrorBody) | null;
		if (!response.ok) throw new Error(adminErrorMessage(body));
		return (body ?? {}) as T;
	}

	async function loadAnalytics() {
		try {
			overviewError = null;
			analytics = await requestAdmin<AdminAnalytics>('/admin/analytics');
		} catch (loadError) {
			overviewError = loadError instanceof Error ? loadError.message : 'Could not load analytics';
		}
	}

	function productListParams(page: number, pageSize: number) {
		const params = new URLSearchParams({
			page: String(page),
			pageSize: String(pageSize)
		});
		const q = productSearch.trim();
		if (q) params.set('q', q);
		if (productCategoryFilter) params.set('category', productCategoryFilter);
		if (productStatusFilter) params.set('status', productStatusFilter);
		if (productStockFilter) params.set('stock', productStockFilter);
		if (productQualityFilter) params.set('quality', productQualityFilter);
		params.set('sort', productSort);
		return params;
	}

	async function loadProducts(force = false) {
		if (productsLoading || (!force && productsLoaded)) return;
		try {
			productsLoading = true;
			productsError = null;
			const response = await requestAdmin<{
				products: AdminProduct[];
				pagination?: { page: number; total: number; totalPages: number };
			}>(`/admin/products?${productListParams(productPage, PRODUCT_PAGE_SIZE)}`);
			products = response.products ?? [];
			productTotal = response.pagination?.total ?? products.length;
			productTotalPages = response.pagination?.totalPages ?? 1;
			if (productPage > productTotalPages) productPage = productTotalPages;
			productsLoaded = true;
			syncProductEditor();
		} catch (loadError) {
			productsError = loadError instanceof Error ? loadError.message : 'Could not load products';
		} finally {
			productsLoading = false;
		}
	}

	function currentSheetFilterSignature() {
		return productListParams(1, SHEET_ALL_PAGE_SIZE).toString();
	}

	function mergeProductRows(currentRows: AdminProduct[], nextRows: AdminProduct[]) {
		const productById = new Map(currentRows.map((product) => [product.id, product]));
		for (const product of nextRows) productById.set(product.id, product);
		return Array.from(productById.values());
	}

	async function loadSheetProductsPage(page: number, replace: boolean) {
		if (sheetAllProductsLoading) return;
		sheetAllProductsLoading = true;
		sheetNotice = null;
		sheetLoadMoreError = null;
		spreadsheetOpen = true;
		if (replace) {
			sheetMode = 'all';
			sheetProducts = [];
			sheetAllProgress = { loaded: 0, total: productTotal };
			sheetNextPage = 1;
			sheetTotalPages = 1;
			sheetFilterSignature = currentSheetFilterSignature();
			activeSheetCell = null;
		}

		try {
			const response = await requestAdmin<{
				products: AdminProduct[];
				pagination?: { page: number; total: number; totalPages: number };
			}>(`/admin/products?${productListParams(page, SHEET_ALL_PAGE_SIZE)}`);
			const incomingRows = response.products ?? [];
			const nextRows = replace ? incomingRows : mergeProductRows(sheetProducts, incomingRows);
			const total = response.pagination?.total ?? nextRows.length;
			const totalPages =
				response.pagination?.totalPages ?? Math.max(1, Math.ceil(total / SHEET_ALL_PAGE_SIZE));
			sheetProducts = nextRows;
			sheetMode = 'all';
			sheetNextPage = page + 1;
			sheetTotalPages = totalPages;
			sheetAllProgress = { loaded: nextRows.length, total };
			if (replace) {
				sheetNotice = {
					tone: 'success',
					text: `Loaded ${nextRows.length.toLocaleString('en-IN')} of ${total.toLocaleString(
						'en-IN'
					)} matching product${total === 1 ? '' : 's'}.`
				};
			}
		} catch (loadError) {
			sheetLoadMoreError =
				loadError instanceof Error ? loadError.message : 'Could not load products into the sheet';
			sheetNotice = {
				tone: 'error',
				text: sheetLoadMoreError
			};
		} finally {
			sheetAllProductsLoading = false;
		}
	}

	async function loadAllSheetProducts() {
		await loadSheetProductsPage(1, true);
	}

	async function loadMoreSheetProducts() {
		if (!sheetCanLoadMore || sheetAllProductsLoading) return;
		await loadSheetProductsPage(sheetNextPage, false);
	}

	function handleSheetScroll(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLDivElement)) return;
		if (!sheetCanLoadMore || sheetAllProductsLoading) return;
		const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
		if (distanceFromBottom < 560) void loadMoreSheetProducts();
	}

	async function openSpreadsheetView() {
		spreadsheetOpen = true;
		sheetFullscreen = true;
		const signature = currentSheetFilterSignature();
		if (sheetMode !== 'all' || sheetProducts.length === 0 || sheetFilterSignature !== signature) {
			await loadAllSheetProducts();
		}
		requestAnimationFrame(() => sheetFrameElement?.focus());
	}

	function closeSpreadsheetView() {
		sheetFullscreen = false;
		activeSheetCell = null;
	}

	function resetSheetDataset() {
		sheetMode = 'visible';
		sheetProducts = [];
		sheetAllProgress = { loaded: 0, total: 0 };
		sheetNextPage = 1;
		sheetTotalPages = 1;
		sheetFilterSignature = '';
		sheetLoadMoreError = null;
		activeSheetCell = null;
	}

	function reloadProductsFromFirstPage() {
		productPage = 1;
		resetSheetDataset();
		void loadProducts(true);
	}

	function queueProductSearch() {
		if (productSearchTimer) window.clearTimeout(productSearchTimer);
		productSearchTimer = window.setTimeout(() => {
			productSearchTimer = null;
			reloadProductsFromFirstPage();
		}, 300);
	}

	function submitProductSearch() {
		if (productSearchTimer) {
			window.clearTimeout(productSearchTimer);
			productSearchTimer = null;
		}
		reloadProductsFromFirstPage();
	}

	function clearCatalogFilters() {
		if (productSearchTimer) {
			window.clearTimeout(productSearchTimer);
			productSearchTimer = null;
		}
		productSearch = '';
		productCategoryFilter = '';
		productStatusFilter = '';
		productStockFilter = '';
		productQualityFilter = '';
		productSort = 'updated-desc';
		reloadProductsFromFirstPage();
	}

	function setProductPage(next: number) {
		const target = Math.min(Math.max(1, next), productTotalPages);
		if (target === productPage) return;
		productPage = target;
		void loadProducts(true);
	}

	function openProductEditor(product: AdminProduct) {
		selectedProductId = product.id;
		productEditor = mapProductToEditor(product);
		productNotice = null;
		drawerOpen = true;
	}

	function closeProductEditor() {
		drawerOpen = false;
		selectedProductId = null;
		productNotice = null;
		productImageUploadError = '';
	}

	function handleProductRowKeydown(event: KeyboardEvent, product: AdminProduct) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openProductEditor(product);
	}

	function toggleProductSelection(productId: string) {
		bulkNotice = null;
		selectedProductIds = selectedProductIds.includes(productId)
			? selectedProductIds.filter((id) => id !== productId)
			: [...selectedProductIds, productId];
	}

	function selectVisibleProducts() {
		const nextIds = [...selectedProductIds];
		for (const product of products) {
			if (!nextIds.includes(product.id)) nextIds.push(product.id);
		}
		selectedProductIds = nextIds;
		bulkNotice = null;
	}

	function deselectVisibleProducts() {
		const visibleIds = products.map((product) => product.id);
		selectedProductIds = selectedProductIds.filter((id) => !visibleIds.includes(id));
		bulkNotice = null;
	}

	function selectLowStockProducts() {
		const nextIds = [...selectedProductIds];
		for (const product of products) {
			if (product.stock <= 5 && !nextIds.includes(product.id)) nextIds.push(product.id);
		}
		selectedProductIds = nextIds;
		bulkNotice = null;
	}

	function clearProductSelection() {
		selectedProductIds = [];
		bulkNotice = null;
	}

	function resetBulkProductEditor() {
		bulkEditor = emptyBulkProductEditor();
		bulkNotice = null;
	}

	async function refreshCatalogSearch() {
		await fetch('/api/admin/catalog-cache', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		}).catch(() => null);
		await invalidate('app:products');
	}

	async function loadUsers(force = false) {
		if (usersLoading || (!force && usersLoaded)) return;
		try {
			usersLoading = true;
			usersError = null;
			const response = await requestAdmin<{ users: AdminUserRecord[] }>('/admin/users');
			users = response.users ?? [];
			usersLoaded = true;
			syncUserEditor();
		} catch (loadError) {
			usersError = loadError instanceof Error ? loadError.message : 'Could not load users';
		} finally {
			usersLoading = false;
		}
	}

	async function loadCoupons(force = false) {
		if (couponsLoading || (!force && couponsLoaded)) return;
		try {
			couponsLoading = true;
			couponsError = null;
			const response = await requestAdmin<{ coupons: AdminCoupon[] }>('/admin/coupons');
			coupons = response.coupons ?? [];
			couponsLoaded = true;
			syncCouponEditor();
		} catch (loadError) {
			couponsError = loadError instanceof Error ? loadError.message : 'Could not load coupons';
		} finally {
			couponsLoading = false;
		}
	}

	function syncProductEditor() {
		// Drawer model: never auto-open an editor. Only refresh the open product's
		// fields if it is still present in the current page after a reload.
		if (selectedProductId === 'new' || !selectedProductId) return;
		const nextProduct = products.find((product) => product.id === selectedProductId);
		if (nextProduct) productEditor = mapProductToEditor(nextProduct);
	}

	function syncCouponEditor() {
		if (selectedCouponId === 'new') return;

		if (!coupons.length) {
			selectedCouponId = null;
			couponEditor = emptyCouponEditor();
			return;
		}

		const nextCoupon = coupons.find((coupon) => coupon.id === selectedCouponId) ?? coupons[0];
		selectedCouponId = nextCoupon.id;
		couponEditor = mapCouponToEditor(nextCoupon);
	}

	function syncUserEditor() {
		if (!users.length) {
			selectedUserId = null;
			userEditor = emptyUserEditor();
			return;
		}

		const nextUser = users.find((user) => user.id === selectedUserId) ?? users[0];
		selectedUserId = nextUser.id;
		userEditor = mapUserToEditor(nextUser);
	}

	async function loadAdmin() {
		loading = true;
		await loadAnalytics();
		loading = false;
		booting = false;
	}

	function isAdminView(value: string): value is AdminView {
		return tabs.some((tab) => tab.id === value);
	}

	function viewFromSearch(section: string | null): AdminView {
		return section && isAdminView(section) ? section : 'overview';
	}

	function loadSectionData(nextView: AdminView) {
		if (nextView === 'catalog') void loadProducts();
		if (nextView === 'users') void loadUsers();
		if (nextView === 'promos') void loadCoupons();
	}

	function setView(nextView: AdminView) {
		if (nextView === view) return;
		prevView = view;
		view = nextView;
		if (!mountedViews.includes(nextView)) mountedViews = [...mountedViews, nextView];
		loadSectionData(nextView);

		const nextUrl = new URL(window.location.href);
		if (nextView === 'overview') nextUrl.searchParams.delete('section');
		else nextUrl.searchParams.set('section', nextView);
		window.history.replaceState(window.history.state, '', nextUrl);
	}

	function openOperations(section: OperationsSection, ordersFilter: string | null = null) {
		operationsSection = section;
		if (section === 'orders') ordersInitialFilter = ordersFilter;
		setView('operations');
	}

	function openRecentOrder(order: NonNullable<AdminAnalytics['recentOrders']>[number]) {
		ordersInitialFilter = null;
		ordersInitialSearch = order.shippingName ?? '';
		ordersInitialSelectId = order.id;
		operationsSection = 'orders';
		setView('operations');
	}

	function paletteNavigate(sectionId: string) {
		if (isAdminView(sectionId)) setView(sectionId);
	}

	function paletteSelectProduct(product: unknown) {
		// The palette searches /admin/products which returns the full admin row.
		const row = product as AdminProduct;
		setView('catalog');
		selectedProductId = row.id;
		productEditor = mapProductToEditor(row);
		productNotice = null;
	}

	function paletteSelectOrder(order: AdminOrderRecord) {
		ordersInitialFilter = null;
		ordersInitialSearch = order.shippingName || order.shippingEmail || order.shippingPhone || '';
		ordersInitialSelectId = order.id;
		operationsSection = 'orders';
		setView('operations');
	}

	function paletteCreateProduct() {
		setView('catalog');
		beginCreateProduct();
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && sheetFullscreen) {
			event.preventDefault();
			closeSpreadsheetView();
			return;
		}
		if (event.key === 'Escape' && drawerOpen) {
			event.preventDefault();
			closeProductEditor();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			if (view === 'catalog' && spreadsheetOpen && dirtySheetProducts.length > 0) {
				event.preventDefault();
				void saveSheetEdits();
			}
			return;
		}
		if (paletteOpen || event.ctrlKey || event.metaKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.tagName === 'SELECT' ||
				target.isContentEditable)
		) {
			return;
		}
		const index = Number(event.key);
		if (Number.isInteger(index) && index >= 1 && index <= tabs.length) {
			setView(tabs[index - 1].id);
		}
	}

	function scheduleAdminRealtimeRefresh(
		targets: Partial<typeof pendingRealtimeRefresh> = { analytics: true }
	) {
		pendingRealtimeRefresh = {
			analytics: pendingRealtimeRefresh.analytics || Boolean(targets.analytics),
			products: pendingRealtimeRefresh.products || Boolean(targets.products),
			users: pendingRealtimeRefresh.users || Boolean(targets.users),
			coupons: pendingRealtimeRefresh.coupons || Boolean(targets.coupons)
		};

		if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
		realtimeRefreshTimer = window.setTimeout(() => {
			const nextRefresh = pendingRealtimeRefresh;
			pendingRealtimeRefresh = {
				analytics: false,
				products: false,
				users: false,
				coupons: false
			};
			realtimeRefreshTimer = null;

			if (nextRefresh.analytics) void loadAnalytics();
			if (nextRefresh.products && productsLoaded) void loadProducts(true);
			if (nextRefresh.users && usersLoaded) void loadUsers(true);
			if (nextRefresh.coupons && couponsLoaded) void loadCoupons(true);
		}, 300);
	}

	function beginCreateProduct() {
		selectedProductId = 'new';
		productEditor = emptyProductEditor();
		productNotice = null;
		drawerOpen = true;
	}

	async function saveProduct() {
		productSaving = true;
		productNotice = null;

		try {
			const isNewProduct = selectedProductId === 'new' || !productEditor.id;
			const image = productEditor.image.trim();
			const price = requiredPayloadNumber(productEditor.price, 'Selling price');
			const payload: Record<string, unknown> = {
				title: productEditor.title.trim(),
				brand: productEditor.brand.trim(),
				category: productEditor.category,
				description: productEditor.description,
				images: parseLines(productEditor.imagesText),
				price,
				sellingPrice: price,
				costPrice: optionalNonnegativePayloadNumber(productEditor.costPrice, 'Cost price') ?? 0,
				mrp: requiredPayloadNumber(productEditor.mrp, 'MRP'),
				stock: requiredPayloadNumber(productEditor.stock, 'Stock', true),
				status: productEditor.status,
				sku: productEditor.sku,
				sourceUrl: productEditor.sourceUrl,
				compatibility: productEditor.compatibility,
				warranty: productEditor.warranty,
				highlights: parseLines(productEditor.highlightsText),
				searchKeywords: parseSearchKeywords(productEditor.searchKeywordsText),
				weightKg: optionalPositivePayloadNumber(productEditor.weightKg, 'Weight'),
				lengthCm: optionalPositivePayloadNumber(productEditor.lengthCm, 'Length'),
				breadthCm: optionalPositivePayloadNumber(productEditor.breadthCm, 'Breadth'),
				heightCm: optionalPositivePayloadNumber(productEditor.heightCm, 'Height'),
				authenticityGrade: productEditor.authenticityGrade,
				conditionGrade: productEditor.conditionGrade,
				hsnCode: productEditor.hsnCode,
				gstRate: optionalNonnegativePayloadNumber(productEditor.gstRate, 'GST rate') ?? 18,
				doaPolicyDays:
					optionalNonnegativePayloadNumber(productEditor.doaPolicyDays, 'DOA policy days', true) ??
					7,
				localDeliveryEligible: productEditor.localDeliveryEligible,
				codEligible: productEditor.codAllowed,
				codAllowed: productEditor.codAllowed,
				returnable: productEditor.returnable,
				isUniversal: productEditor.isUniversal
			};

			if (image) {
				payload.image = image;
			} else if (isNewProduct) {
				throw new Error('Image URL is required before creating a product.');
			}

			if (isNewProduct) {
				const response = await requestAdmin<{ product: AdminProduct }>('/admin/products', {
					method: 'POST',
					body: JSON.stringify(payload)
				});
				selectedProductId = response.product.id;
				productEditor = mapProductToEditor(response.product);
				productNotice = { tone: 'success', text: 'Product created.' };
			} else {
				const response = await requestAdmin<{ product: AdminProduct }>(
					`/admin/products/${productEditor.id}`,
					{
						method: 'PATCH',
						body: JSON.stringify(payload)
					}
				);
				applyUpdatedProducts([response.product]);
				productNotice = { tone: 'success', text: 'Product updated.' };
			}

			await Promise.all([loadProducts(true), loadAnalytics(), refreshCatalogSearch()]);
		} catch (saveError) {
			productNotice = {
				tone: 'error',
				text: saveError instanceof Error ? saveError.message : 'Could not save product'
			};
		} finally {
			productSaving = false;
		}
	}

	async function uploadProductEditorImage() {
		if (productImageUploading) return;
		productImageUploading = true;
		productImageUploadError = '';

		try {
			const file = await pickImageFile({
				title: 'Product image',
				fileNamePrefix: productEditor.sku || productEditor.id || 'lapkart-product'
			});
			if (!file) return;

			const upload = await uploadAdminImage('products', file);
			productEditor.image = upload.image_url;

			const existingImages = parseLines(productEditor.imagesText);
			if (!existingImages.includes(upload.image_url)) {
				productEditor.imagesText = [upload.image_url, ...existingImages].join('\n');
			}

			productNotice = { tone: 'success', text: 'Product image uploaded.' };
			void nativeImpact();
		} catch (uploadError) {
			const message =
				uploadError instanceof Error ? uploadError.message : 'Could not upload product image.';
			productImageUploadError = message;
			productNotice = { tone: 'error', text: message };
		} finally {
			productImageUploading = false;
		}
	}

	async function applyBulkProductUpdate() {
		if (bulkSaving || selectedProductIds.length === 0) return;
		bulkSaving = true;
		bulkNotice = null;
		productNotice = null;

		try {
			const update = bulkProductUpdatePayload();
			const response = await requestAdmin<{ products: AdminProduct[]; updated: number }>(
				'/admin/products/bulk',
				{
					method: 'PATCH',
					body: JSON.stringify({
						productIds: selectedProductIds,
						update
					})
				}
			);
			applyUpdatedProducts(response.products ?? []);

			const updatedCount = response.updated ?? response.products?.length ?? 0;
			bulkNotice = {
				tone: 'success',
				text: `Updated ${updatedCount} product${updatedCount === 1 ? '' : 's'}.`
			};
			await Promise.all([loadProducts(true), loadAnalytics(), refreshCatalogSearch()]);
		} catch (bulkError) {
			bulkNotice = {
				tone: 'error',
				text: bulkError instanceof Error ? bulkError.message : 'Could not update selected products'
			};
		} finally {
			bulkSaving = false;
		}
	}

	async function saveSheetEdits() {
		if (sheetSaving || dirtySheetProducts.length === 0) return;
		sheetSaving = true;
		sheetNotice = null;
		productNotice = null;

		try {
			const jobs = dirtySheetProducts.map((product) => ({
				product,
				payload: sheetPayloadFromDraft(product)
			}));
			const updatedProducts: AdminProduct[] = [];
			const errors: string[] = [];
			const batchSize = 6;

			for (let i = 0; i < jobs.length; i += batchSize) {
				const batch = jobs.slice(i, i + batchSize);
				const results = await Promise.allSettled(
					batch.map((job) =>
						requestAdmin<{ product: AdminProduct }>(`/admin/products/${job.product.id}`, {
							method: 'PATCH',
							body: JSON.stringify(job.payload)
						})
					)
				);

				for (const [index, result] of results.entries()) {
					if (result.status === 'fulfilled') {
						updatedProducts.push(result.value.product);
					} else {
						errors.push(
							`${batch[index].product.title}: ${
								result.reason instanceof Error ? result.reason.message : 'Save failed'
							}`
						);
					}
				}
			}

			if (updatedProducts.length > 0) {
				applyUpdatedProducts(updatedProducts);
				const nextDrafts = { ...sheetDrafts };
				for (const product of updatedProducts) delete nextDrafts[product.id];
				sheetDrafts = nextDrafts;

				await Promise.all([loadAnalytics(), refreshCatalogSearch()]);
			}

			if (errors.length > 0) {
				sheetNotice = {
					tone: 'error',
					text: `Saved ${updatedProducts.length} product${
						updatedProducts.length === 1 ? '' : 's'
					}. ${errors[0]}`
				};
			} else {
				sheetNotice = {
					tone: 'success',
					text: `Saved ${updatedProducts.length} product${updatedProducts.length === 1 ? '' : 's'}.`
				};
			}
		} catch (saveError) {
			sheetNotice = {
				tone: 'error',
				text: saveError instanceof Error ? saveError.message : 'Could not save sheet edits'
			};
		} finally {
			sheetSaving = false;
		}
	}

	async function deleteProduct() {
		if (!productEditor.id) return;
		productDeleting = true;
		productNotice = null;

		try {
			const response = await requestAdmin<{
				archived?: boolean;
				deleted?: boolean;
				message?: string;
			}>(`/admin/products/${productEditor.id}`, { method: 'DELETE' });

			selectedProductId = null;
			productEditor = emptyProductEditor();
			drawerOpen = false;
			productNotice = {
				tone: 'success',
				text:
					response.message ??
					(response.archived
						? 'Product archived because it has order history.'
						: 'Product deleted.')
			};

			await Promise.all([loadProducts(true), loadAnalytics(), refreshCatalogSearch()]);
		} catch (deleteError) {
			productNotice = {
				tone: 'error',
				text: deleteError instanceof Error ? deleteError.message : 'Could not remove product'
			};
		} finally {
			productDeleting = false;
		}
	}

	async function deleteProductRow(product: AdminProduct) {
		if (rowDeletingId) return;
		const confirmed = window.confirm(
			`Delete "${product.title}"? Products with order history are archived instead.`
		);
		if (!confirmed) return;

		rowDeletingId = product.id;
		try {
			const response = await requestAdmin<{
				archived?: boolean;
				deleted?: boolean;
				message?: string;
			}>(`/admin/products/${product.id}`, { method: 'DELETE' });

			if (selectedProductId === product.id) closeProductEditor();
			selectedProductIds = selectedProductIds.filter((id) => id !== product.id);
			productNotice = {
				tone: 'success',
				text:
					response.message ??
					(response.archived
						? `"${product.title}" archived because it has order history.`
						: `"${product.title}" deleted.`)
			};
			void nativeImpact();
			await Promise.all([loadProducts(true), loadAnalytics(), refreshCatalogSearch()]);
		} catch (deleteError) {
			productNotice = {
				tone: 'error',
				text: deleteError instanceof Error ? deleteError.message : 'Could not remove product'
			};
		} finally {
			rowDeletingId = null;
		}
	}

	async function saveUser() {
		if (!userEditor.id) return;
		userSaving = true;
		userNotice = null;

		try {
			const payload: { role: AppRole; fullName: string; phone?: string } = {
				role: userEditor.role,
				fullName: userEditor.fullName
			};

			if (!selectedUserPhoneLocked) {
				payload.phone = userEditor.phone;
			}

			await requestAdmin(`/admin/users/${userEditor.id}`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			});
			userNotice = { tone: 'success', text: 'Account updated.' };
			await loadUsers(true);
		} catch (saveError) {
			userNotice = {
				tone: 'error',
				text: saveError instanceof Error ? saveError.message : 'Could not update account'
			};
		} finally {
			userSaving = false;
		}
	}

	function beginCreateCoupon() {
		selectedCouponId = 'new';
		couponEditor = emptyCouponEditor();
		couponNotice = null;
	}

	function toggleCouponCategory(category: string) {
		couponEditor.applicableCategories = couponEditor.applicableCategories.includes(category)
			? couponEditor.applicableCategories.filter((value) => value !== category)
			: [...couponEditor.applicableCategories, category];
	}

	async function saveCoupon() {
		if (!couponEditor.code.trim()) {
			couponNotice = { tone: 'error', text: 'Coupon code is required.' };
			return;
		}

		couponSaving = true;
		couponNotice = null;

		try {
			const payload = {
				code: couponEditor.code.trim().toUpperCase(),
				description: couponEditor.description.trim(),
				discountType: couponEditor.discountType,
				discountValue:
					couponEditor.discountType === 'free_delivery' ? 1 : Number(couponEditor.discountValue),
				minimumSubtotal: Number(couponEditor.minimumSubtotal || 0),
				maxDiscount: couponEditor.maxDiscount ? Number(couponEditor.maxDiscount) : null,
				startsAt: fromDateTimeInput(couponEditor.startsAt),
				endsAt: fromDateTimeInput(couponEditor.endsAt),
				usageLimit: couponEditor.usageLimit ? Number(couponEditor.usageLimit) : null,
				perUserLimit: Number(couponEditor.perUserLimit || 1),
				firstOrderOnly: couponEditor.firstOrderOnly,
				applicableCategories: couponEditor.applicableCategories.length
					? couponEditor.applicableCategories
					: null,
				allowedPincodePrefix: couponEditor.allowedPincodePrefix.trim() || null,
				active: couponEditor.active
			};

			if (couponEditor.id) {
				await requestAdmin(`/admin/coupons/${couponEditor.id}`, {
					method: 'PATCH',
					body: JSON.stringify(payload)
				});
			} else {
				const response = await requestAdmin<{ coupon: { id: string } }>('/admin/coupons', {
					method: 'POST',
					body: JSON.stringify(payload)
				});
				selectedCouponId = response.coupon.id;
			}

			couponNotice = { tone: 'success', text: 'Coupon saved.' };
			await loadCoupons(true);
		} catch (saveError) {
			couponNotice = {
				tone: 'error',
				text: saveError instanceof Error ? saveError.message : 'Could not save coupon'
			};
		} finally {
			couponSaving = false;
		}
	}

	async function deleteCoupon() {
		if (!couponEditor.id) return;
		couponDeleting = true;
		couponNotice = null;

		try {
			await requestAdmin(`/admin/coupons/${couponEditor.id}`, { method: 'DELETE' });
			selectedCouponId = null;
			couponEditor = emptyCouponEditor();
			couponNotice = { tone: 'success', text: 'Coupon removed or deactivated.' };
			await loadCoupons(true);
		} catch (deleteError) {
			couponNotice = {
				tone: 'error',
				text: deleteError instanceof Error ? deleteError.message : 'Could not remove coupon'
			};
		} finally {
			couponDeleting = false;
		}
	}

	onMount(() => {
		if (!currentUser || !isStaffRole(currentRole)) return;
		if (initializedForUserId === currentUser.id) return;

		initializedForUserId = currentUser.id;
		void loadAdmin().then(() => loadSectionData(view));
		void loadNotifications();
		const timelineTimer = window.setInterval(() => {
			timelineNow = Date.now();
		}, 60_000);

		const channel = auth.supabase
			.channel(`admin-shell:${currentUser.id}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true, products: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true, users: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () =>
				scheduleAdminRealtimeRefresh({ users: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, () =>
				scheduleAdminRealtimeRefresh({ coupons: true })
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'coupon_redemptions' }, () =>
				scheduleAdminRealtimeRefresh({ analytics: true, coupons: true })
			)
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'admin_notifications' },
				(payload) => handleIncomingNotification(payload.new as AdminNotification)
			)
			.subscribe();

		return () => {
			window.clearInterval(timelineTimer);
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			if (productSearchTimer) window.clearTimeout(productSearchTimer);
			pendingRealtimeRefresh = {
				analytics: false,
				products: false,
				users: false,
				coupons: false
			};
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Admin - lapkart</title>
</svelte:head>

<svelte:window onkeydown={handleGlobalKeydown} />

<AdminCommandPalette
	bind:open={paletteOpen}
	sections={tabs.map((tab) => ({ id: tab.id, label: tab.label, hint: tabHint(tab.id) }))}
	onNavigate={paletteNavigate}
	onSelectProduct={paletteSelectProduct}
	onSelectOrder={paletteSelectOrder}
	onCreateProduct={paletteCreateProduct}
/>

<div class="admin-shell">
	<!-- Sidebar navigation -->
	<aside class="admin-sidebar">
		<div class="sidebar-header">
			<a href={resolve('/')} class="sidebar-logo">
				<div class="grid size-8 place-items-center rounded-lg bg-[var(--heat-100)]">
					<Flame class="size-4 text-white" strokeWidth={2.5} />
				</div>
				<span class="text-[15px] font-semibold tracking-tight text-white">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
			</a>
			{#if currentUser?.email}
				<p class="mt-2 truncate text-[10px] tracking-tight text-white/30">{currentUser.email}</p>
			{/if}
		</div>

		<div class="px-3 pt-3">
			<button type="button" class="palette-trigger" onclick={() => (paletteOpen = true)}>
				<Search class="size-3.5" strokeWidth={2} />
				<span class="flex-1 text-left">Search anything</span>
				<kbd class="palette-kbd">Ctrl K</kbd>
			</button>
		</div>

		<nav class="sidebar-nav">
			{#each navGroups as group (group.label)}
				<p class="sidebar-group-label">{group.label}</p>
				{#each group.ids as tabId (tabId)}
					{@const tab = tabById.get(tabId)!}
					<button
						type="button"
						class="sidebar-item {view === tab.id ? 'active' : ''}"
						onclick={() => setView(tab.id)}
					>
						{#if view === tab.id}
							<span class="sidebar-indicator" transition:fade={{ duration: 120 }}></span>
						{/if}
						<tab.icon class="size-[18px]" strokeWidth={1.8} />
						<span class="sidebar-label">{tab.label}</span>
						{#if tab.id === 'operations' && (analytics?.pendingFulfillment ?? 0) > 0}
							<span class="sidebar-badge">{analytics?.pendingFulfillment}</span>
						{:else if tab.id === 'support' && (analytics?.openSupport ?? 0) > 0}
							<span class="sidebar-badge">{analytics?.openSupport}</span>
						{:else}
							<kbd class="sidebar-key">{tabHint(tab.id)}</kbd>
						{/if}
					</button>
				{/each}
			{/each}
		</nav>

		<!-- Sidebar stats (desktop only) -->
		{#if analytics && !booting}
			<div class="sidebar-stats" in:fade={{ duration: 300 }}>
				<div class="stat-row">
					<span class="stat-label">Revenue</span>
					<span class="stat-value">{formatINR(analytics.revenue)}</span>
				</div>
				<div class="stat-row">
					<span class="stat-label">Pending</span>
					<span class="stat-value text-[var(--heat-100)]">{analytics.pendingFulfillment}</span>
				</div>
				<div class="stat-row">
					<span class="stat-label">Delivered</span>
					<span class="stat-value">{analytics.deliveredOrders}</span>
				</div>
			</div>
		{/if}
	</aside>

	<!-- Mobile tab bar -->
	<nav class="admin-mobile-tabs scrollbar-hide" aria-label="Admin sections">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				class="mobile-tab {view === tab.id ? 'active' : ''}"
				onclick={() => setView(tab.id)}
			>
				<tab.icon class="size-4" strokeWidth={2} />
				<span>{tab.label}</span>
				{#if view === tab.id}
					<span
						class="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-[var(--heat-100)]"
						transition:fade={{ duration: 120 }}
					></span>
				{/if}
			</button>
		{/each}
	</nav>

	<!-- Main content area -->
	<main class="admin-main">
		<header class="admin-topbar">
			<div class="min-w-0">
				<h1 class="truncate text-[15px] font-semibold tracking-tight text-foreground">
					{tabById.get(view)?.label}
				</h1>
				<p class="truncate text-[11px] text-[var(--black-alpha-40)]">
					{viewDescriptions[view]}
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if (analytics?.pendingFulfillment ?? 0) > 0}
					<button
						type="button"
						class="hidden items-center gap-1.5 rounded-full border border-[var(--heat-20)] bg-[var(--heat-4)] px-2.5 py-1 text-[11px] font-medium text-[var(--heat-100)] transition-colors hover:border-[var(--heat-100)] sm:inline-flex"
						onclick={() => openOperations('fulfillment')}
					>
						<span class="relative flex size-1.5">
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--heat-100)] opacity-60"
							></span>
							<span class="relative inline-flex size-1.5 rounded-full bg-[var(--heat-100)]"></span>
						</span>
						{analytics?.pendingFulfillment} to fulfil
					</button>
				{/if}
				<div class="notif-wrap">
					<button
						type="button"
						class="notif-bell"
						aria-label="Notifications"
						aria-expanded={notifOpen}
						onclick={() => (notifOpen = !notifOpen)}
					>
						<Bell class="size-4" strokeWidth={2} />
						{#if notifTotal > 0}
							<span class="notif-dot">{notifTotal > 99 ? '99+' : notifTotal}</span>
						{/if}
					</button>
					{#if notifOpen}
						<button
							type="button"
							class="notif-scrim"
							aria-label="Close notifications"
							onclick={() => (notifOpen = false)}
						></button>
						<div class="notif-panel" in:fly={{ y: -6, duration: 160 }}>
							<div class="notif-head">
								<span>Notifications</span>
								<div class="notif-head-actions">
									{#if persistentUnread > 0}
										<button type="button" class="notif-markall" onclick={markAllNotificationsRead}>
											Mark all read
										</button>
									{/if}
									{#if notifTotal > 0}
										<span class="notif-count">{notifTotal}</span>
									{/if}
								</div>
							</div>

							<div class="notif-scroll">
								{#if persistentNotifs.length}
									<div class="notif-list">
										{#each persistentNotifs as notification (notification.id)}
											{@const unread = !notifReadIds.has(notification.id)}
											<button
												type="button"
												class="notif-item {unread ? 'is-unread' : ''}"
												onclick={() => openNotification(notification)}
											>
												<span class="notif-sev {notification.severity}"></span>
												<span class="notif-item-text">
													<span class="notif-item-label">{notification.title}</span>
													{#if notification.body}
														<span class="notif-item-hint">{notification.body}</span>
													{/if}
													<span class="notif-item-time">
														{formatRelativeTime(notification.created_at)}
													</span>
												</span>
												{#if unread}
													<span class="notif-unread-dot"></span>
												{/if}
											</button>
										{/each}
									</div>
								{/if}

								{#if needsActionCards.length}
									<p class="notif-section">Needs attention</p>
									<div class="notif-list">
										{#each needsActionCards as card (card.id)}
											<button
												type="button"
												class="notif-item"
												onclick={() => runNotification(card.action)}
											>
												<span class="notif-item-badge">{card.count}</span>
												<span class="notif-item-text">
													<span class="notif-item-label">{card.label}</span>
													<span class="notif-item-hint">{card.hint}</span>
												</span>
												<ArrowUpRight
													class="size-3.5 text-[var(--black-alpha-24)]"
													strokeWidth={2}
												/>
											</button>
										{/each}
									</div>
								{/if}

								{#if !persistentNotifs.length && !needsActionCards.length}
									<div class="notif-empty">
										{notifLoading ? 'Loading…' : 'All clear — nothing needs attention.'}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
				<button
					type="button"
					class="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] text-[var(--black-alpha-48)] shadow-sm transition-colors hover:border-[var(--black-alpha-24)] hover:text-foreground"
					onclick={() => (paletteOpen = true)}
				>
					<Search class="size-3.5" strokeWidth={2} />
					<span class="hidden sm:inline">Search</span>
					<kbd
						class="hidden rounded border border-[var(--border-muted)] bg-[var(--background-lighter)] px-1 py-px font-mono text-[10px] sm:inline"
					>
						Ctrl K
					</kbd>
				</button>
			</div>
		</header>
		{#if booting}
			<div class="admin-loading-shell" in:fade={{ duration: 200 }}>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{#each [1, 2, 3, 4] as i (i)}
						<div class="skeleton-card" style="animation-delay: {i * 80}ms">
							<div class="h-3 w-16 rounded bg-[var(--border-faint)]"></div>
							<div class="mt-3 h-7 w-24 rounded bg-[var(--border-faint)]"></div>
						</div>
					{/each}
				</div>
				<div class="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
					<div class="skeleton-card h-[300px]"></div>
					<div class="skeleton-card h-[300px]"></div>
				</div>
			</div>
		{:else}
			<!-- Animated content area using {#key} for tab transitions -->
			<div class="admin-content-area">
				{#key view}
					<div
						class="admin-panel"
						in:fly={{ x: 24 * flyDirection, duration: 280, delay: 80, easing: cubicOut }}
						out:fade={{ duration: 120 }}
					>
						{#if view === 'overview'}
							<AdminOverviewPanel
								{analytics}
								{overviewError}
								{overviewCards}
								{needsActionCards}
								{maxMonthlyRevenue}
								{loading}
								{openOperations}
								openOrder={openRecentOrder}
							/>
						{:else if view === 'catalog'}
							<!-- CATALOG TAB -->
							{#if productsLoading && !products.length}
								<div class="catalog-skeleton">
									<div class="grid gap-3 xl:grid-cols-[380px_1fr]">
										<div class="space-y-2">
											{#each [1, 2, 3, 4, 5] as i (i)}
												<div
													class="skeleton-card h-[60px]"
													style="animation-delay: {i * 60}ms"
												></div>
											{/each}
										</div>
										<div class="skeleton-card h-[400px]"></div>
									</div>
								</div>
							{:else}
								<div class="catalog-board">
									<!-- Toolbar -->
									<div class="catalog-toolbar">
										<div class="flex min-w-0 items-center gap-2.5">
											<div class="catalog-toolbar-icon">
												<Boxes class="size-[18px]" strokeWidth={2} />
											</div>
											<div class="min-w-0">
												<h2 class="text-[15px] font-semibold tracking-tight text-foreground">
													Catalog
												</h2>
												<p class="text-[11px] text-[var(--black-alpha-40)]">
													Showing {products.length.toLocaleString('en-IN')} of {productTotal.toLocaleString(
														'en-IN'
													)} products
												</p>
											</div>
										</div>
										<button
											type="button"
											class="button button-primary inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium text-white"
											onclick={beginCreateProduct}
										>
											<Plus class="size-4" strokeWidth={2.2} />
											New product
										</button>
									</div>

									<!-- Search + filters -->
									<div class="catalog-controls">
										<div class="catalog-search-row">
											<label class="catalog-search-field">
												<Search class="size-3.5 text-[var(--black-alpha-32)]" strokeWidth={2} />
												<input
													bind:value={productSearch}
													oninput={queueProductSearch}
													onkeydown={(event) => {
														if (event.key === 'Enter') submitProductSearch();
													}}
													class="catalog-search-input"
													placeholder="Search title, brand, SKU, category..."
												/>
											</label>
											<button
												type="button"
												class="catalog-search-submit"
												aria-label="Search products"
												onclick={submitProductSearch}
											>
												<Search class="size-3.5" strokeWidth={2} />
											</button>
											<button
												type="button"
												class="catalog-excel-button"
												disabled={productsLoading && products.length === 0}
												onclick={openSpreadsheetView}
											>
												<Table2 class="size-3.5" strokeWidth={2} />
												Excel view
											</button>
										</div>
										<div class="catalog-filter-card">
											<div class="catalog-filter-head">
												<div class="flex items-center gap-1.5">
													<Filter class="size-3.5 text-[var(--black-alpha-40)]" strokeWidth={2} />
													<span>Filters</span>
													{#if activeCatalogFilterCount > 0}
														<strong>{activeCatalogFilterCount}</strong>
													{/if}
												</div>
												{#if activeCatalogFilterCount > 0 || productSort !== 'updated-desc'}
													<button type="button" onclick={clearCatalogFilters}>Clear</button>
												{/if}
											</div>
											<div class="catalog-filter-grid">
												<label>
													<span>Category</span>
													<select
														bind:value={productCategoryFilter}
														class="input-field h-8 text-[12px]"
														onchange={reloadProductsFromFirstPage}
													>
														<option value="">All categories</option>
														{#each categoryOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label>
													<span>Status</span>
													<select
														bind:value={productStatusFilter}
														class="input-field h-8 text-[12px]"
														onchange={reloadProductsFromFirstPage}
													>
														<option value="">All status</option>
														{#each productStatusOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label>
													<span>Stock</span>
													<select
														bind:value={productStockFilter}
														class="input-field h-8 text-[12px]"
														onchange={reloadProductsFromFirstPage}
													>
														{#each productStockFilterOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label>
													<span>Quality</span>
													<select
														bind:value={productQualityFilter}
														class="input-field h-8 text-[12px]"
														onchange={reloadProductsFromFirstPage}
													>
														{#each productQualityFilterOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label class="catalog-filter-wide">
													<span>Organize</span>
													<select
														bind:value={productSort}
														class="input-field h-8 text-[12px]"
														onchange={reloadProductsFromFirstPage}
													>
														{#each productSortOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
											</div>
										</div>
										<div class="mt-2 flex flex-wrap gap-1.5">
											<button
												type="button"
												class="catalog-mini-action"
												disabled={!products.length}
												onclick={allVisibleProductsSelected
													? deselectVisibleProducts
													: selectVisibleProducts}
											>
												{allVisibleProductsSelected ? 'Deselect page' : 'Select page'}
											</button>
											<button
												type="button"
												class="catalog-mini-action"
												disabled={!products.some((product) => product.stock <= 5)}
												onclick={selectLowStockProducts}
											>
												Low stock
											</button>
											{#if selectedProductIds.length > 0}
												<button
													type="button"
													class="catalog-mini-action text-[var(--accent-crimson)]"
													onclick={clearProductSelection}
												>
													Clear {selectedProductIds.length}
												</button>
											{/if}
										</div>
									</div>

									{#if selectedProductIds.length > 0}
										<section class="bulk-bar" in:fly={{ y: -6, duration: 180 }}>
											<div class="bulk-bar-head">
												<div>
													<p class="bulk-bar-kicker">Bulk edit</p>
													<h3 class="bulk-bar-title">
														{selectedProductIds.length} selected product{selectedProductIds.length ===
														1
															? ''
															: 's'}
													</h3>
													<p class="bulk-bar-note">
														Only filled fields are applied.
														{#if selectedProductIds.length !== selectedProducts.length}
															{selectedProducts.length} visible on this page.
														{/if}
													</p>
												</div>
												<button
													type="button"
													class="catalog-mini-action"
													onclick={clearProductSelection}
												>
													<X class="size-3.5" strokeWidth={2} />
													Clear
												</button>
											</div>
											<div class="bulk-bar-grid">
												<label>
													<span class="field-label">Selling price</span>
													<input
														bind:value={bulkEditor.price}
														class="input-field bg-white"
														inputmode="decimal"
														placeholder="Unchanged"
													/>
												</label>
												<label>
													<span class="field-label">MRP</span>
													<input
														bind:value={bulkEditor.mrp}
														class="input-field bg-white"
														inputmode="decimal"
														placeholder="Unchanged"
													/>
												</label>
												<label>
													<span class="field-label">Stock</span>
													<input
														bind:value={bulkEditor.stock}
														class="input-field bg-white"
														inputmode="numeric"
														placeholder="Unchanged"
													/>
												</label>
												<label>
													<span class="field-label">Status</span>
													<select bind:value={bulkEditor.status} class="input-field bg-white">
														<option value="">Unchanged</option>
														{#each productStatusOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label>
													<span class="field-label">Category</span>
													<select bind:value={bulkEditor.category} class="input-field bg-white">
														<option value="">Unchanged</option>
														{#each categoryOptions as option (option.value)}
															<option value={option.value}>{option.label}</option>
														{/each}
													</select>
												</label>
												<label>
													<span class="field-label">Warranty</span>
													<input
														bind:value={bulkEditor.warranty}
														class="input-field bg-white"
														placeholder="Unchanged"
													/>
												</label>
												<label>
													<span class="field-label">Local delivery</span>
													<select
														bind:value={bulkEditor.localDeliveryEligible}
														class="input-field bg-white"
													>
														<option value="">Unchanged</option>
														<option value="true">Enabled</option>
														<option value="false">Disabled</option>
													</select>
												</label>
												<label>
													<span class="field-label">COD</span>
													<select bind:value={bulkEditor.codAllowed} class="input-field bg-white">
														<option value="">Unchanged</option>
														<option value="true">Allowed</option>
														<option value="false">Disabled</option>
													</select>
												</label>
												<label>
													<span class="field-label">Returnable</span>
													<select bind:value={bulkEditor.returnable} class="input-field bg-white">
														<option value="">Unchanged</option>
														<option value="true">Yes</option>
														<option value="false">No</option>
													</select>
												</label>
											</div>
											{#if bulkNotice}
												<div
													class="mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] {noticeClasses(
														bulkNotice.tone
													)}"
												>
													<span class="mt-1 size-1.5 shrink-0 rounded-full bg-current"></span>
													<span>{bulkNotice.text}</span>
												</div>
											{/if}
											<div class="mt-2.5 flex flex-wrap gap-2">
												<button
													type="button"
													class="button button-primary inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[12px] font-medium text-white disabled:opacity-50"
													disabled={bulkSaving}
													onclick={applyBulkProductUpdate}
												>
													<Check class="size-3.5" strokeWidth={2.4} />
													{bulkSaving ? 'Applying...' : 'Apply to selected'}
												</button>
												<button
													type="button"
													class="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground"
													onclick={resetBulkProductEditor}
													disabled={bulkSaving}
												>
													Reset fields
												</button>
											</div>
										</section>
									{/if}

									<div class="catalog-table-wrap">
										<table class="catalog-table">
											<thead>
												<tr>
													<th class="cat-check-col">
														<button
															type="button"
															class="catalog-check {allVisibleProductsSelected ? 'active' : ''}"
															aria-label={allVisibleProductsSelected
																? 'Deselect page'
																: 'Select page'}
															aria-pressed={allVisibleProductsSelected}
															disabled={!products.length}
															onclick={allVisibleProductsSelected
																? deselectVisibleProducts
																: selectVisibleProducts}
														>
															{#if allVisibleProductsSelected}
																<Check class="size-3.5" strokeWidth={2.6} />
															{/if}
														</button>
													</th>
													<th class="cat-img-col">Image</th>
													<th>Product</th>
													<th class="cat-type-col">Type</th>
													<th class="cat-num-col">Price</th>
													<th class="cat-stock-col">Stock</th>
													<th class="cat-status-col">Status</th>
													<th class="cat-act-col">Edit</th>
												</tr>
											</thead>
											<tbody>
												{#each products as product, idx (product.id)}
													{@const isSelected = selectedProductIds.includes(product.id)}
													<tr
														class="catalog-trow {isSelected ? 'is-selected' : ''}"
														in:fly={{ y: 6, duration: 180, delay: Math.min(idx * 14, 260) }}
														onclick={() => openProductEditor(product)}
														onkeydown={(event) => handleProductRowKeydown(event, product)}
														tabindex="0"
														role="button"
														aria-label={`Edit ${product.title}`}
													>
														<td class="cat-check-col" onclick={(event) => event.stopPropagation()}>
															<button
																type="button"
																class="catalog-check {isSelected ? 'active' : ''}"
																aria-label={isSelected
																	? `Deselect ${product.title}`
																	: `Select ${product.title}`}
																aria-pressed={isSelected}
																onclick={() => toggleProductSelection(product.id)}
															>
																{#if isSelected}
																	<Check class="size-3.5" strokeWidth={2.6} />
																{/if}
															</button>
														</td>
														<td class="cat-img-col">
															<div class="catalog-thumb">
																<img
																	src={product.image || 'https://placehold.co/120x120?text=%20'}
																	alt={product.title}
																	loading="lazy"
																/>
															</div>
														</td>
														<td>
															<p class="catalog-name">{product.title}</p>
															<p class="catalog-sub">
																<span class="truncate">{product.brand}</span>
																{#if product.sku}
																	<span class="catalog-sku">SKU {product.sku}</span>
																{/if}
															</p>
														</td>
														<td class="cat-type-col">
															<span class="catalog-type">
																{categoryNameBySlug.get(product.category) ?? product.category}
															</span>
														</td>
														<td class="cat-num-col">
															<span class="catalog-price">{formatINR(product.price)}</span>
															{#if product.mrp > product.price}
																<span class="catalog-mrp">{formatINR(product.mrp)}</span>
															{/if}
														</td>
														<td class="cat-stock-col">
															<span class="catalog-stock">
																<span
																	class="catalog-dot {product.stock <= 0
																		? 'is-out'
																		: product.stock <= 5
																			? 'is-low'
																			: 'is-ok'}"
																></span>
																{product.stock}
															</span>
														</td>
														<td class="cat-status-col">
															<span class="catalog-status {product.status}">{product.status}</span>
														</td>
														<td class="cat-act-col" onclick={(event) => event.stopPropagation()}>
															<div class="catalog-actions">
																<button
																	type="button"
																	class="catalog-act edit"
																	aria-label={`Edit ${product.title}`}
																	onclick={() => openProductEditor(product)}
																>
																	<Pencil class="size-4" strokeWidth={2} />
																</button>
																<button
																	type="button"
																	class="catalog-act delete"
																	aria-label={`Delete ${product.title}`}
																	disabled={rowDeletingId === product.id}
																	onclick={() => deleteProductRow(product)}
																>
																	<Trash2 class="size-4" strokeWidth={2} />
																</button>
															</div>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
										{#if !products.length}
											<div class="catalog-empty">
												{productsError || 'No products match your filters.'}
											</div>
										{/if}
									</div>

									{#if productTotalPages > 1}
										<div
											class="flex items-center justify-between gap-2 border-t border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2"
										>
											<button
												type="button"
												class="inline-flex h-7 items-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
												disabled={productPage <= 1 || productsLoading}
												onclick={() => setProductPage(productPage - 1)}
											>
												Prev
											</button>
											<span class="text-[11px] text-[var(--black-alpha-48)]">
												Page {productPage} of {productTotalPages}
											</span>
											<button
												type="button"
												class="inline-flex h-7 items-center rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
												disabled={productPage >= productTotalPages || productsLoading}
												onclick={() => setProductPage(productPage + 1)}
											>
												Next
											</button>
										</div>
									{/if}
								</div>
								<!-- end catalog board -->
								{#if sheetFullscreen}
									<section
										class="spreadsheet-panel"
										class:sheet-fullscreen={sheetFullscreen}
										aria-label="Product spreadsheet editor"
									>
										<div class="spreadsheet-toolbar">
											<div class="min-w-0">
												<div class="flex items-center gap-2">
													<Table2 class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
													<h2 class="text-[14px] font-medium text-foreground">Sheet edit</h2>
													<span
														class="rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
													>
														{sheetRows.length.toLocaleString('en-IN')} rows
													</span>
													<span
														class="rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
													>
														{sheetMode === 'all'
															? activeCatalogFilterCount > 0
																? 'Filtered catalog'
																: 'All products'
															: 'Current page'}
													</span>
													{#if sheetMode === 'all' && activeCatalogFilterCount > 0}
														<span
															class="rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
														>
															{activeCatalogFilterCount} filter{activeCatalogFilterCount === 1
																? ''
																: 's'}
														</span>
													{/if}
													{#if dirtySheetCellCount > 0}
														<span
															class="rounded bg-[var(--heat-8)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--heat-100)]"
														>
															{dirtySheetCellCount} changed
														</span>
													{/if}
													{#if selectedProductIds.length > 0}
														<span
															class="rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
														>
															{selectedProductIds.length} selected
														</span>
													{/if}
													{#if sheetAllProductsLoading}
														<span
															class="rounded bg-[var(--heat-8)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--heat-100)]"
														>
															Loading {sheetAllProgress.loaded.toLocaleString('en-IN')} / {Math.max(
																sheetAllProgress.total,
																productTotal
															).toLocaleString('en-IN')}
														</span>
													{:else if sheetSortKey}
														<span
															class="rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--black-alpha-48)]"
														>
															Sorted by {sheetColumnName(sheetSortKey)}
															{sheetSortDirection}
														</span>
													{/if}
												</div>
											</div>
											<div class="flex flex-wrap items-center gap-2">
												<button
													type="button"
													class="catalog-mini-action"
													disabled={sheetAllProductsLoading || sheetSaving}
													onclick={loadAllSheetProducts}
												>
													{sheetAllProductsLoading ? 'Loading...' : 'Refresh'}
												</button>
												{#if sheetSortKey}
													<button
														type="button"
														class="catalog-mini-action"
														onclick={clearSheetSort}
													>
														Clear sort
													</button>
												{/if}
												<button
													type="button"
													class="catalog-mini-action"
													disabled={sheetFillTargetCount === 0 || sheetSaving}
													onclick={fillActiveCellToSelectedRows}
												>
													Fill selected
												</button>
												<button
													type="button"
													class="catalog-mini-action"
													onclick={() => (spreadsheetOpen = !spreadsheetOpen)}
												>
													{spreadsheetOpen ? 'Hide grid' : 'Show grid'}
												</button>
												<button
													type="button"
													class="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
													onclick={closeSpreadsheetView}
												>
													<Minimize2 class="size-3.5" strokeWidth={2} />
													Close
												</button>
												<button
													type="button"
													class="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[11px] font-medium text-[var(--black-alpha-64)] transition-colors hover:text-foreground disabled:opacity-40"
													disabled={dirtySheetCellCount === 0 || sheetSaving}
													onclick={resetSheetDrafts}
												>
													<RotateCcw class="size-3.5" strokeWidth={2} />
													Reset
												</button>
												<button
													type="button"
													class="button button-primary inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-medium text-white disabled:opacity-50"
													disabled={dirtySheetProducts.length === 0 || sheetSaving}
													onclick={saveSheetEdits}
												>
													<Save class="size-3.5" strokeWidth={2} />
													{sheetSaving ? 'Saving...' : `Save ${dirtySheetProducts.length || ''}`}
												</button>
											</div>
										</div>

										<div class="sheet-formula-bar">
											<div class="sheet-name-box" aria-label="Active cell">
												{activeSheetAddress}
											</div>
											<div class="sheet-formula-mark" aria-hidden="true">fx</div>
											{#if activeSheetProduct && activeSheetCell && activeSheetColumn?.kind === 'select'}
												<select
													class="sheet-formula-input"
													value={activeSheetValue}
													aria-label={`Edit ${activeSheetColumn.label} for ${activeSheetProduct.title}`}
													onchange={(event) => setActiveSheetValue(event.currentTarget.value)}
												>
													{#each sheetColumnOptions(activeSheetColumn) as option (option.value)}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											{:else}
												<input
													class="sheet-formula-input"
													value={activeSheetValue}
													disabled={!activeSheetProduct || !activeSheetCell}
													aria-label={activeSheetProduct && activeSheetColumn
														? `Edit ${activeSheetColumn.label} for ${activeSheetProduct.title}`
														: 'Active cell value'}
													oninput={(event) => setActiveSheetValue(event.currentTarget.value)}
												/>
											{/if}
											<button
												type="button"
												class="sheet-formula-action"
												disabled={!activeSheetProduct || !activeSheetCell}
												onclick={resetActiveSheetCell}
											>
												Reset cell
											</button>
											<button
												type="button"
												class="sheet-formula-action"
												disabled={!activeSheetProduct ||
													!activeSheetCell ||
													activeSheetColumn?.kind === 'select'}
												onclick={clearActiveSheetCell}
											>
												Clear
											</button>
										</div>

										{#if sheetNotice}
											<div
												class="mx-3 mb-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] {noticeClasses(
													sheetNotice.tone
												)}"
												in:fly={{ y: -4, duration: 180 }}
											>
												<span class="mt-1 size-1.5 shrink-0 rounded-full bg-current"></span>
												<span>{sheetNotice.text}</span>
											</div>
										{/if}

										{#if spreadsheetOpen}
											<div
												class="sheet-frame"
												bind:this={sheetFrameElement}
												tabindex="-1"
												onscroll={handleSheetScroll}
											>
												<table class="sheet-table">
													<colgroup>
														<col style="width: 54px" />
														{#each sheetColumns as column (column.key)}
															<col style="width: {column.width}" />
														{/each}
													</colgroup>
													<thead>
														<tr>
															<th class="sheet-corner sheet-letter-corner"></th>
															{#each sheetColumns as column, columnIndex (column.key)}
																<th
																	scope="col"
																	class:sheet-column-active={activeSheetCell?.key === column.key}
																>
																	<span>{sheetColumnLabel(columnIndex)}</span>
																</th>
															{/each}
														</tr>
														<tr>
															<th class="sheet-corner">#</th>
															{#each sheetColumns as column (column.key)}
																<th
																	scope="col"
																	class:sheet-column-active={activeSheetCell?.key === column.key}
																>
																	<button
																		type="button"
																		class="sheet-column-sort"
																		class:active={sheetSortKey === column.key}
																		aria-label={`Sort sheet by ${column.label}`}
																		onclick={() => toggleSheetSort(column.key)}
																	>
																		<span>{column.label}</span>
																		<span aria-hidden="true">{sheetSortGlyph(column.key)}</span>
																	</button>
																</th>
															{/each}
														</tr>
													</thead>
													<tbody>
														{#each sheetRows as product, rowIndex (product.id)}
															<tr
																class:sheet-row-active={activeSheetCell?.productId === product.id}
																class:sheet-row-dirty={sheetRowDirty(product)}
															>
																<th scope="row">
																	<button
																		type="button"
																		class="sheet-row-button {selectedProductIds.includes(product.id)
																			? 'selected'
																			: ''}"
																		aria-label={selectedProductIds.includes(product.id)
																			? `Deselect row ${rowIndex + 1}`
																			: `Select row ${rowIndex + 1}`}
																		aria-pressed={selectedProductIds.includes(product.id)}
																		onclick={() => toggleProductSelection(product.id)}
																	>
																		{rowIndex + 1}
																	</button>
																</th>
																{#each sheetColumns as column, columnIndex (column.key)}
																	{@const active =
																		activeSheetCell?.productId === product.id &&
																		activeSheetCell?.key === column.key}
																	{@const dirty = sheetCellDirty(product, column.key)}
																	<td
																		class:sheet-cell-active={active}
																		class:sheet-cell-dirty={dirty}
																		class:sheet-column-active={activeSheetCell?.key === column.key}
																	>
																		{#if column.kind === 'select'}
																			<select
																				value={sheetCellValue(product, column.key)}
																				data-sheet-row={rowIndex}
																				data-sheet-col={columnIndex}
																				class="sheet-input"
																				aria-label={`${column.label} for ${product.title}`}
																				onfocus={() => setActiveSheetCell(product, column.key)}
																				onchange={(event) =>
																					setSheetCell(
																						product,
																						column.key,
																						event.currentTarget.value
																					)}
																				onkeydown={(event) =>
																					handleSheetCellKeydown(event, rowIndex, columnIndex)}
																			>
																				{#each sheetColumnOptions(column) as option (option.value)}
																					<option value={option.value}>{option.label}</option>
																				{/each}
																			</select>
																		{:else}
																			<input
																				value={sheetCellValue(product, column.key)}
																				data-sheet-row={rowIndex}
																				data-sheet-col={columnIndex}
																				class="sheet-input"
																				inputmode={column.kind === 'number' ? 'decimal' : undefined}
																				aria-label={`${column.label} for ${product.title}`}
																				onfocus={() => setActiveSheetCell(product, column.key)}
																				oninput={(event) =>
																					setSheetCell(
																						product,
																						column.key,
																						event.currentTarget.value
																					)}
																				onkeydown={(event) =>
																					handleSheetCellKeydown(event, rowIndex, columnIndex)}
																				onpaste={(event) =>
																					handleSheetPaste(event, rowIndex, columnIndex)}
																			/>
																		{/if}
																	</td>
																{/each}
															</tr>
														{/each}
													</tbody>
												</table>
											</div>
											{#if sheetMode === 'all'}
												<div class="sheet-load-more">
													<div>
														<span>
															{sheetProducts.length.toLocaleString('en-IN')} of {Math.max(
																sheetAllProgress.total,
																productTotal
															).toLocaleString('en-IN')}
														</span>
														{#if sheetLoadMoreError}
															<small>{sheetLoadMoreError}</small>
														{:else}
															<small>
																{sheetCanLoadMore
																	? 'Scroll to keep loading matching products'
																	: 'All matching products loaded'}
															</small>
														{/if}
													</div>
													{#if sheetCanLoadMore}
														<button
															type="button"
															class="catalog-mini-action"
															disabled={sheetAllProductsLoading}
															onclick={loadMoreSheetProducts}
														>
															{sheetAllProductsLoading ? 'Loading...' : 'Load more'}
														</button>
													{/if}
												</div>
											{/if}
											<div class="sheet-status-bar">
												<span>{activeSheetAddress}</span>
												<span>{activeSheetProduct?.title ?? 'No cell selected'}</span>
												{#if activeSheetProduct}
													<span title={formatAdminDateTime(activeSheetProduct.updated_at)}>
														Edited {formatRelativeTime(activeSheetProduct.updated_at)}
													</span>
													<span title={formatAdminDateTime(activeSheetProduct.created_at)}>
														Created {formatRelativeTime(activeSheetProduct.created_at)}
													</span>
												{/if}
												<span>{dirtySheetProducts.length} dirty rows</span>
												<span>
													{sheetMode === 'all'
														? `${sheetRows.length.toLocaleString('en-IN')} loaded products`
														: `Page ${productPage} of ${productTotalPages}`}
												</span>
											</div>
										{/if}
									</section>
								{/if}

								{#if drawerOpen}
									<button
										type="button"
										class="drawer-backdrop"
										aria-label="Close editor"
										onclick={closeProductEditor}
										transition:fade={{ duration: 150 }}
									></button>
									<aside
										class="editor-drawer"
										transition:fly={{ x: 480, duration: 280, easing: cubicOut }}
										aria-label="Product editor"
									>
										<div class="drawer-head">
											<div class="min-w-0">
												<p class="drawer-kicker">
													{selectedProductId === 'new' ? 'New product' : 'Edit product'}
												</p>
												<h2 class="drawer-title">{productEditor.title || 'Untitled product'}</h2>
											</div>
											<button
												type="button"
												class="drawer-close"
												aria-label="Close editor"
												onclick={closeProductEditor}
											>
												<X class="size-4" strokeWidth={2.2} />
											</button>
										</div>
										<div class="drawer-body">
											<div class="border-b border-[var(--border-faint)] p-5">
												<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
													<div
														class="flex size-24 shrink-0 items-center justify-center rounded-md bg-[var(--background-lighter)] p-3"
													>
														{#if productEditor.image}
															<img
																src={productEditor.image}
																alt={productEditor.title || 'Preview'}
																class="max-h-full max-w-full object-contain"
															/>
														{:else}
															<Boxes
																class="size-5 text-[var(--black-alpha-16)]"
																strokeWidth={1.5}
															/>
														{/if}
													</div>
													<div class="min-w-0 flex-1">
														<div class="flex flex-wrap items-center gap-1.5">
															<span
																class="rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase
																{selectedProductId === 'new'
																	? 'bg-[var(--heat-100)] text-white'
																	: productEditor.status === 'active'
																		? 'bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]'
																		: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}"
															>
																{selectedProductId === 'new' ? 'new' : productEditor.status}
															</span>
															<span
																class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
															>
																{categoryNameBySlug.get(productEditor.category) ??
																	'Category pending'}
															</span>
														</div>
														<h2 class="mt-1 truncate text-[16px] font-medium text-foreground">
															{productEditor.title || 'Untitled product'}
														</h2>
														<p class="text-[12px] text-[var(--black-alpha-40)]">
															{productEditor.brand || 'Brand pending'} · SKU {productEditor.sku ||
																'—'}
														</p>
														{#if selectedProductId !== 'new'}
															<p
																class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--black-alpha-32)]"
															>
																<span title={formatAdminDateTime(productEditor.updatedAt)}>
																	Edited {formatRelativeTime(productEditor.updatedAt)}
																</span>
																<span title={formatAdminDateTime(productEditor.createdAt)}>
																	Created {formatRelativeTime(productEditor.createdAt)}
																</span>
															</p>
														{/if}
													</div>
													<div class="flex shrink-0 gap-5">
														<div>
															<p
																class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
															>
																Price
															</p>
															<p class="mt-0.5 text-[14px] font-medium text-foreground">
																{formatINR(Number(productEditor.price || 0))}
															</p>
														</div>
														<div>
															<p
																class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
															>
																Stock
															</p>
															<p class="mt-0.5 text-[14px] font-medium text-foreground">
																{productEditor.stock || '0'}
															</p>
														</div>
													</div>
												</div>
											</div>

											{#if productNotice}
												<div
													class="m-5 mb-0 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px] {noticeClasses(
														productNotice.tone
													)}"
													in:fly={{ y: -4, duration: 200 }}
												>
													<span class="mt-1 size-1.5 shrink-0 rounded-full bg-current"></span>
													<span>{productNotice.text}</span>
												</div>
											{/if}

											<div class="space-y-6 p-5">
												<section>
													<h3 class="section-title">Product identity</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
														<label>
															<span class="field-label">Title</span>
															<input bind:value={productEditor.title} class="input-field" />
														</label>
														<label>
															<span class="field-label">Brand</span>
															<input bind:value={productEditor.brand} class="input-field" />
														</label>
														<label>
															<span class="field-label">Category</span>
															<select bind:value={productEditor.category} class="input-field">
																{#each categoryOptions as option (option.value)}
																	<option value={option.value}>{option.label}</option>
																{/each}
															</select>
														</label>
														<label>
															<span class="field-label">SKU</span>
															<input bind:value={productEditor.sku} class="input-field" />
														</label>
														<label class="sm:col-span-2">
															<span class="field-label">Description</span>
															<textarea
																bind:value={productEditor.description}
																class="input-field min-h-[80px] py-2"
																style="height:auto"
															></textarea>
														</label>
														<label class="sm:col-span-2">
															<span class="field-label">Compatibility</span>
															<input bind:value={productEditor.compatibility} class="input-field" />
														</label>
													</div>
												</section>

												<hr class="border-[var(--border-faint)]" />

												<section>
													<h3 class="section-title">Pricing &amp; availability</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
														<label>
															<span class="field-label">Selling price</span>
															<input
																bind:value={productEditor.price}
																class="input-field"
																inputmode="decimal"
															/>
														</label>
														<label>
															<span class="field-label">Cost price</span>
															<input
																bind:value={productEditor.costPrice}
																class="input-field"
																inputmode="decimal"
															/>
														</label>
														<label>
															<span class="field-label">Max discount (%)</span>
															<input
																value={productEditor.maxDiscountPct}
																class="input-field bg-[var(--background-lighter)] text-[var(--black-alpha-56)]"
																readonly
																aria-readonly="true"
															/>
														</label>
														<label>
															<span class="field-label">MRP</span>
															<input
																bind:value={productEditor.mrp}
																class="input-field"
																inputmode="decimal"
															/>
														</label>
														<label>
															<span class="field-label">Stock</span>
															<input
																bind:value={productEditor.stock}
																class="input-field"
																inputmode="numeric"
															/>
														</label>
														<label>
															<span class="field-label">Status</span>
															<select bind:value={productEditor.status} class="input-field">
																<option value="active">Active</option>
																<option value="draft">Draft</option>
																<option value="archived">Archived</option>
															</select>
														</label>
													</div>
												</section>

												<hr class="border-[var(--border-faint)]" />

												<section>
													<h3 class="section-title">Trust, tax &amp; checkout</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
														<label>
															<span class="field-label">Authenticity</span>
															<select
																bind:value={productEditor.authenticityGrade}
																class="input-field"
															>
																<option value="oem">OEM</option>
																<option value="compatible">Compatible</option>
																<option value="refurbished">Refurbished</option>
																<option value="open_box">Open box</option>
															</select>
														</label>
														<label>
															<span class="field-label">Condition</span>
															<select bind:value={productEditor.conditionGrade} class="input-field">
																<option value="new">New</option>
																<option value="open_box">Open box</option>
																<option value="refurbished">Refurbished</option>
																<option value="used">Used</option>
															</select>
														</label>
														<label>
															<span class="field-label">HSN code</span>
															<input bind:value={productEditor.hsnCode} class="input-field" />
														</label>
														<label>
															<span class="field-label">GST rate (%)</span>
															<input
																bind:value={productEditor.gstRate}
																class="input-field"
																inputmode="numeric"
															/>
														</label>
													</div>
												</section>

												<hr class="border-[var(--border-faint)]" />

												<section>
													<h3 class="section-title">Delivery &amp; policies</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
														<label>
															<span class="field-label">DOA window (days)</span>
															<input
																bind:value={productEditor.doaPolicyDays}
																class="input-field"
																inputmode="numeric"
															/>
														</label>
														<label class="checkbox-field">
															<input
																type="checkbox"
																bind:checked={productEditor.localDeliveryEligible}
																class="size-3.5 accent-[var(--heat-100)]"
															/>
															<span class="text-[11px] text-[var(--black-alpha-56)]"
																>Local delivery</span
															>
														</label>
														<label class="checkbox-field">
															<input
																type="checkbox"
																bind:checked={productEditor.codAllowed}
																class="size-3.5 accent-[var(--heat-100)]"
															/>
															<span class="text-[11px] text-[var(--black-alpha-56)]"
																>COD allowed</span
															>
														</label>
														<label class="checkbox-field">
															<input
																type="checkbox"
																bind:checked={productEditor.returnable}
																class="size-3.5 accent-[var(--heat-100)]"
															/>
															<span class="text-[11px] text-[var(--black-alpha-56)]"
																>Returnable</span
															>
														</label>
														<label class="checkbox-field">
															<input
																type="checkbox"
																bind:checked={productEditor.isUniversal}
																class="size-3.5 accent-[var(--heat-100)]"
															/>
															<span class="text-[11px] text-[var(--black-alpha-56)]"
																>Universal fit</span
															>
														</label>
													</div>
												</section>

												<hr class="border-[var(--border-faint)]" />

												<section>
													<h3 class="section-title">Imagery &amp; dimensions</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
														<label>
															<span class="field-label">Primary image URL</span>
															<input bind:value={productEditor.image} class="input-field" />
														</label>
														<div class="flex items-end">
															<button
																type="button"
																class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-40)] hover:text-[var(--heat-100)] disabled:opacity-60"
																disabled={productImageUploading}
																onclick={uploadProductEditorImage}
															>
																<ImagePlus class="size-4" strokeWidth={2.2} />
																{productImageUploading ? 'Uploading...' : 'Upload image'}
															</button>
														</div>
														{#if productImageUploadError}
															<p class="text-[11px] text-red-600 sm:col-span-2">
																{productImageUploadError}
															</p>
														{/if}
														<label>
															<span class="field-label">Source URL</span>
															<input bind:value={productEditor.sourceUrl} class="input-field" />
														</label>
														<label class="sm:col-span-2">
															<span class="field-label">Additional images (one URL per line)</span>
															<textarea
																bind:value={productEditor.imagesText}
																class="input-field min-h-[80px] py-2 font-mono"
																style="height:auto"
															></textarea>
														</label>
														<div class="grid grid-cols-2 gap-2.5 sm:col-span-2 sm:grid-cols-4">
															<label>
																<span class="field-label">Weight (kg)</span>
																<input
																	bind:value={productEditor.weightKg}
																	class="input-field"
																	inputmode="decimal"
																/>
															</label>
															<label>
																<span class="field-label">Length (cm)</span>
																<input
																	bind:value={productEditor.lengthCm}
																	class="input-field"
																	inputmode="decimal"
																/>
															</label>
															<label>
																<span class="field-label">Breadth (cm)</span>
																<input
																	bind:value={productEditor.breadthCm}
																	class="input-field"
																	inputmode="decimal"
																/>
															</label>
															<label>
																<span class="field-label">Height (cm)</span>
																<input
																	bind:value={productEditor.heightCm}
																	class="input-field"
																	inputmode="decimal"
																/>
															</label>
														</div>
													</div>
												</section>

												<hr class="border-[var(--border-faint)]" />

												<section>
													<h3 class="section-title">Merchandising</h3>
													<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
														<label>
															<span class="field-label">Highlights (one per line)</span>
															<textarea
																bind:value={productEditor.highlightsText}
																class="input-field min-h-[80px] py-2"
																style="height:auto"
															></textarea>
														</label>
														<label>
															<span class="field-label">Search keywords (one per line)</span>
															<textarea
																bind:value={productEditor.searchKeywordsText}
																class="input-field min-h-[80px] py-2"
																style="height:auto"
															></textarea>
															<span
																class="mt-1 block text-[10px] {productKeywordOverflowCount > 0
																	? 'text-[var(--accent-crimson)]'
																	: 'text-[var(--black-alpha-40)]'}"
															>
																{productKeywordCount}/24 saved{productKeywordOverflowCount > 0
																	? `, ${productKeywordOverflowCount} extra ignored`
																	: ''}
															</span>
														</label>
													</div>
												</section>
											</div>

											<!-- Save bar -->
											<div class="editor-save-bar">
												<button
													type="button"
													class="button button-primary inline-flex h-9 items-center rounded-md px-5 text-[13px] font-medium text-white disabled:opacity-50"
													disabled={productSaving}
													onclick={saveProduct}
												>
													{productSaving ? 'Saving...' : 'Save product'}
												</button>
												{#if selectedProductId !== 'new'}
													<button
														type="button"
														class="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--accent-crimson)] transition-colors hover:border-[var(--accent-crimson)] hover:bg-[var(--accent-crimson)]/4 disabled:opacity-50"
														disabled={productDeleting}
														onclick={deleteProduct}
													>
														<Trash2 class="size-3.5" strokeWidth={2} />
														{productDeleting ? 'Processing...' : 'Delete or archive'}
													</button>
												{/if}
											</div>
										</div>
									</aside>
								{/if}
							{/if}
						{:else if view === 'operations'}
							<AdminOperationsPanel
								sections={operationsSections}
								{operationsSection}
								pendingFulfillment={analytics?.pendingFulfillment ?? 0}
								initialFilter={ordersInitialFilter}
								initialSearch={ordersInitialSearch}
								initialSelectId={ordersInitialSelectId}
								setOperationsSection={(section) => (operationsSection = section)}
							/>
						{:else if view === 'users'}
							<!-- USERS TAB -->
							{#if usersLoading && !users.length}
								<div class="grid gap-4 lg:grid-cols-2">
									<div class="skeleton-card h-[400px]"></div>
									<div class="skeleton-card h-[300px]"></div>
								</div>
							{:else}
								<div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
									<!-- User list -->
									<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
										<input
											bind:value={userSearch}
											class="input-field mb-3"
											placeholder="Search name, email, or phone"
										/>
										<div class="overflow-x-auto">
											<table class="w-full min-w-[600px] border-collapse text-left">
												<thead>
													<tr
														class="border-b border-[var(--border-muted)] text-[10px] font-medium tracking-[0.12em] text-[var(--black-alpha-40)] uppercase"
													>
														<th class="px-2 py-2">User</th>
														<th class="px-2 py-2">Role</th>
														<th class="px-2 py-2">Orders</th>
														<th class="px-2 py-2">Value</th>
													</tr>
												</thead>
												<tbody>
													{#each filteredUsers as user, idx (user.id)}
														<tr
															class="cursor-pointer border-b border-[var(--border-faint)] transition-colors hover:bg-[var(--background-lighter)]
																{user.id === selectedUserId ? 'bg-[var(--heat-4)]' : ''}"
															onclick={() => {
																selectedUserId = user.id;
																userEditor = mapUserToEditor(user);
																userNotice = null;
															}}
															in:fly={{ x: -6, duration: 180, delay: Math.min(idx * 20, 200) }}
														>
															<td class="px-2 py-3">
																<div class="flex items-center gap-2.5">
																	<span
																		class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase
																			{user.role !== 'user'
																			? 'bg-[var(--heat-8)] text-[var(--heat-100)]'
																			: 'bg-[var(--background-lighter)] text-[var(--black-alpha-40)]'}"
																	>
																		{(user.fullName || user.email || '?').slice(0, 2)}
																	</span>
																	<span class="min-w-0">
																		<p class="truncate text-[12px] font-medium text-foreground">
																			{user.fullName || user.email || 'Unnamed'}
																		</p>
																		<p class="truncate text-[10px] text-[var(--black-alpha-32)]">
																			{user.email || 'No email'}
																		</p>
																	</span>
																</div>
															</td>
															<td class="px-2 py-3">
																<span
																	class="rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
																	{user.role !== 'user'
																		? 'bg-[var(--accent-honey)]/12 text-[var(--accent-honey)]'
																		: 'bg-[var(--background-lighter)] text-[var(--black-alpha-40)]'}"
																	>{roleLabel(user.role)}</span
																>
															</td>
															<td class="px-2 py-3 text-[12px] text-foreground"
																>{user.orderCount}</td
															>
															<td class="px-2 py-3 text-[12px] text-foreground"
																>{formatINR(user.totalSpent)}</td
															>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
										{#if usersError}
											<div
												class="mt-3 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]"
											>
												{usersError}
											</div>
										{:else if !filteredUsers.length}
											<div class="mt-3 p-3 text-center text-[12px] text-[var(--black-alpha-32)]">
												No users match.
											</div>
										{/if}
									</div>

									<!-- User editor -->
									<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
										<p class="text-[13px] font-medium text-foreground">Edit account</p>

										{#if userNotice}
											<div
												class="mt-3 rounded-md border px-3 py-2 text-[12px] {noticeClasses(
													userNotice.tone
												)}"
												in:fly={{ y: -4, duration: 200 }}
											>
												{userNotice.text}
											</div>
										{/if}

										{#if selectedUser}
											<div class="mt-4 grid gap-3 sm:grid-cols-2">
												<label>
													<span class="field-label">Role</span>
													<select
														bind:value={userEditor.role}
														class="input-field"
														disabled={selectedUserIsCurrentAdmin}
													>
														<option value="user">Customer</option>
														{#each staffRoles as role (role)}
															<option value={role}>{roleLabel(role)}</option>
														{/each}
													</select>
													{#if selectedUserIsCurrentAdmin}
														<span class="mt-1 block text-[10px] text-[var(--black-alpha-32)]"
															>Use another admin account first.</span
														>
													{/if}
												</label>
												<label>
													<span class="field-label">Full name</span>
													<input bind:value={userEditor.fullName} class="input-field" />
												</label>
												<label class="sm:col-span-2">
													<span class="field-label">Phone</span>
													<input
														bind:value={userEditor.phone}
														class="input-field disabled:opacity-50"
														disabled={selectedUserPhoneLocked}
													/>
													{#if selectedUserPhoneLocked}
														<span class="mt-1 block text-[10px] text-[var(--black-alpha-32)]"
															>Locked — account has order history.</span
														>
													{/if}
												</label>
											</div>

											<div class="mt-4 grid gap-2 sm:grid-cols-2">
												<div class="rounded-md bg-[var(--background-lighter)] p-3">
													<p
														class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
													>
														Email
													</p>
													<p class="mt-0.5 text-[12px] font-medium text-foreground">
														{selectedUser.email || 'No email'}
													</p>
												</div>
												<div class="rounded-md bg-[var(--background-lighter)] p-3">
													<p
														class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
													>
														Joined
													</p>
													<p class="mt-0.5 text-[12px] font-medium text-foreground">
														{selectedUser.createdAt
															? new Date(selectedUser.createdAt).toLocaleString('en-IN')
															: 'Unknown'}
													</p>
												</div>
												<div class="rounded-md bg-[var(--background-lighter)] p-3">
													<p
														class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
													>
														Orders
													</p>
													<p class="mt-0.5 text-[12px] font-medium text-foreground">
														{selectedUser.orderCount}
													</p>
												</div>
												<div class="rounded-md bg-[var(--background-lighter)] p-3">
													<p
														class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
													>
														Total spent
													</p>
													<p class="mt-0.5 text-[12px] font-medium text-foreground">
														{formatINR(selectedUser.totalSpent)}
													</p>
												</div>
											</div>

											<div class="mt-4">
												<button
													type="button"
													class="button button-primary inline-flex h-9 items-center rounded-md px-4 text-[12px] font-medium disabled:opacity-50"
													disabled={userSaving}
													onclick={saveUser}
												>
													{userSaving ? 'Saving...' : 'Save account'}
												</button>
											</div>
										{:else}
											<div
												class="mt-4 rounded-md bg-[var(--background-lighter)] p-4 text-center text-[12px] text-[var(--black-alpha-32)]"
											>
												Select a user to edit.
											</div>
										{/if}
									</div>
								</div>
							{/if}
						{:else if view === 'promos'}
							<!-- PROMOS TAB -->
							<div class="mb-5 rounded-lg border border-[var(--border-faint)] bg-white p-4">
								<AdminPromotionsManager />
							</div>
							{#if couponsLoading && !coupons.length}
								<div class="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
									<div class="skeleton-card h-[300px]"></div>
									<div class="skeleton-card h-[400px]"></div>
								</div>
							{:else}
								<div class="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
									<!-- Coupon list -->
									<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
										<div class="mb-3 flex items-center justify-between gap-2">
											<div>
												<p class="text-[13px] font-medium text-foreground">Promotions</p>
												<p class="text-[11px] text-[var(--black-alpha-40)]">
													Coupon codes &amp; limits.
												</p>
											</div>
											<button
												type="button"
												class="button button-primary inline-flex h-8 items-center rounded-md px-3 text-[12px] font-medium"
												onclick={beginCreateCoupon}
											>
												New coupon
											</button>
										</div>

										<div class="overflow-hidden rounded-md border border-[var(--border-faint)]">
											<div
												class="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2 text-[9px] font-medium tracking-[0.12em] text-[var(--black-alpha-40)] uppercase"
											>
												<span>Code</span>
												<span>Used</span>
												<span>Status</span>
											</div>

											{#each coupons as coupon, idx (coupon.id)}
												<button
													type="button"
													class="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[var(--border-faint)] px-3 py-2.5 text-left transition-colors last:border-b-0
														{selectedCouponId === coupon.id ? 'bg-[var(--heat-4)]' : 'hover:bg-[var(--background-lighter)]'}"
													onclick={() => {
														selectedCouponId = coupon.id;
														couponEditor = mapCouponToEditor(coupon);
														couponNotice = null;
													}}
													in:fly={{ x: -6, duration: 180, delay: Math.min(idx * 25, 200) }}
												>
													<span>
														<span class="text-[12px] font-medium text-foreground"
															>{coupon.code}</span
														>
														<span class="mt-0.5 block text-[10px] text-[var(--black-alpha-32)]">
															{coupon.discountType === 'percent'
																? `${coupon.discountValue}% off`
																: coupon.discountType === 'free_delivery'
																	? 'Free delivery'
																	: `${formatINR(coupon.discountValue)} off`}
														</span>
													</span>
													<span class="text-right">
														<span
															class="font-mono text-[12px] font-medium text-foreground tabular-nums"
														>
															{coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}
														</span>
														{#if coupon.usageLimit}
															<span
																class="mt-1 block h-1 w-12 overflow-hidden rounded-full bg-[var(--background-lighter)]"
															>
																<span
																	class="block h-full rounded-full {coupon.usedCount >=
																	coupon.usageLimit
																		? 'bg-[var(--accent-crimson)]'
																		: 'bg-[var(--heat-100)]'}"
																	style="width: {Math.min(
																		100,
																		(coupon.usedCount / coupon.usageLimit) * 100
																	)}%"
																></span>
															</span>
														{/if}
													</span>
													<span
														class="rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
														{coupon.active
															? 'bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]'
															: 'bg-[var(--background-lighter)] text-[var(--black-alpha-32)]'}"
													>
														{coupon.active ? 'Active' : 'Off'}
													</span>
												</button>
											{/each}
										</div>

										{#if couponsError}
											<div
												class="mt-3 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]"
											>
												{couponsError}
											</div>
										{:else if !coupons.length}
											<div class="mt-3 p-3 text-center text-[12px] text-[var(--black-alpha-32)]">
												No coupons yet.
											</div>
										{/if}
									</div>

									<!-- Coupon editor -->
									<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
										<div class="flex items-start justify-between gap-3">
											<div>
												<p
													class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase"
												>
													{couponEditor.id ? 'Edit coupon' : 'Create coupon'}
												</p>
												<h3 class="mt-0.5 text-[16px] font-medium text-foreground">
													{couponEditor.code || 'New campaign'}
												</h3>
											</div>
											{#if selectedCoupon}
												<div class="text-right text-[11px] text-[var(--black-alpha-40)]">
													<p>{selectedCoupon.usedCount} redemptions</p>
													<p>{formatINR(selectedCoupon.discountGiven)} discounts</p>
												</div>
											{/if}
										</div>

										{#if couponNotice}
											<div
												class="mt-3 rounded-md border px-3 py-2 text-[12px] {noticeClasses(
													couponNotice.tone
												)}"
												in:fly={{ y: -4, duration: 200 }}
											>
												{couponNotice.text}
											</div>
										{/if}

										<div class="mt-4 grid gap-3 md:grid-cols-2">
											<label>
												<span class="field-label">Code</span>
												<input
													bind:value={couponEditor.code}
													class="input-field uppercase"
													oninput={() => (couponEditor.code = couponEditor.code.toUpperCase())}
												/>
											</label>
											<label>
												<span class="field-label">Discount type</span>
												<select bind:value={couponEditor.discountType} class="input-field">
													<option value="percent">Percent</option>
													<option value="fixed">Fixed amount</option>
													<option value="free_delivery">Free delivery</option>
												</select>
											</label>
											{#if couponEditor.discountType !== 'free_delivery'}
												<label>
													<span class="field-label">
														{couponEditor.discountType === 'percent'
															? 'Discount percent'
															: 'Discount amount'}
													</span>
													<input
														bind:value={couponEditor.discountValue}
														class="input-field"
														inputmode="decimal"
													/>
												</label>
											{/if}
											<label>
												<span class="field-label">Minimum subtotal</span>
												<input
													bind:value={couponEditor.minimumSubtotal}
													class="input-field"
													inputmode="decimal"
												/>
											</label>
											{#if couponEditor.discountType !== 'free_delivery'}
												<label>
													<span class="field-label">Max discount</span>
													<input
														bind:value={couponEditor.maxDiscount}
														class="input-field"
														inputmode="decimal"
													/>
												</label>
											{/if}
											<label>
												<span class="field-label">Total usage limit</span>
												<input
													bind:value={couponEditor.usageLimit}
													class="input-field"
													inputmode="numeric"
												/>
											</label>
											<label>
												<span class="field-label">Per user limit</span>
												<input
													bind:value={couponEditor.perUserLimit}
													class="input-field"
													inputmode="numeric"
												/>
											</label>
											<label>
												<span class="field-label">Status</span>
												<select
													class="input-field"
													value={couponEditor.active ? 'active' : 'inactive'}
													onchange={(event) =>
														(couponEditor.active =
															(event.currentTarget as HTMLSelectElement).value === 'active')}
												>
													<option value="active">Active</option>
													<option value="inactive">Inactive</option>
												</select>
											</label>
											<label
												class="flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2"
											>
												<input
													type="checkbox"
													class="size-4 rounded border-[var(--border-muted)] accent-[var(--heat-100)]"
													bind:checked={couponEditor.firstOrderOnly}
												/>
												<span class="text-[12px] font-medium text-foreground">First order only</span
												>
											</label>
											<label>
												<span class="field-label">Pincode prefix</span>
												<input
													bind:value={couponEditor.allowedPincodePrefix}
													class="input-field"
													inputmode="numeric"
													maxlength="6"
													placeholder="600"
												/>
											</label>
											<label>
												<span class="field-label">Starts at</span>
												<input
													bind:value={couponEditor.startsAt}
													class="input-field"
													type="datetime-local"
												/>
											</label>
											<label>
												<span class="field-label">Ends at</span>
												<input
													bind:value={couponEditor.endsAt}
													class="input-field"
													type="datetime-local"
												/>
											</label>
										</div>

										<fieldset
											class="mt-3 rounded-md border border-[var(--border-faint)] bg-white p-3"
										>
											<legend class="field-label">Applicable categories</legend>
											<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
												<span class="text-[11px] text-[var(--black-alpha-40)]">
													Leave empty to apply to every category.
												</span>
												{#if couponEditor.applicableCategories.length > 0}
													<button
														type="button"
														class="text-[11px] font-medium text-[var(--heat-100)]"
														onclick={() => (couponEditor.applicableCategories = [])}
													>
														Clear
													</button>
												{/if}
											</div>
											<div class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
												{#each categoryOptions as category (category.value)}
													<label
														class="flex items-center gap-2 rounded border border-[var(--border-faint)] px-2.5 py-2 text-[12px] text-[var(--black-alpha-64)]"
													>
														<input
															type="checkbox"
															class="size-3.5 rounded border-[var(--border-muted)] accent-[var(--heat-100)]"
															checked={couponEditor.applicableCategories.includes(category.value)}
															onchange={() => toggleCouponCategory(category.value)}
														/>
														<span>{category.label}</span>
													</label>
												{/each}
											</div>
										</fieldset>

										<label class="mt-3 block">
											<span class="field-label">Description</span>
											<textarea
												bind:value={couponEditor.description}
												class="input-field min-h-[80px] py-2"
											></textarea>
										</label>

										<div class="mt-4 flex flex-wrap gap-2">
											<button
												type="button"
												class="button button-primary inline-flex h-9 items-center rounded-md px-4 text-[12px] font-medium disabled:opacity-50"
												disabled={couponSaving}
												onclick={saveCoupon}
											>
												{couponSaving ? 'Saving...' : 'Save coupon'}
											</button>
											{#if couponEditor.id}
												<button
													type="button"
													class="inline-flex h-9 items-center rounded-md border border-[var(--border-faint)] bg-white px-3 text-[12px] font-medium text-[var(--accent-crimson)] transition-colors hover:border-[var(--accent-crimson)] disabled:opacity-50"
													disabled={couponDeleting}
													onclick={deleteCoupon}
												>
													{couponDeleting ? 'Removing...' : 'Remove'}
												</button>
											{/if}
										</div>
									</div>
								</div>
							{/if}
						{:else if view === 'support'}
							<div class="space-y-8">
								<AdminGrievanceManager />
								<AdminSupportManager />
							</div>
						{/if}
					</div>
				{/key}
			</div>
		{/if}
	</main>
</div>

<style>
	/* ── Shell layout ── */
	.admin-shell {
		display: grid;
		grid-template-columns: 240px 1fr;
		min-height: 100dvh;
	}

	/* ── Sidebar ── */
	.admin-sidebar {
		display: flex;
		flex-direction: column;
		background: var(--accent-black);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		position: sticky;
		top: 0;
		height: 100dvh;
		overflow-y: auto;
		z-index: 20;
	}

	.sidebar-header {
		padding: 20px 20px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.sidebar-logo {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
	}

	.sidebar-nav {
		padding: 6px 10px 12px;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.sidebar-group-label {
		padding: 14px 12px 4px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.24);
	}

	.sidebar-key {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		color: rgba(255, 255, 255, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		padding: 0 5px;
		line-height: 16px;
		opacity: 0;
		transition: opacity 150ms ease;
	}

	.sidebar-item:hover .sidebar-key,
	.sidebar-item.active .sidebar-key {
		opacity: 1;
	}

	.palette-trigger {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.04);
		padding: 8px 10px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.38);
		cursor: pointer;
		transition:
			border-color 160ms ease,
			color 160ms ease,
			background-color 160ms ease;
	}

	.palette-trigger:hover {
		border-color: rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.65);
		background: rgba(255, 255, 255, 0.07);
	}

	.palette-kbd {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		letter-spacing: 0.08em;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		padding: 1px 5px;
		color: rgba(255, 255, 255, 0.3);
	}

	.sidebar-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		border-radius: 8px;
		color: rgba(255, 255, 255, 0.4);
		font-size: 13px;
		font-weight: 500;
		transition:
			color 180ms ease,
			background-color 180ms ease;
		cursor: pointer;
		border: none;
		background: none;
		width: 100%;
		text-align: left;
	}

	.sidebar-item:hover {
		color: rgba(255, 255, 255, 0.7);
		background: rgba(255, 255, 255, 0.04);
	}

	.sidebar-item.active {
		color: white;
		background: rgba(255, 255, 255, 0.08);
	}

	.sidebar-indicator {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 3px;
		height: 16px;
		border-radius: 0 3px 3px 0;
		background: var(--heat-100);
	}

	.sidebar-label {
		flex: 1;
	}

	.sidebar-badge {
		font-size: 10px;
		font-weight: 600;
		background: var(--heat-100);
		color: white;
		padding: 1px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
	}

	.sidebar-chevron {
		opacity: 0.3;
	}

	.sidebar-stats {
		padding: 16px 20px;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.stat-label {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
	}

	.stat-value {
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
	}

	/* ── Mobile tabs ── */
	.admin-mobile-tabs {
		display: none;
	}

	/* ── Main content ── */
	.admin-main {
		background: var(--background-base);
		min-height: 100dvh;
		overflow-x: hidden;
	}

	.admin-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 24px;
		border-bottom: 1px solid var(--border-faint);
		background: rgba(255, 255, 255, 0.72);
		backdrop-filter: blur(8px);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.admin-loading-shell {
		padding: 24px;
	}

	.admin-content-area {
		position: relative;
		padding: 20px 24px 40px;
	}

	.admin-panel {
		width: 100%;
	}

	/* ── Skeleton ── */
	.skeleton-card {
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 16px;
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}

	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* ── KPI cards ── */
	.kpi-card {
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 16px 18px;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.kpi-card:hover {
		border-color: var(--heat-20);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.kpi-icon {
		display: flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: var(--heat-8);
		color: var(--heat-100);
		transition: transform 200ms ease;
	}

	.kpi-card:hover .kpi-icon {
		transform: scale(1.08);
	}

	/* ── Chart ── */
	.chart-bar {
		opacity: 0.8;
		transition: opacity 150ms ease;
	}

	.chart-bar:hover {
		opacity: 1;
	}

	.chart-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		background: var(--accent-black);
		color: white;
		font-size: 10px;
		padding: 3px 6px;
		border-radius: 4px;
		white-space: nowrap;
		z-index: 5;
	}

	.group:hover .chart-tooltip {
		display: block;
	}

	/* ── Catalog ── */
	.catalog-board {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.catalog-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.catalog-toolbar-icon {
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

	.catalog-controls {
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 12px;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
	}

	.catalog-search-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 34px auto;
		gap: 6px;
	}

	.catalog-search-field {
		display: flex;
		min-width: 0;
		height: 34px;
		align-items: center;
		gap: 7px;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 0 9px;
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease;
	}

	.catalog-search-field:focus-within {
		border-color: var(--heat-40);
		box-shadow: 0 0 0 3px var(--heat-8);
	}

	.catalog-search-input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--foreground);
		font-size: 12px;
		outline: none;
	}

	.catalog-search-input::placeholder {
		color: var(--black-alpha-32);
	}

	.catalog-search-submit,
	.catalog-excel-button {
		display: inline-flex;
		height: 34px;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: white;
		color: var(--black-alpha-64);
		font-size: 11px;
		font-weight: 600;
		transition:
			border-color 150ms ease,
			background-color 150ms ease,
			color 150ms ease,
			transform 150ms ease;
	}

	.catalog-search-submit {
		width: 34px;
		padding: 0;
	}

	.catalog-excel-button {
		gap: 6px;
		padding: 0 10px;
		white-space: nowrap;
	}

	.catalog-search-submit:hover:not(:disabled),
	.catalog-excel-button:hover:not(:disabled) {
		border-color: var(--heat-40);
		background: var(--heat-4);
		color: var(--heat-100);
	}

	.catalog-search-submit:active:not(:disabled),
	.catalog-excel-button:active:not(:disabled) {
		transform: translateY(1px);
	}

	.catalog-excel-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.catalog-filter-card {
		margin-top: 8px;
		border-radius: 7px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 8px;
	}

	.catalog-filter-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 7px;
		color: var(--black-alpha-56);
		font-size: 11px;
		font-weight: 600;
	}

	.catalog-filter-head strong {
		display: grid;
		min-width: 18px;
		height: 18px;
		place-items: center;
		border-radius: 5px;
		background: var(--heat-8);
		color: var(--heat-100);
		font-size: 10px;
		font-weight: 700;
	}

	.catalog-filter-head button {
		border: 0;
		background: transparent;
		color: var(--heat-100);
		font-size: 11px;
		font-weight: 600;
	}

	.catalog-filter-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 7px;
	}

	.catalog-filter-grid label {
		min-width: 0;
	}

	.catalog-filter-grid span {
		display: block;
		margin-bottom: 3px;
		color: var(--black-alpha-40);
		font-size: 10px;
		font-weight: 600;
	}

	.catalog-filter-wide {
		grid-column: 1 / -1;
	}

	.catalog-mini-action {
		display: inline-flex;
		height: 26px;
		align-items: center;
		border-radius: 5px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 0 8px;
		font-size: 11px;
		font-weight: 500;
		color: var(--black-alpha-64);
		transition:
			border-color 150ms ease,
			color 150ms ease,
			background-color 150ms ease;
	}

	.catalog-mini-action:hover:not(:disabled) {
		border-color: var(--black-alpha-24);
		color: var(--foreground);
	}

	.catalog-mini-action:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Bulk bar ── */
	.bulk-bar {
		border-radius: 12px;
		border: 1px solid var(--heat-20);
		background: linear-gradient(180deg, var(--heat-4), white 70%);
		padding: 14px 16px;
	}

	.bulk-bar-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.bulk-bar-kicker {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--heat-100);
	}

	.bulk-bar-title {
		margin-top: 2px;
		font-size: 15px;
		font-weight: 600;
		color: var(--foreground);
	}

	.bulk-bar-note {
		margin-top: 2px;
		font-size: 11px;
		color: var(--black-alpha-48);
	}

	.bulk-bar-grid {
		margin-top: 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 10px;
	}

	/* ── Catalog table ── */
	.catalog-table-wrap {
		overflow-x: auto;
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.catalog-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.catalog-table thead th {
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

	.catalog-table tbody td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border-faint);
		vertical-align: middle;
	}

	.catalog-table tbody tr:last-child td {
		border-bottom: 0;
	}

	.cat-check-col {
		width: 44px;
	}
	.cat-img-col {
		width: 64px;
	}
	.cat-type-col {
		width: 150px;
	}
	.cat-num-col,
	.catalog-table th.cat-num-col {
		width: 120px;
		text-align: right;
	}
	.cat-stock-col {
		width: 84px;
	}
	.cat-status-col {
		width: 110px;
	}
	.cat-act-col,
	.catalog-table th.cat-act-col {
		width: 92px;
		text-align: right;
	}

	.catalog-trow {
		cursor: pointer;
		outline: none;
		transition: background-color 140ms ease;
	}

	.catalog-trow:hover {
		background: var(--heat-4);
	}

	.catalog-trow:focus-visible {
		background: var(--heat-4);
		box-shadow: inset 2px 0 0 var(--heat-100);
	}

	.catalog-trow.is-selected {
		background: var(--heat-8);
	}

	.catalog-check {
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

	.catalog-check:hover:not(:disabled) {
		border-color: var(--heat-100);
	}

	.catalog-check.active {
		border-color: var(--heat-100);
		background: var(--heat-100);
	}

	.catalog-check:disabled {
		opacity: 0.4;
	}

	.catalog-thumb {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 3px;
		overflow: hidden;
	}

	.catalog-thumb img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.catalog-name {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
		line-height: 1.35;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.catalog-sub {
		margin-top: 2px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--black-alpha-40);
	}

	.catalog-sku {
		font-family: ui-monospace, monospace;
		font-size: 10px;
		color: var(--black-alpha-32);
	}

	.catalog-type {
		display: inline-block;
		border-radius: 6px;
		background: var(--background-lighter);
		border: 1px solid var(--border-faint);
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 500;
		color: var(--black-alpha-64);
		white-space: nowrap;
	}

	.catalog-price {
		font-weight: 600;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.catalog-mrp {
		display: block;
		font-size: 11px;
		color: var(--black-alpha-32);
		text-decoration: line-through;
	}

	.catalog-stock {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--foreground);
	}

	.catalog-dot {
		width: 7px;
		height: 7px;
		border-radius: 999px;
	}
	.catalog-dot.is-ok {
		background: var(--accent-forest);
	}
	.catalog-dot.is-low {
		background: var(--accent-honey);
	}
	.catalog-dot.is-out {
		background: var(--accent-crimson);
	}

	.catalog-status {
		display: inline-block;
		border-radius: 6px;
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.catalog-status.active {
		background: color-mix(in srgb, var(--accent-forest) 12%, white);
		color: var(--accent-forest);
	}
	.catalog-status.draft {
		background: color-mix(in srgb, var(--accent-honey) 14%, white);
		color: var(--accent-honey);
	}
	.catalog-status.archived {
		background: var(--background-lighter);
		color: var(--black-alpha-40);
	}

	.catalog-actions {
		display: inline-flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.catalog-act {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		color: var(--black-alpha-56);
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}

	.catalog-act.edit:hover {
		border-color: var(--heat-100);
		background: var(--heat-4);
		color: var(--heat-100);
	}

	.catalog-act.delete:hover:not(:disabled) {
		border-color: var(--accent-crimson);
		background: color-mix(in srgb, var(--accent-crimson) 6%, white);
		color: var(--accent-crimson);
	}

	.catalog-act:disabled {
		opacity: 0.5;
		cursor: progress;
	}

	.catalog-empty {
		padding: 40px 16px;
		text-align: center;
		font-size: 13px;
		color: var(--black-alpha-32);
	}

	/* ── Editor drawer ── */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(15, 15, 15, 0.32);
		backdrop-filter: blur(1.5px);
		border: 0;
	}

	.editor-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 61;
		width: min(560px, 100vw);
		display: flex;
		flex-direction: column;
		background: white;
		border-left: 1px solid var(--border-faint);
		box-shadow: -16px 0 48px rgba(0, 0, 0, 0.16);
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-shrink: 0;
		padding: 14px 18px;
		border-bottom: 1px solid var(--border-faint);
		background: var(--background-lighter);
	}

	.drawer-kicker {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--heat-100);
	}

	.drawer-title {
		margin-top: 2px;
		font-size: 15px;
		font-weight: 600;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 420px;
	}

	.drawer-close {
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

	.drawer-close:hover {
		border-color: var(--accent-crimson);
		color: var(--accent-crimson);
	}

	.drawer-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.spreadsheet-panel {
		position: relative;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
	}

	.spreadsheet-panel.sheet-fullscreen {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100dvh;
		border: 0;
		border-radius: 0;
		background: white;
		box-shadow: none;
	}

	.sheet-fullscreen .spreadsheet-toolbar {
		flex: 0 0 auto;
		padding: 12px 16px;
	}

	.sheet-fullscreen .sheet-formula-bar,
	.sheet-fullscreen .sheet-status-bar {
		flex: 0 0 auto;
	}

	.sheet-fullscreen .sheet-frame {
		flex: 1 1 auto;
		max-height: none;
		min-height: 0;
	}

	.spreadsheet-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border-bottom: 1px solid var(--border-faint);
		background: linear-gradient(180deg, white, var(--background-lighter));
		padding: 10px 12px;
	}

	.sheet-formula-bar {
		display: grid;
		grid-template-columns: 72px 34px minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0;
		border-bottom: 1px solid var(--border-faint);
		background: white;
		padding: 6px;
	}

	.sheet-name-box,
	.sheet-formula-mark,
	.sheet-formula-input,
	.sheet-formula-action {
		height: 30px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
	}

	.sheet-name-box {
		display: grid;
		place-items: center;
		border-radius: 5px 0 0 5px;
		color: var(--black-alpha-64);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 12px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.sheet-formula-mark {
		display: grid;
		place-items: center;
		border-left: 0;
		color: var(--heat-100);
		font-family: ui-serif, Georgia, Cambria, serif;
		font-size: 13px;
		font-style: italic;
		font-weight: 700;
	}

	.sheet-formula-input {
		min-width: 0;
		border-left: 0;
		background: white;
		padding: 0 10px;
		color: var(--foreground);
		font-size: 12px;
		outline: none;
	}

	.sheet-formula-input:focus {
		border-color: var(--heat-40);
		box-shadow: inset 0 0 0 1px var(--heat-20);
	}

	.sheet-formula-input:disabled {
		color: var(--black-alpha-32);
	}

	.sheet-formula-action {
		border-left: 0;
		padding: 0 10px;
		color: var(--black-alpha-56);
		font-size: 11px;
		font-weight: 600;
		transition:
			background-color 150ms ease,
			color 150ms ease;
	}

	.sheet-formula-action:last-child {
		border-radius: 0 5px 5px 0;
	}

	.sheet-formula-action:hover:not(:disabled) {
		background: white;
		color: var(--foreground);
	}

	.sheet-formula-action:disabled {
		opacity: 0.45;
	}

	.sheet-frame {
		max-height: min(62vh, 600px);
		overflow: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable both-edges;
		background:
			linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
			linear-gradient(180deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
		background-size: 32px 32px;
	}

	.sheet-frame:focus {
		outline: none;
	}

	.sheet-table {
		min-width: 1900px;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
		background: white;
	}

	.sheet-table th,
	.sheet-table td {
		height: 34px;
		border-right: 1px solid var(--border-faint);
		border-bottom: 1px solid var(--border-faint);
		padding: 0;
	}

	.sheet-table thead th {
		position: sticky;
		z-index: 2;
		background: var(--background-lighter);
		color: var(--black-alpha-56);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-align: left;
		text-transform: uppercase;
	}

	.sheet-table thead tr:first-child th {
		top: 0;
		height: 26px;
		background: #f4f2ef;
		color: var(--black-alpha-40);
		text-align: center;
	}

	.sheet-table thead tr:nth-child(2) th {
		top: 26px;
	}

	.sheet-table thead th > span {
		display: block;
		overflow: hidden;
		padding: 0 9px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sheet-table th:first-child {
		position: sticky;
		left: 0;
		z-index: 3;
		background: var(--background-lighter);
	}

	.sheet-table thead th:first-child {
		z-index: 4;
	}

	.sheet-corner {
		text-align: center !important;
	}

	.sheet-letter-corner {
		background: #efede9 !important;
	}

	.sheet-column-active {
		background: rgba(250, 93, 25, 0.035);
	}

	.sheet-table thead th.sheet-column-active {
		background: var(--heat-8);
		color: var(--heat-100);
		box-shadow: inset 0 -1px 0 var(--heat-20);
	}

	.sheet-column-sort {
		display: flex;
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		border: 0;
		background: transparent;
		padding: 0 9px;
		color: inherit;
		font: inherit;
		text-align: left;
		text-transform: inherit;
	}

	.sheet-column-sort span:first-child {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sheet-column-sort span:last-child {
		color: var(--black-alpha-32);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 10px;
	}

	.sheet-column-sort:hover,
	.sheet-column-sort.active {
		color: var(--heat-100);
	}

	.sheet-column-sort.active span:last-child {
		color: var(--heat-100);
	}

	.sheet-row-button {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--black-alpha-40);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 11px;
		font-weight: 600;
		transition:
			background-color 140ms ease,
			color 140ms ease;
	}

	.sheet-row-button:hover,
	.sheet-row-button.selected {
		background: var(--heat-8);
		color: var(--heat-100);
	}

	.sheet-row-active th:first-child {
		background: var(--heat-8);
	}

	.sheet-row-active .sheet-row-button {
		color: var(--heat-100);
	}

	.sheet-row-dirty th:first-child {
		background: var(--heat-4);
	}

	.sheet-input {
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: 0;
		background: transparent;
		padding: 0 9px;
		color: var(--foreground);
		font-size: 12px;
		outline: none;
		font-variant-numeric: tabular-nums;
	}

	.sheet-input:focus {
		background: white;
	}

	.sheet-cell-active {
		position: relative;
		z-index: 1;
		box-shadow: inset 0 0 0 2px var(--heat-100);
	}

	.sheet-cell-dirty {
		background: var(--heat-4);
	}

	.sheet-cell-dirty .sheet-input {
		color: var(--heat-120);
		font-weight: 500;
	}

	.sheet-status-bar {
		display: flex;
		min-height: 28px;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		border-top: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 5px 10px;
		color: var(--black-alpha-48);
		font-size: 11px;
	}

	.sheet-status-bar span:first-child {
		color: var(--foreground);
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.sheet-load-more {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border-top: 1px solid var(--border-faint);
		background: white;
		padding: 8px 12px;
		color: var(--black-alpha-48);
		font-size: 11px;
	}

	.sheet-load-more span {
		display: block;
		color: var(--foreground);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.sheet-load-more small {
		display: block;
		margin-top: 2px;
		color: var(--black-alpha-40);
		font-size: 10px;
	}

	@media (max-width: 767px) {
		.catalog-search-row {
			grid-template-columns: minmax(0, 1fr) 34px;
		}

		.catalog-excel-button {
			grid-column: 1 / -1;
			width: 100%;
		}

		.sheet-formula-bar {
			grid-template-columns: 58px 30px minmax(0, 1fr);
		}

		.sheet-formula-action {
			display: none;
		}
	}

	.editor-save-bar {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		border-top: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 16px 20px;
	}

	/* ── Shared field styles ── */
	.section-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--foreground);
	}

	.field-label {
		display: block;
		margin-bottom: 4px;
		font-size: 11px;
		font-weight: 500;
		color: var(--black-alpha-48);
	}

	.checkbox-field {
		display: flex;
		align-items: center;
		gap: 8px;
		border-radius: 6px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 8px 12px;
	}

	/* ── Notifications ── */
	.notif-wrap {
		position: relative;
	}

	.notif-bell {
		position: relative;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid var(--border-muted);
		background: white;
		color: var(--black-alpha-56);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
		transition:
			border-color 140ms ease,
			color 140ms ease;
	}

	.notif-bell:hover {
		border-color: var(--black-alpha-24);
		color: var(--foreground);
	}

	.notif-dot {
		position: absolute;
		top: -6px;
		right: -6px;
		display: grid;
		place-items: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--heat-100);
		color: white;
		font-size: 9px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		box-shadow: 0 0 0 2px white;
	}

	.notif-scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: transparent;
		border: 0;
		cursor: default;
	}

	.notif-panel {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 41;
		width: 300px;
		max-width: calc(100vw - 24px);
		border-radius: 12px;
		border: 1px solid var(--border-faint);
		background: white;
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14);
		overflow: hidden;
	}

	.notif-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 11px 14px;
		border-bottom: 1px solid var(--border-faint);
		background: var(--background-lighter);
		font-size: 12px;
		font-weight: 600;
		color: var(--foreground);
	}

	.notif-count {
		display: grid;
		place-items: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 999px;
		background: var(--heat-8);
		color: var(--heat-100);
		font-size: 10px;
		font-weight: 700;
	}

	.notif-head-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.notif-markall {
		font-size: 11px;
		font-weight: 600;
		color: var(--heat-100);
	}

	.notif-markall:hover {
		text-decoration: underline;
	}

	.notif-scroll {
		max-height: 60vh;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.notif-section {
		padding: 8px 14px 4px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--black-alpha-40);
		border-top: 1px solid var(--border-faint);
	}

	.notif-list {
		display: flex;
		flex-direction: column;
	}

	.notif-item.is-unread {
		background: var(--heat-4);
	}

	.notif-sev {
		width: 7px;
		height: 7px;
		margin-top: 5px;
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--black-alpha-24);
	}
	.notif-sev.success {
		background: var(--accent-forest);
	}
	.notif-sev.warning {
		background: var(--accent-honey);
	}
	.notif-sev.critical {
		background: var(--accent-crimson);
	}

	.notif-item-time {
		display: block;
		margin-top: 2px;
		font-size: 10px;
		color: var(--black-alpha-32);
	}

	.notif-unread-dot {
		width: 7px;
		height: 7px;
		flex-shrink: 0;
		border-radius: 999px;
		background: var(--heat-100);
	}

	.notif-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		text-align: left;
		border-bottom: 1px solid var(--border-faint);
		transition: background-color 140ms ease;
	}

	.notif-item:last-child {
		border-bottom: 0;
	}

	.notif-item:hover {
		background: var(--heat-4);
	}

	.notif-item-badge {
		display: grid;
		place-items: center;
		min-width: 24px;
		height: 24px;
		flex-shrink: 0;
		padding: 0 6px;
		border-radius: 7px;
		background: var(--heat-8);
		color: var(--heat-100);
		font-size: 12px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.notif-item-text {
		flex: 1;
		min-width: 0;
	}

	.notif-item-label {
		display: block;
		font-size: 12px;
		font-weight: 500;
		color: var(--foreground);
	}

	.notif-item-hint {
		display: block;
		font-size: 11px;
		color: var(--black-alpha-40);
	}

	.notif-empty {
		padding: 24px 14px;
		text-align: center;
		font-size: 12px;
		color: var(--black-alpha-40);
	}

	/* ── Responsive: mobile ── */
	@media (max-width: 1023px) {
		.admin-shell {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
			min-height: 100dvh;
		}

		.admin-sidebar {
			display: none;
		}

		.admin-mobile-tabs {
			display: flex;
			align-items: center;
			gap: 2px;
			overflow-x: auto;
			border-bottom: 1px solid var(--border-faint);
			background: var(--background-base);
			padding: 0 12px;
			position: sticky;
			top: 0;
			z-index: 15;
		}

		.mobile-tab {
			position: relative;
			display: flex;
			align-items: center;
			gap: 5px;
			padding: 10px 12px;
			font-size: 13px;
			font-weight: 500;
			white-space: nowrap;
			color: var(--black-alpha-40);
			transition: color 180ms ease;
			background: none;
			border: none;
			cursor: pointer;
		}

		.mobile-tab.active {
			color: var(--heat-100);
		}

		.mobile-tab:hover {
			color: var(--black-alpha-64);
		}

		.admin-content-area {
			padding: 16px 12px 32px;
		}

		.admin-main {
			min-height: 100dvh;
		}

		.admin-topbar {
			position: static;
			padding: 10px 12px;
		}
	}

	/* ── Tablet sidebar narrows ── */
	@media (min-width: 1024px) and (max-width: 1279px) {
		.admin-shell {
			grid-template-columns: 200px 1fr;
		}
	}
</style>
