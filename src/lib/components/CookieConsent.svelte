<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { cookieConsent, loadStoredConsent, setCookieConsent } from '$lib/cookie-consent.svelte';

	let storageChecked = $state(false);
	let legalChecked = $state(false);
	const show = $derived(storageChecked && cookieConsent.value === null);

	onMount(() => {
		loadStoredConsent();
		storageChecked = true;
	});

	function acceptAnalyticsCookies() {
		if (!legalChecked) return;
		setCookieConsent('granted');
	}
</script>

{#if show}
	<div
		class="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] z-50 mx-auto w-full max-w-3xl px-4 md:bottom-4"
		role="dialog"
		aria-live="polite"
		aria-label="Cookie consent"
	>
		<div class="rounded-2xl border border-[var(--border-faint)] bg-white p-4 shadow-xl">
			<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
				<div class="grid gap-2">
					<p class="text-sm text-[var(--text-secondary)]">
						We use analytics cookies only after you accept them.
					</p>
					<label class="flex items-start gap-2 text-[12px] leading-relaxed text-[var(--black-alpha-56)]">
						<input
							type="checkbox"
							bind:checked={legalChecked}
							class="mt-0.5 size-4 shrink-0 accent-[var(--heat-100)]"
						/>
						<span>
							I have read the
							<a class="font-medium text-foreground underline" href={resolve('/terms')}>Terms</a>
							and
							<a class="font-medium text-foreground underline" href={resolve('/privacy')}
								>Privacy Policy</a
							>.
						</span>
					</label>
				</div>
				<div class="flex gap-2 md:shrink-0">
					<button
						type="button"
						class="flex-1 rounded-full border border-[var(--border-faint)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--background-base)] md:flex-none"
						onclick={() => setCookieConsent('denied')}
					>
						Reject
					</button>
					<button
						type="button"
						class="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45 md:flex-none"
						disabled={!legalChecked}
						onclick={acceptAnalyticsCookies}
					>
						Accept
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
