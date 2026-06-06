<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminOrdersManager from '$lib/components/admin/AdminOrdersManager.svelte';
	import AdminSupportManager from '$lib/components/admin/AdminSupportManager.svelte';
	import { apiBase } from '$lib/api-base';
	import { categories, formatINR } from '$lib/catalog';
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

	type AdminView = 'overview' | 'catalog' | 'orders' | 'users' | 'promos' | 'support';

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

	let view = $state<AdminView>('overview');
	let booting = $state(true);
	let loading = $state(false);
	let initializedForUserId: string | null = null;
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

	function ensureViewData(nextView: AdminView) {
		if (nextView === 'catalog') void loadProducts();
		if (nextView === 'users') void loadUsers();
		if (nextView === 'promos') void loadCoupons();
	}

	function setAdminView(nextView: AdminView) {
		view = nextView;
		ensureViewData(nextView);
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
		void loadAdmin();
	});
</script>

<svelte:head>
	<title>Admin - lapkart</title>
</svelte:head>

<section class="admin-page mx-auto max-w-[1400px] px-6 py-8">
	<div
		class="mb-6 overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white shadow-card"
	>
		<div class="grain absolute inset-0 opacity-0"></div>
		<div class="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
			<div class="flex items-start gap-4">
				<div
					class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-black)] text-[var(--heat-100)]"
				>
					<LayoutDashboard class="size-5" strokeWidth={2} />
				</div>
				<div>
					<nav
						class="text-mono-x-small flex items-center gap-1.5 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
					>
						<a href={resolve('/')} class="motion-soft-link hover:text-foreground">home</a>
						<span class="text-[var(--black-alpha-24)]">/</span>
						<span class="text-foreground">operations</span>
					</nav>
					<h1 class="text-title-h4 mt-1.5 font-display text-foreground">Operations workspace</h1>
					<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
						Catalog, orders, users, and promotions — all in one console.
					</p>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				{#if currentUser?.email}
					<div
						class="text-label-small flex h-10 items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 text-[var(--black-alpha-72)]"
					>
						<span class="size-2 rounded-full bg-[var(--accent-forest)]"></span>
						<span class="max-w-[200px] truncate">{currentUser.email}</span>
					</div>
				{/if}
				<a
					href={resolve('/admin/fulfillment')}
					class="button button-primary text-label-small inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-white"
				>
					<Truck class="size-4" strokeWidth={2} />
					Fulfillment queue
					<ArrowUpRight class="size-3.5" strokeWidth={2.2} />
				</a>
			</div>
		</div>
	</div>

	{#if booting}
		<div class="grid gap-3 md:grid-cols-4">
			{#each loadingSkeletons as skeleton (skeleton)}
				<div
					class="h-[120px] animate-pulse rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)]"
				></div>
			{/each}
		</div>
	{:else}
		<div
			class="scrollbar-hide mb-6 flex gap-1 overflow-x-auto rounded-lg border border-[var(--border-faint)] bg-white p-1 shadow-card"
			aria-label="Tabs"
		>
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					class={`text-label-small motion-press flex h-9 items-center gap-2 rounded-md px-3 whitespace-nowrap transition-all ${
						view === tab.id
							? 'bg-[var(--accent-black)] text-white shadow-card'
							: 'text-[var(--black-alpha-56)] hover:bg-[var(--background-lighter)] hover:text-foreground'
					}`}
					onclick={() => setAdminView(tab.id)}
				>
					<tab.icon class="size-3.5" strokeWidth={2} />
					{tab.label}
				</button>
			{/each}
		</div>

		{#if view === 'overview'}
			<div class="flex flex-col gap-6">
				{#if overviewError}
					<div
						class="text-body-small flex items-start gap-3 rounded-md border border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/8 p-4 text-[var(--accent-crimson)]"
					>
						<ShieldAlert class="mt-2 size-4 shrink-0" strokeWidth={2} />
						<span>{overviewError}</span>
					</div>
				{/if}

				<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					{#each overviewCards as card (card.id)}
						{@const Icon = overviewIcons[card.id] ?? TrendingUp}
						<div
							class="motion-card relative overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white p-5 shadow-card"
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<p
										class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>
										{card.label}
									</p>
									<p class="text-title-h4 mt-3 font-display text-foreground">{card.value}</p>
								</div>
								<div
									class="flex size-9 items-center justify-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]"
								>
									<Icon class="size-4" strokeWidth={2} />
								</div>
							</div>
						</div>
					{/each}
				</div>

				<div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
					<div
						class="overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white shadow-card"
					>
						<div
							class="flex items-center justify-between gap-3 border-b-1 border-[var(--border-faint)] bg-[var(--background-lighter)] px-5 py-4"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex size-8 items-center justify-center rounded-md bg-[var(--accent-black)] text-[var(--heat-100)]"
								>
									<Activity class="size-3.5" strokeWidth={2} />
								</div>
								<div>
									<p class="text-label-medium text-foreground">Recent orders</p>
									<p class="text-body-small text-[var(--black-alpha-56)]">
										Latest order activity across the store
									</p>
								</div>
							</div>
							{#if loading}
								<span
									class="text-mono-x-small flex items-center gap-1.5 tracking-[0.16em] text-[var(--heat-100)] uppercase"
								>
									<span class="size-1.5 animate-pulse rounded-full bg-[var(--heat-100)]"></span>
									Syncing
								</span>
							{/if}
						</div>

						<div class="divide-y-1 divide-[var(--border-faint)]">
							{#each analytics?.recentOrders ?? [] as order (order.id)}
								<div class="flex items-center justify-between gap-3 px-5 py-4">
									<div class="flex items-center gap-3">
										<div
											class="text-mono-small flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--background-lighter)] font-medium text-[var(--black-alpha-72)]"
										>
											{order.id.slice(0, 2).toUpperCase()}
										</div>
										<div>
											<p class="text-mono-small text-foreground">
												#{order.id.slice(0, 8).toUpperCase()}
											</p>
											<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
												{order.shippingName || 'Customer'}
											</p>
										</div>
									</div>
									<div class="flex items-center gap-3">
										<span
											class={`text-mono-x-small rounded-sm border px-1.5 py-2 tracking-[0.16em] uppercase ${
												order.status === 'cancelled'
													? 'border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
													: order.status === 'delivered'
														? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
														: 'border-[var(--border-muted)] bg-[var(--background-lighter)] text-[var(--black-alpha-72)]'
											}`}
										>
											{order.status}
										</span>
										<p class="text-label-small text-foreground">{formatINR(order.total)}</p>
									</div>
								</div>
							{/each}

							{#if (analytics?.recentOrders ?? []).length === 0}
								<div class="px-5 py-8 text-center">
									<p class="text-body-small text-[var(--black-alpha-48)]">
										No order history is available yet.
									</p>
								</div>
							{/if}
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<div class="rounded-lg border border-[var(--heat-20)] bg-[var(--heat-4)] p-5">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-mono-x-small tracking-[0.16em] text-[var(--heat-100)] uppercase">
										Pending fulfillment
									</p>
									<p class="text-title-h4 mt-2 font-display text-foreground">
										{analytics?.pendingFulfillment ?? 0}
									</p>
									<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
										Orders awaiting Shiprocket dispatch
									</p>
								</div>
								<div
									class="flex size-9 items-center justify-center rounded-md bg-white text-[var(--heat-100)]"
								>
									<Truck class="size-4" strokeWidth={2} />
								</div>
							</div>
							<a
								href={resolve('/admin/fulfillment')}
								class="text-label-small motion-soft-link mt-4 inline-flex items-center gap-1.5 text-[var(--heat-100)]"
							>
								Open queue
								<ArrowUpRight class="size-3.5" strokeWidth={2.2} />
							</a>
						</div>

						<div class="rounded-lg border border-[var(--border-faint)] bg-white p-5 shadow-card">
							<p class="text-label-medium text-foreground">Service health</p>
							<div class="mt-4 space-y-12">
								<div class="flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<span class="size-2 rounded-full bg-[var(--accent-forest)]"></span>
										<span class="text-body-small text-[var(--black-alpha-72)]">Delivered</span>
									</div>
									<span class="text-label-small text-foreground"
										>{analytics?.deliveredOrders ?? 0}</span
									>
								</div>
								<div class="flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<span class="size-2 rounded-full bg-[var(--accent-honey)]"></span>
										<span class="text-body-small text-[var(--black-alpha-72)]"
											>Cancellation queue</span
										>
									</div>
									<span class="text-label-small text-foreground"
										>{analytics?.cancellationReport.total ?? 0}</span
									>
								</div>
								<div class="flex items-center justify-between gap-3">
									<div class="flex items-center gap-2">
										<span class="size-2 rounded-full bg-[var(--accent-crimson)]"></span>
										<span class="text-body-small text-[var(--black-alpha-72)]">Awaiting review</span
										>
									</div>
									<span class="text-label-small text-foreground"
										>{analytics?.cancellationReport.pending ?? 0}</span
									>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else if view === 'catalog'}
			<div class="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
				<aside
					class="flex flex-col gap-3 overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white shadow-card xl:sticky xl:top-24 xl:self-start"
				>
					<div class="border-b-1 border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
						<div class="flex items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								<div
									class="flex size-8 items-center justify-center rounded-md bg-[var(--accent-black)] text-[var(--heat-100)]"
								>
									<Boxes class="size-3.5" strokeWidth={2} />
								</div>
								<div>
									<p class="text-label-medium text-foreground">Catalog</p>
									<p class="text-body-small text-[var(--black-alpha-56)]">
										{filteredProducts.length} of {products.length}
									</p>
								</div>
							</div>
							<button
								type="button"
								class="button button-primary text-label-small inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-white"
								onclick={beginCreateProduct}
							>
								<Plus class="size-3.5" strokeWidth={2.2} />
								New
							</button>
						</div>

						<input
							bind:value={productSearch}
							class="input-field mt-3"
							placeholder="Search title, brand, SKU..."
						/>
					</div>

					<div class="max-h-[calc(100vh-280px)] space-y-8 overflow-y-auto px-3 pb-4">
						{#if productsLoading && !products.length}
							<div
								class="text-body-small rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-center text-[var(--black-alpha-56)]"
							>
								Loading catalog...
							</div>
						{:else}
							{#each filteredProducts as product (product.id)}
								<button
									type="button"
									class={`motion-press flex w-full items-start gap-3 rounded-md border p-3 text-left transition-all ${
										product.id === selectedProductId
											? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
											: 'border-transparent bg-white hover:border-[var(--border-muted)] hover:bg-[var(--background-lighter)]'
									}`}
									onclick={() => {
										selectedProductId = product.id;
										productEditor = mapProductToEditor(product);
										productNotice = null;
									}}
								>
									<div
										class="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--border-faint)] bg-white p-1"
									>
										<img
											src={product.image || 'https://placehold.co/100x100?text=%20'}
											alt={product.title}
											class="max-h-full max-w-full object-contain"
										/>
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex items-start justify-between gap-2">
											<p class="text-label-small line-clamp-1 text-foreground">{product.title}</p>
											<p class="text-label-small shrink-0 text-foreground">
												{formatINR(product.price)}
											</p>
										</div>
										<p class="text-body-small mt-2 truncate text-[var(--black-alpha-56)]">
											{product.brand} · {categoryNameBySlug.get(product.category) ??
												product.category}
										</p>
										<div class="mt-2 flex flex-wrap items-center gap-1.5">
											<span
												class={`text-mono-x-small rounded-sm border px-1.5 py-2 tracking-[0.14em] uppercase ${
													product.status === 'active'
														? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
														: product.status === 'archived'
															? 'border-[var(--border-muted)] bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'
															: 'border-[var(--accent-honey)]/30 bg-[var(--accent-honey)]/8 text-[var(--accent-honey)]'
												}`}>{product.status}</span
											>
											<span
												class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
												>Stock {product.stock}</span
											>
										</div>
									</div>
								</button>
							{/each}
						{/if}

						{#if !productsLoading && !filteredProducts.length}
							<div
								class="text-body-small rounded-md border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-4 text-center text-[var(--black-alpha-56)]"
							>
								{productsError || 'No products match the current search.'}
							</div>
						{/if}
					</div>
				</aside>

				<div
					class="flex flex-col overflow-hidden rounded-lg border border-[var(--border-faint)] bg-white shadow-card"
				>
					<div class="border-b border-[var(--border-faint)] p-8">
						<div class="flex flex-col gap-8 sm:flex-row sm:items-start">
							<div
								class="flex size-32 shrink-0 items-center justify-center rounded-lg bg-[var(--background-lighter)] p-4 mix-blend-multiply"
							>
								{#if productEditor.image}
									<img
										src={productEditor.image}
										alt={productEditor.title || 'Product preview'}
										class="max-h-full max-w-full object-contain"
									/>
								{:else}
									<Boxes class="size-6 text-[var(--black-alpha-32)]" strokeWidth={1.5} />
								{/if}
							</div>

							<div class="min-w-0 flex-1">
								<div class="mb-1.5 flex flex-wrap items-center gap-1.5">
									<span
										class={`text-mono-x-small rounded-sm border px-2 py-2 tracking-[0.16em] uppercase ${
											selectedProductId === 'new'
												? 'border-[var(--heat-100)] bg-[var(--heat-100)] text-white'
												: productEditor.status === 'active'
													? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
													: 'border-[var(--border-muted)] bg-white text-[var(--black-alpha-72)]'
										}`}
									>
										{selectedProductId === 'new' ? 'new' : productEditor.status}
									</span>
									<span
										class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-56)] uppercase"
									>
										{categoryNameBySlug.get(productEditor.category) ?? 'Category pending'}
									</span>
								</div>
								<h2 class="text-title-h5 truncate font-display text-foreground">
									{productEditor.title || 'Untitled product'}
								</h2>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{productEditor.brand || 'Brand pending'} · SKU {productEditor.sku || '—'}
								</p>
							</div>

							<div class="mt-6 flex shrink-0 gap-8 sm:mt-0">
								<div class="px-4 py-2">
									<p
										class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										Price
									</p>
									<p class="text-label-large mt-2 text-foreground">
										{formatINR(Number(productEditor.price || 0))}
									</p>
								</div>
								<div class="px-4 py-2">
									<p
										class="text-mono-x-small tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										Stock
									</p>
									<p class="text-label-large mt-2 text-foreground">
										{productEditor.stock || '0'}
									</p>
								</div>
							</div>
						</div>
					</div>

					{#if productsLoading && !productEditor.id && selectedProductId !== 'new'}
						<div
							class="text-body-small m-6 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3 text-[var(--black-alpha-56)]"
						>
							Preparing product editor...
						</div>
					{/if}

					{#if productNotice}
						<div
							class={`text-body-small m-6 mb-0 flex items-start gap-2 rounded-md border px-3 py-3 ${noticeClasses(productNotice.tone)}`}
						>
							<span class="mt-2 size-1.5 shrink-0 rounded-full bg-current"></span>
							<span>{productNotice.text}</span>
						</div>
					{/if}

					<div class="space-y-10 p-8">
						<section>
							<h3 class="text-label-medium text-foreground">Product identity</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Title</span
									>
									<input bind:value={productEditor.title} class="input-field" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Brand</span
									>
									<input bind:value={productEditor.brand} class="input-field" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Category</span
									>
									<select bind:value={productEditor.category} class="input-field">
										{#each categoryOptions as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]">SKU</span
									>
									<input bind:value={productEditor.sku} class="input-field" />
								</label>
								<label class="sm:col-span-2">
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Description</span
									>
									<textarea
										bind:value={productEditor.description}
										class="input-field min-h-[100px] py-3"
										style="height: auto;"
									></textarea>
								</label>
								<label class="sm:col-span-2">
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Compatibility</span
									>
									<input bind:value={productEditor.compatibility} class="input-field" />
								</label>
							</div>
						</section>

						<div class="border-t-1 border-[var(--border-faint)]"></div>

						<section>
							<h3 class="text-label-medium text-foreground">Pricing &amp; availability</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Price</span
									>
									<input bind:value={productEditor.price} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]">MRP</span
									>
									<input bind:value={productEditor.mrp} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Stock</span
									>
									<input bind:value={productEditor.stock} class="input-field" inputmode="numeric" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Status</span
									>
									<select bind:value={productEditor.status} class="input-field">
										<option value="active">Active</option>
										<option value="draft">Draft</option>
										<option value="archived">Archived</option>
									</select>
								</label>
							</div>
						</section>

						<div class="border-t-1 border-[var(--border-faint)]"></div>

						<section>
							<h3 class="text-label-medium text-foreground">Trust, tax &amp; checkout rules</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Authenticity</span
									>
									<select bind:value={productEditor.authenticityGrade} class="input-field">
										<option value="oem">OEM</option>
										<option value="compatible">Compatible</option>
										<option value="refurbished">Refurbished</option>
										<option value="open_box">Open box</option>
									</select>
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Condition</span
									>
									<select bind:value={productEditor.conditionGrade} class="input-field">
										<option value="new">New</option>
										<option value="open_box">Open box</option>
										<option value="refurbished">Refurbished</option>
										<option value="used">Used</option>
									</select>
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>HSN code</span
									>
									<input bind:value={productEditor.hsnCode} class="input-field" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>GST rate (%)</span
									>
									<input
										bind:value={productEditor.gstRate}
										class="input-field"
										inputmode="numeric"
									/>
								</label>
							</div>
						</section>

						<div class="border-t-1 border-[var(--border-faint)]"></div>

						<section>
							<h3 class="text-label-medium text-foreground">Delivery &amp; policies</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>DOA window (days)</span
									>
									<input
										bind:value={productEditor.doaPolicyDays}
										class="input-field"
										inputmode="numeric"
									/>
								</label>
								<label
									class="flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3"
								>
									<input
										type="checkbox"
										bind:checked={productEditor.localDeliveryEligible}
										class="size-4 accent-[var(--heat-100)]"
									/>
									<span class="text-label-small text-[var(--black-alpha-72)]"
										>Local delivery eligible</span
									>
								</label>
								<label
									class="flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3"
								>
									<input
										type="checkbox"
										bind:checked={productEditor.codEligible}
										class="size-4 accent-[var(--heat-100)]"
									/>
									<span class="text-label-small text-[var(--black-alpha-72)]">COD eligible</span>
								</label>
							</div>
						</section>

						<div class="border-t-1 border-[var(--border-faint)]"></div>

						<section>
							<h3 class="text-label-medium text-foreground">Imagery &amp; dimensions</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Primary image URL</span
									>
									<input bind:value={productEditor.image} class="input-field" />
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Source URL</span
									>
									<input bind:value={productEditor.sourceUrl} class="input-field" />
								</label>
								<label class="sm:col-span-2">
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Additional images (one URL per line)</span
									>
									<textarea
										bind:value={productEditor.imagesText}
										class="input-field min-h-[100px] py-3 font-mono"
										style="height: auto;"
									></textarea>
								</label>

								<div class="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
									<label>
										<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
											>Weight (kg)</span
										>
										<input
											bind:value={productEditor.weightKg}
											class="input-field"
											inputmode="decimal"
										/>
									</label>
									<label>
										<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
											>Length (cm)</span
										>
										<input
											bind:value={productEditor.lengthCm}
											class="input-field"
											inputmode="decimal"
										/>
									</label>
									<label>
										<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
											>Breadth (cm)</span
										>
										<input
											bind:value={productEditor.breadthCm}
											class="input-field"
											inputmode="decimal"
										/>
									</label>
									<label>
										<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
											>Height (cm)</span
										>
										<input
											bind:value={productEditor.heightCm}
											class="input-field"
											inputmode="decimal"
										/>
									</label>
								</div>
							</div>
						</section>

						<div class="border-t-1 border-[var(--border-faint)]"></div>

						<section>
							<h3 class="text-label-medium text-foreground">Merchandising</h3>
							<div class="mt-3 grid gap-3 sm:grid-cols-2">
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Highlights (one per line)</span
									>
									<textarea
										bind:value={productEditor.highlightsText}
										class="input-field min-h-[100px] py-3"
										style="height: auto;"
									></textarea>
								</label>
								<label>
									<span class="text-label-small mb-1.5 block text-[var(--black-alpha-72)]"
										>Search keywords (one per line)</span
									>
									<textarea
										bind:value={productEditor.searchKeywordsText}
										class="input-field min-h-[100px] py-3"
										style="height: auto;"
									></textarea>
								</label>
							</div>
						</section>
					</div>

					<div
						class="flex flex-wrap items-center gap-3 border-t-1 border-[var(--border-faint)] bg-[var(--background-lighter)] p-6"
					>
						<button
							type="button"
							class="button button-primary text-label-medium inline-flex h-10 items-center justify-center rounded-md px-6 text-white disabled:opacity-50"
							disabled={productSaving}
							onclick={saveProduct}
						>
							{productSaving ? 'Saving...' : 'Save product'}
						</button>
						{#if selectedProductId !== 'new'}
							<button
								type="button"
								class="text-label-small motion-press inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-[var(--accent-crimson)] transition-colors hover:border-[var(--accent-crimson)] hover:bg-[var(--accent-crimson)]/4 disabled:opacity-50"
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
			<div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
				<div class="bg-background-base rounded-lg border border-border-muted p-5">
					<input
						bind:value={userSearch}
						class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
						placeholder="Search name, email, or phone"
					/>

					<div class="mt-6 overflow-x-auto">
						<table class="w-full min-w-[760px] border-collapse text-left">
							<thead>
								<tr
									class="text-mono-x-small border-b-1 border-border-muted tracking-[0.16em] text-[var(--black-alpha-56)] uppercase"
								>
									<th class="px-3 py-3 font-medium">User</th>
									<th class="px-3 py-3 font-medium">Role</th>
									<th class="px-3 py-3 font-medium">Orders</th>
									<th class="px-3 py-3 font-medium">Value</th>
								</tr>
							</thead>
							<tbody>
								{#if usersLoading && !users.length}
									<tr>
										<td
											class="text-body-small px-3 py-6 text-center text-[var(--black-alpha-56)]"
											colspan="4"
										>
											Loading customer accounts...
										</td>
									</tr>
								{:else}
									{#each filteredUsers as user (user.id)}
										<tr
											class={`hover:bg-background-lighter cursor-pointer border-b-1 border-border-faint align-top transition-colors ${
												user.id === selectedUserId ? 'bg-[var(--heat-4)]' : ''
											}`}
											onclick={() => {
												selectedUserId = user.id;
												userEditor = mapUserToEditor(user);
												userNotice = null;
											}}
										>
											<td class="px-3 py-4">
												<p class="text-label-small text-foreground">
													{user.fullName || user.email || 'Unnamed account'}
												</p>
												<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
													{user.email || 'No email'}
												</p>
												<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
													{user.phone || 'No phone'}
												</p>
											</td>
											<td class="px-3 py-4">
												<span
													class={`text-mono-x-small rounded-sm px-1.5 py-2 tracking-[0.16em] uppercase ${
														user.role === 'admin'
															? 'border border-amber-200 bg-amber-50 text-amber-700'
															: 'bg-background-lighter border border-border-muted text-[var(--black-alpha-56)]'
													}`}
												>
													{user.role}
												</span>
											</td>
											<td class="text-label-small px-3 py-4 text-foreground">{user.orderCount}</td>
											<td class="text-label-small px-3 py-4 text-foreground"
												>{formatINR(user.totalSpent)}</td
											>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>

					{#if usersError}
						<div
							class="text-body-small bg-background-lighter mt-4 rounded-md border border-accent-crimson p-4 text-accent-crimson"
						>
							{usersError}
						</div>
					{:else if !usersLoading && !filteredUsers.length}
						<div
							class="text-body-small bg-background-lighter mt-4 rounded-md border border-border-muted p-4 text-[var(--black-alpha-56)]"
						>
							No users match the current search.
						</div>
					{/if}
				</div>

				<div class="bg-background-base rounded-lg border border-border-muted p-5">
					<p class="text-label-medium text-foreground">Edit account</p>

					{#if userNotice}
						<div
							class={`text-body-small mt-6 rounded-md border px-4 py-3 ${noticeClasses(userNotice.tone)}`}
						>
							{userNotice.text}
						</div>
					{/if}

					{#if selectedUser}
						<div class="mt-6 grid gap-4 sm:grid-cols-2">
							<label>
								<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Role</span>
								<select
									bind:value={userEditor.role}
									class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									disabled={selectedUserIsCurrentAdmin}
								>
									<option value="user">User</option>
									<option value="admin">Admin</option>
								</select>
								{#if selectedUserIsCurrentAdmin}
									<span class="text-body-small mt-2 block text-[var(--black-alpha-56)]">
										Use another admin account before changing your own role.
									</span>
								{/if}
							</label>
							<label>
								<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
									>Full name</span
								>
								<input
									bind:value={userEditor.fullName}
									class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								/>
							</label>
							<label class="sm:col-span-2">
								<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Phone</span>
								<input
									bind:value={userEditor.phone}
									class="bg-background-base text-body-input disabled:bg-background-lighter flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none disabled:cursor-not-allowed disabled:text-[var(--black-alpha-48)]"
									disabled={selectedUserPhoneLocked}
								/>
								{#if selectedUserPhoneLocked}
									<span class="text-body-small mt-2 block text-[var(--black-alpha-56)]">
										Phone is locked because this account has order history.
									</span>
								{/if}
							</label>
						</div>

						<div class="mt-6 grid gap-3 sm:grid-cols-2">
							<div class="bg-background-lighter rounded-md border border-border-faint p-4">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Email
								</p>
								<p class="text-label-small mt-2 text-foreground">
									{selectedUser.email || 'No email'}
								</p>
							</div>
							<div class="bg-background-lighter rounded-md border border-border-faint p-4">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Joined
								</p>
								<p class="text-label-small mt-2 text-foreground">
									{selectedUser.createdAt
										? new Date(selectedUser.createdAt).toLocaleString('en-IN')
										: 'Unknown'}
								</p>
							</div>
							<div class="bg-background-lighter rounded-md border border-border-faint p-4">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Orders
								</p>
								<p class="text-label-small mt-2 text-foreground">{selectedUser.orderCount}</p>
							</div>
							<div class="bg-background-lighter rounded-md border border-border-faint p-4">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Total spent
								</p>
								<p class="text-label-small mt-2 text-foreground">
									{formatINR(selectedUser.totalSpent)}
								</p>
							</div>
						</div>

						<div class="mt-6">
							<button
								type="button"
								class="text-label-small text-accent-white inline-flex h-10 items-center justify-center rounded-md bg-heat-100 px-4 transition-colors hover:opacity-90 disabled:opacity-50"
								disabled={userSaving}
								onclick={saveUser}
							>
								{userSaving ? 'Saving...' : 'Save account'}
							</button>
						</div>
					{:else}
						<div
							class="text-body-small bg-background-lighter mt-6 rounded-md border border-border-muted p-4 text-[var(--black-alpha-56)]"
						>
							Select a user to edit it.
						</div>
					{/if}
				</div>
			</div>
		{:else if view === 'promos'}
			<div class="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
				<div class="bg-background-base rounded-lg border border-border-muted p-5">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-label-large text-foreground">Promotions</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
								Manage coupon codes, limits, and redemption windows.
							</p>
						</div>
						<button
							type="button"
							class="text-label-small text-accent-white inline-flex h-10 items-center justify-center rounded-md bg-heat-100 px-4 transition-colors hover:opacity-90"
							onclick={beginCreateCoupon}
						>
							New coupon
						</button>
					</div>

					<div
						class="bg-background-lighter mt-6 overflow-hidden rounded-lg border border-border-muted"
					>
						<div
							class="text-mono-x-small grid grid-cols-[1fr_auto_auto] border-b-1 border-border-muted px-4 py-3 tracking-[0.16em] text-[var(--black-alpha-56)] uppercase"
						>
							<span>Code</span>
							<span>Used</span>
							<span>Status</span>
						</div>

						{#if couponsLoading && !coupons.length}
							<div
								class="text-body-small bg-background-base px-4 py-6 text-center text-[var(--black-alpha-56)]"
							>
								Loading promotions...
							</div>
						{:else}
							{#each coupons as coupon (coupon.id)}
								<button
									type="button"
									class={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b-1 border-border-faint px-4 py-3 text-left transition-colors last:border-b-0 ${
										selectedCouponId === coupon.id
											? 'bg-[var(--heat-4)] text-[var(--heat-100)]'
											: 'bg-background-base hover:bg-background-lighter text-foreground'
									}`}
									onclick={() => {
										selectedCouponId = coupon.id;
										couponEditor = mapCouponToEditor(coupon);
										couponNotice = null;
									}}
								>
									<span>
										<span class="text-label-small">{coupon.code}</span>
										<span class="text-body-small mt-1 block text-[var(--black-alpha-56)]">
											{coupon.discountType === 'percent'
												? `${coupon.discountValue}% off`
												: `${formatINR(coupon.discountValue)} off`}
										</span>
									</span>
									<span class="text-label-small">{coupon.usedCount}</span>
									<span
										class={`text-mono-x-small rounded-sm px-1.5 py-2 tracking-[0.16em] uppercase ${
											coupon.active
												? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
												: 'bg-background-lighter border border-border-muted text-[var(--black-alpha-56)]'
										}`}
									>
										{coupon.active ? 'Active' : 'Off'}
									</span>
								</button>
							{/each}
						{/if}
					</div>

					{#if couponsError}
						<div
							class="text-body-small bg-background-lighter mt-4 rounded-md border border-accent-crimson p-4 text-accent-crimson"
						>
							{couponsError}
						</div>
					{:else if !couponsLoading && !coupons.length}
						<div
							class="text-body-small bg-background-lighter mt-4 rounded-md border border-border-muted p-4 text-[var(--black-alpha-56)]"
						>
							No coupons have been created yet.
						</div>
					{/if}
				</div>

				<div class="bg-background-base rounded-lg border border-border-muted p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-56)] uppercase">
								{couponEditor.id ? 'Edit coupon' : 'Create coupon'}
							</p>
							<h3 class="text-title-h5 mt-2 text-foreground">
								{couponEditor.code || 'New campaign'}
							</h3>
						</div>
						{#if selectedCoupon}
							<div class="text-body-small text-right text-[var(--black-alpha-56)]">
								<p>{selectedCoupon.usedCount} redemptions</p>
								<p>{formatINR(selectedCoupon.discountGiven)} discounts</p>
							</div>
						{/if}
					</div>

					{#if couponNotice}
						<div
							class={`text-body-small mt-6 rounded-md border px-4 py-3 ${noticeClasses(couponNotice.tone)}`}
						>
							{couponNotice.text}
						</div>
					{/if}

					<div class="mt-6 grid gap-4 md:grid-cols-2">
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Code</span>
							<input
								bind:value={couponEditor.code}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 uppercase transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								oninput={() => (couponEditor.code = couponEditor.code.toUpperCase())}
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
								>Discount type</span
							>
							<select
								bind:value={couponEditor.discountType}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
							>
								<option value="percent">Percent</option>
								<option value="fixed">Fixed amount</option>
							</select>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">
								{couponEditor.discountType === 'percent' ? 'Discount percent' : 'Discount amount'}
							</span>
							<input
								bind:value={couponEditor.discountValue}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
								>Minimum subtotal</span
							>
							<input
								bind:value={couponEditor.minimumSubtotal}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
								>Max discount</span
							>
							<input
								bind:value={couponEditor.maxDiscount}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
								>Total usage limit</span
							>
							<input
								bind:value={couponEditor.usageLimit}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								inputmode="numeric"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]"
								>Per user limit</span
							>
							<input
								bind:value={couponEditor.perUserLimit}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								inputmode="numeric"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Status</span>
							<select
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
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
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Starts at</span
							>
							<input
								bind:value={couponEditor.startsAt}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								type="datetime-local"
							/>
						</label>
						<label>
							<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Ends at</span>
							<input
								bind:value={couponEditor.endsAt}
								class="bg-background-base text-body-input flex h-10 w-full rounded-md border border-border-muted px-3 py-2 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
								type="datetime-local"
							/>
						</label>
					</div>

					<label class="mt-4 block">
						<span class="text-label-small mb-2 block text-[var(--black-alpha-72)]">Description</span
						>
						<textarea
							bind:value={couponEditor.description}
							class="bg-background-base text-body-input flex min-h-[100px] w-full rounded-md border border-border-muted px-3 py-3 transition-colors focus-visible:ring-1 focus-visible:ring-[var(--heat-100)] focus-visible:outline-none"
						></textarea>
					</label>

					<div class="mt-6 flex flex-wrap gap-3">
						<button
							type="button"
							class="text-label-small text-accent-white inline-flex h-10 items-center justify-center rounded-md bg-heat-100 px-4 transition-colors hover:opacity-90 disabled:opacity-50"
							disabled={couponSaving}
							onclick={saveCoupon}
						>
							{couponSaving ? 'Saving...' : 'Save coupon'}
						</button>

						{#if couponEditor.id}
							<button
								type="button"
								class="bg-background-base text-label-small hover:bg-background-lighter inline-flex h-10 items-center justify-center rounded-md border border-border-faint px-4 text-accent-crimson transition-colors hover:border-accent-crimson disabled:opacity-50"
								disabled={couponDeleting}
								onclick={deleteCoupon}
							>
								{couponDeleting ? 'Removing...' : 'Remove'}
							</button>
						{/if}
					</div>
				</div>
			</div>
		{:else if view === 'orders'}
			<AdminOrdersManager />
		{:else if view === 'support'}
			<AdminSupportManager />
		{/if}
	{/if}
</section>
