<script lang="ts">
	let {
		class: className = '',
		rounded = 'md'
	}: {
		class?: string;
		rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'none';
	} = $props();

	const radius: Record<string, string> = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		xl: 'rounded-xl',
		full: 'rounded-full'
	};
</script>

<div class={['skeleton', radius[rounded], className]} aria-hidden="true"></div>

<style>
	.skeleton {
		position: relative;
		overflow: hidden;
		background: var(--black-alpha-4, rgba(0, 0, 0, 0.04));
	}

	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		transform: translateX(-100%);
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.55) 50%,
			transparent 100%
		);
		animation: skeleton-sweep 1.4s ease-in-out infinite;
	}

	@keyframes skeleton-sweep {
		100% {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton::after {
			animation: none;
		}
	}
</style>
