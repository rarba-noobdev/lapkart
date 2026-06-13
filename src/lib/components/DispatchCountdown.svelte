<script lang="ts">
	import { onMount } from 'svelte';
	import { Clock } from '@lucide/svelte';
	import { MANUAL_DISPATCH_CUTOFF_HOUR_IST } from '$lib/shipping';

	/*
	 * Honest dispatch countdown. Shows the real time remaining until today's
	 * same-day-ship cutoff (app_settings.manual_cutoff_hour_ist, mirrored in
	 * shipping.ts). After the cutoff it switches to "Ships tomorrow". No
	 * fabricated timer — the number is derived from the actual cutoff and the
	 * current time in IST.
	 */
	let { cutoffHour = MANUAL_DISPATCH_CUTOFF_HOUR_IST }: { cutoffHour?: number } = $props();

	let now = $state(Date.now());

	onMount(() => {
		const timer = setInterval(() => {
			now = Date.now();
		}, 30_000);
		return () => clearInterval(timer);
	});

	// Current wall-clock time in IST (UTC+5:30), independent of the device tz.
	const istParts = $derived.by(() => {
		const ist = new Date(now + 5.5 * 60 * 60 * 1000);
		return { hour: ist.getUTCHours(), minute: ist.getUTCMinutes() };
	});

	const beforeCutoff = $derived(istParts.hour < cutoffHour);

	const remaining = $derived.by(() => {
		if (!beforeCutoff) return null;
		const minutesLeft = (cutoffHour - istParts.hour) * 60 - istParts.minute;
		const hours = Math.floor(minutesLeft / 60);
		const minutes = minutesLeft % 60;
		return { hours, minutes };
	});
</script>

<div
	class="inline-flex items-center gap-1.5 rounded-md border border-[var(--heat-16)] bg-[var(--heat-4)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--heat-100)]"
>
	<Clock class="size-3.5 shrink-0" strokeWidth={2.2} />
	{#if remaining}
		<span>
			Order in
			{#if remaining.hours > 0}{remaining.hours}h
			{/if}{remaining.minutes}m to ship today
		</span>
	{:else}
		<span>Ships tomorrow</span>
	{/if}
</div>
