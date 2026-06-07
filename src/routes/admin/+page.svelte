<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminOrdersManager from '$lib/components/admin/AdminOrdersManager.svelte';
	import AdminSupportManager from '$lib/components/admin/AdminSupportManager.svelte';
	import FulfillmentQueue from '$lib/components/admin/FulfillmentQueue.svelte';
	import { apiBase } from '$lib/api-base';
	import { categories, formatINR } from '$lib/catalog';
	import { getAuthContext } from '$lib/auth-context';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
	import {
		Activity,
		ArrowUpRight,
		Boxes,
		LayoutDashboard,
		LifeBuoy,
		Package,
		Plus,
		ShieldAlert,
		Tag,
		Trash2,
		TrendingUp,
		Truck,
		Users
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fade, fly, crossfade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	const [send, receive] = crossfade({
		duration: 350,
		easing: quintOut
	});

	type AdminView = 'overview' | 'catalog' | 'orders' | 'fulfillment' | 'users' | 'promos' | 'support';

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
	};

	type AdminUserRecord = {
		id: string;
		email: string | null;
		createdAt: string | null;
		lastSignInAt: string | null;
		role: 'admin' | 'user';
		fullName: string | null;
		phone: string | null;
		orderCount: number;
		totalSpent: number;
	};

	type UserEditorState = {
		id: string | null;
		role: 'admin' | 'user';
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
		{ id: 'catalog', label: 'Catalog', icon: Boxes },
		{ id: 'orders', label: 'Orders', icon: Package },
		{ id: 'fulfillment', label: 'Fulfillment', icon: Truck },
		{ id: 'users', label: 'Users', icon: Users },
		{ id: 'promos', label: 'Promos', icon: Tag },
		{ id: 'support', label: 'Support', icon: LifeBuoy }
	];

	const overviewIcons: Record<string, typeof TrendingUp> = {
		orders: Package,
		products: Boxes,
		users: Users,
		revenue: TrendingUp
	};

	const categoryOptions = categories.map((category) => ({
		value: category.slug,
		label: category.name
	}));
	const loadingSkeletons = ['orders', 'products', 'users', 'revenue'];
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
	let mountedViews = $state<AdminView[]>(
		initialView === 'overview' ? ['overview'] : ['overview', initialView]
	);
	let realtimeRefreshTimer: number | null = null;
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

	const filteredProducts = $derived.by(() =>
		products.filter((product) =>
			`${product.title} ${product.brand} ${product.category} ${product.sku ?? ''}`
				.toLowerCase()
				.includes(productSearch.toLowerCase())
		)
	);

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
		{ id: 'orders', label: 'Orders', value: analytics?.orders ?? 0 },
		{ id: 'products', label: 'Products', value: analytics?.products ?? 0 },
		{ id: 'users', label: 'Users', value: analytics?.users ?? 0 },
		{ id: 'revenue', label: 'Revenue', value: formatINR(analytics?.revenue ?? 0) }
	]);

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
			codEligible: true
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
			price: String(Number(product.price ?? 0)),
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
			codEligible: product.cod_eligible !== false
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
		if (tone === 'error') return 'border-red-200 bg-red-50 text-red-700';
		if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
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
			const response = await requestAdmin<{ products: AdminProduct[] }>('/admin/products');
			products = response.products ?? [];
			productsLoaded = true;
			syncProductEditor();
		} catch (loadError) {
			productsError = loadError instanceof Error ? loadError.message : 'Could not load products';
		} finally {
			productsLoading = false;
		}
	}

	async function syncProductSearchIndex() {
		try {
			await fetch(resolve('/api/admin/search/sync'), { method: 'POST' });
		} catch (syncError) {
			console.warn('Product search sync failed.', syncError);
		}

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

	function panelHidden(panel: AdminView) {
		return view === panel ? '' : 'hidden';
	}

	function loadSectionData(nextView: AdminView) {
		if (nextView === 'catalog') void loadProducts();
		if (nextView === 'users') void loadUsers();
		if (nextView === 'promos') void loadCoupons();
	}

	function setView(nextView: AdminView) {
		view = nextView;
		if (!mountedViews.includes(nextView)) mountedViews = [...mountedViews, nextView];
		loadSectionData(nextView);

		const nextUrl = new URL(window.location.href);
		if (nextView === 'overview') nextUrl.searchParams.delete('section');
		else nextUrl.searchParams.set('section', nextView);
		window.history.replaceState(window.history.state, '', nextUrl);
	}

	function scheduleAdminRealtimeRefresh() {
		if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
		realtimeRefreshTimer = window.setTimeout(() => {
			void loadAnalytics();
			if (productsLoaded) void loadProducts(true);
			if (usersLoaded) void loadUsers(true);
			if (couponsLoaded) void loadCoupons(true);
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
				codEligible: productEditor.codEligible
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

			await Promise.all([loadProducts(true), loadAnalytics(), syncProductSearchIndex()]);
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

			await Promise.all([loadProducts(true), loadAnalytics(), syncProductSearchIndex()]);
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
			const payload: { role: 'admin' | 'user'; fullName: string; phone?: string } = {
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
		if (!currentUser || currentRole !== 'admin') return;
		if (initializedForUserId === currentUser.id) return;

		initializedForUserId = currentUser.id;
		void loadAdmin().then(() => loadSectionData(view));

		const channel = auth.supabase
			.channel(`admin-shell:${currentUser.id}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, scheduleAdminRealtimeRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'coupon_redemptions' }, scheduleAdminRealtimeRefresh)
			.subscribe();

		return () => {
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<svelte:head>
	<title>Admin - lapkart</title>
</svelte:head>

<section class="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-8">
	<!-- Header -->
	<header class="admin-header mb-6 rounded-xl bg-[var(--accent-black)] px-5 py-5 sm:px-8 sm:py-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-3">
				<div class="flex size-10 items-center justify-center rounded-lg bg-white/[0.08] text-[var(--heat-100)]">
					<LayoutDashboard class="size-5" strokeWidth={2} />
				</div>
				<div>
					<h1 class="text-[18px] font-medium tracking-tight text-white sm:text-[22px]">Admin</h1>
					{#if currentUser?.email}
						<p class="font-mono text-[11px] tracking-tight text-white/40">{currentUser.email}</p>
					{/if}
				</div>
			</div>
			<div class="flex items-center gap-3">
				<div class="grid grid-cols-3 gap-2 text-center">
					<div class="rounded-md bg-white/[0.06] px-3 py-1.5">
						<p class="text-[10px] tracking-[0.1em] text-white/35 uppercase">Orders</p>
						<p class="text-[15px] font-medium text-white">{analytics?.orders ?? '—'}</p>
					</div>
					<div class="rounded-md bg-white/[0.06] px-3 py-1.5">
						<p class="text-[10px] tracking-[0.1em] text-white/35 uppercase">Pending</p>
						<p class="text-[15px] font-medium text-[var(--heat-100)]">{analytics?.pendingFulfillment ?? '—'}</p>
					</div>
					<div class="rounded-md bg-white/[0.06] px-3 py-1.5">
						<p class="text-[10px] tracking-[0.1em] text-white/35 uppercase">Revenue</p>
						<p class="text-[15px] font-medium text-white">{formatINR(analytics?.revenue ?? 0)}</p>
					</div>
				</div>
				<button
					type="button"
					class="button button-primary text-label-small inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-white"
					onclick={() => setView('fulfillment')}
				>
					<Truck class="size-4" strokeWidth={2} />
					<span class="hidden sm:inline">Fulfillment</span>
				</button>
			</div>
		</div>
	</header>

	{#if booting}
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{#each loadingSkeletons as skeleton (skeleton)}
				<div class="h-[100px] animate-pulse rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<div class="h-3 w-16 rounded bg-[var(--background-lighter)]"></div>
					<div class="mt-3 h-6 w-24 rounded bg-[var(--background-lighter)]"></div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Tab navigation -->
		<nav
			class="admin-tabs scrollbar-hide mb-5 flex w-full items-center gap-0.5 overflow-x-auto border-b border-[var(--border-faint)]"
			aria-label="Admin sections"
		>
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class="admin-tab group relative flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium whitespace-nowrap sm:px-4
						{view === tab.id
							? 'text-[var(--heat-100)]'
							: 'text-[var(--black-alpha-48)] hover:text-[var(--black-alpha-72)]'}"
					aria-current={view === tab.id ? 'page' : undefined}
					onclick={() => setView(tab.id)}
				>
					<tab.icon class="size-4" strokeWidth={2} />
					<span>{tab.label}</span>
					{#if view === tab.id}
						<span
							class="absolute inset-x-0 -bottom-px h-[2px] bg-[var(--heat-100)]"
							in:receive={{ key: 'active-tab' }}
							out:send={{ key: 'active-tab' }}
						></span>
					{/if}
				</button>
			{/each}
		</nav>

		<!-- Content area -->
		<div class="relative grid">
				<div
					class="col-start-1 row-start-1 w-full"
					in:fly={{ y: 12, duration: 250, delay: 120 }}
					out:fade={{ duration: 120 }}
				>
					{#if view === 'overview'}
			<div class="flex flex-col gap-5">
				{#if overviewError}
					<div class="flex items-start gap-2 rounded-md border border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/6 p-3 text-[13px] text-[var(--accent-crimson)]">
						<ShieldAlert class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
						<span>{overviewError}</span>
					</div>
				{/if}

				<!-- KPI cards -->
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{#each overviewCards as card (card.id)}
						{@const Icon = overviewIcons[card.id] ?? TrendingUp}
						<div class="group flex items-start justify-between rounded-lg border border-[var(--border-faint)] bg-white p-4 transition-shadow hover:shadow-sm">
							<div>
								<p class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-48)] uppercase">{card.label}</p>
								<p class="mt-1.5 text-[22px] font-semibold tracking-tight text-foreground">{card.value}</p>
							</div>
							<div class="flex size-9 items-center justify-center rounded-lg bg-[var(--heat-8)] text-[var(--heat-100)] transition-transform duration-200 group-hover:scale-105">
								<Icon class="size-4" strokeWidth={2} />
							</div>
						</div>
					{/each}
				</div>

				<!-- Orders + sidebar -->
				<div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
					<!-- Recent orders -->
					<div class="overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white">
						<div class="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3">
							<div class="flex items-center gap-2">
								<Activity class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
								<p class="text-[13px] font-medium text-foreground">Recent orders</p>
							</div>
							{#if loading}
								<span class="flex items-center gap-1 text-[10px] tracking-[0.12em] text-[var(--heat-100)] uppercase">
									<span class="size-1.5 animate-pulse rounded-full bg-[var(--heat-100)]"></span>
									Syncing
								</span>
							{/if}
						</div>
						<div class="divide-y divide-[var(--border-faint)]">
							{#each analytics?.recentOrders ?? [] as order (order.id)}
								<div class="flex items-center justify-between px-4 py-3">
									<div class="flex items-center gap-2.5">
										<div class="flex size-7 items-center justify-center rounded bg-[var(--background-lighter)] font-mono text-[10px] font-medium text-[var(--black-alpha-56)]">
											{order.id.slice(0, 2).toUpperCase()}
										</div>
										<div>
											<p class="font-mono text-[12px] text-foreground">#{order.id.slice(0, 8).toUpperCase()}</p>
											<p class="text-[11px] text-[var(--black-alpha-48)]">{order.shippingName || 'Customer'}</p>
										</div>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="rounded-sm px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase
												{order.status === 'cancelled'
													? 'bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
													: order.status === 'delivered'
														? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
														: 'bg-[var(--background-lighter)] text-[var(--black-alpha-56)]'}"
										>
											{order.status}
										</span>
										<span class="text-[12px] font-medium text-foreground">{formatINR(order.total)}</span>
									</div>
								</div>
							{/each}
							{#if (analytics?.recentOrders ?? []).length === 0}
								<div class="px-4 py-8 text-center text-[12px] text-[var(--black-alpha-40)]">
									No order history yet.
								</div>
							{/if}
						</div>
					</div>

					<!-- Sidebar cards -->
					<div class="flex flex-col gap-3">
						<div class="rounded-lg border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
							<div class="flex items-start justify-between">
								<div>
									<p class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase">Pending fulfillment</p>
									<p class="mt-1 text-[22px] font-semibold text-foreground">{analytics?.pendingFulfillment ?? 0}</p>
									<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">Awaiting Shiprocket dispatch</p>
								</div>
								<Truck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
							</div>
							<button
								type="button"
								class="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] hover:underline"
								onclick={() => setView('fulfillment')}
							>
								Open queue <ArrowUpRight class="size-3" strokeWidth={2} />
							</button>
						</div>

						<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
							<p class="text-[13px] font-medium text-foreground">Service health</p>
							<div class="mt-3 space-y-2.5">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="size-1.5 rounded-full bg-[var(--accent-forest)]"></span>
										<span class="text-[12px] text-[var(--black-alpha-64)]">Delivered</span>
									</div>
									<span class="text-[12px] font-medium text-foreground">{analytics?.deliveredOrders ?? 0}</span>
								</div>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="size-1.5 rounded-full bg-[var(--accent-honey)]"></span>
										<span class="text-[12px] text-[var(--black-alpha-64)]">Cancellation queue</span>
									</div>
									<span class="text-[12px] font-medium text-foreground">{analytics?.cancellationReport.total ?? 0}</span>
								</div>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<span class="size-1.5 rounded-full bg-[var(--accent-crimson)]"></span>
										<span class="text-[12px] text-[var(--black-alpha-64)]">Awaiting review</span>
									</div>
									<span class="text-[12px] font-medium text-foreground">{analytics?.cancellationReport.pending ?? 0}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else if view === 'catalog'}
			<div class="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
				<!-- Product list sidebar -->
				<aside class="flex flex-col overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white xl:sticky xl:top-24 xl:self-start">
					<div class="border-b border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
						<div class="flex items-center justify-between gap-2 mb-2">
							<div class="flex items-center gap-2">
								<Boxes class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
								<span class="text-[13px] font-medium text-foreground">Catalog</span>
								<span class="text-[11px] text-[var(--black-alpha-40)]">{filteredProducts.length}/{products.length}</span>
							</div>
							<button
								type="button"
								class="button button-primary text-[12px] inline-flex h-7 items-center gap-1 rounded px-2.5 text-white"
								onclick={beginCreateProduct}
							>
								<Plus class="size-3.5" strokeWidth={2} />
								New
							</button>
						</div>
						<input
							bind:value={productSearch}
							class="input-field h-8 text-[12px]"
							placeholder="Search title, brand, SKU..."
						/>
					</div>

					<div class="max-h-[calc(100vh-280px)] space-y-0.5 overflow-y-auto p-1.5">
						{#if productsLoading && !products.length}
							<div class="p-4 text-center text-[12px] text-[var(--black-alpha-40)]">Loading catalog...</div>
						{:else}
							{#each filteredProducts as product (product.id)}
								<button
									type="button"
									class="flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors
										{product.id === selectedProductId
											? 'bg-[var(--heat-4)] ring-1 ring-[var(--heat-100)]/30'
											: 'hover:bg-[var(--background-lighter)]'}"
									onclick={() => {
										selectedProductId = product.id;
										productEditor = mapProductToEditor(product);
										productNotice = null;
									}}
								>
									<div class="flex size-10 shrink-0 items-center justify-center rounded border border-[var(--border-faint)] bg-white p-0.5">
										<img
											src={product.image || 'https://placehold.co/100x100?text=%20'}
											alt={product.title}
											class="max-h-full max-w-full object-contain"
										/>
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-1">
											<p class="line-clamp-1 text-[12px] font-medium text-foreground">{product.title}</p>
											<p class="shrink-0 text-[11px] font-medium text-foreground">{formatINR(product.price)}</p>
										</div>
										<p class="mt-0.5 truncate text-[10px] text-[var(--black-alpha-48)]">
											{product.brand} · {categoryNameBySlug.get(product.category) ?? product.category}
										</p>
										<div class="mt-1 flex items-center gap-1">
											<span
												class="rounded px-1 py-px text-[9px] font-medium tracking-wide uppercase
													{product.status === 'active'
														? 'bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]'
														: product.status === 'archived'
															? 'bg-[var(--background-lighter)] text-[var(--black-alpha-40)]'
															: 'bg-[var(--accent-honey)]/10 text-[var(--accent-honey)]'}"
											>{product.status}</span>
											<span class="text-[9px] text-[var(--black-alpha-40)]">Stock {product.stock}</span>
										</div>
									</div>
								</button>
							{/each}
						{/if}

						{#if !productsLoading && !filteredProducts.length}
							<div class="p-4 text-center text-[12px] text-[var(--black-alpha-40)]">
								{productsError || 'No products match.'}
							</div>
						{/if}
					</div>
				</aside>

				<!-- Product editor -->
				<div class="flex flex-col overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white">
					<div class="border-b border-[var(--border-faint)] p-5">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
							<div class="flex size-24 shrink-0 items-center justify-center rounded-md bg-[var(--background-lighter)] p-3">
								{#if productEditor.image}
									<img src={productEditor.image} alt={productEditor.title || 'Preview'} class="max-h-full max-w-full object-contain" />
								{:else}
									<Boxes class="size-5 text-[var(--black-alpha-24)]" strokeWidth={1.5} />
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
													: 'bg-[var(--background-lighter)] text-[var(--black-alpha-56)]'}"
									>
										{selectedProductId === 'new' ? 'new' : productEditor.status}
									</span>
									<span class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">
										{categoryNameBySlug.get(productEditor.category) ?? 'Category pending'}
									</span>
								</div>
								<h2 class="mt-1 truncate text-[16px] font-medium text-foreground">
									{productEditor.title || 'Untitled product'}
								</h2>
								<p class="text-[12px] text-[var(--black-alpha-48)]">
									{productEditor.brand || 'Brand pending'} · SKU {productEditor.sku || '—'}
								</p>
							</div>
							<div class="flex shrink-0 gap-5">
								<div>
									<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Price</p>
									<p class="mt-0.5 text-[14px] font-medium text-foreground">{formatINR(Number(productEditor.price || 0))}</p>
								</div>
								<div>
									<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Stock</p>
									<p class="mt-0.5 text-[14px] font-medium text-foreground">{productEditor.stock || '0'}</p>
								</div>
							</div>
						</div>
					</div>

					{#if productsLoading && !productEditor.id && selectedProductId !== 'new'}
						<div class="m-5 rounded-md bg-[var(--background-lighter)] p-3 text-[12px] text-[var(--black-alpha-48)]">
							Preparing editor...
						</div>
					{/if}

					{#if productNotice}
						<div class="m-5 mb-0 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px] {noticeClasses(productNotice.tone)}">
							<span class="mt-1 size-1.5 shrink-0 rounded-full bg-current"></span>
							<span>{productNotice.text}</span>
						</div>
					{/if}

					<div class="space-y-6 p-5">
						<section>
							<h3 class="text-[13px] font-medium text-foreground">Product identity</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Title</span>
									<input bind:value={productEditor.title} class="input-field" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Brand</span>
									<input bind:value={productEditor.brand} class="input-field" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Category</span>
									<select bind:value={productEditor.category} class="input-field">
										{#each categoryOptions as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">SKU</span>
									<input bind:value={productEditor.sku} class="input-field" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Description</span>
									<textarea bind:value={productEditor.description} class="input-field min-h-[80px] py-2" style="height:auto"></textarea>
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Compatibility</span>
									<input bind:value={productEditor.compatibility} class="input-field" />
								</label>
							</div>
						</section>

						<hr class="border-[var(--border-faint)]" />

						<section>
							<h3 class="text-[13px] font-medium text-foreground">Pricing &amp; availability</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Price</span>
									<input bind:value={productEditor.price} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">MRP</span>
									<input bind:value={productEditor.mrp} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Stock</span>
									<input bind:value={productEditor.stock} class="input-field" inputmode="numeric" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Status</span>
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
							<h3 class="text-[13px] font-medium text-foreground">Trust, tax &amp; checkout</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Authenticity</span>
									<select bind:value={productEditor.authenticityGrade} class="input-field">
										<option value="oem">OEM</option>
										<option value="compatible">Compatible</option>
										<option value="refurbished">Refurbished</option>
										<option value="open_box">Open box</option>
									</select>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Condition</span>
									<select bind:value={productEditor.conditionGrade} class="input-field">
										<option value="new">New</option>
										<option value="open_box">Open box</option>
										<option value="refurbished">Refurbished</option>
										<option value="used">Used</option>
									</select>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">HSN code</span>
									<input bind:value={productEditor.hsnCode} class="input-field" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">GST rate (%)</span>
									<input bind:value={productEditor.gstRate} class="input-field" inputmode="numeric" />
								</label>
							</div>
						</section>

						<hr class="border-[var(--border-faint)]" />

						<section>
							<h3 class="text-[13px] font-medium text-foreground">Delivery &amp; policies</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">DOA window (days)</span>
									<input bind:value={productEditor.doaPolicyDays} class="input-field" inputmode="numeric" />
								</label>
								<label class="flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2">
									<input type="checkbox" bind:checked={productEditor.localDeliveryEligible} class="size-3.5 accent-[var(--heat-100)]" />
									<span class="text-[11px] text-[var(--black-alpha-64)]">Local delivery</span>
								</label>
								<label class="flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2">
									<input type="checkbox" bind:checked={productEditor.codEligible} class="size-3.5 accent-[var(--heat-100)]" />
									<span class="text-[11px] text-[var(--black-alpha-64)]">COD eligible</span>
								</label>
							</div>
						</section>

						<hr class="border-[var(--border-faint)]" />

						<section>
							<h3 class="text-[13px] font-medium text-foreground">Imagery &amp; dimensions</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Primary image URL</span>
									<input bind:value={productEditor.image} class="input-field" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Source URL</span>
									<input bind:value={productEditor.sourceUrl} class="input-field" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Additional images (one URL per line)</span>
									<textarea bind:value={productEditor.imagesText} class="input-field min-h-[80px] py-2 font-mono" style="height:auto"></textarea>
								</label>
								<div class="grid grid-cols-2 gap-2.5 sm:col-span-2 sm:grid-cols-4">
									<label>
										<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Weight (kg)</span>
										<input bind:value={productEditor.weightKg} class="input-field" inputmode="decimal" />
									</label>
									<label>
										<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Length (cm)</span>
										<input bind:value={productEditor.lengthCm} class="input-field" inputmode="decimal" />
									</label>
									<label>
										<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Breadth (cm)</span>
										<input bind:value={productEditor.breadthCm} class="input-field" inputmode="decimal" />
									</label>
									<label>
										<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Height (cm)</span>
										<input bind:value={productEditor.heightCm} class="input-field" inputmode="decimal" />
									</label>
								</div>
							</div>
						</section>

						<hr class="border-[var(--border-faint)]" />

						<section>
							<h3 class="text-[13px] font-medium text-foreground">Merchandising</h3>
							<div class="mt-2.5 grid gap-2.5 sm:grid-cols-2">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Highlights (one per line)</span>
									<textarea bind:value={productEditor.highlightsText} class="input-field min-h-[80px] py-2" style="height:auto"></textarea>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Search keywords (one per line)</span>
									<textarea bind:value={productEditor.searchKeywordsText} class="input-field min-h-[80px] py-2" style="height:auto"></textarea>
								</label>
							</div>
						</section>
					</div>

					<!-- Save bar -->
					<div class="flex flex-wrap items-center gap-2.5 border-t border-[var(--border-faint)] bg-[var(--background-lighter)] px-5 py-4">
						<button
							type="button"
							class="button button-primary text-[13px] inline-flex h-9 items-center rounded-md px-5 font-medium text-white disabled:opacity-50"
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
		{:else if view === 'users'}
			<div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
				<!-- User list -->
				<div class="overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<input
						bind:value={userSearch}
						class="input-field mb-3"
						placeholder="Search name, email, or phone"
					/>
					<div class="overflow-x-auto">
						<table class="w-full min-w-[600px] border-collapse text-left">
							<thead>
								<tr class="border-b border-[var(--border-muted)] text-[10px] font-medium tracking-[0.12em] text-[var(--black-alpha-48)] uppercase">
									<th class="px-2 py-2">User</th>
									<th class="px-2 py-2">Role</th>
									<th class="px-2 py-2">Orders</th>
									<th class="px-2 py-2">Value</th>
								</tr>
							</thead>
							<tbody>
								{#if usersLoading && !users.length}
									<tr><td class="px-2 py-6 text-center text-[12px] text-[var(--black-alpha-40)]" colspan="4">Loading accounts...</td></tr>
								{:else}
									{#each filteredUsers as user (user.id)}
										<tr
											class="admin-table-row cursor-pointer border-b border-[var(--border-faint)] transition-colors hover:bg-[var(--background-lighter)]
												{user.id === selectedUserId ? 'bg-[var(--heat-4)]' : ''}"
											onclick={() => {
												selectedUserId = user.id;
												userEditor = mapUserToEditor(user);
												userNotice = null;
											}}
										>
											<td class="px-2 py-3">
												<p class="text-[12px] font-medium text-foreground">{user.fullName || user.email || 'Unnamed'}</p>
												<p class="text-[10px] text-[var(--black-alpha-40)]">{user.email || 'No email'}</p>
											</td>
											<td class="px-2 py-3">
												<span class="rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
													{user.role === 'admin'
														? 'bg-amber-50 text-amber-700'
														: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}"
												>{user.role}</span>
											</td>
											<td class="px-2 py-3 text-[12px] text-foreground">{user.orderCount}</td>
											<td class="px-2 py-3 text-[12px] text-foreground">{formatINR(user.totalSpent)}</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>
					{#if usersError}
						<div class="mt-3 rounded-md border border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]">{usersError}</div>
					{:else if !usersLoading && !filteredUsers.length}
						<div class="mt-3 p-3 text-center text-[12px] text-[var(--black-alpha-40)]">No users match.</div>
					{/if}
				</div>

				<!-- User editor -->
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<p class="text-[13px] font-medium text-foreground">Edit account</p>

					{#if userNotice}
						<div class="mt-3 rounded-md border px-3 py-2 text-[12px] {noticeClasses(userNotice.tone)}">{userNotice.text}</div>
					{/if}

					{#if selectedUser}
						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							<label>
								<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Role</span>
								<select
									bind:value={userEditor.role}
									class="input-field"
									disabled={selectedUserIsCurrentAdmin}
								>
									<option value="user">User</option>
									<option value="admin">Admin</option>
								</select>
								{#if selectedUserIsCurrentAdmin}
									<span class="mt-1 block text-[10px] text-[var(--black-alpha-40)]">Use another admin account first.</span>
								{/if}
							</label>
							<label>
								<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Full name</span>
								<input bind:value={userEditor.fullName} class="input-field" />
							</label>
							<label class="sm:col-span-2">
								<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Phone</span>
								<input bind:value={userEditor.phone} class="input-field disabled:opacity-50" disabled={selectedUserPhoneLocked} />
								{#if selectedUserPhoneLocked}
									<span class="mt-1 block text-[10px] text-[var(--black-alpha-40)]">Locked — account has order history.</span>
								{/if}
							</label>
						</div>

						<div class="mt-4 grid gap-2 sm:grid-cols-2">
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Email</p>
								<p class="mt-0.5 text-[12px] font-medium text-foreground">{selectedUser.email || 'No email'}</p>
							</div>
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Joined</p>
								<p class="mt-0.5 text-[12px] font-medium text-foreground">
									{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString('en-IN') : 'Unknown'}
								</p>
							</div>
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Orders</p>
								<p class="mt-0.5 text-[12px] font-medium text-foreground">{selectedUser.orderCount}</p>
							</div>
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Total spent</p>
								<p class="mt-0.5 text-[12px] font-medium text-foreground">{formatINR(selectedUser.totalSpent)}</p>
							</div>
						</div>

						<div class="mt-4">
							<button
								type="button"
								class="button button-primary text-[12px] inline-flex h-9 items-center rounded-md px-4 font-medium disabled:opacity-50"
								disabled={userSaving}
								onclick={saveUser}
							>
								{userSaving ? 'Saving...' : 'Save account'}
							</button>
						</div>
					{:else}
						<div class="mt-4 rounded-md bg-[var(--background-lighter)] p-4 text-center text-[12px] text-[var(--black-alpha-40)]">
							Select a user to edit.
						</div>
					{/if}
				</div>
			</div>
		{:else if view === 'promos'}
			<div class="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
				<!-- Coupon list -->
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<div class="flex items-center justify-between gap-2 mb-3">
						<div>
							<p class="text-[13px] font-medium text-foreground">Promotions</p>
							<p class="text-[11px] text-[var(--black-alpha-48)]">Coupon codes &amp; limits.</p>
						</div>
						<button
							type="button"
							class="button button-primary text-[12px] inline-flex h-8 items-center rounded-md px-3 font-medium"
							onclick={beginCreateCoupon}
						>
							New coupon
						</button>
					</div>

					<div class="overflow-hidden rounded-md border border-[var(--border-faint)]">
						<div class="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2 text-[9px] font-medium tracking-[0.12em] text-[var(--black-alpha-48)] uppercase">
							<span>Code</span>
							<span>Used</span>
							<span>Status</span>
						</div>

						{#if couponsLoading && !coupons.length}
							<div class="px-3 py-6 text-center text-[12px] text-[var(--black-alpha-40)]">Loading...</div>
						{:else}
							{#each coupons as coupon (coupon.id)}
								<button
									type="button"
									class="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[var(--border-faint)] px-3 py-2.5 text-left transition-colors last:border-b-0
										{selectedCouponId === coupon.id
											? 'bg-[var(--heat-4)]'
											: 'hover:bg-[var(--background-lighter)]'}"
									onclick={() => {
										selectedCouponId = coupon.id;
										couponEditor = mapCouponToEditor(coupon);
										couponNotice = null;
									}}
								>
									<span>
										<span class="text-[12px] font-medium text-foreground">{coupon.code}</span>
										<span class="mt-0.5 block text-[10px] text-[var(--black-alpha-40)]">
											{coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : `${formatINR(coupon.discountValue)} off`}
										</span>
									</span>
									<span class="text-[12px] font-medium text-foreground">{coupon.usedCount}</span>
									<span class="rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
										{coupon.active
											? 'bg-emerald-50 text-emerald-700'
											: 'bg-[var(--background-lighter)] text-[var(--black-alpha-40)]'}"
									>
										{coupon.active ? 'Active' : 'Off'}
									</span>
								</button>
							{/each}
						{/if}
					</div>

					{#if couponsError}
						<div class="mt-3 rounded-md border border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]">{couponsError}</div>
					{:else if !couponsLoading && !coupons.length}
						<div class="mt-3 p-3 text-center text-[12px] text-[var(--black-alpha-40)]">No coupons yet.</div>
					{/if}
				</div>

				<!-- Coupon editor -->
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">
								{couponEditor.id ? 'Edit coupon' : 'Create coupon'}
							</p>
							<h3 class="mt-0.5 text-[16px] font-medium text-foreground">{couponEditor.code || 'New campaign'}</h3>
						</div>
						{#if selectedCoupon}
							<div class="text-right text-[11px] text-[var(--black-alpha-48)]">
								<p>{selectedCoupon.usedCount} redemptions</p>
								<p>{formatINR(selectedCoupon.discountGiven)} discounts</p>
							</div>
						{/if}
					</div>

					{#if couponNotice}
						<div class="mt-3 rounded-md border px-3 py-2 text-[12px] {noticeClasses(couponNotice.tone)}">{couponNotice.text}</div>
					{/if}

					<div class="mt-4 grid gap-3 md:grid-cols-2">
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Code</span>
							<input
								bind:value={couponEditor.code}
								class="input-field uppercase"
								oninput={() => (couponEditor.code = couponEditor.code.toUpperCase())}
							/>
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Discount type</span>
							<select bind:value={couponEditor.discountType} class="input-field">
								<option value="percent">Percent</option>
								<option value="fixed">Fixed amount</option>
							</select>
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">
								{couponEditor.discountType === 'percent' ? 'Discount percent' : 'Discount amount'}
							</span>
							<input bind:value={couponEditor.discountValue} class="input-field" inputmode="decimal" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Minimum subtotal</span>
							<input bind:value={couponEditor.minimumSubtotal} class="input-field" inputmode="decimal" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Max discount</span>
							<input bind:value={couponEditor.maxDiscount} class="input-field" inputmode="decimal" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Total usage limit</span>
							<input bind:value={couponEditor.usageLimit} class="input-field" inputmode="numeric" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Per user limit</span>
							<input bind:value={couponEditor.perUserLimit} class="input-field" inputmode="numeric" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Status</span>
							<select
								class="input-field"
								value={couponEditor.active ? 'active' : 'inactive'}
								onchange={(event) => (couponEditor.active = (event.currentTarget as HTMLSelectElement).value === 'active')}
							>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
							</select>
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Starts at</span>
							<input bind:value={couponEditor.startsAt} class="input-field" type="datetime-local" />
						</label>
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Ends at</span>
							<input bind:value={couponEditor.endsAt} class="input-field" type="datetime-local" />
						</label>
					</div>

					<label class="mt-3 block">
						<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Description</span>
						<textarea bind:value={couponEditor.description} class="input-field min-h-[80px] py-2"></textarea>
					</label>

					<div class="mt-4 flex flex-wrap gap-2">
						<button
							type="button"
							class="button button-primary text-[12px] inline-flex h-9 items-center rounded-md px-4 font-medium disabled:opacity-50"
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
				</div>

			{#if mountedViews.includes('orders')}
				<div class="col-start-1 row-start-1 w-full {panelHidden('orders')}">
					<AdminOrdersManager />
				</div>
			{/if}

			{#if mountedViews.includes('fulfillment')}
				<div class="col-start-1 row-start-1 w-full {panelHidden('fulfillment')}">
					<FulfillmentQueue />
				</div>
			{/if}

			{#if mountedViews.includes('support')}
				<div class="col-start-1 row-start-1 w-full {panelHidden('support')}">
					<AdminSupportManager />
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.admin-header {
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.admin-tabs {
		position: sticky;
		top: 74px;
		z-index: 15;
		background: var(--background-base);
	}

	.admin-tab {
		transition: color 180ms ease;
	}

	.admin-table-row {
		transition: background-color 140ms ease;
	}

	@media (max-width: 767px) {
		.admin-tabs {
			top: 62px;
		}
	}
</style>
