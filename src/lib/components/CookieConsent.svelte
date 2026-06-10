<script lang="ts">
	import { resolve } from '$app/paths';
	import { cookieConsent, setCookieConsent } from '$lib/cookie-consent.svelte';

	const show = $derived(cookieConsent.value === null);
</script>

{#if show}
	<div
		class="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] z-50 mx-auto w-full max-w-3xl px-4 md:bottom-4"
		role="dialog"
		aria-live="polite"
		aria-label="Cookie consent"
	>
		<div
			class="rounded-2xl border border-[var(--border-faint)] bg-white p-4 shadow-xl md:flex md:items-center md:gap-4"
		>
			<p class="text-sm text-[var(--text-secondary)] md:flex-1">
				We use cookies for analytics to understand how the store is used and improve it. We never
				set analytics cookies until you accept. See our
				<a class="font-medium text-foreground underline" href={resolve('/privacy')}>Privacy Policy</a
				>.
			</p>
			<div class="mt-3 flex gap-2 md:mt-0 md:shrink-0">
				<button
					type="button"
					class="flex-1 rounded-full border border-[var(--border-faint)] px-4 py-2 text-sm font-medium text-foreground hover:bg-[var(--background-base)] md:flex-none"
					onclick={() => setCookieConsent('denied')}
				>
					Reject
				</button>
				<button
					type="button"
					class="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90 md:flex-none"
					onclick={() => setCookieConsent('granted')}
				>
					Accept
				</button>
			</div>
		</div>
	</div>
{/if}
