<script lang="ts">
	import { navigating } from '$app/state';

	let progress = $state(0);
	let visible = $state(false);
	let animFrame: number | null = null;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let done = $state(false);

	const isNavigating = $derived(navigating.to !== null);

	function startTick() {
		function tick() {
			if (progress < 90) {
				progress += (90 - progress) * 0.08;
			}
			animFrame = requestAnimationFrame(tick);
		}
		animFrame = requestAnimationFrame(tick);
	}

	function stopTick() {
		if (animFrame !== null) {
			cancelAnimationFrame(animFrame);
			animFrame = null;
		}
	}

	function clearHideTimer() {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	$effect(() => {
		if (isNavigating) {
			clearHideTimer();
			done = false;
			progress = 12;
			visible = true;
			startTick();
		} else if (visible) {
			stopTick();
			progress = 100;
			done = true;
			hideTimer = setTimeout(() => {
				visible = false;
				progress = 0;
				done = false;
				hideTimer = null;
			}, 340);
		}

		return () => {
			stopTick();
			clearHideTimer();
		};
	});
</script>

{#if visible}
	<div class="nav-loader" class:done aria-hidden="true">
		<div class="nav-loader-bar" style:transform="scaleX({progress / 100})"></div>
	</div>
{/if}

<style>
	.nav-loader {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		z-index: 9999;
		pointer-events: none;
	}

	.nav-loader-bar {
		height: 100%;
		background: var(--heat-100);
		transform-origin: left;
		transition: transform 180ms cubic-bezier(0.25, 0.1, 0.25, 1);
		box-shadow: 0 0 6px rgba(250, 93, 25, 0.35);
	}

	.nav-loader.done .nav-loader-bar {
		transition:
			transform 100ms cubic-bezier(0.25, 0.1, 0.25, 1),
			opacity 260ms ease 60ms;
		opacity: 0;
	}
</style>
