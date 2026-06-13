<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { WifiOff } from '@lucide/svelte';

	// Shows a quiet banner when the browser goes offline. The cart lives in
	// localStorage, so it survives — the message just reassures the customer.
	let offline = $state(false);

	onMount(() => {
		const update = () => (offline = !navigator.onLine);
		update();
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});
</script>

{#if offline}
	<div
		class="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-[var(--accent-black)] px-4 py-2 text-[12px] font-medium text-white"
		transition:fly={{ y: -40, duration: 200 }}
		role="status"
	>
		<WifiOff class="size-3.5 shrink-0" strokeWidth={2.2} />
		You're offline — your cart is saved on this device.
	</div>
{/if}
