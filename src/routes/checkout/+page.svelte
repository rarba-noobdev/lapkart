<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		AlertTriangle,
		ArrowLeft,
		CheckCircle2,
		Clock3,
		CreditCard,
		LoaderCircle,
		MapPin,
		Navigation,
		Package,
		ReceiptText,
		ShieldCheck,
		Tag,
		Truck,
		Wallet
	} from '@lucide/svelte';
	import { getAuthContext } from '$lib/auth-context';
	import { apiBase } from '$lib/api-base';
	import { cartState, clearCart, type CartItem } from '$lib/cart';
	import { formatINR, type Product } from '$lib/catalog';
	import { listProductsByIds } from '$lib/products';
	import { getAccessToken, getAuthorizationHeaders } from '$lib/supabase-auth';
	import type { Tables } from '$lib/supabase/types';
	import DeliveryMapPicker, {
		type DeliveryPin,
		type ResolvedDeliveryAddress
	} from '$lib/components/DeliveryMapPicker.svelte';

	type MessageTone = 'error' | 'success' | 'info';

	type MessageState = {
		tone: MessageTone;
		text: string;
	};

	type CourierQuote = {
		quoteId: string;
		courierCompanyId: number | null;
		courierName: string;
		rate: number;
		rating: number;
		etd: string;
		expectedDeliveryDate: string | null;
		estimatedDeliveryDays: number;
		etdHours: number;
		mode: string;
		recommended: boolean;
		serviceType: 'standard' | 'quick';
	};

	type DeliveryEstimate = {
		dispatch: {
			pickupLocation: string;
			pincode: string;
		};
		route: {
			distanceMeters: number;
			durationSeconds: number;
			readableDistance: string;
			readableDuration: string;
		};
		couriers: CourierQuote[];
		generatedAt: string;
	};

	type CheckoutSummary = {
		subtotal: number;
		shipping: number;
		discountTotal: number;
		total: number;
		amountPaise: number;
		coupon: {
			id: string;
			code: string;
			description: string | null;
			discountAmount: number;
		} | null;
		deliveryEstimate: DeliveryEstimate;
		selectedCourier: CourierQuote;
		cod: {
			eligible: boolean;
			reason: string | null;
			cap: number;
		};
		deliveryPromise: {
			label: string;
			detail: string;
			serviceType: 'standard' | 'quick';
		};
	};

	type BackendCheckoutOrderResponse = {
		razorpayOrder: {
			order_id: string;
			amount: number;
			currency: string;
		};
		summary: CheckoutSummary;
		error?: string;
	};

	type BackendCheckoutPreviewResponse = {
		summary?: CheckoutSummary;
		error?: string;
	};

	type BackendCheckoutCompleteResponse = {
		verified?: boolean;
		orderId?: string;
		error?: string;
	};

	type BackendCodOrderResponse = {
		orderId?: string;
		codReference?: string;
		summary?: CheckoutSummary;
		error?: string;
	};

	const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID ?? '';

	const indianStates = [
		'Andhra Pradesh',
		'Delhi',
		'Gujarat',
		'Karnataka',
		'Maharashtra',
		'Rajasthan',
		'Tamil Nadu',
		'Telangana',
		'Uttar Pradesh',
		'West Bengal'
	];
	const checkoutSkeletons = [1, 2, 3];
	const auth = getAuthContext();

	let products = $state<Product[]>([]);
	let productsLoading = $state(true);
	let productsError = $state<string | null>(null);
	let busy = $state(false);
	let couponBusy = $state(false);
	let estimateLoading = $state(false);
	let estimateError = $state<string | null>(null);
	let message = $state<MessageState | null>(null);
	let orderId = $state<string | null>(null);
	let deliveryEstimate = $state<DeliveryEstimate | null>(null);
	let selectedQuoteId = $state<string | null>(null);
	let paymentMode = $state<'razorpay' | 'cod'>('razorpay');
	let couponCode = $state('');
	let appliedSummary = $state<CheckoutSummary | null>(null);
	let saveAddress = $state(true);
	let address = $state({
		fullName: '',
		phone: '',
		email: '',
		line1: '',
		line2: '',
		city: '',
		state: 'Tamil Nadu',
		pincode: '',
		latitude: null as number | null,
		longitude: null as number | null,
		locationSource: null as DeliveryPin['source'] | null,
		olaPlaceId: null as string | null,
		formattedAddress: ''
	});

	const itemIds = $derived([...new Set($cartState.items.map((item) => item.id))]);

	const rows = $derived.by(() => {
		const productMap = new Map(products.map((product) => [product.id, product]));
		return $cartState.items
			.map((item) => ({ item, product: productMap.get(item.id) }))
			.filter((row): row is { item: CartItem; product: Product } => Boolean(row.product));
	});

	const subtotal = $derived(rows.reduce((sum, row) => sum + row.product.price * row.item.qty, 0));

	const selectedCourier = $derived(
		deliveryEstimate?.couriers.find((courier) => courier.quoteId === selectedQuoteId) ?? null
	);

	const shipping = $derived(
		subtotal === 0
			? 0
			: selectedCourier
				? subtotal > 999
					? 0
					: selectedCourier.rate
				: subtotal > 999
					? 0
					: 49
	);

	const discountTotal = $derived(appliedSummary?.discountTotal ?? 0);
	const payableTotal = $derived(appliedSummary?.total ?? subtotal + shipping);
	const hasDeliveryPin = $derived(address.latitude !== null && address.longitude !== null);
	const hasValidAddress = $derived(
		address.fullName.trim().length > 1 &&
			address.line1.trim().length > 5 &&
			address.city.trim().length > 1 &&
			address.state.trim().length > 1 &&
			/^[0-9]{6}$/.test(address.pincode.trim()) &&
			address.phone.replace(/\D/g, '').length >= 10
	);
	const deliveryPin = $derived(
		hasDeliveryPin && address.locationSource
			? {
					latitude: address.latitude as number,
					longitude: address.longitude as number,
					source: address.locationSource
				}
			: null
	);

	const localCodAllowed = $derived(
		isLocalCodAddress(address.city, address.state, address.pincode) &&
			payableTotal <= 4000 &&
			rows.every((row) => row.product.cod_eligible !== false)
	);

	const codEligibility = $derived(
		appliedSummary?.cod ?? {
			eligible: localCodAllowed,
			reason: localCodAllowed
				? null
				: 'COD is available only for Chennai-area orders up to INR 4,000 on eligible products.',
			cap: 4000
		}
	);
	const currentUser = $derived(page.data.user ?? auth.user ?? null);
	const supabase = $derived(auth.supabase);
	const summaryResetKey = $derived(
		[
			address.latitude,
			address.longitude,
			address.pincode,
			selectedQuoteId,
			subtotal,
			couponCode,
			rows.length
		].join('|')
	);
	let loadedProductIdsKey = '';
	let savedAddressLoadedForUserId: string | null = null;
	let lastSummaryResetKey = '';
	let lastEstimateKey = '';
	let estimateController: AbortController | null = null;
	let estimateTimer: number | null = null;

	function setMessage(tone: MessageTone, text: string) {
		message = { tone, text };
	}

	async function loadCartProducts(ids: string[]) {
		if (ids.length === 0) {
			products = [];
			productsLoading = false;
			productsError = null;
			return;
		}

		productsLoading = true;
		productsError = null;

		try {
			products = await listProductsByIds(ids);
		} catch (loadError) {
			productsError =
				loadError instanceof Error ? loadError.message : 'Could not load cart products';
		} finally {
			productsLoading = false;
		}
	}

	async function loadSavedAddressForUser(userId: string) {
		const { data, error } = await supabase
			.from('addresses')
			.select('*')
			.eq('user_id', userId)
			.order('is_default', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error || !data || savedAddressLoadedForUserId !== userId) return;
		applySavedAddress(data as Tables<'addresses'>);
	}

	function clearEstimateRequest() {
		if (estimateTimer) {
			window.clearTimeout(estimateTimer);
			estimateTimer = null;
		}

		if (estimateController) {
			estimateController.abort();
			estimateController = null;
		}
	}

	function queueDeliveryEstimate() {
		const latitude = address.latitude;
		const longitude = address.longitude;
		const pincode = address.pincode.trim();
		const declaredValue = subtotal;
		const rowCount = rows.length;
		const nextEstimateKey = [latitude, longitude, pincode, declaredValue, rowCount].join('|');

		if (nextEstimateKey === lastEstimateKey) return;
		lastEstimateKey = nextEstimateKey;
		clearEstimateRequest();

		if (latitude === null || longitude === null || !/^[0-9]{6}$/.test(pincode) || rowCount === 0) {
			deliveryEstimate = null;
			selectedQuoteId = null;
			estimateError = null;
			estimateLoading = false;
			return;
		}

		const controller = new AbortController();
		estimateController = controller;
		estimateTimer = window.setTimeout(async () => {
			try {
				estimateLoading = true;
				estimateError = null;

				const url = new URL(`${apiBase}/maps/delivery-estimate`);
				url.searchParams.set('latitude', String(latitude));
				url.searchParams.set('longitude', String(longitude));
				url.searchParams.set('pincode', pincode);
				url.searchParams.set('declaredValue', String(declaredValue));

				const response = await fetch(url, {
					signal: controller.signal,
					headers: await getAuthorizationHeaders()
				});
				const data = (await response.json().catch(() => null)) as
					| (DeliveryEstimate & { error?: string })
					| null;

				if (!response.ok || !data) {
					throw new Error(data?.error ?? 'Could not calculate delivery estimate');
				}

				deliveryEstimate = data;
				selectedQuoteId =
					data.couriers.find((courier) => courier.quoteId === selectedQuoteId)?.quoteId ??
					data.couriers.find((courier) => courier.recommended)?.quoteId ??
					data.couriers[0]?.quoteId ??
					null;

				if (data.couriers.length === 0) {
					estimateError =
						'No standard or Shiprocket Quick courier currently services this location.';
				}
			} catch (loadError) {
				if (controller.signal.aborted) return;
				deliveryEstimate = null;
				selectedQuoteId = null;
				estimateError =
					loadError instanceof Error ? loadError.message : 'Could not calculate delivery estimate';
			} finally {
				if (!controller.signal.aborted) estimateLoading = false;
			}
		}, 350);
	}

	function syncCheckoutState() {
		if ($cartState.hydrated) {
			const productIdsKey = itemIds.join('|');
			if (productIdsKey !== loadedProductIdsKey) {
				loadedProductIdsKey = productIdsKey;
				void loadCartProducts(itemIds);
			}
		}

		const user = currentUser;
		if (!user) {
			savedAddressLoadedForUserId = null;
		} else {
			address.fullName ||= user.user_metadata?.full_name ?? '';
			address.email ||= user.email ?? '';

			if (savedAddressLoadedForUserId !== user.id) {
				savedAddressLoadedForUserId = user.id;
				void loadSavedAddressForUser(user.id);
			}
		}

		if (lastSummaryResetKey && summaryResetKey !== lastSummaryResetKey) {
			appliedSummary = null;
			message = null;
		}
		lastSummaryResetKey = summaryResetKey;

		if (paymentMode === 'cod' && !codEligibility.eligible) {
			paymentMode = 'razorpay';
		}

		queueDeliveryEstimate();
	}

	function applyResolvedAddress(resolved: ResolvedDeliveryAddress) {
		address.line1 = resolved.line1 || address.line1;
		address.line2 = resolved.line2 || '';
		address.city = resolved.city || address.city;
		address.state = resolved.state || address.state;
		address.pincode = resolved.pincode || address.pincode;
		address.formattedAddress = resolved.formattedAddress || address.formattedAddress;
		address.olaPlaceId = resolved.placeId;
		address.latitude = resolved.latitude ?? address.latitude;
		address.longitude = resolved.longitude ?? address.longitude;
	}

	function applySavedAddress(savedAddress: Tables<'addresses'>) {
		address.fullName ||= savedAddress.full_name;
		address.phone ||= savedAddress.phone;
		address.line1 ||= savedAddress.line1;
		address.line2 ||= savedAddress.line2 ?? '';
		address.city ||= savedAddress.city;
		address.state ||= savedAddress.state;
		address.pincode ||= savedAddress.pincode;
		address.latitude ??= savedAddress.latitude;
		address.longitude ??= savedAddress.longitude;
		address.locationSource ??=
			(savedAddress.location_source as DeliveryPin['source'] | null) ?? null;
		address.olaPlaceId ??= savedAddress.ola_place_id;
		address.formattedAddress ||= savedAddress.formatted_address ?? '';
	}

	onMount(() => {
		syncCheckoutState();
		const interval = window.setInterval(syncCheckoutState, 250);

		return () => {
			window.clearInterval(interval);
			clearEstimateRequest();
		};
	});

	async function applyCoupon() {
		const code = couponCode.trim().toUpperCase();
		if (!code) {
			appliedSummary = null;
			message = null;
			return;
		}

		if (!hasValidAddress || !hasDeliveryPin || !selectedCourier) {
			setMessage('error', 'Confirm the delivery address and courier before applying a coupon.');
			return;
		}

		couponBusy = true;
		message = null;

		try {
			const response = await fetch(`${apiBase}/checkout/preview`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(await getAuthorizationHeaders())
				},
				body: JSON.stringify({
					items: rows.map(({ item, product }) => ({ id: product.id, qty: item.qty })),
					address,
					selectedQuoteId,
					saveAddress,
					couponCode: code
				})
			});

			const body = (await response
				.json()
				.catch(() => null)) as BackendCheckoutPreviewResponse | null;
			if (!response.ok || !body?.summary) {
				throw new Error(body?.error ?? 'Coupon could not be applied');
			}

			couponCode = code;
			deliveryEstimate = body.summary.deliveryEstimate;
			selectedQuoteId = body.summary.selectedCourier.quoteId;
			appliedSummary = body.summary;
			setMessage(
				'success',
				`${body.summary.coupon?.code ?? code} applied. You saved ${formatINR(body.summary.discountTotal)}.`
			);
		} catch (applyError) {
			appliedSummary = null;
			setMessage(
				'error',
				applyError instanceof Error ? applyError.message : 'Coupon could not be applied'
			);
		} finally {
			couponBusy = false;
		}
	}

	async function pay() {
		message = null;

		if (!currentUser) {
			setMessage('error', 'Sign in before checkout.');
			return;
		}

		const accessToken = await getAccessToken();
		if (!accessToken) {
			setMessage('error', 'Sign in again before checkout.');
			return;
		}

		if (rows.length === 0) {
			setMessage('error', 'Add at least one item to your cart.');
			return;
		}

		if (!hasValidAddress) {
			setMessage('error', 'Complete the delivery address before payment.');
			return;
		}

		if (!hasDeliveryPin) {
			setMessage('error', 'Attach a delivery pin before payment.');
			return;
		}

		if (!deliveryEstimate || !selectedCourier) {
			setMessage('error', 'Select an available delivery option before payment.');
			return;
		}

		if (paymentMode === 'cod') {
			if (!codEligibility.eligible) {
				setMessage('error', codEligibility.reason ?? 'COD is not available for this order.');
				return;
			}

			busy = true;

			try {
				const response = await fetch(`${apiBase}/checkout/create-cod-order`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(await getAuthorizationHeaders())
					},
					body: JSON.stringify({
						items: rows.map(({ item, product }) => ({ id: product.id, qty: item.qty })),
						address,
						selectedQuoteId,
						saveAddress,
						couponCode: couponCode.trim().toUpperCase()
					})
				});

				const body = (await response.json().catch(() => null)) as BackendCodOrderResponse | null;
				if (!response.ok || !body?.orderId) {
					throw new Error(body?.error ?? 'Could not place COD order');
				}

				if (body.summary) {
					deliveryEstimate = body.summary.deliveryEstimate;
					selectedQuoteId = body.summary.selectedCourier.quoteId;
					appliedSummary = body.summary;
				}

				orderId = body.orderId;
				clearCart();
				setMessage('success', 'COD order placed. Redirecting to your order.');
				await goto(resolve(`/order/${body.orderId}`));
			} catch (placeError) {
				setMessage(
					'error',
					placeError instanceof Error ? placeError.message : 'Could not place COD order'
				);
			} finally {
				busy = false;
			}

			return;
		}

		if (!razorpayKey) {
			setMessage('error', 'Razorpay key is missing. Restart the frontend after updating .env.');
			return;
		}

		busy = true;

		try {
			await loadRazorpay();

			const orderResponse = await fetch(`${apiBase}/checkout/create-payment-order`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(await getAuthorizationHeaders())
				},
				body: JSON.stringify({
					items: rows.map(({ item, product }) => ({ id: product.id, qty: item.qty })),
					address,
					selectedQuoteId,
					saveAddress,
					couponCode: couponCode.trim().toUpperCase()
				})
			});

			const body = (await orderResponse
				.json()
				.catch(() => null)) as BackendCheckoutOrderResponse | null;

			if (!orderResponse.ok || !body?.razorpayOrder.order_id) {
				throw new Error(body?.error ?? 'Could not create a Razorpay order');
			}

			deliveryEstimate = body.summary.deliveryEstimate;
			selectedQuoteId = body.summary.selectedCourier.quoteId;
			appliedSummary = body.summary;

			const checkout = new window.Razorpay!({
				key: razorpayKey,
				amount: body.razorpayOrder.amount,
				currency: body.razorpayOrder.currency,
				name: 'LapKart',
				description:
					rows.length > 0 ? `${rows.length} laptop marketplace item(s)` : 'LapKart payment',
				order_id: body.razorpayOrder.order_id,
				prefill: {
					name: address.fullName.trim(),
					email: address.email.trim() || currentUser.email || '',
					contact: address.phone.replace(/\D/g, '').slice(-10)
				},
				theme: { color: '#fa5d19' },
				modal: {
					ondismiss: () => {
						busy = false;
						setMessage('info', 'Payment cancelled.');
					}
				},
				handler: async (paymentResponse: {
					razorpay_order_id: string;
					razorpay_payment_id: string;
					razorpay_signature: string;
				}) => {
					try {
						const completeResponse = await fetch(`${apiBase}/checkout/complete-payment`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								...(await getAuthorizationHeaders())
							},
							body: JSON.stringify({
								razorpay_order_id: paymentResponse.razorpay_order_id,
								razorpay_payment_id: paymentResponse.razorpay_payment_id,
								razorpay_signature: paymentResponse.razorpay_signature
							})
						});

						const completed = (await completeResponse
							.json()
							.catch(() => null)) as BackendCheckoutCompleteResponse | null;

						if (!completeResponse.ok || !completed?.verified || !completed.orderId) {
							throw new Error(completed?.error ?? 'Could not complete the paid order');
						}

						orderId = completed.orderId;
						clearCart();
						setMessage('success', 'Payment verified. Redirecting to your order.');
						await goto(resolve(`/order/${completed.orderId}`));
					} catch (completeError) {
						setMessage(
							'error',
							completeError instanceof Error
								? completeError.message
								: 'Could not complete the paid order'
						);
					} finally {
						busy = false;
					}
				}
			});

			checkout.on?.(
				'payment.failed',
				(failure: { error?: { description?: string; reason?: string } }) => {
					busy = false;
					setMessage(
						'error',
						failure.error?.description ?? failure.error?.reason ?? 'Payment failed in Razorpay.'
					);
				}
			);

			checkout.open();
		} catch (paymentError) {
			busy = false;
			setMessage(
				'error',
				paymentError instanceof Error ? paymentError.message : 'Could not start payment'
			);
		}
	}

	function removeAppliedCoupon() {
		couponCode = '';
		appliedSummary = null;
		message = null;
	}

	function isLocalCodAddress(city: string, state: string, pincode: string) {
		const normalizedCity = city.trim().toLowerCase();
		const normalizedState = state.trim().toLowerCase();
		const normalizedPincode = pincode.trim();

		return (
			normalizedPincode.startsWith('600') ||
			(normalizedCity.includes('chennai') && normalizedState.includes('tamil'))
		);
	}

	function loadRazorpay() {
		if (window.Razorpay) return Promise.resolve();

		return new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = 'https://checkout.razorpay.com/v1/checkout.js';
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('Could not load Razorpay Checkout'));
			document.body.appendChild(script);
		});
	}
