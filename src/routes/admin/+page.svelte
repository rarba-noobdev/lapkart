<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminCommandPalette from '$lib/components/admin/AdminCommandPalette.svelte';
	import AdminOrdersManager from '$lib/components/admin/AdminOrdersManager.svelte';
	import AdminSupportManager from '$lib/components/admin/AdminSupportManager.svelte';
	import AdminGrievanceManager from '$lib/components/admin/AdminGrievanceManager.svelte';
	import FulfillmentQueue from '$lib/components/admin/FulfillmentQueue.svelte';
	import type { AdminOrderRecord } from '$lib/admin';
	import { apiBase } from '$lib/api-base';
	import { categories, formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import { isStaffRole, roleLabel, staffRoles, type AppRole } from '$lib/roles';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
	import {
		Activity,
		ArrowUpRight,
		Boxes,
		Flame,
		LayoutDashboard,
		LifeBuoy,
		Package,
		Plus,
		Search,
		ShieldAlert,
		Tag,
		Trash2,
		TrendingUp,
		Truck,
		Users
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly, crossfade } from 'svelte/transition';
	import { cubicOut, quintOut } from 'svelte/easing';

	const [send, receive] = crossfade({
		duration: 300,
		easing: cubicOut,
		fallback(node) {
			const style = getComputedStyle(node);
			const opacity = +style.opacity;
			return {
				duration: 250,
				easing: cubicOut,
				css: (t) => `opacity: ${t * opacity}`
			};
		}
	});

	type AdminView = 'overview' | 'catalog' | 'operations' | 'users' | 'promos' | 'support';

	type OperationsSection = 'orders' | 'fulfillment';

	type Notice = {
		tone: 'error' | 'success' | 'info';
		text: string;
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
		updated_at: string;
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
		discountType: 'percent' | 'fixed';
		discountValue: number;
		minimumSubtotal: number;
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
		discountType: 'percent' | 'fixed';
		discountValue: string;
		minimumSubtotal: string;
		maxDiscount: string;
		startsAt: string;
		endsAt: string;
		usageLimit: string;
		perUserLimit: string;
		active: boolean;
	};

	const tabs: Array<{ id: AdminView; label: string; icon: typeof LayoutDashboard }> = [
		{ id: 'overview', label: 'Overview', icon: LayoutDashboard },
		{ id: 'operations', label: 'Operations', icon: Package },
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
		operations: 'Orders, fulfillment, cancellations, and refunds',
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
		{ id: 'fulfillment', label: 'Fulfillment', icon: Truck }
	];

	const overviewIcons: Record<string, typeof TrendingUp> = {
		orders: Package,
		products: Boxes,
		users: Users,
		revenue: TrendingUp,
		margin: TrendingUp
	};

	const categoryOptions = categories.map((category) => ({
		value: category.slug,
		label: category.name
	}));
	const defaultCategory = categoryOptions[0]?.value ?? '';
	const categoryNameBySlug = new Map(categories.map((category) => [category.slug, category.name]));
	const currentUser = $derived(page.data.user ?? null);
	const currentRole = $derived(page.data.role ?? null);
	const auth = getAuthContext();

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

	let productSearch = $state('');
	let productPage = $state(1);
	let productTotal = $state(0);
	let productTotalPages = $state(1);
	let productSearchTimer: number | null = null;
	const PRODUCT_PAGE_SIZE = 60;
	let selectedProductId = $state<string | 'new' | null>(null);
	let productEditor = $state<ProductEditorState>(emptyProductEditor());
	let productSaving = $state(false);
	let productDeleting = $state(false);
	let productNotice = $state<Notice | null>(null);

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
			isUniversal: false
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
			isUniversal: product.is_universal === true
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
			active: coupon.active
		};
	}

	function parseLines(input: string) {
		return input
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
	}

	function payloadNumber(input: string) {
		const value = input.trim();
		if (!value) return null;
		return Number(value);
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

	async function requestAdmin<T>(path: string, init?: RequestInit): Promise<T> {
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

	async function loadAnalytics() {
		try {
			overviewError = null;
			analytics = await requestAdmin<AdminAnalytics>('/admin/analytics');
		} catch (loadError) {
			overviewError = loadError instanceof Error ? loadError.message : 'Could not load analytics';
		}
	}

	async function loadProducts(force = false) {
		if (productsLoading || (!force && productsLoaded)) return;
		try {
			productsLoading = true;
			productsError = null;
			const params = new URLSearchParams({
				page: String(productPage),
				pageSize: String(PRODUCT_PAGE_SIZE)
			});
			const q = productSearch.trim();
			if (q) params.set('q', q);
			const response = await requestAdmin<{
				products: AdminProduct[];
				pagination?: { page: number; total: number; totalPages: number };
			}>(`/admin/products?${params}`);
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

	function queueProductSearch() {
		if (productSearchTimer) window.clearTimeout(productSearchTimer);
		productSearchTimer = window.setTimeout(() => {
			productSearchTimer = null;
			productPage = 1;
			void loadProducts(true);
		}, 300);
	}

	function setProductPage(next: number) {
		const target = Math.min(Math.max(1, next), productTotalPages);
		if (target === productPage) return;
		productPage = target;
		void loadProducts(true);
	}

	async function refreshCatalogSearch() {
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
		if (selectedProductId === 'new') return;

		if (!products.length) {
			selectedProductId = null;
			productEditor = emptyProductEditor();
			return;
		}

		const nextProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
		selectedProductId = nextProduct.id;
		productEditor = mapProductToEditor(nextProduct);
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
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			paletteOpen = !paletteOpen;
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
	}

	async function saveProduct() {
		productSaving = true;
		productNotice = null;

		try {
			const payload = {
				title: productEditor.title,
				brand: productEditor.brand,
				category: productEditor.category,
				description: productEditor.description,
				image: productEditor.image,
				images: parseLines(productEditor.imagesText),
				price: Number(productEditor.price),
				sellingPrice: Number(productEditor.price),
				costPrice: payloadNumber(productEditor.costPrice) ?? 0,
				mrp: Number(productEditor.mrp),
				stock: Number(productEditor.stock),
				status: productEditor.status,
				sku: productEditor.sku,
				sourceUrl: productEditor.sourceUrl,
				compatibility: productEditor.compatibility,
				warranty: productEditor.warranty,
				highlights: parseLines(productEditor.highlightsText),
				searchKeywords: parseLines(productEditor.searchKeywordsText),
				weightKg: payloadNumber(productEditor.weightKg),
				lengthCm: payloadNumber(productEditor.lengthCm),
				breadthCm: payloadNumber(productEditor.breadthCm),
				heightCm: payloadNumber(productEditor.heightCm),
				authenticityGrade: productEditor.authenticityGrade,
				conditionGrade: productEditor.conditionGrade,
				hsnCode: productEditor.hsnCode,
				gstRate: payloadNumber(productEditor.gstRate) ?? 18,
				doaPolicyDays: payloadNumber(productEditor.doaPolicyDays) ?? 7,
				localDeliveryEligible: productEditor.localDeliveryEligible,
				codEligible: productEditor.codAllowed,
				codAllowed: productEditor.codAllowed,
				returnable: productEditor.returnable,
				isUniversal: productEditor.isUniversal
			};

			if (selectedProductId === 'new' || !productEditor.id) {
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
				productEditor = mapProductToEditor(response.product);
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
				discountValue: Number(couponEditor.discountValue),
				minimumSubtotal: Number(couponEditor.minimumSubtotal || 0),
				maxDiscount: couponEditor.maxDiscount ? Number(couponEditor.maxDiscount) : null,
				startsAt: fromDateTimeInput(couponEditor.startsAt),
				endsAt: fromDateTimeInput(couponEditor.endsAt),
				usageLimit: couponEditor.usageLimit ? Number(couponEditor.usageLimit) : null,
				perUserLimit: Number(couponEditor.perUserLimit || 1),
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
			.subscribe();

		return () => {
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
							<span
								class="sidebar-indicator"
								in:receive={{ key: 'sidebar-active' }}
								out:send={{ key: 'sidebar-active' }}
							></span>
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
						in:receive={{ key: 'mobile-tab' }}
						out:send={{ key: 'mobile-tab' }}
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
							<!-- OVERVIEW TAB -->
							<div class="space-y-5">
								{#if overviewError}
									<div
										class="flex items-start gap-2 rounded-lg border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[13px] text-[var(--accent-crimson)]"
										in:fly={{ y: -8, duration: 200 }}
									>
										<ShieldAlert class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
										<span>{overviewError}</span>
									</div>
								{/if}

								<!-- Needs action -->
								{#if needsActionCards.length}
									<div in:fly={{ y: 12, duration: 300 }}>
										<p
											class="mb-2 text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
										>
											Needs action
										</p>
										<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
											{#each needsActionCards as card, idx (card.id)}
												<button
													type="button"
													class="group flex items-center justify-between rounded-lg border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4 text-left transition-colors hover:border-[var(--heat-100)]"
													in:fly={{ y: 12, duration: 250, delay: idx * 50 }}
													onclick={card.action}
												>
													<div>
														<p
															class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase"
														>
															{card.label}
														</p>
														<p
															class="mt-1.5 text-[24px] font-semibold tracking-tight text-foreground"
														>
															{card.count}
														</p>
														<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
															{card.hint}
														</p>
													</div>
													<ArrowUpRight
														class="size-4 text-[var(--heat-100)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
														strokeWidth={2.5}
													/>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- KPI cards -->
								<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									{#each overviewCards as card, idx (card.id)}
										{@const Icon = overviewIcons[card.id] ?? TrendingUp}
										<div
											class="kpi-card group"
											in:fly={{ y: 16, duration: 300, delay: idx * 60, easing: cubicOut }}
										>
											<div class="flex items-start justify-between">
												<div>
													<p
														class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
													>
														{card.label}
													</p>
													<p
														class="mt-2 text-[26px] font-semibold tracking-tight text-foreground tabular-nums"
													>
														{card.value}
													</p>
												</div>
												<div class="kpi-icon">
													<Icon class="size-4" strokeWidth={2} />
												</div>
											</div>
											{#if card.id === 'revenue' && analytics?.monthlySeries?.length}
												<div class="mt-3 flex items-end gap-px" style="height: 22px">
													{#each analytics.monthlySeries.slice(-12) as month (month.month)}
														<div
															class="flex-1 rounded-t-[1px] bg-[var(--heat-100)]/25 transition-colors duration-300 group-hover:bg-[var(--heat-100)]/60"
															style="height: {Math.max(
																8,
																(month.revenue / maxMonthlyRevenue) * 100
															)}%"
														></div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>

								<!-- Period reports -->
								{#if analytics?.periodReports?.length}
									<div
										class="grid gap-3 sm:grid-cols-3"
										in:fly={{ y: 12, duration: 300, delay: 280 }}
									>
										{#each analytics.periodReports as period (period.id)}
											<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
												<p
													class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
												>
													{period.label}
												</p>
												<div class="mt-3 grid grid-cols-2 gap-3">
													<div>
														<p class="text-[11px] text-[var(--black-alpha-48)]">Orders</p>
														<p class="text-[16px] font-semibold text-foreground">{period.orders}</p>
													</div>
													<div>
														<p class="text-[11px] text-[var(--black-alpha-48)]">Revenue</p>
														<p class="text-[16px] font-semibold text-foreground">
															{formatINR(period.revenue)}
														</p>
													</div>
													<div>
														<p class="text-[11px] text-[var(--black-alpha-48)]">AOV</p>
														<p class="text-[14px] font-medium text-foreground">
															{formatINR(period.averageOrderValue)}
														</p>
													</div>
													<div>
														<p class="text-[11px] text-[var(--black-alpha-48)]">Refunds</p>
														<p class="text-[14px] font-medium text-[var(--accent-crimson)]">
															{formatINR(period.refundAmount)}
														</p>
													</div>
												</div>
											</div>
										{/each}
									</div>
								{/if}

								<div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
									<!-- Recent orders -->
									<div
										class="rounded-lg border border-[var(--border-faint)] bg-white"
										in:fly={{ y: 12, duration: 300, delay: 340 }}
									>
										<div
											class="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3"
										>
											<div class="flex items-center gap-2">
												<Activity class="size-4 text-[var(--black-alpha-40)]" strokeWidth={2} />
												<p class="text-[13px] font-medium text-foreground">Recent orders</p>
											</div>
											{#if loading}
												<span
													class="flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-[var(--heat-100)] uppercase"
												>
													<span class="size-1.5 animate-pulse rounded-full bg-[var(--heat-100)]"
													></span>
													Live
												</span>
											{/if}
										</div>
										<div class="divide-y divide-[var(--border-faint)]">
											{#each analytics?.recentOrders ?? [] as order, idx (order.id)}
												<button
													type="button"
													class="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--background-lighter)]"
													in:fly={{ x: -8, duration: 200, delay: idx * 30 }}
													onclick={() => {
														ordersInitialFilter = null;
														ordersInitialSearch = order.shippingName ?? '';
														ordersInitialSelectId = order.id;
														operationsSection = 'orders';
														setView('operations');
													}}
												>
													<div class="flex items-center gap-2.5">
														<div
															class="flex size-7 items-center justify-center rounded bg-[var(--background-lighter)] font-mono text-[10px] font-medium text-[var(--black-alpha-48)] transition-colors group-hover:bg-[var(--heat-8)] group-hover:text-[var(--heat-100)]"
														>
															{order.id.slice(0, 2).toUpperCase()}
														</div>
														<div>
															<p class="font-mono text-[12px] text-foreground">
																#{order.id.slice(0, 8).toUpperCase()}
															</p>
															<p class="text-[11px] text-[var(--black-alpha-40)]">
																{order.shippingName || 'Customer'}
															</p>
														</div>
													</div>
													<div class="flex items-center gap-2.5">
														<span
															class="rounded-sm px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
																{order.status === 'cancelled'
																? 'bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
																: order.status === 'delivered'
																	? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
																	: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}"
														>
															{order.status}
														</span>
														<span
															class="font-mono text-[12px] font-medium text-foreground tabular-nums"
															>{formatINR(order.total)}</span
														>
														<ArrowUpRight
															class="size-3 text-[var(--black-alpha-24)] opacity-0 transition-opacity group-hover:opacity-100"
															strokeWidth={2.5}
														/>
													</div>
												</button>
											{/each}
											{#if (analytics?.recentOrders ?? []).length === 0}
												<div
													class="px-4 py-10 text-center text-[12px] text-[var(--black-alpha-32)]"
												>
													No order history yet.
												</div>
											{/if}
										</div>
									</div>

									<!-- Right sidebar column -->
									<div class="flex flex-col gap-3" in:fly={{ y: 12, duration: 300, delay: 400 }}>
										<!-- Pending fulfillment CTA -->
										<div
											class="rounded-lg border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4"
										>
											<div class="flex items-start justify-between">
												<div>
													<p
														class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase"
													>
														Pending fulfillment
													</p>
													<p
														class="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground"
													>
														{analytics?.pendingFulfillment ?? 0}
													</p>
													<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
														Awaiting manual dispatch
													</p>
												</div>
												<Truck class="size-5 text-[var(--heat-100)]" strokeWidth={1.5} />
											</div>
											<button
												type="button"
												class="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-120)]"
												onclick={() => openOperations('fulfillment')}
											>
												Open queue <ArrowUpRight class="size-3" strokeWidth={2.5} />
											</button>
										</div>

										<!-- Monthly revenue chart -->
										{#if analytics?.monthlySeries?.length}
											<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
												<p
													class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
												>
													Monthly revenue
												</p>
												<div class="mt-3 flex items-end gap-1" style="height: 80px">
													{#each analytics.monthlySeries as month, idx (month.month)}
														<div
															class="group relative flex flex-1 flex-col items-center justify-end"
															style="height: 100%"
														>
															<div
																class="chart-bar w-full rounded-t-sm bg-[var(--heat-100)] transition-[height] duration-500 ease-out"
																style="height: {Math.max(
																	4,
																	(month.revenue / maxMonthlyRevenue) * 100
																)}%; animation-delay: {idx * 60}ms"
															></div>
															<span class="mt-1 text-[8px] text-[var(--black-alpha-32)]"
																>{month.month.slice(5)}</span
															>
															<div class="chart-tooltip">
																{formatINR(month.revenue)}
															</div>
														</div>
													{/each}
												</div>
											</div>
										{/if}

										<!-- Service health -->
										<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
											<p class="text-[13px] font-medium text-foreground">Service health</p>
											<div class="mt-3 space-y-2.5">
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-2">
														<span class="size-1.5 rounded-full bg-[var(--accent-forest)]"></span>
														<span class="text-[12px] text-[var(--black-alpha-56)]">Delivered</span>
													</div>
													<span class="text-[12px] font-medium text-foreground"
														>{analytics?.deliveredOrders ?? 0}</span
													>
												</div>
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-2">
														<span class="size-1.5 rounded-full bg-[var(--accent-honey)]"></span>
														<span class="text-[12px] text-[var(--black-alpha-56)]"
															>Cancellations</span
														>
													</div>
													<span class="text-[12px] font-medium text-foreground"
														>{analytics?.cancellationReport.total ?? 0}</span
													>
												</div>
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-2">
														<span class="size-1.5 rounded-full bg-[var(--accent-crimson)]"></span>
														<span class="text-[12px] text-[var(--black-alpha-56)]"
															>Awaiting review</span
														>
													</div>
													<span class="text-[12px] font-medium text-foreground"
														>{analytics?.cancellationReport.pending ?? 0}</span
													>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
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
								<div class="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
									<!-- Product list sidebar -->
									<aside class="catalog-sidebar xl:sticky xl:top-4 xl:self-start">
										<div
											class="border-b border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
										>
											<div class="mb-2 flex items-center justify-between gap-2">
												<div class="flex items-center gap-2">
													<Boxes class="size-4 text-[var(--black-alpha-40)]" strokeWidth={2} />
													<span class="text-[13px] font-medium text-foreground">Catalog</span>
													<span class="text-[11px] text-[var(--black-alpha-32)]"
														>{products.length} of {productTotal}</span
													>
												</div>
												<button
													type="button"
													class="button button-primary inline-flex h-7 items-center gap-1 rounded px-2.5 text-[12px] text-white"
													onclick={beginCreateProduct}
												>
													<Plus class="size-3.5" strokeWidth={2} />
													New
												</button>
											</div>
											<input
												bind:value={productSearch}
												oninput={queueProductSearch}
												class="input-field h-8 text-[12px]"
												placeholder="Search title, brand, SKU, category..."
											/>
										</div>

										<div class="catalog-list">
											{#each products as product, idx (product.id)}
												<button
													type="button"
													class="catalog-item {product.id === selectedProductId ? 'selected' : ''}"
													onclick={() => {
														selectedProductId = product.id;
														productEditor = mapProductToEditor(product);
														productNotice = null;
													}}
													in:fly={{ x: -8, duration: 200, delay: Math.min(idx * 20, 300) }}
												>
													<div
														class="flex size-10 shrink-0 items-center justify-center rounded border border-[var(--border-faint)] bg-white p-0.5"
													>
														<img
															src={product.image || 'https://placehold.co/100x100?text=%20'}
															alt={product.title}
															class="max-h-full max-w-full object-contain"
														/>
													</div>
													<div class="min-w-0 flex-1">
														<div class="flex items-start justify-between gap-1">
															<p class="line-clamp-1 text-[12px] font-medium text-foreground">
																{product.title}
															</p>
															<p class="shrink-0 text-[11px] font-medium text-foreground">
																{formatINR(product.price)}
															</p>
														</div>
														<p class="mt-0.5 truncate text-[10px] text-[var(--black-alpha-40)]">
															{product.brand} · {categoryNameBySlug.get(product.category) ??
																product.category}
														</p>
														<div class="mt-1 flex items-center gap-1">
															<span
																class="rounded px-1 py-px text-[9px] font-medium tracking-wide uppercase
																	{product.status === 'active'
																	? 'bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]'
																	: product.status === 'archived'
																		? 'bg-[var(--background-lighter)] text-[var(--black-alpha-32)]'
																		: 'bg-[var(--accent-honey)]/10 text-[var(--accent-honey)]'}"
																>{product.status}</span
															>
															<span
																class="flex items-center gap-1 text-[9px] text-[var(--black-alpha-32)]"
															>
																<span
																	class="size-1.5 rounded-full {product.stock <= 0
																		? 'bg-[var(--accent-crimson)]'
																		: product.stock <= 5
																			? 'bg-[var(--accent-honey)]'
																			: 'bg-[var(--accent-forest)]'}"
																></span>
																{product.stock} in stock
															</span>
														</div>
													</div>
												</button>
											{/each}

											{#if !products.length}
												<div class="p-4 text-center text-[12px] text-[var(--black-alpha-32)]">
													{productsError || 'No products match.'}
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
									</aside>

									<!-- Product editor -->
									<div class="editor-panel">
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
														<Boxes class="size-5 text-[var(--black-alpha-16)]" strokeWidth={1.5} />
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
															{categoryNameBySlug.get(productEditor.category) ?? 'Category pending'}
														</span>
													</div>
													<h2 class="mt-1 truncate text-[16px] font-medium text-foreground">
														{productEditor.title || 'Untitled product'}
													</h2>
													<p class="text-[12px] text-[var(--black-alpha-40)]">
														{productEditor.brand || 'Brand pending'} · SKU {productEditor.sku ||
															'—'}
													</p>
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
								</div>
							{/if}
						{:else if view === 'operations'}
							<!-- OPERATIONS TAB (orders + fulfillment) -->
							<div class="space-y-4">
								<div
									class="inline-flex rounded-lg border border-[var(--border-faint)] bg-white p-1"
									role="tablist"
									aria-label="Operations sections"
								>
									{#each operationsSections as section (section.id)}
										<button
											type="button"
											role="tab"
											aria-selected={operationsSection === section.id}
											class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors {operationsSection ===
											section.id
												? 'bg-[var(--heat-100)] text-white'
												: 'text-[var(--black-alpha-56)] hover:text-foreground'}"
											onclick={() => (operationsSection = section.id)}
										>
											<section.icon class="size-3.5" strokeWidth={2} />
											{section.label}
											{#if section.id === 'fulfillment' && (analytics?.pendingFulfillment ?? 0) > 0}
												<span
													class="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {operationsSection ===
													section.id
														? 'bg-white/20 text-white'
														: 'bg-[var(--heat-8)] text-[var(--heat-100)]'}"
												>
													{analytics?.pendingFulfillment}
												</span>
											{/if}
										</button>
									{/each}
								</div>

								{#if operationsSection === 'orders'}
									<AdminOrdersManager
										initialFilter={ordersInitialFilter}
										initialSearch={ordersInitialSearch}
										initialSelectId={ordersInitialSelectId}
									/>
								{:else}
									<FulfillmentQueue />
								{/if}
							</div>
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
												</select>
											</label>
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
											<label>
												<span class="field-label">Minimum subtotal</span>
												<input
													bind:value={couponEditor.minimumSubtotal}
													class="input-field"
													inputmode="decimal"
												/>
											</label>
											<label>
												<span class="field-label">Max discount</span>
												<input
													bind:value={couponEditor.maxDiscount}
													class="input-field"
													inputmode="decimal"
												/>
											</label>
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
	.catalog-sidebar {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
	}

	.catalog-list {
		max-height: calc(100vh - 220px);
		overflow-y: auto;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.catalog-item {
		display: flex;
		width: 100%;
		align-items: flex-start;
		gap: 10px;
		border-radius: 6px;
		padding: 8px;
		text-align: left;
		transition:
			background-color 150ms ease,
			box-shadow 150ms ease;
		cursor: pointer;
		border: none;
		background: none;
	}

	.catalog-item:hover {
		background: var(--background-lighter);
	}

	.catalog-item.selected {
		background: var(--heat-4);
		box-shadow: inset 0 0 0 1px rgba(250, 93, 25, 0.15);
	}

	/* ── Editor ── */
	.editor-panel {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
	}

	.editor-save-bar {
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
