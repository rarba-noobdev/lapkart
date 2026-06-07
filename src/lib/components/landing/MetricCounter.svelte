<script lang="ts">
	import { onMount } from 'svelte';

	let {
		value,
		prefix = '',
		suffix = '',
		duration = 850
	}: {
		value: number;
		prefix?: string;
		suffix?: string;
		duration?: number;
	} = $props();

	let displayValue = $state(0);
	let formattedValue = $derived(Math.round(displayValue).toLocaleString('en-IN'));

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (prefersReducedMotion || duration <= 0) {
			displayValue = value;
			return;
		}

		let frame = 0;
		const start = performance.now();

		const tick = (now: number) => {
			const progress = Math.min((now - start) / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 4);
			displayValue = value * eased;

			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};

		frame = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frame);
	});
</script>

<span>{prefix}{formattedValue}{suffix}</span>
