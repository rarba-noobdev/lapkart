<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		ArrowLeft,
		ArrowRight,
		BadgeCheck,
		Banknote,
		Bell,
		Check,
		CreditCard,
		LoaderCircle,
		MapPin,
		Search,
		ShieldCheck,
		Smartphone,
		Sparkles
	} from '@lucide/svelte';
	import {
		isNativeApp,
		nativeImpact,
		registerPushNotifications,
		requestLocationPermission
	} from '$lib/native/capacitor';

	const storageKey = 'lapkart_native_onboarding_v1';

	// 0..2 = value slides, 3 = permissions, 4 = sign-in choice.
	const VALUE_SLIDES = [
		{
			eyebrow: 'Laptop parts, made simpler',
			title: 'Find the exact part',
			body: 'Search by laptop model, part number, or component type.'
		},
		{
			eyebrow: 'Fitment first',
			title: 'Check compatibility',
			body: 'Review model details and part numbers before placing your order.'
		},
		{
			eyebrow: 'Checkout your way',
			title: 'Pay with confidence',
			body: 'Use UPI, cards, or cash on delivery when the order is eligible.'
		}
	] as const;
	const TOTAL_STEPS = VALUE_SLIDES.length + 2; // + permissions + auth
	const PERMISSIONS_STEP = VALUE_SLIDES.length; // 3
	const AUTH_STEP = TOTAL_STEPS - 1; // 4

	let visible = $state(false);
	let step = $state(0);
	let notifGranted = $state(false);
	let locGranted = $state(false);
	let notifBusy = $state(false);
	let locBusy = $state(false);

	const isValueStep = $derived(step < VALUE_SLIDES.length);
	const valueSlide = $derived(isValueStep ? VALUE_SLIDES[step] : null);

	onMount(() => {
		let active = true;
		const handleNativeBack = () => {
			if (!visible) return;
			if (step > 0) {
				step -= 1;
				void nativeImpact();
				return;
			}
			finish();
		};
		window.addEventListener('lapkart:onboarding-back', handleNativeBack);
		void isNativeApp().then((native) => {
			if (active && native && localStorage.getItem(storageKey) !== 'complete') visible = true;
		});
		return () => {
			active = false;
			window.removeEventListener('lapkart:onboarding-back', handleNativeBack);
		};
	});

	$effect(() => {
		if (!visible) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.documentElement.dataset.lapkartOnboarding = 'open';
		return () => {
			document.body.style.overflow = previousOverflow;
			delete document.documentElement.dataset.lapkartOnboarding;
		};
	});

	function finish() {
		localStorage.setItem(storageKey, 'complete');
		visible = false;
		void nativeImpact();
	}

	function next() {
		if (step < AUTH_STEP) {
			step += 1;
			void nativeImpact();
		}
	}

	function previous() {
		if (step === 0) return;
		step -= 1;
		void nativeImpact();
	}

	async function enableNotifications() {
		if (notifBusy || notifGranted) return;
		notifBusy = true;
		void nativeImpact();
		const token = await registerPushNotifications({ prompt: true });
		notifGranted = token !== null;
		notifBusy = false;
	}

	async function enableLocation() {
		if (locBusy || locGranted) return;
		locBusy = true;
		void nativeImpact();
		locGranted = await requestLocationPermission();
		locBusy = false;
	}

	function signIn() {
		finish();
		void goto(resolve('/login'));
	}
</script>

