<script lang="ts">
	import { updated } from '$app/state';
	import { RefreshCw, X } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { isNativeApp, nativeImpact } from '$lib/native/capacitor';

	let native = $state(false);
	let dismissed = $state(false);
	const showPrompt = $derived(native && updated.current && !dismissed);

	onMount(() => {
		let timer: ReturnType<typeof setInterval> | undefined;
		void isNativeApp().then((value) => {
			native = value;
			if (!value) return;
			timer = setInterval(() => void updated.check().catch(() => false), 60000);
			void updated.check().catch(() => false);
		});

		return () => {
			if (timer) clearInterval(timer);
		};
	});

	function refreshApp() {
		void nativeImpact();
		window.location.reload();
	}
</script>

{#if showPrompt}
	<div
		class="fixed right-3 bottom-[calc(92px+env(safe-area-inset-bottom))] left-3 z-[80] rounded-lg border border-[var(--heat-20)] bg-white p-3 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.32)] md:right-4 md:bottom-4 md:left-auto md:w-[360px]"
		role="status"
		transition:fly={{ y: 18, duration: 180 }}
	>
		<div class="flex items-start gap-3">
			<div class="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
				<RefreshCw class="size-4" strokeWidth={2.3} />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-label-medium text-foreground">Update available</p>
				<p class="text-body-small mt-0.5 text-[var(--black-alpha-56)]">
					Refresh LapKart to load the latest catalog and checkout fixes.
				</p>
				<button
					type="button"
					class="button button-primary mt-2 inline-flex h-8 items-center rounded-md px-3 text-[12px] font-medium text-white"
					onclick={refreshApp}
				>
					Refresh
				</button>
			</div>
			<button
				type="button"
				class="grid size-8 shrink-0 place-items-center rounded-md text-[var(--black-alpha-48)] transition-colors hover:bg-[var(--black-alpha-4)] hover:text-foreground"
				aria-label="Dismiss update prompt"
				onclick={() => (dismissed = true)}
			>
				<X class="size-4" />
			</button>
		</div>
	</div>
{/if}
