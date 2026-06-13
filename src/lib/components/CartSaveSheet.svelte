<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { MessageCircle, X } from '@lucide/svelte';
	import { page } from '$app/state';

	/*
	 * Exit-intent helper. When the customer leaves the cart with items still in
	 * it (tab hidden / mobile back), offer to send the cart to themselves on
	 * WhatsApp so they can come back. No discount begging — just a reminder with
	 * the item list and a link back to the store. Shown at most once per visit.
	 */
	let { items }: { items: { title: string; qty: number }[] } = $props();

	let open = $state(false);
	let shownThisVisit = false;

	const message = $derived.by(() => {
		const lines = items.map((item) => `• ${item.title} x${item.qty}`).join('\n');
		const origin = page.url.origin;
		return `My LapKart cart:\n${lines}\n\nFinish here: ${origin}/cart`;
	});
	const shareUrl = $derived(`https://wa.me/?text=${encodeURIComponent(message)}`);

	function maybeOpen() {
		if (shownThisVisit || !items.length || document.visibilityState !== 'hidden') return;
		shownThisVisit = true;
		open = true;
	}

	onMount(() => {
		document.addEventListener('visibilitychange', maybeOpen);
		return () => document.removeEventListener('visibilitychange', maybeOpen);
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 z-[75] flex items-end justify-center bg-black/40"
		transition:fade={{ duration: 150 }}
		onclick={(event) => {
			if (event.target === event.currentTarget) open = false;
		}}
	>
		<div
			class="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
			transition:fly={{ y: 240, duration: 240 }}
			role="dialog"
			aria-modal="true"
			aria-label="Save your cart"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="text-[16px] font-medium text-foreground">Save your cart?</h2>
					<p class="mt-1 text-[12px] text-[var(--black-alpha-56)]">
						Send it to yourself on WhatsApp and pick up where you left off.
					</p>
				</div>
				<button
					type="button"
					aria-label="Close"
					class="grid size-8 shrink-0 place-items-center rounded-md text-[var(--black-alpha-48)] hover:bg-[var(--background-lighter)]"
					onclick={() => (open = false)}
				>
					<X class="size-4" />
				</button>
			</div>
			<a
				href={shareUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="button button-primary mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-medium text-white"
				onclick={() => (open = false)}
			>
				<MessageCircle class="size-4" /> Send to WhatsApp
			</a>
		</div>
	</div>
{/if}