{#if visible}
	<div
		class="native-onboarding"
		role="dialog"
		aria-modal="true"
		aria-labelledby="onboarding-title"
		transition:fade={{ duration: 180 }}
	>
		<header class="onboarding-header">
			<img src={asset('/brand/lapkart-logo.svg')} alt="LapKart" class="onboarding-logo" />
			{#if step !== AUTH_STEP}
				<button type="button" class="skip-button" onclick={finish}>Skip</button>
			{/if}
		</header>

		{#if isValueStep}
			<section class="onboarding-visual" aria-hidden="true">
				{#key step}
					<div class="visual-stage" in:fly={{ x: 28, duration: 260 }} out:fade={{ duration: 100 }}>
						{#if step === 0}
							<div class="search-preview">
								<Search size={20} strokeWidth={2} />
								<span>Search model or part number</span>
							</div>
							<div class="part-grid">
								<div><strong>Display</strong><span>NV156FHM-N4K</span></div>
								<div><strong>Keyboard</strong><span>IdeaPad 310</span></div>
								<div><strong>Battery</strong><span>L17M3PG1</span></div>
								<div><strong>IC</strong><span>TPS51225C</span></div>
							</div>
						{:else if step === 1}
							<div class="fitment-mark">
								<ShieldCheck size={72} strokeWidth={1.6} />
								<span><BadgeCheck size={18} strokeWidth={2.2} /> Compatibility details</span>
							</div>
							<div class="fitment-lines">
								<span>Model series</span><strong>Lenovo IdeaPad 310</strong>
								<span>Part number</span><strong>5CB0L35888</strong>
							</div>
						{:else}
							<div class="payment-orbit">
								<div><Smartphone size={26} strokeWidth={1.9} /><span>UPI</span></div>
								<div class="payment-main"><Sparkles size={34} strokeWidth={1.7} /></div>
								<div><CreditCard size={26} strokeWidth={1.9} /><span>Cards</span></div>
								<div><Banknote size={26} strokeWidth={1.9} /><span>COD</span></div>
							</div>
						{/if}
					</div>
				{/key}
			</section>

			<section class="onboarding-copy">
				<p class="onboarding-eyebrow">{valueSlide?.eyebrow}</p>
				<h1 id="onboarding-title">{valueSlide?.title}</h1>
				<p class="onboarding-body">{valueSlide?.body}</p>
			</section>
		{:else if step === PERMISSIONS_STEP}
			<section class="onboarding-panel" in:fly={{ x: 28, duration: 260 }}>
				<p class="onboarding-eyebrow">Quick setup</p>
				<h1 id="onboarding-title">Get the best experience</h1>
				<p class="onboarding-body">Both are optional and you can change them anytime.</p>

				<div class="perm-list">
					<div class="perm-row">
						<span class="perm-icon"><Bell size={20} strokeWidth={2} /></span>
						<div class="perm-text">
							<strong>Order updates</strong>
							<span>Get notified when your order ships and arrives.</span>
						</div>
						<button
							type="button"
							class="perm-action"
							class:is-on={notifGranted}
							disabled={notifBusy || notifGranted}
							onclick={enableNotifications}
						>
							{#if notifBusy}
								<LoaderCircle size={15} class="spin" strokeWidth={2.2} />
							{:else if notifGranted}
								<Check size={15} strokeWidth={2.6} /> On
							{:else}
								Enable
							{/if}
						</button>
					</div>

					<div class="perm-row">
						<span class="perm-icon"><MapPin size={20} strokeWidth={2} /></span>
						<div class="perm-text">
							<strong>Delivery location</strong>
							<span>Auto-fill your address and confirm delivery to your spot.</span>
						</div>
						<button
							type="button"
							class="perm-action"
							class:is-on={locGranted}
							disabled={locBusy || locGranted}
							onclick={enableLocation}
						>
							{#if locBusy}
								<LoaderCircle size={15} class="spin" strokeWidth={2.2} />
							{:else if locGranted}
								<Check size={15} strokeWidth={2.6} /> On
							{:else}
								Enable
							{/if}
						</button>
					</div>
				</div>
			</section>
		{:else}
			<section class="onboarding-panel onboarding-auth" in:fly={{ x: 28, duration: 260 }}>
				<div class="auth-mark"><ShieldCheck size={64} strokeWidth={1.6} /></div>
				<p class="onboarding-eyebrow">You're all set</p>
				<h1 id="onboarding-title">Track orders & checkout faster</h1>
				<p class="onboarding-body">
					Sign in to save addresses, track orders, and reorder parts in a tap.
				</p>
			</section>
		{/if}

		<footer class="onboarding-footer">
			<div class="progress-dots" aria-label={`Step ${step + 1} of ${TOTAL_STEPS}`}>
				{#each Array.from({ length: TOTAL_STEPS }) as _, index (index)}
					<button
						type="button"
						class:active={index === step}
						aria-label={`Go to step ${index + 1}`}
						onclick={() => (step = index)}
					></button>
				{/each}
			</div>

			{#if step === AUTH_STEP}
				<div class="auth-actions">
					<button type="button" class="next-button" onclick={signIn}>
						<span>Sign in or create account</span>
						<ArrowRight size={20} strokeWidth={2.1} />
					</button>
					<button type="button" class="ghost-button" onclick={finish}>Continue as guest</button>
				</div>
			{:else}
				<div class="onboarding-actions">
					<button
						type="button"
						class="back-button"
						aria-label="Previous step"
						title="Previous"
						disabled={step === 0}
						onclick={previous}
					>
						<ArrowLeft size={20} strokeWidth={2.1} />
					</button>
					<button type="button" class="next-button" onclick={next}>
						<span>{step === PERMISSIONS_STEP ? 'Continue' : 'Next'}</span>
						<ArrowRight size={20} strokeWidth={2.1} />
					</button>
				</div>
			{/if}
		</footer>
	</div>
{/if}

<style>
	.native-onboarding {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto auto;
		height: 100dvh;
		overflow: hidden;
		background: #ffffff;
		color: var(--foreground);
		padding: max(18px, env(safe-area-inset-top)) 20px max(18px, env(safe-area-inset-bottom));
	}

	.onboarding-header {
		display: flex;
		min-height: 42px;
		align-items: center;
		justify-content: space-between;
	}

	.onboarding-logo {
		display: block;
		width: 126px;
		height: 36px;
		object-fit: contain;
		object-position: left center;
	}

	.skip-button {
		min-width: 48px;
		min-height: 40px;
		border: 0;
		background: transparent;
		color: var(--black-alpha-56);
		font-size: 14px;
		font-weight: 650;
	}

	.onboarding-visual {
		display: grid;
		min-height: 0;
		place-items: center;
		padding: 18px 0 12px;
	}

	.visual-stage {
		display: grid;
		width: min(100%, 390px);
		min-height: 280px;
		align-content: center;
		gap: 14px;
	}

	.search-preview {
		display: flex;
		height: 54px;
		align-items: center;
		gap: 11px;
		border: 1px solid var(--border-muted);
		border-radius: 8px;
		padding: 0 16px;
		color: var(--black-alpha-48);
		background: #ffffff;
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.07);
		font-size: 14px;
	}

	.part-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.part-grid div {
		display: grid;
		min-width: 0;
		gap: 5px;
		border: 1px solid var(--border-faint);
		border-radius: 8px;
		padding: 16px;
		background: var(--background-lighter);
	}

	.part-grid strong,
	.fitment-lines strong {
		overflow-wrap: anywhere;
		font-size: 14px;
		font-weight: 700;
	}

	.part-grid span,
	.fitment-lines span {
		color: var(--black-alpha-48);
		font-size: 12px;
	}

	.fitment-mark {
		display: grid;
		place-items: center;
		gap: 14px;
		color: var(--heat-100);
	}

	.fitment-mark > span {
		display: flex;
		align-items: center;
		gap: 7px;
		color: var(--foreground);
		font-size: 14px;
		font-weight: 700;
	}

	.fitment-lines {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 9px 18px;
		border-top: 1px solid var(--border-faint);
		border-bottom: 1px solid var(--border-faint);
		padding: 16px 4px;
	}

	.fitment-lines strong {
		text-align: right;
	}

	.payment-orbit {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		align-items: center;
		gap: 12px;
	}

	.payment-orbit > div {
		display: grid;
		min-width: 0;
		place-items: center;
		gap: 8px;
		border: 1px solid var(--border-faint);
		border-radius: 8px;
		padding: 18px 8px;
		background: var(--background-lighter);
		font-size: 12px;
		font-weight: 700;
	}

	.payment-orbit .payment-main {
		grid-column: 2;
		grid-row: 1 / span 2;
		min-height: 116px;
		border-color: var(--heat-100);
		background: var(--heat-100);
		color: #ffffff;
	}

	.onboarding-copy {
		min-height: 154px;
		padding: 4px 0 18px;
	}

	/* Permissions + auth panels reuse the copy rhythm but fill the flexible row. */
	.onboarding-panel {
		display: grid;
		align-content: center;
		min-height: 0;
		padding: 8px 0 18px;
	}

	.onboarding-auth {
		justify-items: start;
	}

	.auth-mark {
		display: grid;
		width: 96px;
		height: 96px;
		place-items: center;
		margin-bottom: 18px;
		border-radius: 24px;
		background: var(--heat-8);
		color: var(--heat-100);
	}

	.onboarding-eyebrow {
		margin: 0 0 8px;
		color: var(--heat-100);
		font-size: 12px;
		font-weight: 750;
		letter-spacing: 0;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: 32px;
		font-weight: 780;
		line-height: 1.12;
		letter-spacing: 0;
	}

	.onboarding-body {
		max-width: 34ch;
		margin: 12px 0 0;
		color: var(--black-alpha-56);
		font-size: 15px;
		line-height: 1.55;
	}

	.perm-list {
		display: grid;
		gap: 12px;
		margin-top: 24px;
	}

	.perm-row {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		border: 1px solid var(--border-muted);
		border-radius: 12px;
		padding: 14px;
	}

	.perm-icon {
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		border-radius: 10px;
		background: var(--heat-8);
		color: var(--heat-100);
	}

	.perm-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.perm-text strong {
		font-size: 14px;
		font-weight: 700;
		color: var(--foreground);
	}

	.perm-text span {
		font-size: 12px;
		line-height: 1.4;
		color: var(--black-alpha-56);
	}

	.perm-action {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 36px;
		min-width: 72px;
		justify-content: center;
		border: 1px solid var(--heat-100);
		border-radius: 999px;
		padding: 0 14px;
		background: var(--heat-100);
		color: #ffffff;
		font-size: 13px;
		font-weight: 700;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.perm-action.is-on {
		border-color: var(--accent-forest);
		background: color-mix(in srgb, var(--accent-forest) 10%, transparent);
		color: var(--accent-forest);
	}

	.perm-action:disabled {
		cursor: default;
	}

	.onboarding-footer {
		display: grid;
		gap: 18px;
	}

	.progress-dots {
		display: flex;
		height: 8px;
		align-items: center;
		gap: 7px;
	}

	.progress-dots button {
		width: 8px;
		height: 8px;
		border: 0;
		border-radius: 999px;
		background: var(--black-alpha-16);
		padding: 0;
		transition:
			width 180ms ease,
			background-color 180ms ease;
	}

	.progress-dots button.active {
		width: 28px;
		background: var(--heat-100);
	}

	.onboarding-actions {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr);
		gap: 10px;
	}

	.auth-actions {
		display: grid;
		gap: 10px;
	}

	.back-button,
	.next-button,
	.ghost-button {
		height: 52px;
		border-radius: 8px;
		font: inherit;
	}

	.back-button {
		display: grid;
		place-items: center;
		border: 1px solid var(--border-muted);
		background: #ffffff;
		color: var(--foreground);
	}

	.back-button:disabled {
		opacity: 0;
		pointer-events: none;
	}

	.next-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 9px;
		border: 1px solid var(--heat-100);
		background: var(--heat-100);
		color: #ffffff;
		font-size: 15px;
		font-weight: 750;
	}

	.ghost-button {
		border: 1px solid var(--border-muted);
		background: #ffffff;
		color: var(--foreground);
		font-size: 15px;
		font-weight: 700;
	}

	.native-onboarding :global(.spin) {
		animation: onboarding-spin 800ms linear infinite;
	}

	@keyframes onboarding-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-height: 700px) {
		.visual-stage {
			min-height: 220px;
		}

		.onboarding-visual {
			padding-block: 6px;
		}

		.onboarding-copy {
			min-height: 132px;
		}

		h1 {
			font-size: 28px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-dots button,
		.perm-action {
			transition: none;
		}

		.native-onboarding :global(.spin) {
			animation: none;
		}
	}
</style>
