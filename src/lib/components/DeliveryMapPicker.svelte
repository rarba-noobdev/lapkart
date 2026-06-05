<script lang="ts">
	import { apiBase } from '$lib/api-base';
	import { getAuthorizationHeaders } from '$lib/supabase-auth';

	export type DeliveryPin = {
		latitude: number;
		longitude: number;
		source: 'ola_maps' | 'browser_geolocation';
	};

	export type ResolvedDeliveryAddress = {
		placeId: string | null;
		formattedAddress: string;
		line1: string;
		line2: string;
		city: string;
		state: string;
		pincode: string;
		latitude: number | null;
		longitude: number | null;
	};

	type Suggestion = {
		placeId: string;
		description: string;
		mainText: string;
		secondaryText: string;
		latitude: number | null;
		longitude: number | null;
	};

	type Props = {
		value: DeliveryPin | null;
		onChange: (pin: DeliveryPin) => void;
		onAddressResolved?: (address: ResolvedDeliveryAddress) => void;
		addressLabel?: string;
		disabled?: boolean;
	};

	const olaMapsKey = import.meta.env.VITE_OLA_MAPS_API_KEY ?? '';

	let {
		value,
		onChange,
		onAddressResolved,
		addressLabel = 'Delivery pin',
		disabled = false
	}: Props = $props();

	let query = $state('');
	let searching = $state(false);
	let resolving = $state(false);
	let locating = $state(false);
	let error = $state<string | null>(null);
	let suggestions = $state<Suggestion[]>([]);
	let currentPin = $state<DeliveryPin | null>(null);
	let suppressNextSearch = false;

	function roundCoordinate(value: number) {
		return Number(value.toFixed(6));
	}

	function buildStaticMapUrl(pin: DeliveryPin | null) {
		if (!pin || !olaMapsKey) return null;

		const params = new URLSearchParams({ api_key: olaMapsKey });
		return `https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/${pin.longitude},${pin.latitude},15/1000x640.png?${params.toString()}`;
	}

	async function resolvePin(pin: DeliveryPin, selectedPlaceId?: string) {
		try {
			resolving = true;
			error = null;

			const url = new URL(`${apiBase}/maps/reverse-geocode`);
			url.searchParams.set('latitude', String(pin.latitude));
			url.searchParams.set('longitude', String(pin.longitude));

			const response = await fetch(url, {
				headers: await getAuthorizationHeaders()
			});
			const data = (await response.json().catch(() => null)) as
				| (ResolvedDeliveryAddress & { error?: string })
				| null;

			if (!response.ok || !data) {
				throw new Error(data?.error ?? 'Could not resolve this address');
			}

			const resolved = { ...data, placeId: selectedPlaceId ?? data.placeId };
			suppressNextSearch = true;
			query = resolved.formattedAddress;
			onAddressResolved?.(resolved);
		} catch (resolveError) {
			error =
				resolveError instanceof Error ? resolveError.message : 'Could not resolve this address';
		} finally {
			resolving = false;
		}
	}

	function commitPin(pin: DeliveryPin, selectedPlaceId?: string) {
		currentPin = pin;
		onChange(pin);
		void resolvePin(pin, selectedPlaceId);
	}

	async function useBrowserLocation() {
		if (!navigator.geolocation) {
			error = 'Browser location is not available on this device';
			return;
		}

		locating = true;
		error = null;

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const pin: DeliveryPin = {
					latitude: roundCoordinate(position.coords.latitude),
					longitude: roundCoordinate(position.coords.longitude),
					source: 'browser_geolocation'
				};

				commitPin(pin);
				locating = false;
			},
			() => {
				error = 'Could not read browser location';
				locating = false;
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	function selectSuggestion(suggestion: Suggestion) {
		if (suggestion.latitude === null || suggestion.longitude === null) {
			error = 'This suggestion does not include a selectable coordinate';
			return;
		}

		suggestions = [];
		suppressNextSearch = true;
		query = suggestion.description;

		commitPin(
			{
				latitude: roundCoordinate(suggestion.latitude),
				longitude: roundCoordinate(suggestion.longitude),
				source: 'ola_maps'
			},
			suggestion.placeId
		);
	}

	$effect(() => {
		if (
			value &&
			(!currentPin ||
				value.latitude !== currentPin.latitude ||
				value.longitude !== currentPin.longitude)
		) {
			currentPin = value;
		}
	});

	$effect(() => {
		const input = query.trim();
		if (disabled) return;

		if (suppressNextSearch) {
			suppressNextSearch = false;
			return;
		}

		if (input.length < 3) {
			suggestions = [];
			searching = false;
			return;
		}

		const latitude = currentPin?.latitude;
		const longitude = currentPin?.longitude;
		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			try {
				searching = true;
				error = null;

				const url = new URL(`${apiBase}/maps/autocomplete`);
				url.searchParams.set('input', input.slice(0, 160));
				if (latitude !== undefined) url.searchParams.set('latitude', String(latitude));
				if (longitude !== undefined) url.searchParams.set('longitude', String(longitude));

				const response = await fetch(url, {
					signal: controller.signal,
					headers: await getAuthorizationHeaders()
				});
				const data = (await response.json().catch(() => null)) as {
					suggestions?: Suggestion[];
					error?: string;
				} | null;

				if (!response.ok || !data) {
					throw new Error(data?.error ?? 'Could not search addresses');
				}

				suggestions = data.suggestions ?? [];
			} catch (searchError) {
				if (controller.signal.aborted) return;
				suggestions = [];
				error = searchError instanceof Error ? searchError.message : 'Could not search addresses';
			} finally {
				if (!controller.signal.aborted) searching = false;
			}
		}, 250);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	});

	const staticMapUrl = $derived(buildStaticMapUrl(currentPin));
