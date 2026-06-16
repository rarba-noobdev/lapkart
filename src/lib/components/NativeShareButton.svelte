<script lang="ts">
	import { Check, Share2 } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { nativeImpact, shareUrl } from '$lib/native/capacitor';

	type Props = {
		title: string;
		text?: string;
		url: string;
		label?: string;
		className?: string;
	};

	let { title, text = '', url, label = 'Share', className = '' }: Props = $props();
	let sharing = $state(false);
	let copied = $state(false);

	async function handleShare() {
		if (sharing) return;
		sharing = true;
		copied = false;

		try {
			await shareUrl({ title, text, url });
			copied = true;
			void nativeImpact();
			window.setTimeout(() => (copied = false), 1500);
		} catch {
			// User cancelled the native share sheet or clipboard is unavailable.
		} finally {
			sharing = false;
		}
	}
</script>

<button
	type="button"
	class={[
		'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-40)] hover:text-[var(--heat-100)] disabled:opacity-60',
		className
	]}
	title={label}
	aria-label={label}
	disabled={sharing}
	onclick={handleShare}
>
	{#if copied}
		<span transition:fly={{ y: 4, duration: 120 }} class="inline-flex items-center gap-1.5">
			<Check class="size-3.5" strokeWidth={2.4} />
			Shared
		</span>
	{:else}
		<Share2 class="size-3.5" strokeWidth={2.2} />
		<span class="hidden sm:inline">{label}</span>
	{/if}
</button>