</script>

<svelte:head>
	<title>Checkout - lapkart</title>
</svelte:head>

<section class="motion-page mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
	<header
		class="relative mb-6 overflow-hidden rounded-[24px] border border-[var(--border-faint)] bg-white shadow-card"
	>
		<div class="grain absolute inset-0 opacity-20"></div>
		<div
			class="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-[var(--heat-12)] blur-3xl"
		></div>
		<div class="relative grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-6 lg:p-8">
			<div>
				<a
					href={resolve('/cart')}
					class="motion-soft-link text-label-small mb-5 inline-flex items-center gap-2 text-[var(--black-alpha-56)] hover:text-[var(--heat-100)]"
				>
					<ArrowLeft class="size-4" strokeWidth={2} />
					Back to cart
				</a>
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					Secure checkout
				</p>
				<h1 class="text-title-h3 mt-2 max-w-[760px] font-display text-balance text-foreground">
					Delivery, courier, and payment
				</h1>
				<p class="text-body-medium mt-3 max-w-[640px] text-[var(--black-alpha-56)]">
					Confirm the address, pick a live courier quote, then place the order through Razorpay or
					eligible cash on delivery.
				</p>
			</div>

			<div
				class="grid min-w-[280px] gap-2 rounded-[18px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 sm:grid-cols-3 md:min-w-[360px]"
				aria-label="Checkout progress"
			>
				<div class="rounded-[14px] bg-white p-3 shadow-card">
					<Package class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					<p
						class="text-mono-x-small mt-3 tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Cart
					</p>
					<p class="text-label-small text-foreground">
						{rows.length || $cartState.items.length} items
					</p>
				</div>
				<div class="rounded-[14px] bg-white p-3 shadow-card">
					<MapPin class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					<p
						class="text-mono-x-small mt-3 tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Delivery
					</p>
					<p class="text-label-small text-foreground">{hasDeliveryPin ? 'Pinned' : 'Needs pin'}</p>
				</div>
				<div class="rounded-[14px] bg-white p-3 shadow-card">
					<ShieldCheck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					<p
						class="text-mono-x-small mt-3 tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
					>
						Payment
					</p>
					<p class="text-label-small text-foreground">
						{paymentMode === 'cod' ? 'COD' : 'Razorpay'}
					</p>
				</div>
			</div>
		</div>
	</header>

	{#if !$cartState.hydrated || productsLoading}
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
			<div class="motion-list space-y-4">
				{#each checkoutSkeletons as skeleton (skeleton)}
					<div
						class="h-40 animate-pulse rounded-[22px] border border-[var(--border-faint)] bg-white"
					></div>
				{/each}
			</div>
			<div
				class="h-[420px] animate-pulse rounded-[22px] border border-[var(--border-faint)] bg-white"
			></div>
		</div>
	{:else if productsError}
		<div class="rounded-[18px] border border-red-200 bg-red-50 p-5 text-red-700">
			<div class="flex gap-3">
				<AlertTriangle class="mt-1 size-5 shrink-0" strokeWidth={2} />
				<p class="text-body-medium">{productsError}</p>
			</div>
		</div>
	{:else if rows.length === 0}
		<div
			class="rounded-[24px] border border-dashed border-[var(--border-muted)] bg-white p-8 text-center shadow-card"
		>
			<div
				class="mx-auto flex size-12 items-center justify-center rounded-[16px] bg-[var(--heat-8)] text-[var(--heat-100)]"
			>
				<Package class="size-6" strokeWidth={2} />
			</div>
			<p class="text-label-small mt-5 text-[var(--heat-100)]">Your cart is empty</p>
			<p class="text-body-large mt-2 text-foreground">Add parts to your cart before checkout.</p>
			<a
				href={resolve('/products')}
				class="button button-primary text-label-medium mt-6 inline-flex h-11 items-center justify-center rounded-md px-5 text-white"
			>
				Browse products
			</a>
		</div>
	{:else}
		<div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
			<div class="motion-list space-y-6">
				<article class="rounded-[22px] border border-[var(--border-faint)] bg-white shadow-card">
					<div
						class="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] p-5"
					>
						<div class="flex gap-3">
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-black)] text-[var(--heat-100)]"
							>
								<MapPin class="size-5" strokeWidth={2} />
							</div>
							<div>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Step 1
								</p>
								<h2 class="text-title-h5 text-foreground">Address and delivery pin</h2>
								<p class="text-body-small mt-1 max-w-[620px] text-[var(--black-alpha-56)]">
									Use a precise map pin so courier and COD rules are calculated from the real
									delivery location.
								</p>
							</div>
						</div>
						{#if hasValidAddress && hasDeliveryPin}
							<span
								class="text-mono-x-small inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 uppercase"
							>
								<CheckCircle2 class="size-3.5" strokeWidth={2} />
								Ready
							</span>
						{/if}
					</div>

					<div class="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
						<div class="grid content-start gap-4 md:grid-cols-2">
							<label>
								<span class="text-label-small mb-2 block text-foreground">Full name</span>
								<input bind:value={address.fullName} class="input-field" autocomplete="name" />
							</label>
							<label>
								<span class="text-label-small mb-2 block text-foreground">Phone</span>
								<input bind:value={address.phone} class="input-field" autocomplete="tel" />
							</label>
							<label class="md:col-span-2">
								<span class="text-label-small mb-2 block text-foreground">Email</span>
								<input bind:value={address.email} class="input-field" autocomplete="email" />
							</label>
							<label class="md:col-span-2">
								<span class="text-label-small mb-2 block text-foreground">Address line 1</span>
								<input
									bind:value={address.line1}
									class="input-field"
									autocomplete="address-line1"
								/>
							</label>
							<label class="md:col-span-2">
								<span class="text-label-small mb-2 block text-foreground">Address line 2</span>
								<input
									bind:value={address.line2}
									class="input-field"
									autocomplete="address-line2"
								/>
							</label>
							<label>
								<span class="text-label-small mb-2 block text-foreground">City</span>
								<input
									bind:value={address.city}
									class="input-field"
									autocomplete="address-level2"
								/>
							</label>
							<label>
								<span class="text-label-small mb-2 block text-foreground">Pincode</span>
								<input
									bind:value={address.pincode}
									class="input-field"
									autocomplete="postal-code"
									inputmode="numeric"
								/>
							</label>
							<label class="md:col-span-2">
								<span class="text-label-small mb-2 block text-foreground">State</span>
								<select bind:value={address.state} class="input-field">
									{#each indianStates as state (state)}
										<option value={state}>{state}</option>
									{/each}
								</select>
							</label>
						</div>

						<div
							class="rounded-[18px] border border-[var(--border-faint)] bg-[var(--background-base)] p-3"
						>
							<DeliveryMapPicker
								value={deliveryPin}
								onChange={(pin) => {
									address.latitude = pin.latitude;
									address.longitude = pin.longitude;
									address.locationSource = pin.source;
								}}
								onAddressResolved={applyResolvedAddress}
							/>
						</div>
					</div>

					<div class="border-t border-[var(--border-faint)] p-5">
						<label
							class="text-body-small flex items-start gap-3 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-72)]"
						>
							<input bind:checked={saveAddress} type="checkbox" class="mt-1 h-4 w-4 shrink-0" />
							<span>Save this delivery address to your account for faster future checkouts.</span>
						</label>
					</div>
				</article>

				<article
					class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card"
				>
					<div class="flex gap-3">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-black)] text-[var(--heat-100)]"
						>
							<Truck class="size-5" strokeWidth={2} />
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Step 2
							</p>
							<h2 class="text-title-h5 text-foreground">Courier options</h2>
							<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
								Live quotes update after address, pin, and cart changes.
							</p>
						</div>
					</div>

					{#if estimateLoading}
						<div
							class="text-body-small mt-5 flex items-center gap-3 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-64)]"
						>
							<LoaderCircle class="size-4 animate-spin text-[var(--heat-100)]" strokeWidth={2} />
							Checking route distance and delivery quotes...
						</div>
					{:else if estimateError}
						<div
							class="text-body-small mt-5 flex items-start gap-3 rounded-[16px] border border-red-200 bg-red-50 px-4 py-4 text-red-700"
						>
							<AlertTriangle class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
							<span>{estimateError}</span>
						</div>
					{:else if !deliveryEstimate}
						<div
							class="text-body-small mt-5 flex items-start gap-3 rounded-[16px] border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-64)]"
						>
							<Navigation class="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" strokeWidth={2} />
							<span>Add a valid pincode and delivery pin to load courier options.</span>
						</div>
					{:else}
						<div class="mt-5 grid gap-4 md:grid-cols-2">
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<div class="flex items-center gap-2 text-[var(--black-alpha-48)]">
									<Navigation class="size-4" strokeWidth={2} />
									<p class="text-mono-x-small tracking-[0.16em] uppercase">Road distance</p>
								</div>
								<p class="text-title-h5 mt-2 text-foreground">
									{deliveryEstimate.route.readableDistance ||
										`${(deliveryEstimate.route.distanceMeters / 1000).toFixed(1)} km`}
								</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<div class="flex items-center gap-2 text-[var(--black-alpha-48)]">
									<Clock3 class="size-4" strokeWidth={2} />
									<p class="text-mono-x-small tracking-[0.16em] uppercase">Route time</p>
								</div>
								<p class="text-title-h5 mt-2 text-foreground">
									{deliveryEstimate.route.readableDuration ||
										`${Math.ceil(deliveryEstimate.route.durationSeconds / 60)} min`}
								</p>
							</div>
						</div>

						<div class="mt-5 grid gap-3">
							{#each deliveryEstimate.couriers as courier (courier.quoteId)}
								<button
									type="button"
									aria-pressed={selectedQuoteId === courier.quoteId}
									class={`motion-card rounded-[18px] border p-4 text-left ${
										selectedQuoteId === courier.quoteId
											? 'border-[var(--heat-100)] bg-[var(--heat-4)] shadow-card'
											: 'border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)]'
									}`}
									onclick={() => (selectedQuoteId = courier.quoteId)}
								>
									<div class="flex flex-wrap items-start justify-between gap-4">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<p class="text-label-large text-foreground">{courier.courierName}</p>
												{#if courier.recommended}
													<span
														class="text-mono-x-small rounded-full border border-[var(--heat-20)] bg-[var(--heat-8)] px-2 py-1 text-[var(--heat-100)] uppercase"
													>
														Recommended
													</span>
												{/if}
												{#if courier.serviceType === 'quick'}
													<span
														class="text-mono-x-small rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 uppercase"
													>
														Quick
													</span>
												{/if}
											</div>
											<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
												{courier.mode} / Expected {courier.etd ||
													`${courier.estimatedDeliveryDays} day(s)`}
												{courier.rating ? ` / ${courier.rating} rating` : ''}
											</p>
										</div>
										<div class="text-left sm:text-right">
											<p class="text-label-large text-foreground">{formatINR(courier.rate)}</p>
											<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
												{courier.expectedDeliveryDate ?? 'Date on dispatch'}
											</p>
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</article>

				<article
					class="rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card"
				>
					<div class="flex gap-3">
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent-black)] text-[var(--heat-100)]"
						>
							<CreditCard class="size-5" strokeWidth={2} />
						</div>
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Step 3
							</p>
							<h2 class="text-title-h5 text-foreground">Payment method</h2>
							<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
								Payment status is verified server-side before an order is created.
							</p>
						</div>
					</div>

					<div class="mt-5 grid gap-3 md:grid-cols-2">
						<button
							type="button"
							aria-pressed={paymentMode === 'razorpay'}
							class={`motion-card rounded-[18px] border p-4 text-left ${
								paymentMode === 'razorpay'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)] shadow-card'
									: 'border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)]'
							}`}
							onclick={() => (paymentMode = 'razorpay')}
						>
							<CreditCard class="size-5 text-[var(--heat-100)]" strokeWidth={2} />
							<p class="text-label-large mt-3 text-foreground">Razorpay</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								Card, UPI, netbanking, and wallets through hosted checkout.
							</p>
						</button>

						<button
							type="button"
							aria-pressed={paymentMode === 'cod'}
							class={`motion-card rounded-[18px] border p-4 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
								paymentMode === 'cod'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)] shadow-card'
									: 'border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)]'
							}`}
							disabled={!codEligibility.eligible}
							onclick={() => (paymentMode = 'cod')}
						>
							<Wallet class="size-5 text-[var(--heat-100)]" strokeWidth={2} />
							<p class="text-label-large mt-3 text-foreground">Cash on delivery</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								{codEligibility.eligible
									? `Available up to ${formatINR(codEligibility.cap)} for eligible Chennai-area deliveries.`
									: (codEligibility.reason ?? 'COD is not available for this order.')}
							</p>
						</button>
					</div>

					{#if appliedSummary?.deliveryPromise}
						<div
							class="mt-5 flex items-start gap-3 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4"
						>
							<CheckCircle2 class="mt-0.5 size-4 shrink-0 text-emerald-700" strokeWidth={2} />
							<div>
								<p class="text-label-medium text-emerald-800">
									{appliedSummary.deliveryPromise.label}
								</p>
								<p class="text-body-small mt-1 text-emerald-700">
									{appliedSummary.deliveryPromise.detail}
								</p>
							</div>
						</div>
					{/if}

					{#if message}
						<div
							class={`text-body-small mt-5 flex items-start gap-3 rounded-[16px] border px-4 py-4 ${
								message.tone === 'error'
									? 'border-red-200 bg-red-50 text-red-700'
									: message.tone === 'success'
										? 'border-emerald-200 bg-emerald-50 text-emerald-700'
										: 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-72)]'
							}`}
						>
							{#if message.tone === 'error'}
								<AlertTriangle class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
							{:else}
								<CheckCircle2 class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
							{/if}
							<span>{message.text}</span>
						</div>
					{/if}
				</article>
			</div>

			<aside
				class="sticky top-24 h-fit rounded-[22px] border border-[var(--border-faint)] bg-white p-5 shadow-card"
			>
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
							Order summary
						</p>
						<h2 class="text-title-h5 mt-2 text-foreground">
							{rows.length} item{rows.length === 1 ? '' : 's'}
						</h2>
					</div>
					<div
						class="flex size-10 items-center justify-center rounded-[14px] bg-[var(--heat-8)] text-[var(--heat-100)]"
					>
						<ReceiptText class="size-5" strokeWidth={2} />
					</div>
				</div>

				<div class="motion-list mt-5 space-y-3">
					{#each rows as row (row.item.id)}
						<div
							class="flex gap-3 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
						>
							<div class="grid h-18 w-18 shrink-0 place-items-center rounded-[12px] bg-white p-2">
								<img
									src={row.product.images?.[0] ?? row.product.image}
									alt={row.product.title}
									class="max-h-full w-full object-contain"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-label-medium line-clamp-2 text-foreground">{row.product.title}</p>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{row.product.brand} / Qty {row.item.qty}
								</p>
								<p class="text-body-small mt-2 text-[var(--black-alpha-72)]">
									{formatINR(row.product.price * row.item.qty)}
								</p>
							</div>
						</div>
					{/each}
				</div>

				<div
					class="text-body-medium mt-5 space-y-3 border-t border-[var(--border-faint)] pt-5 text-[var(--black-alpha-64)]"
				>
					<div class="flex items-center justify-between">
						<span>Subtotal</span>
						<span class="text-foreground">{formatINR(subtotal)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span>Shipping</span>
						<span class="text-foreground">{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
					</div>
					{#if discountTotal > 0}
						<div class="flex items-center justify-between text-emerald-700">
							<span>{appliedSummary?.coupon?.code ?? 'Coupon'}</span>
							<span>-{formatINR(discountTotal)}</span>
						</div>
					{/if}
					<div
						class="text-label-large flex items-center justify-between border-t border-[var(--border-faint)] pt-3 text-foreground"
					>
						<span>Total</span>
						<span>{formatINR(payableTotal)}</span>
					</div>
				</div>

				<div
					class="mt-5 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
				>
					<div class="flex items-center gap-2">
						<Tag class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
						<p class="text-label-medium text-foreground">Coupon</p>
					</div>
					<div class="mt-3 flex gap-2">
						<input
							bind:value={couponCode}
							class="input-field min-w-0 flex-1 uppercase"
							maxlength="40"
							placeholder="SAVE10"
						/>
						<button
							type="button"
							class="motion-press text-label-medium inline-flex h-12 shrink-0 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={couponBusy || !couponCode.trim()}
							onclick={applyCoupon}
						>
							{couponBusy ? 'Applying' : 'Apply'}
						</button>
					</div>

					{#if appliedSummary?.coupon}
						<div class="text-body-small mt-3 flex items-center justify-between gap-3">
							<span class="text-emerald-700">
								{appliedSummary.coupon.code} saved {formatINR(discountTotal)}
							</span>
							<button
								type="button"
								class="motion-soft-link text-[var(--heat-100)]"
								onclick={removeAppliedCoupon}
							>
								Remove
							</button>
						</div>
					{/if}
				</div>

				{#if selectedCourier}
					<div class="mt-5 rounded-[16px] border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
						<div class="flex items-center gap-2">
							<Truck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
							<p class="text-label-medium text-foreground">{selectedCourier.courierName}</p>
						</div>
						<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
							{selectedCourier.serviceType === 'quick' ? 'Quick' : 'Standard'} / Expected {selectedCourier.etd ||
								`${selectedCourier.estimatedDeliveryDays} day(s)`}
						</p>
						<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
							{deliveryEstimate?.route.readableDistance || '-'} / {deliveryEstimate?.route
								.readableDuration || '-'}
						</p>
					</div>
				{/if}

				<button
					type="button"
					class="button button-primary text-label-medium mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md text-white disabled:cursor-not-allowed disabled:opacity-60"
					disabled={busy ||
						rows.length === 0 ||
						estimateLoading ||
						!selectedCourier ||
						Boolean(orderId)}
					onclick={pay}
				>
					{#if busy}
						<LoaderCircle class="size-4 animate-spin" strokeWidth={2} />
						Working
					{:else if orderId}
						<CheckCircle2 class="size-4" strokeWidth={2} />
						Order placed
					{:else if paymentMode === 'cod'}
						Place COD order for {formatINR(payableTotal)}
					{:else}
						Pay {formatINR(payableTotal)}
					{/if}
				</button>

				<a
					href={resolve('/orders')}
					class="motion-soft-link text-label-medium mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				>
					Review existing orders
				</a>
			</aside>
		</div>
	{/if}
</section>
