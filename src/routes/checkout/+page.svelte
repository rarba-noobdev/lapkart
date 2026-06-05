<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
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

<section class="container mx-auto px-4 py-10">
	<div class="mb-8">
		<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
			Secure checkout
		</p>
		<h1 class="text-title-h3 mt-3 font-display text-foreground">Delivery, courier, and payment</h1>
		<p class="text-body-medium mt-2 max-w-[42rem] text-[var(--black-alpha-56)]">
			Confirm the delivery location, compare the live courier options, and complete the order with
			Razorpay or eligible cash on delivery.
		</p>
	</div>

	{#if !$cartState.hydrated || productsLoading}
		<div class="grid gap-6 lg:grid-cols-[1fr_380px]">
			<div class="space-y-5">
				{#each checkoutSkeletons as skeleton (skeleton)}
					<div class="h-56 animate-pulse rounded-[18px] bg-white"></div>
				{/each}
			</div>
			<div class="h-[420px] animate-pulse rounded-[18px] bg-white"></div>
		</div>
	{:else if productsError}
		<div class="rounded-[18px] border border-red-200 bg-red-50 p-6 text-red-700">
			{productsError}
		</div>
	{:else if rows.length === 0}
		<div
			class="rounded-[18px] border border-dashed border-[var(--border-muted)] bg-white p-10 text-center"
		>
			<p class="text-label-small text-[var(--heat-100)]">Your cart is empty</p>
			<p class="text-body-large mt-3 text-foreground">Add parts to your cart before checkout.</p>
			<a
				href={resolve('/products')}
				class="button button-primary text-label-medium mt-6 inline-flex h-12 items-center justify-center rounded-md px-6 text-white"
			>
				Browse products
			</a>
		</div>
	{:else}
		<div class="grid gap-6 lg:grid-cols-[1fr_380px]">
			<div class="space-y-6">
				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6 md:p-8">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
								Delivery details
							</p>
							<h2 class="text-title-h5 mt-2 text-foreground">Address and delivery pin</h2>
						</div>
						<a
							href={resolve('/cart')}
							class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
						>
							Back to cart
						</a>
					</div>

					<div class="mt-6 grid gap-4 md:grid-cols-2">
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
							<input bind:value={address.line1} class="input-field" autocomplete="address-line1" />
						</label>
						<label class="md:col-span-2">
							<span class="text-label-small mb-2 block text-foreground">Address line 2</span>
							<input bind:value={address.line2} class="input-field" autocomplete="address-line2" />
						</label>
						<label>
							<span class="text-label-small mb-2 block text-foreground">City</span>
							<input bind:value={address.city} class="input-field" autocomplete="address-level2" />
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

					<div class="mt-6">
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

					<label
						class="text-body-small mt-5 flex items-start gap-3 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-72)]"
					>
						<input bind:checked={saveAddress} type="checkbox" class="mt-1 h-4 w-4 shrink-0" />
						<span>Save this delivery address to your account for faster future checkouts.</span>
					</label>
				</div>

				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6 md:p-8">
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Shipping
					</p>
					<h2 class="text-title-h5 mt-2 text-foreground">Courier options</h2>

					{#if estimateLoading}
						<div
							class="text-body-small mt-5 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-64)]"
						>
							Checking route distance and delivery quotes...
						</div>
					{:else if estimateError}
						<div
							class="text-body-small mt-5 rounded-[16px] border border-red-200 bg-red-50 px-4 py-4 text-red-700"
						>
							{estimateError}
						</div>
					{:else if !deliveryEstimate}
						<div
							class="text-body-small mt-5 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-4 text-[var(--black-alpha-64)]"
						>
							Add a valid pincode and delivery pin to load courier options.
						</div>
					{:else}
						<div class="mt-5 grid gap-4 md:grid-cols-2">
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Road distance
								</p>
								<p class="text-title-h5 mt-2 text-foreground">
									{deliveryEstimate.route.readableDistance ||
										`${(deliveryEstimate.route.distanceMeters / 1000).toFixed(1)} km`}
								</p>
							</div>
							<div
								class="rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
							>
								<p
									class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Route time
								</p>
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
									class={`rounded-[18px] border p-4 text-left transition-colors ${
										selectedQuoteId === courier.quoteId
											? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
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
														class="text-mono-x-small rounded-full bg-[var(--heat-12)] px-2 py-1 text-[var(--heat-100)] uppercase"
													>
														Recommended
													</span>
												{/if}
												{#if courier.serviceType === 'quick'}
													<span
														class="text-mono-x-small rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 uppercase"
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
										<div class="text-right">
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
				</div>

				<div class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6 md:p-8">
					<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
						Payment
					</p>
					<h2 class="text-title-h5 mt-2 text-foreground">Choose how to pay</h2>

					<div class="mt-5 grid gap-3 md:grid-cols-2">
						<button
							type="button"
							class={`rounded-[18px] border p-4 text-left transition-colors ${
								paymentMode === 'razorpay'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
									: 'border-[var(--border-faint)] bg-white'
							}`}
							onclick={() => (paymentMode = 'razorpay')}
						>
							<p class="text-label-large text-foreground">Razorpay</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								Card, UPI, netbanking, and wallets through the hosted checkout.
							</p>
						</button>

						<button
							type="button"
							class={`rounded-[18px] border p-4 text-left transition-colors ${
								paymentMode === 'cod'
									? 'border-[var(--heat-100)] bg-[var(--heat-4)]'
									: 'border-[var(--border-faint)] bg-white'
							}`}
							disabled={!codEligibility.eligible}
							onclick={() => (paymentMode = 'cod')}
						>
							<p class="text-label-large text-foreground">Cash on delivery</p>
							<p class="text-body-small mt-2 text-[var(--black-alpha-56)]">
								{codEligibility.eligible
									? `Available up to ${formatINR(codEligibility.cap)} for eligible Chennai-area deliveries.`
									: (codEligibility.reason ?? 'COD is not available for this order.')}
							</p>
						</button>
					</div>

					{#if appliedSummary?.deliveryPromise}
						<div class="mt-5 rounded-[16px] border border-emerald-200 bg-emerald-50 p-4">
							<p class="text-label-medium text-emerald-800">
								{appliedSummary.deliveryPromise.label}
							</p>
							<p class="text-body-small mt-1 text-emerald-700">
								{appliedSummary.deliveryPromise.detail}
							</p>
						</div>
					{/if}

					{#if message}
						<div
							class={`text-body-small mt-5 rounded-[16px] px-4 py-4 ${
								message.tone === 'error'
									? 'border border-red-200 bg-red-50 text-red-700'
									: message.tone === 'success'
										? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
										: 'border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-72)]'
							}`}
						>
							{message.text}
						</div>
					{/if}
				</div>
			</div>

			<aside class="h-fit rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
				<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
					Order summary
				</p>
				<h2 class="text-title-h5 mt-2 text-foreground">
					{rows.length} item{rows.length === 1 ? '' : 's'} in checkout
				</h2>

				<div class="mt-6 space-y-4">
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
								<p class="text-label-medium text-foreground">{row.product.title}</p>
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
					class="text-body-medium mt-6 space-y-3 border-t border-[var(--border-faint)] pt-5 text-[var(--black-alpha-64)]"
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
					class="mt-6 rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
				>
					<p class="text-label-medium text-foreground">Coupon</p>
					<div class="mt-3 flex gap-2">
						<input
							bind:value={couponCode}
							class="input-field flex-1 uppercase"
							maxlength="40"
							placeholder="SAVE10"
						/>
						<button
							type="button"
							class="text-label-medium inline-flex h-12 shrink-0 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={couponBusy || !couponCode.trim()}
							onclick={applyCoupon}
						>
							{couponBusy ? 'Applying...' : 'Apply'}
						</button>
					</div>

					{#if appliedSummary?.coupon}
						<div class="text-body-small mt-3 flex items-center justify-between">
							<span class="text-emerald-700">
								{appliedSummary.coupon.code} saved {formatINR(discountTotal)}
							</span>
							<button type="button" class="text-[var(--heat-100)]" onclick={removeAppliedCoupon}>
								Remove
							</button>
						</div>
					{/if}
				</div>

				{#if selectedCourier}
					<div class="mt-6 rounded-[16px] border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
						<p class="text-label-medium text-foreground">{selectedCourier.courierName}</p>
						<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
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
					class="button button-primary text-label-medium mt-6 inline-flex h-12 w-full items-center justify-center rounded-md text-white disabled:cursor-not-allowed disabled:opacity-60"
					disabled={busy ||
						rows.length === 0 ||
						estimateLoading ||
						!selectedCourier ||
						Boolean(orderId)}
					onclick={pay}
				>
					{#if busy}
						Working...
					{:else if orderId}
						Order placed
					{:else if paymentMode === 'cod'}
						Place COD order for {formatINR(payableTotal)}
					{:else}
						Pay {formatINR(payableTotal)}
					{/if}
				</button>

				<a
					href={resolve('/orders')}
					class="text-label-medium mt-3 inline-flex h-11 w-full items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				>
					Review existing orders
				</a>
			</aside>
		</div>
	{/if}
</section>
