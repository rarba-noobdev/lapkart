<script lang="ts">
	import { onMount } from 'svelte';
	import { Gift } from '@lucide/svelte';

	/*
	 * GPay-style scratch card. The prize is NOT known to the client until the
	 * reveal RPC runs — `onReveal` is called once the user has scratched ~60% of
	 * the foil, and the parent fetches the real value from reveal_scratch_card().
	 * The canvas is pure presentation; the money math is server-side.
	 */
	let {
		revealed = false,
		value = null,
		onReveal
	}: {
		revealed?: boolean;
		value?: number | null;
		onReveal: () => Promise<number | null>;
	} = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let scratching = false;
	let done = $state(false);
	let revealedValue = $state<number | null>(null);
	let busy = false;

	function setupCanvas(node: HTMLCanvasElement) {
		const ctx = node.getContext('2d');
		if (!ctx) return;
		const rect = node.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		node.width = rect.width * dpr;
		node.height = rect.height * dpr;
		ctx.scale(dpr, dpr);
		// Foil
		const grad = ctx.createLinearGradient(0, 0, rect.width, rect.height);
		grad.addColorStop(0, '#b9c2cc');
		grad.addColorStop(0.5, '#e6ebf0');
		grad.addColorStop(1, '#aab4bf');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, rect.width, rect.height);
		ctx.fillStyle = 'rgba(0,0,0,0.32)';
		ctx.font = '600 13px system-ui, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('Scratch here', rect.width / 2, rect.height / 2 + 4);
		ctx.globalCompositeOperation = 'destination-out';
	}

	function pointerPos(node: HTMLCanvasElement, event: PointerEvent) {
		const rect = node.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function scratchAt(node: HTMLCanvasElement, x: number, y: number) {
		const ctx = node.getContext('2d');
		if (!ctx) return;
		ctx.beginPath();
		ctx.arc(x, y, 22, 0, Math.PI * 2);
		ctx.fill();
	}

	function scratchedFraction(node: HTMLCanvasElement) {
		const ctx = node.getContext('2d');
		if (!ctx) return 0;
		const { width, height } = node;
		const data = ctx.getImageData(0, 0, width, height).data;
		let clear = 0;
		// Sample every 64th pixel for speed.
		for (let i = 3; i < data.length; i += 256) {
			if (data[i] === 0) clear++;
		}
		return clear / (data.length / 256);
	}

	async function maybeReveal(node: HTMLCanvasElement) {
		if (done || busy) return;
		if (scratchedFraction(node) < 0.6) return;
		busy = true;
		try {
			const result = await onReveal();
			revealedValue = result;
			done = true;
		} finally {
			busy = false;
		}
	}

	function handleDown(event: PointerEvent) {
		if (!canvas || done) return;
		scratching = true;
		canvas.setPointerCapture(event.pointerId);
		const { x, y } = pointerPos(canvas, event);
		scratchAt(canvas, x, y);
	}

	function handleMove(event: PointerEvent) {
		if (!scratching || !canvas || done) return;
		const { x, y } = pointerPos(canvas, event);
		scratchAt(canvas, x, y);
	}

	function handleUp() {
		if (!canvas) return;
		scratching = false;
		void maybeReveal(canvas);
	}

	onMount(() => {
		done = revealed;
		revealedValue = value;
		if (canvas && !done) setupCanvas(canvas);
	});
</script>

<div
	class="relative h-32 w-full overflow-hidden rounded-xl border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white"
>
	<!-- Prize underneath -->
	<div class="absolute inset-0 grid place-items-center">
		{#if done}
			<div class="text-center">
				<Gift class="mx-auto size-6 text-[var(--heat-100)]" strokeWidth={2} />
				<p class="mt-1 text-[20px] font-semibold text-foreground">
					{#if revealedValue && revealedValue > 0}
						&#8377;{revealedValue} credit
					{:else}
						Better luck next time
					{/if}
				</p>
				{#if revealedValue && revealedValue > 0}
					<p class="text-[11px] text-[var(--black-alpha-48)]">Added to your store credit</p>
				{/if}
			</div>
		{:else}
			<p class="text-[12px] font-medium text-[var(--heat-100)]">Your reward is hidden</p>
		{/if}
	</div>

	{#if !done}
		<canvas
			bind:this={canvas}
			class="absolute inset-0 h-full w-full cursor-pointer touch-none"
			onpointerdown={handleDown}
			onpointermove={handleMove}
			onpointerup={handleUp}
			onpointerleave={handleUp}
		></canvas>
	{/if}
</div>
