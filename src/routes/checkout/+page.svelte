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
		'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
		'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
		'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
		'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
		'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
		'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
		'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
		'Chandigarh', 'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Lakshadweep'
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
	let savedAddresses = $state<Tables<'addresses'>[]>([]);
	let selectedSavedAddressId = $state<string | null>(null);
	let showManualForm = $state(false);
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
			.order('created_at', { ascending: false });

		if (error || !data || savedAddressLoadedForUserId !== userId) return;
		savedAddresses = data as Tables<'addresses'>[];
		if (data.length > 0) {
			const defaultAddr = data[0] as Tables<'addresses'>;
			selectedSavedAddressId = defaultAddr.id;
			applySavedAddress(defaultAddr);
			showManualForm = false;
		} else {
			showManualForm = true;
		}
	}

	function selectSavedAddress(addr: Tables<'addresses'>) {
		selectedSavedAddressId = addr.id;
		showManualForm = false;
		address.fullName = addr.full_name;
		address.phone = addr.phone;
		address.line1 = addr.line1;
		address.line2 = addr.line2 ?? '';
		address.city = addr.city;
		address.state = addr.state;
		address.pincode = addr.pincode;
		address.latitude = addr.latitude;
		address.longitude = addr.longitude;
		address.locationSource = (addr.location_source as DeliveryPin['source'] | null) ?? null;
		address.olaPlaceId = addr.ola_place_id;
		address.formattedAddress = addr.formatted_address ?? '';
	}

	function useNewAddress() {
		selectedSavedAddressId = null;
		showManualForm = true;
		address.fullName = currentUser?.user_metadata?.full_name ?? '';
		address.phone = '';
		address.email = currentUser?.email ?? '';
		address.line1 = '';
		address.line2 = '';
		address.city = '';
		address.state = 'Tamil Nadu';
		address.pincode = '';
		address.latitude = null;
		address.longitude = null;
		address.locationSource = null;
		address.olaPlaceId = null;
		address.formattedAddress = '';
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
		const authHeaders = { Authorization: `Bearer ${accessToken}` };

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
						...authHeaders
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
					...authHeaders
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

<section class="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-8">
	<!-- Compact header -->
	<div class="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex items-center gap-3">
			<a
				href={resolve('/cart')}
				class="flex size-8 items-center justify-center rounded-md border border-[var(--border-faint)] bg-white text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)]"
			>
				<ArrowLeft class="size-4" strokeWidth={2} />
			</a>
			<div>
				<h1 class="text-[18px] font-medium tracking-tight text-foreground sm:text-[22px]">Checkout</h1>
				<p class="text-[11px] text-[var(--black-alpha-40)]">Address · Courier · Payment</p>
			</div>
		</div>
		<div class="flex items-center gap-2 text-[11px]">
			<span class="flex items-center gap-1 rounded-md bg-[var(--background-lighter)] px-2 py-1 text-[var(--black-alpha-48)]">
				<Package class="size-3" /> {rows.length || $cartState.items.length} items
			</span>
			<span class="flex items-center gap-1 rounded-md px-2 py-1 {hasDeliveryPin ? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]' : 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}">
				<MapPin class="size-3" /> {hasDeliveryPin ? 'Pinned' : 'Needs pin'}
			</span>
			<span class="flex items-center gap-1 rounded-md bg-[var(--background-lighter)] px-2 py-1 text-[var(--black-alpha-48)]">
				<ShieldCheck class="size-3" /> {paymentMode === 'cod' ? 'COD' : 'Razorpay'}
			</span>
		</div>
	</div>

	{#if !$cartState.hydrated || productsLoading}
		<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
			<div class="space-y-3">
				{#each checkoutSkeletons as skeleton (skeleton)}
					<div class="h-32 animate-pulse rounded-lg border border-[var(--border-faint)] bg-white"></div>
				{/each}
			</div>
			<div class="h-[380px] animate-pulse rounded-lg border border-[var(--border-faint)] bg-white"></div>
		</div>
	{:else if productsError}
		<div class="flex items-start gap-2 rounded-lg border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-4 text-[13px] text-[var(--accent-crimson)]">
			<AlertTriangle class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
			<span>{productsError}</span>
		</div>
	{:else if rows.length === 0}
		<div class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-10 text-center">
			<Package class="mx-auto size-8 text-[var(--black-alpha-32)]" strokeWidth={1.5} />
			<p class="mt-3 text-[13px] font-medium text-foreground">Cart is empty</p>
			<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">Add parts before checkout.</p>
			<a href={resolve('/products')} class="button button-primary mt-4 inline-flex h-9 items-center rounded-md px-4 text-[12px] text-white">
				Browse products
			</a>
		</div>
	{:else}
		<div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
			<div class="space-y-3 sm:space-y-4">
				<!-- Address section -->
				<article class="rounded-lg border border-[var(--border-faint)] bg-white">
					<div class="flex items-center justify-between border-b border-[var(--border-faint)] px-3 py-2.5 sm:px-4 sm:py-3">
						<div class="flex items-center gap-2">
							<MapPin class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
							<h2 class="text-[13px] font-medium text-foreground">Delivery address</h2>
						</div>
						{#if hasValidAddress && hasDeliveryPin}
							<span class="flex items-center gap-1 rounded-full bg-[var(--accent-forest)]/8 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-forest)]">
								<CheckCircle2 class="size-3" strokeWidth={2} /> Ready
							</span>
						{/if}
					</div>

					<!-- Saved address picker -->
					{#if savedAddresses.length > 0}
						<div class="border-b border-[var(--border-faint)] p-3 sm:p-4">
							<p class="mb-2 text-[11px] font-medium text-[var(--black-alpha-48)]">Saved addresses</p>
							<div class="space-y-1.5">
								{#each savedAddresses as addr (addr.id)}
									<button
										type="button"
										class="w-full rounded-md border p-2.5 text-left transition-colors sm:p-3
											{selectedSavedAddressId === addr.id && !showManualForm
												? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
												: 'border-[var(--border-faint)] hover:border-[var(--heat-40)]'}"
										onclick={() => selectSavedAddress(addr)}
									>
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0">
												<p class="text-[12px] font-medium text-foreground sm:text-[13px]">{addr.full_name}</p>
												<p class="mt-0.5 text-[11px] leading-relaxed text-[var(--black-alpha-56)]">
													{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city} — {addr.pincode}
												</p>
											</div>
											{#if addr.is_default}
												<span class="shrink-0 rounded bg-[var(--heat-8)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--heat-100)] uppercase">Default</span>
											{/if}
										</div>
									</button>
								{/each}
								<button
									type="button"
									class="w-full rounded-md border border-dashed p-2.5 text-center text-[12px] font-medium transition-colors sm:p-3
										{showManualForm
											? 'border-[var(--heat-100)] bg-[var(--heat-4)] text-[var(--heat-100)]'
											: 'border-[var(--border-muted)] text-[var(--black-alpha-56)] hover:border-[var(--heat-40)] hover:text-[var(--heat-100)]'}"
									onclick={useNewAddress}
								>
									+ Use a different address
								</button>
							</div>
						</div>
					{/if}

					<!-- Address form (show if no saved addresses OR manual mode) -->
					{#if savedAddresses.length === 0 || showManualForm}
						<div class="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1fr)]">
							<div class="grid content-start gap-2 sm:gap-2.5 sm:grid-cols-2">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Full name</span>
									<input bind:value={address.fullName} class="input-field !h-10 text-[13px]" autocomplete="name" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Phone</span>
									<input bind:value={address.phone} class="input-field !h-10 text-[13px]" autocomplete="tel" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Email</span>
									<input bind:value={address.email} class="input-field !h-10 text-[13px]" autocomplete="email" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Address line 1</span>
									<input bind:value={address.line1} class="input-field !h-10 text-[13px]" autocomplete="address-line1" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Address line 2</span>
									<input bind:value={address.line2} class="input-field !h-10 text-[13px]" autocomplete="address-line2" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">City</span>
									<input bind:value={address.city} class="input-field !h-10 text-[13px]" autocomplete="address-level2" />
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Pincode</span>
									<input bind:value={address.pincode} class="input-field !h-10 text-[13px]" autocomplete="postal-code" inputmode="numeric" />
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">State</span>
									<select bind:value={address.state} class="input-field !h-10 text-[13px]">
										{#each indianStates as st (st)}
											<option value={st}>{st}</option>
										{/each}
									</select>
								</label>
							</div>

							<div class="rounded-lg border border-[var(--border-faint)] bg-[var(--background-base)] p-2">
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
					{:else}
						<!-- Map picker for saved address (may need pin update) -->
						<div class="p-3 sm:p-4">
							<div class="rounded-lg border border-[var(--border-faint)] bg-[var(--background-base)] p-2">
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
					{/if}

					<div class="border-t border-[var(--border-faint)] px-3 py-2.5 sm:px-4 sm:py-3">
						<label class="flex items-center gap-2 text-[12px] text-[var(--black-alpha-64)]">
							<input bind:checked={saveAddress} type="checkbox" class="size-3.5 accent-[var(--heat-100)]" />
							Save address for future checkouts
						</label>
					</div>
				</article>

				<!-- Courier section -->
				<article class="rounded-lg border border-[var(--border-faint)] bg-white p-3 sm:p-4">
					<div class="flex items-center gap-2 mb-2.5 sm:mb-3">
						<Truck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
						<h2 class="text-[13px] font-medium text-foreground">Courier options</h2>
					</div>

					{#if estimateLoading}
						<div class="flex items-center gap-2 rounded-md bg-[var(--background-lighter)] p-3 text-[12px] text-[var(--black-alpha-48)]">
							<LoaderCircle class="size-3.5 animate-spin text-[var(--heat-100)]" strokeWidth={2} />
							Checking delivery quotes...
						</div>
					{:else if estimateError}
						<div class="flex items-start gap-2 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]">
							<AlertTriangle class="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
							<span>{estimateError}</span>
						</div>
					{:else if !deliveryEstimate}
						<div class="flex items-start gap-2 rounded-md border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-3 text-[12px] text-[var(--black-alpha-48)]">
							<Navigation class="mt-0.5 size-3.5 shrink-0 text-[var(--heat-100)]" strokeWidth={2} />
							<span>Add pincode and delivery pin to load courier options.</span>
						</div>
					{:else}
						<div class="grid gap-2 sm:grid-cols-2">
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Distance</p>
								<p class="mt-0.5 text-[14px] font-medium text-foreground">
									{deliveryEstimate.route.readableDistance || `${(deliveryEstimate.route.distanceMeters / 1000).toFixed(1)} km`}
								</p>
							</div>
							<div class="rounded-md bg-[var(--background-lighter)] p-3">
								<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-40)] uppercase">Route time</p>
								<p class="mt-0.5 text-[14px] font-medium text-foreground">
									{deliveryEstimate.route.readableDuration || `${Math.ceil(deliveryEstimate.route.durationSeconds / 60)} min`}
								</p>
							</div>
						</div>

						<div class="mt-3 space-y-2">
							{#each deliveryEstimate.couriers as courier (courier.quoteId)}
								<button
									type="button"
									aria-pressed={selectedQuoteId === courier.quoteId}
									class="w-full rounded-md border p-3 text-left transition-colors
										{selectedQuoteId === courier.quoteId
											? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
											: 'border-[var(--border-faint)] hover:border-[var(--heat-40)]'}"
									onclick={() => (selectedQuoteId = courier.quoteId)}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-1.5">
												<p class="text-[13px] font-medium text-foreground">{courier.courierName}</p>
												{#if courier.recommended}
													<span class="rounded bg-[var(--heat-8)] px-1.5 py-px text-[9px] font-medium text-[var(--heat-100)] uppercase">Best</span>
												{/if}
												{#if courier.serviceType === 'quick'}
													<span class="rounded bg-[var(--accent-forest)]/8 px-1.5 py-px text-[9px] font-medium text-[var(--accent-forest)] uppercase">Quick</span>
												{/if}
											</div>
											<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
												{courier.mode} · {courier.etd || `${courier.estimatedDeliveryDays}d`}
												{courier.rating ? ` · ${courier.rating}★` : ''}
											</p>
										</div>
										<div class="shrink-0 text-right">
											<p class="text-[13px] font-medium text-foreground">{formatINR(courier.rate)}</p>
											<p class="text-[10px] text-[var(--black-alpha-40)]">{courier.expectedDeliveryDate ?? 'On dispatch'}</p>
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</article>

				<article class="rounded-lg border border-[var(--border-faint)] bg-white p-3 sm:p-4">
					<div class="flex items-center gap-2 mb-2.5 sm:mb-3">
						<CreditCard class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
						<h2 class="text-[13px] font-medium text-foreground">Payment method</h2>
					</div>

					<div class="grid gap-2 sm:grid-cols-2">
						<button
							type="button"
							aria-pressed={paymentMode === 'razorpay'}
							class="rounded-md border p-3 text-left transition-colors
								{paymentMode === 'razorpay'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
									: 'border-[var(--border-faint)] hover:border-[var(--heat-40)]'}"
							onclick={() => (paymentMode = 'razorpay')}
						>
							<div class="flex items-center gap-2">
								<CreditCard class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
								<p class="text-[13px] font-medium text-foreground">Razorpay</p>
							</div>
							<p class="mt-1 text-[11px] text-[var(--black-alpha-48)]">
								Card, UPI, netbanking, wallets
							</p>
						</button>

						<button
							type="button"
							aria-pressed={paymentMode === 'cod'}
							class="rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50
								{paymentMode === 'cod'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
									: 'border-[var(--border-faint)] hover:border-[var(--heat-40)]'}"
							disabled={!codEligibility.eligible}
							onclick={() => (paymentMode = 'cod')}
						>
							<div class="flex items-center gap-2">
								<Wallet class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
								<p class="text-[13px] font-medium text-foreground">Cash on delivery</p>
							</div>
							<p class="mt-1 text-[11px] text-[var(--black-alpha-48)]">
								{codEligibility.eligible
									? `Up to ${formatINR(codEligibility.cap)}`
									: (codEligibility.reason ?? 'Not available for this order.')}
							</p>
						</button>
					</div>

					{#if appliedSummary?.deliveryPromise}
						<div class="mt-3 flex items-start gap-2 rounded-md border border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/6 p-3 text-[12px]">
							<CheckCircle2 class="mt-0.5 size-3.5 shrink-0 text-[var(--accent-forest)]" strokeWidth={2} />
							<div>
								<p class="font-medium text-[var(--accent-forest)]">{appliedSummary.deliveryPromise.label}</p>
								<p class="mt-0.5 text-[var(--accent-forest)]/80">{appliedSummary.deliveryPromise.detail}</p>
							</div>
						</div>
					{/if}

					{#if message}
						<div
							class="mt-3 flex items-start gap-2 rounded-md border p-3 text-[12px]
								{message.tone === 'error'
									? 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]'
									: message.tone === 'success'
										? 'border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/6 text-[var(--accent-forest)]'
										: 'border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-72)]'}"
						>
							{#if message.tone === 'error'}
								<AlertTriangle class="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
							{:else}
								<CheckCircle2 class="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
							{/if}
							<span>{message.text}</span>
						</div>
					{/if}
				</article>
			</div>

			<aside class="sticky top-24 h-fit rounded-lg border border-[var(--border-faint)] bg-white">
				<div class="border-b border-[var(--border-faint)] px-4 py-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<ReceiptText class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
							<h2 class="text-[13px] font-medium text-foreground">Order summary</h2>
						</div>
						<span class="text-[11px] text-[var(--black-alpha-48)]">{rows.length} item{rows.length === 1 ? '' : 's'}</span>
					</div>
				</div>

				<div class="space-y-2 p-4">
					{#each rows as row (row.item.id)}
						<div class="flex gap-3 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-2">
							<div class="grid size-14 shrink-0 place-items-center rounded bg-white p-1.5">
								<img
									src={row.product.images?.[0] ?? row.product.image}
									alt={row.product.title}
									class="max-h-full w-full object-contain"
								/>
							</div>
							<div class="min-w-0 flex-1">
								<p class="line-clamp-2 text-[12px] font-medium text-foreground">{row.product.title}</p>
								<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
									{row.product.brand} · Qty {row.item.qty}
								</p>
								<p class="mt-1 text-[12px] text-[var(--black-alpha-72)]">
									{formatINR(row.product.price * row.item.qty)}
								</p>
							</div>
						</div>
					{/each}
				</div>

				<div class="space-y-2 border-t border-[var(--border-faint)] px-4 py-3 text-[12px] text-[var(--black-alpha-64)]">
					<div class="flex justify-between">
						<span>Subtotal</span>
						<span class="text-foreground">{formatINR(subtotal)}</span>
					</div>
					<div class="flex justify-between">
						<span>Shipping</span>
						<span class="text-foreground">{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
					</div>
					{#if discountTotal > 0}
						<div class="flex justify-between text-[var(--accent-forest)]">
							<span>{appliedSummary?.coupon?.code ?? 'Coupon'}</span>
							<span>-{formatINR(discountTotal)}</span>
						</div>
					{/if}
					<div class="flex justify-between border-t border-[var(--border-faint)] pt-2 text-[14px] font-semibold text-foreground">
						<span>Total</span>
						<span>{formatINR(payableTotal)}</span>
					</div>
				</div>

				<div class="border-t border-[var(--border-faint)] px-4 py-3">
					<div class="flex items-center gap-2 mb-2">
						<Tag class="size-3.5 text-[var(--heat-100)]" strokeWidth={2} />
						<p class="text-[12px] font-medium text-foreground">Coupon</p>
					</div>
					<div class="flex gap-2">
						<input
							bind:value={couponCode}
							class="input-field min-w-0 flex-1 text-[12px] uppercase"
							maxlength="40"
							placeholder="SAVE10"
						/>
						<button
							type="button"
							class="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={couponBusy || !couponCode.trim()}
							onclick={applyCoupon}
						>
							{couponBusy ? 'Applying' : 'Apply'}
						</button>
					</div>

					{#if appliedSummary?.coupon}
						<div class="mt-2 flex items-center justify-between text-[11px]">
							<span class="text-[var(--accent-forest)]">
								{appliedSummary.coupon.code} saved {formatINR(discountTotal)}
							</span>
							<button
								type="button"
								class="text-[var(--heat-100)] hover:underline"
								onclick={removeAppliedCoupon}
							>
								Remove
							</button>
						</div>
					{/if}
				</div>

				{#if selectedCourier}
					<div class="border-t border-[var(--border-faint)] px-4 py-3">
						<div class="flex items-center gap-2">
							<Truck class="size-3.5 text-[var(--heat-100)]" strokeWidth={2} />
							<p class="text-[12px] font-medium text-foreground">{selectedCourier.courierName}</p>
						</div>
						<p class="mt-1 text-[11px] text-[var(--black-alpha-48)]">
							{selectedCourier.serviceType === 'quick' ? 'Quick' : 'Standard'} · {selectedCourier.etd || `${selectedCourier.estimatedDeliveryDays}d`}
							· {deliveryEstimate?.route.readableDistance || '-'}
						</p>
					</div>
				{/if}

				<div class="border-t border-[var(--border-faint)] p-4 space-y-2">
					<button
						type="button"
						class="button button-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
						class="inline-flex h-9 w-full items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
					>
						Review existing orders
					</a>
				</div>
			</aside>
		</div>
	{/if}
</section>
