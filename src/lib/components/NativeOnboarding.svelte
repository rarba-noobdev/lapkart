<script lang="ts">
	import { asset } from '$app/paths';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import {
		ArrowLeft,
		ArrowRight,
		BadgeCheck,
		Banknote,
		CreditCard,
		Search,
		ShieldCheck,
		Smartphone,
		Sparkles
	} from '@lucide/svelte';
	import { isNativeApp, nativeImpact } from '$lib/native/capacitor';

	const storageKey = 'lapkart_native_onboarding_v1';
	const slides = [
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

	let visible = $state(false);
	let step = $state(0);
	const current = $derived(slides[step]);
	const finalStep = $derived(step === slides.length - 1);

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
		if (finalStep) {
			finish();
			return;
		}
		step += 1;
		void nativeImpact();
	}

	function previous() {
		if (step === 0) return;
		step -= 1;
		void nativeImpact();
	}
</script>

{#if visible}
	<div class="native-onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" transition:fade={{ duration: 180 }}>
		<header class="onboarding-header">
			<img src={asset('/brand/lapkart-logo.svg')} alt="LapKart" class="onboarding-logo" />
			<button type="button" class="skip-button" onclick={finish}>Skip</button>
		</header>

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
			<p class="onboarding-eyebrow">{current.eyebrow}</p>
			<h1 id="onboarding-title">{current.title}</h1>
			<p class="onboarding-body">{current.body}</p>
		</section>

		<footer class="onboarding-footer">
			<div class="progress-dots" aria-label={`Step ${step + 1} of ${slides.length}`}>
				{#each slides as _, index (index)}
					<button
						type="button"
						class:active={index === step}
						aria-label={`Go to step ${index + 1}`}
						onclick={() => (step = index)}
					></button>
				{/each}
			</div>
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
					<span>{finalStep ? 'Start shopping' : 'Next'}</span>
					<ArrowRight size={20} strokeWidth={2.1} />
				</button>
			</div>
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
		color: #171717;
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
		color: #595959;
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
		border: 1px solid #dedede;
		border-radius: 8px;
		padding: 0 16px;
		color: #737373;
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
		border: 1px solid #ececec;
		border-radius: 8px;
		padding: 16px;
		background: #f8f8f8;
	}

	.part-grid strong,
	.fitment-lines strong {
		overflow-wrap: anywhere;
		font-size: 14px;
		font-weight: 700;
	}

	.part-grid span,
	.fitment-lines span {
		color: #727272;
		font-size: 12px;
	}

	.fitment-mark {
		display: grid;
		place-items: center;
		gap: 14px;
		color: #ff4d0a;
	}

	.fitment-mark > span {
		display: flex;
		align-items: center;
		gap: 7px;
		color: #171717;
		font-size: 14px;
		font-weight: 700;
	}

	.fitment-lines {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 9px 18px;
		border-top: 1px solid #e9e9e9;
		border-bottom: 1px solid #e9e9e9;
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
		border: 1px solid #e7e7e7;
		border-radius: 8px;
		padding: 18px 8px;
		background: #f8f8f8;
		font-size: 12px;
		font-weight: 700;
	}

	.payment-orbit .payment-main {
		grid-column: 2;
		grid-row: 1 / span 2;
		min-height: 116px;
		border-color: #ff4d0a;
		background: #ff4d0a;
		color: #ffffff;
	}

	.onboarding-copy {
		min-height: 154px;
		padding: 4px 0 18px;
	}

	.onboarding-eyebrow {
		margin: 0 0 8px;
		color: #ff4d0a;
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
		color: #676767;
		font-size: 15px;
		line-height: 1.55;
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
		background: #d7d7d7;
		padding: 0;
		transition: width 180ms ease, background-color 180ms ease;
	}

	.progress-dots button.active {
		width: 28px;
		background: #ff4d0a;
	}

	.onboarding-actions {
		display: grid;
		grid-template-columns: 48px minmax(0, 1fr);
		gap: 10px;
	}

	.back-button,
	.next-button {
		height: 52px;
		border-radius: 8px;
		font: inherit;
	}

	.back-button {
		display: grid;
		place-items: center;
		border: 1px solid #dedede;
		background: #ffffff;
		color: #232323;
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
		border: 1px solid #ff4d0a;
		background: #ff4d0a;
		color: #ffffff;
		font-size: 15px;
		font-weight: 750;
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
		.progress-dots button {
			transition: none;
		}
	}
</style>
