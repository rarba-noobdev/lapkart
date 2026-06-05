<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminOrdersManager from '$lib/components/admin/AdminOrdersManager.svelte';
	import AdminSupportManager from '$lib/components/admin/AdminSupportManager.svelte';
	import { apiBase } from '$lib/api-base';
	import { categories, formatINR } from '$lib/catalog';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';
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

	const tabs: Array<{ id: AdminView; label: string }> = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'catalog', label: 'Catalog' },
		{ id: 'orders', label: 'Orders' },
		{ id: 'users', label: 'Users' },
		{ id: 'promos', label: 'Promos' },
		{ id: 'support', label: 'Support' }
	];

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

	async function loadProducts() {
		try {
			productsError = null;
			const response = await requestAdmin<{ products: AdminProduct[] }>('/admin/products');
			products = response.products ?? [];
			syncProductEditor();
		} catch (loadError) {
			productsError = loadError instanceof Error ? loadError.message : 'Could not load products';
		}
	}

	async function loadUsers() {
		try {
			usersError = null;
			const response = await requestAdmin<{ users: AdminUserRecord[] }>('/admin/users');
			users = response.users ?? [];
			syncUserEditor();
		} catch (loadError) {
			usersError = loadError instanceof Error ? loadError.message : 'Could not load users';
		}
	}

	async function loadCoupons() {
		try {
			couponsError = null;
			const response = await requestAdmin<{ coupons: AdminCoupon[] }>('/admin/coupons');
			coupons = response.coupons ?? [];
			syncCouponEditor();
		} catch (loadError) {
			couponsError = loadError instanceof Error ? loadError.message : 'Could not load coupons';
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
		await Promise.all([loadAnalytics(), loadProducts(), loadUsers(), loadCoupons()]);
		loading = false;
		booting = false;
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

			await Promise.all([loadProducts(), loadAnalytics()]);
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

			await Promise.all([loadProducts(), loadAnalytics()]);
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
			await loadUsers();
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
			await loadCoupons();
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
			await loadCoupons();
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

<section class="container mx-auto px-4 py-10">
	<div class="mb-8 space-y-4">
		<nav class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
			<a href={resolve('/')} class="transition-colors hover:text-[var(--heat-100)]">home</a>
			<span class="mx-2 text-[var(--black-alpha-24)]">/</span>
			<span class="text-[var(--heat-100)]">admin</span>
		</nav>

		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Admin operations
				</p>
				<h1 class="text-title-h3 mt-3 font-display text-foreground">Admin dashboard</h1>
				<p class="text-body-medium mt-2 max-w-[44rem] text-[var(--black-alpha-56)]">
					Catalog management, coupon controls, order workflows, fulfillment handoff, and support are
					now running in the SvelteKit admin surface.
				</p>
			</div>

			<a
				href={resolve('/admin/fulfillment')}
				class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
			>
				Fulfillment queue
			</a>
		</div>
	</div>

	{#if booting}
		<div class="grid gap-4 md:grid-cols-4">
			{#each loadingSkeletons as skeleton (skeleton)}
				<div
					class="h-28 animate-pulse rounded-[18px] border border-[var(--border-faint)] bg-white"
				></div>
			{/each}
		</div>
	{:else}
		<div class="mb-6 rounded-[18px] border border-[var(--border-faint)] bg-white p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Workspace
					</p>
					<p class="text-label-medium mt-2 text-foreground">
						Switch between catalog, users, promos, and support.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each tabs as tab (tab.id)}
						<button
							type="button"
							class={`text-label-small rounded-full border px-4 py-2 transition-colors ${
								view === tab.id
									? 'border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]'
									: 'border-[var(--border-muted)] bg-white text-foreground'
							}`}
							onclick={() => (view = tab.id)}
						>
							{tab.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if view === 'overview'}
			<div class="space-y-6">
				{#if overviewError}
					<div class="rounded-[16px] border border-red-200 bg-red-50 p-6 text-red-700">
						{overviewError}
					</div>
				{/if}

				<div class="grid gap-4 md:grid-cols-4">
					{#each overviewCards as card (card.id)}
						<div class="rounded-[16px] border border-[var(--border-faint)] bg-white p-6">
							<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
								{card.label}
							</p>
							<p class="text-title-h4 mt-3 text-foreground">{card.value}</p>
						</div>
					{/each}
				</div>

				<div class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
					<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="text-label-large text-foreground">Recent orders</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									Latest order activity across the store.
								</p>
							</div>
							{#if loading}
								<span class="text-body-small text-[var(--black-alpha-56)]">Refreshing...</span>
							{/if}
						</div>

						<div class="mt-5 space-y-3">
							{#each analytics?.recentOrders ?? [] as order (order.id)}
								<div
									class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
								>
									<div class="flex flex-wrap items-center justify-between gap-3">
										<div>
											<p class="text-label-large text-foreground">
												#{order.id.slice(0, 8).toUpperCase()}
											</p>
											<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
												{order.shippingName || 'Customer'}
											</p>
										</div>
										<div class="text-right">
											<p class="text-label-large text-foreground">{formatINR(order.total)}</p>
											<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
												{order.status}
											</p>
										</div>
									</div>
								</div>
							{/each}

							{#if (analytics?.recentOrders ?? []).length === 0}
								<div
									class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
								>
									No order history is available yet.
								</div>
							{/if}
						</div>
					</div>

					<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
						<p class="text-label-large text-foreground">Risk and service</p>
						<div class="mt-5 grid gap-4">
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Pending fulfillment
								</p>
								<p class="text-title-h5 mt-2 text-foreground">
									{analytics?.pendingFulfillment ?? 0}
								</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Delivered orders
								</p>
								<p class="text-title-h5 mt-2 text-foreground">{analytics?.deliveredOrders ?? 0}</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Cancellation requests
								</p>
								<p class="text-title-h5 mt-2 text-foreground">
									{analytics?.cancellationReport.total ?? 0}
								</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{analytics?.cancellationReport.pending ?? 0} still pending review
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else if view === 'catalog'}
			<div class="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
				<div
					class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5 xl:sticky xl:top-24 xl:self-start"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<input
							bind:value={productSearch}
							class="input-field min-w-0 flex-1"
							placeholder="Search title, brand, category, SKU"
						/>
						<button
							type="button"
							class="button button-primary text-label-medium inline-flex h-11 items-center justify-center rounded-md px-4 text-white"
							onclick={beginCreateProduct}
						>
							New product
						</button>
					</div>

					<div
						class="text-mono-x-small mt-5 flex items-center justify-between tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
					>
						<span>{filteredProducts.length} records</span>
						<span>Live catalog</span>
					</div>

					<div class="mt-4 max-h-[calc(100vh-280px)] space-y-2 overflow-y-auto pr-1">
						{#each filteredProducts as product (product.id)}
							<button
								type="button"
								class={`flex w-full gap-3 rounded-[16px] border p-3 text-left transition-colors ${
									product.id === selectedProductId
										? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
										: 'border-[var(--border-faint)] bg-white hover:border-[var(--heat-20)] hover:bg-[var(--background-lighter)]'
								}`}
								onclick={() => {
									selectedProductId = product.id;
									productEditor = mapProductToEditor(product);
									productNotice = null;
								}}
							>
								<img
									src={product.image}
									alt={product.title}
									class="h-16 w-16 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
								/>
								<div class="min-w-0 flex-1">
									<div class="flex items-start justify-between gap-3">
										<p class="text-label-small line-clamp-2 text-foreground">{product.title}</p>
										<p class="text-label-small shrink-0 text-foreground">
											{formatINR(product.price)}
										</p>
									</div>
									<p class="text-body-small mt-1 truncate text-[var(--black-alpha-56)]">
										{product.brand} / {categoryNameBySlug.get(product.category) ?? product.category}
									</p>
									<div
										class="text-mono-x-small mt-2 flex flex-wrap items-center gap-2 tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
									>
										<span>{product.status}</span>
										<span>Stock {product.stock}</span>
										{#if product.sku}
											<span>SKU {product.sku}</span>
										{/if}
									</div>
								</div>
							</button>
						{/each}

						{#if !filteredProducts.length}
							<div
								class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
							>
								{productsError || 'No products match the current search.'}
							</div>
						{/if}
					</div>
				</div>

				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<div
						class="grid gap-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 lg:grid-cols-[120px_1fr_auto] lg:items-center"
					>
						{#if productEditor.image}
							<img
								src={productEditor.image}
								alt={productEditor.title || 'Product preview'}
								class="h-28 w-28 rounded-md border border-[var(--border-faint)] bg-white object-contain p-2"
							/>
						{:else}
							<div
								class="grid h-28 w-28 place-items-center rounded-md border border-[var(--border-faint)] bg-white text-[var(--black-alpha-40)]"
							>
								No image
							</div>
						{/if}

						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span
									class="text-mono-x-small rounded-full border border-[var(--heat-20)] bg-[var(--heat-8)] px-3 py-1 tracking-[0.16em] text-[var(--heat-100)] uppercase"
								>
									{selectedProductId === 'new' ? 'new product' : productEditor.status}
								</span>
								<span
									class="text-mono-x-small rounded-full border border-[var(--border-faint)] bg-white px-3 py-1 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									{categoryNameBySlug.get(productEditor.category) ?? 'Category pending'}
								</span>
							</div>
							<p class="text-label-large mt-3 line-clamp-2 text-foreground">
								{productEditor.title || 'Untitled product'}
							</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
								{productEditor.brand || 'Brand pending'} / SKU {productEditor.sku || 'pending'}
							</p>
						</div>

						<div class="grid gap-2 sm:grid-cols-3 lg:min-w-[240px] lg:grid-cols-1 xl:grid-cols-3">
							<div class="rounded-[14px] border border-[var(--border-faint)] bg-white p-3">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Price
								</p>
								<p class="text-label-medium mt-2 text-foreground">
									{formatINR(Number(productEditor.price || 0))}
								</p>
							</div>
							<div class="rounded-[14px] border border-[var(--border-faint)] bg-white p-3">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									MRP
								</p>
								<p class="text-label-medium mt-2 text-foreground">
									{formatINR(Number(productEditor.mrp || 0))}
								</p>
							</div>
							<div class="rounded-[14px] border border-[var(--border-faint)] bg-white p-3">
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Stock
								</p>
								<p class="text-label-medium mt-2 text-foreground">{productEditor.stock || '0'}</p>
							</div>
						</div>
					</div>

					{#if productNotice}
						<div
							class={`text-body-small mt-5 rounded-[16px] border px-4 py-3 ${noticeClasses(productNotice.tone)}`}
						>
							{productNotice.text}
						</div>
					{/if}

					<div class="mt-6 space-y-5">
						<section class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4">
							<p class="text-label-medium text-foreground">Product identity</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2">
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Title</span
									>
									<input bind:value={productEditor.title} class="input-field" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Brand</span
									>
									<input bind:value={productEditor.brand} class="input-field" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Category</span
									>
									<select bind:value={productEditor.category} class="input-field">
										{#each categoryOptions as option (option.value)}
											<option value={option.value}>{option.label}</option>
										{/each}
									</select>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>SKU</span
									>
									<input bind:value={productEditor.sku} class="input-field" />
								</label>
								<label class="sm:col-span-2">
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Description</span
									>
									<textarea bind:value={productEditor.description} class="input-field min-h-28 py-3"
									></textarea>
								</label>
								<label class="sm:col-span-2">
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Compatibility</span
									>
									<input bind:value={productEditor.compatibility} class="input-field" />
								</label>
							</div>
						</section>

						<section class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4">
							<p class="text-label-medium text-foreground">Pricing and availability</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Price</span
									>
									<input bind:value={productEditor.price} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>MRP</span
									>
									<input bind:value={productEditor.mrp} class="input-field" inputmode="decimal" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Stock</span
									>
									<input bind:value={productEditor.stock} class="input-field" inputmode="numeric" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
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

						<section class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4">
							<p class="text-label-medium text-foreground">Trust, tax, and checkout rules</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
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
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
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
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>HSN code</span
									>
									<input bind:value={productEditor.hsnCode} class="input-field" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>GST rate</span
									>
									<input
										bind:value={productEditor.gstRate}
										class="input-field"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>DOA days</span
									>
									<input
										bind:value={productEditor.doaPolicyDays}
										class="input-field"
										inputmode="numeric"
									/>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Local delivery</span
									>
									<select
										class="input-field"
										value={productEditor.localDeliveryEligible ? 'yes' : 'no'}
										onchange={(event) =>
											(productEditor.localDeliveryEligible =
												(event.currentTarget as HTMLSelectElement).value === 'yes')}
									>
										<option value="yes">Eligible</option>
										<option value="no">Not eligible</option>
									</select>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>COD</span
									>
									<select
										class="input-field"
										value={productEditor.codEligible ? 'yes' : 'no'}
										onchange={(event) =>
											(productEditor.codEligible =
												(event.currentTarget as HTMLSelectElement).value === 'yes')}
									>
										<option value="yes">Eligible</option>
										<option value="no">Prepaid only</option>
									</select>
								</label>
							</div>
						</section>

						<section class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4">
							<p class="text-label-medium text-foreground">Media and references</p>
							<div class="mt-4 grid gap-4">
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Primary image URL</span
									>
									<input bind:value={productEditor.image} class="input-field" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Gallery image URLs</span
									>
									<textarea bind:value={productEditor.imagesText} class="input-field min-h-28 py-3"
									></textarea>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Source URL</span
									>
									<input bind:value={productEditor.sourceUrl} class="input-field" />
								</label>
							</div>
						</section>

						<section class="rounded-[16px] border border-[var(--border-faint)] bg-white p-4">
							<p class="text-label-medium text-foreground">Shipping and merchandising</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Warranty</span
									>
									<input bind:value={productEditor.warranty} class="input-field" />
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Weight (kg)</span
									>
									<input
										bind:value={productEditor.weightKg}
										class="input-field"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Length (cm)</span
									>
									<input
										bind:value={productEditor.lengthCm}
										class="input-field"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Breadth (cm)</span
									>
									<input
										bind:value={productEditor.breadthCm}
										class="input-field"
										inputmode="decimal"
									/>
								</label>
								<label>
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Height (cm)</span
									>
									<input
										bind:value={productEditor.heightCm}
										class="input-field"
										inputmode="decimal"
									/>
								</label>
								<label class="sm:col-span-2 xl:col-span-4">
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Highlights</span
									>
									<textarea
										bind:value={productEditor.highlightsText}
										class="input-field min-h-32 py-3"
									></textarea>
								</label>
								<label class="sm:col-span-2 xl:col-span-4">
									<span
										class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
										>Search keywords</span
									>
									<textarea
										bind:value={productEditor.searchKeywordsText}
										class="input-field min-h-28 py-3"
									></textarea>
								</label>
							</div>
						</section>
					</div>

					<div
						class="sticky bottom-0 -mx-6 mt-6 flex flex-wrap gap-3 border-t border-[var(--border-faint)] bg-white/95 px-6 py-4 backdrop-blur"
					>
						<button
							type="button"
							class="button button-primary text-label-medium inline-flex h-11 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
							disabled={productSaving}
							onclick={saveProduct}
						>
							{productSaving
								? 'Saving...'
								: selectedProductId === 'new'
									? 'Create product'
									: 'Save product'}
						</button>

						{#if productEditor.id}
							<button
								type="button"
								class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-red-500/20 bg-red-50 px-4 text-red-700 transition-colors hover:border-red-500/40 disabled:opacity-60"
								disabled={productDeleting}
								onclick={deleteProduct}
							>
								{productDeleting ? 'Removing...' : 'Delete or archive'}
							</button>
						{/if}
					</div>
				</div>
			</div>
		{:else if view === 'users'}
			<div class="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5">
					<input
						bind:value={userSearch}
						class="input-field"
						placeholder="Search name, email, or phone"
					/>

					<div class="mt-5 overflow-x-auto">
						<table class="w-full min-w-[760px] border-collapse text-left">
							<thead>
								<tr
									class="text-mono-x-small border-b border-[var(--border-faint)] tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									<th class="px-3 py-3 font-normal">User</th>
									<th class="px-3 py-3 font-normal">Role</th>
									<th class="px-3 py-3 font-normal">Orders</th>
									<th class="px-3 py-3 font-normal">Value</th>
								</tr>
							</thead>
							<tbody>
								{#each filteredUsers as user (user.id)}
									<tr
										class={`cursor-pointer border-b border-[var(--border-faint)] align-top transition-colors hover:bg-[var(--heat-4)] ${
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
												class={`text-mono-x-small rounded-full px-3 py-1 tracking-[0.16em] uppercase ${
													user.role === 'admin'
														? 'border border-amber-200 bg-amber-50 text-amber-700'
														: 'border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-56)]'
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
							</tbody>
						</table>
					</div>

					{#if usersError}
						<div
							class="text-body-small mt-4 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
						>
							{usersError}
						</div>
					{:else if !filteredUsers.length}
						<div
							class="text-body-small mt-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
						>
							No users match the current search.
						</div>
					{/if}
				</div>

				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<p class="text-label-large text-foreground">Edit account</p>

					{#if userNotice}
						<div
							class={`text-body-small mt-5 rounded-[16px] border px-4 py-3 ${noticeClasses(userNotice.tone)}`}
						>
							{userNotice.text}
						</div>
					{/if}

					{#if selectedUser}
						<div class="mt-5 grid gap-4 sm:grid-cols-2">
							<label>
								<span
									class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>Role</span
								>
								<select
									bind:value={userEditor.role}
									class="input-field"
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
								<span
									class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>Full name</span
								>
								<input bind:value={userEditor.fullName} class="input-field" />
							</label>
							<label class="sm:col-span-2">
								<span
									class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
									>Phone</span
								>
								<input
									bind:value={userEditor.phone}
									class="input-field disabled:cursor-not-allowed disabled:bg-[var(--background-lighter)] disabled:text-[var(--black-alpha-48)]"
									disabled={selectedUserPhoneLocked}
								/>
								{#if selectedUserPhoneLocked}
									<span class="text-body-small mt-2 block text-[var(--black-alpha-56)]">
										Phone is locked because this account has order history.
									</span>
								{/if}
							</label>
						</div>

						<div class="mt-5 grid gap-3 sm:grid-cols-2">
							<div
								class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Email
								</p>
								<p class="text-label-small mt-2 text-foreground">
									{selectedUser.email || 'No email'}
								</p>
							</div>
							<div
								class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
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
							<div
								class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Orders
								</p>
								<p class="text-label-small mt-2 text-foreground">{selectedUser.orderCount}</p>
							</div>
							<div
								class="rounded-[14px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
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

						<div class="mt-5">
							<button
								type="button"
								class="button button-primary text-label-medium inline-flex h-11 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
								disabled={userSaving}
								onclick={saveUser}
							>
								{userSaving ? 'Saving...' : 'Save account'}
							</button>
						</div>
					{:else}
						<div
							class="text-body-small mt-5 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
						>
							Select a user to edit it.
						</div>
					{/if}
				</div>
			</div>
		{:else if view === 'promos'}
			<div class="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-5">
					<div class="flex items-center justify-between gap-3">
						<div>
							<p class="text-label-large text-foreground">Promotions</p>
							<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
								Manage coupon codes, limits, and redemption windows.
							</p>
						</div>
						<button
							type="button"
							class="button button-primary text-label-medium inline-flex h-11 items-center justify-center rounded-md px-4 text-white"
							onclick={beginCreateCoupon}
						>
							New coupon
						</button>
					</div>

					<div
						class="mt-5 overflow-hidden rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)]"
					>
						<div
							class="text-mono-x-small grid grid-cols-[1fr_auto_auto] border-b border-[var(--border-faint)] px-4 py-3 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
						>
							<span>Code</span>
							<span>Used</span>
							<span>Status</span>
						</div>

						{#each coupons as coupon (coupon.id)}
							<button
								type="button"
								class={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[var(--border-faint)] px-4 py-3 text-left transition-colors last:border-b-0 ${
									selectedCouponId === coupon.id
										? 'bg-[var(--heat-4)] text-[var(--heat-100)]'
										: 'bg-white text-foreground hover:bg-[var(--background-lighter)]'
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
									class={`text-mono-x-small rounded-full px-2 py-1 tracking-[0.16em] uppercase ${
										coupon.active
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-[var(--black-alpha-8)] text-[var(--black-alpha-48)]'
									}`}
								>
									{coupon.active ? 'Active' : 'Off'}
								</span>
							</button>
						{/each}
					</div>

					{#if couponsError}
						<div
							class="text-body-small mt-4 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
						>
							{couponsError}
						</div>
					{:else if !coupons.length}
						<div
							class="text-body-small mt-4 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
						>
							No coupons have been created yet.
						</div>
					{/if}
				</div>

				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
								{couponEditor.id ? 'Edit coupon' : 'Create coupon'}
							</p>
							<h3 class="text-title-h5 mt-1 text-foreground">
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
							class={`text-body-small mt-5 rounded-[16px] border px-4 py-3 ${noticeClasses(couponNotice.tone)}`}
						>
							{couponNotice.text}
						</div>
					{/if}

					<div class="mt-5 grid gap-4 md:grid-cols-2">
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Code</span
							>
							<input
								bind:value={couponEditor.code}
								class="input-field uppercase"
								oninput={() => (couponEditor.code = couponEditor.code.toUpperCase())}
							/>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Discount type</span
							>
							<select bind:value={couponEditor.discountType} class="input-field">
								<option value="percent">Percent</option>
								<option value="fixed">Fixed amount</option>
							</select>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>
								{couponEditor.discountType === 'percent' ? 'Discount percent' : 'Discount amount'}
							</span>
							<input
								bind:value={couponEditor.discountValue}
								class="input-field"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Minimum subtotal</span
							>
							<input
								bind:value={couponEditor.minimumSubtotal}
								class="input-field"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Max discount</span
							>
							<input
								bind:value={couponEditor.maxDiscount}
								class="input-field"
								inputmode="decimal"
							/>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Total usage limit</span
							>
							<input bind:value={couponEditor.usageLimit} class="input-field" inputmode="numeric" />
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Per user limit</span
							>
							<input
								bind:value={couponEditor.perUserLimit}
								class="input-field"
								inputmode="numeric"
							/>
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Status</span
							>
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
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Starts at</span
							>
							<input bind:value={couponEditor.startsAt} class="input-field" type="datetime-local" />
						</label>
						<label>
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>Ends at</span
							>
							<input bind:value={couponEditor.endsAt} class="input-field" type="datetime-local" />
						</label>
					</div>

					<label class="mt-4 block">
						<span
							class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>Description</span
						>
						<textarea bind:value={couponEditor.description} class="input-field min-h-28 py-3"
						></textarea>
					</label>

					<div class="mt-5 flex flex-wrap gap-2">
						<button
							type="button"
							class="button button-primary text-label-medium inline-flex h-11 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
							disabled={couponSaving}
							onclick={saveCoupon}
						>
							{couponSaving ? 'Saving...' : 'Save coupon'}
						</button>

						{#if couponEditor.id}
							<button
								type="button"
								class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-red-500/20 bg-red-50 px-4 text-red-700 transition-colors hover:border-red-500/40 disabled:opacity-60"
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