</script>

<div class="overflow-hidden rounded-[18px] border border-[var(--border-faint)] bg-white">
	<div class="border-b border-[var(--border-faint)] p-4">
		<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
			Search address or landmark
		</p>
		<div class="relative mt-2">
			<input
				bind:value={query}
				class="input-field pr-10"
				{disabled}
				autocomplete="off"
				placeholder="Search by area, landmark, or pincode"
			/>
			{#if searching}
				<span
					class="text-body-small absolute top-1/2 right-3 -translate-y-1/2 text-[var(--heat-100)]"
				>
					...
				</span>
			{/if}

			{#if suggestions.length > 0}
				<div
					class="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[14px] border border-[var(--border-muted)] bg-white shadow-[var(--shadow-pop)]"
				>
					{#each suggestions as suggestion (suggestion.placeId)}
						<button
							type="button"
							class="block w-full border-b border-[var(--border-faint)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--background-lighter)]"
							onclick={() => selectSuggestion(suggestion)}
						>
							<span class="text-label-small block text-foreground">{suggestion.mainText}</span>
							<span class="text-body-small mt-1 block text-[var(--black-alpha-56)]">
								{suggestion.secondaryText}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="relative h-[280px] overflow-hidden bg-[var(--background-lighter)]">
		{#if staticMapUrl}
			<img
				src={staticMapUrl}
				alt="Selected delivery area"
				class="absolute inset-0 h-full w-full object-cover"
			/>
		{/if}

		<div
			class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,93,25,0.12),transparent_58%)]"
		></div>

		<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
			<div
				class="grid h-14 w-14 place-items-center rounded-full border border-white/70 bg-[var(--heat-100)] text-white shadow-[var(--shadow-pop)]"
			>
				<span class="text-title-h5 leading-none">+</span>
			</div>

			{#if currentPin}
				<div
					class="text-body-small rounded-full border border-white/70 bg-white/90 px-4 py-2 text-[var(--black-alpha-72)] backdrop-blur-sm"
				>
					{currentPin.latitude}, {currentPin.longitude}
				</div>
			{:else}
				<div
					class="text-body-small max-w-[22rem] rounded-[16px] border border-white/70 bg-white/90 px-4 py-3 text-[var(--black-alpha-72)] backdrop-blur-sm"
				>
					Search for an address or use browser GPS to attach the delivery pin.
				</div>
			{/if}
		</div>
	</div>

	<div
		class="flex flex-col gap-3 border-t border-[var(--border-faint)] p-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
				{addressLabel}
			</p>
			<p class="text-body-small mt-1 text-[var(--black-alpha-72)]">
				{#if currentPin}
					{currentPin.latitude}, {currentPin.longitude}
				{:else}
					No delivery pin selected yet
				{/if}
			</p>
			{#if resolving}
				<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
					Resolving selected address...
				</p>
			{/if}
			{#if error}
				<p class="text-body-small mt-1 text-red-700">{error}</p>
			{/if}
		</div>

		<button
			type="button"
			class="text-label-medium inline-flex h-11 items-center justify-center rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-4 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:cursor-not-allowed disabled:opacity-60"
			disabled={disabled || locating}
			onclick={useBrowserLocation}
		>
			{locating ? 'Locating...' : 'Use browser GPS'}
		</button>
	</div>
</div>
