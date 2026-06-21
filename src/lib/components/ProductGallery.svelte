<script lang="ts">
	import { ChevronLeft, ChevronRight, X, ZoomIn } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let {
		images,
		alt,
		discount = 0
	}: {
		images: string[];
		alt: string;
		discount?: number;
	} = $props();

	let index = $state(0);
	let lightbox = $state(false);
	let zoomed = $state(false);
	let origin = $state('50% 50%');
	let track = $state<HTMLDivElement | undefined>();

	const current = $derived(images[index] ?? images[0]);
	const hasMany = $derived(images.length > 1);

	function select(i: number) {
		index = ((i % images.length) + images.length) % images.length;
	}

	function openLightbox(i: number) {
		select(i);
		zoomed = false;
		origin = '50% 50%';
		lightbox = true;
	}

	function closeLightbox() {
		lightbox = false;
		zoomed = false;
	}

	function onTrackScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		const w = el.clientWidth || 1;
		index = Math.round(el.scrollLeft / w);
	}

	function moveZoom(event: PointerEvent) {
		if (!zoomed) return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		origin = `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
	}

	// Body scroll lock + keyboard nav while the lightbox is open.
	$effect(() => {
		if (!lightbox) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeLightbox();
			else if (event.key === 'ArrowRight') select(index + 1);
			else if (event.key === 'ArrowLeft') select(index - 1);
		};
		window.addEventListener('keydown', onKey);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="gallery">
	{#if discount >= 10}
		<span class="discount-badge">-{discount}% off</span>
	{/if}

	<!-- Mobile: swipeable snap carousel -->
	<div class="m-track" bind:this={track} onscroll={onTrackScroll}>
		{#each images as image, i (image)}
			<button
				type="button"
				class="m-slide"
				aria-label="Open image {i + 1} of {images.length}"
				onclick={() => openLightbox(i)}
			>
				<img src={image} {alt} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
			</button>
		{/each}
	</div>

	{#if hasMany}
		<div class="m-dots" aria-hidden="true">
			{#each images as image, i (image)}
				<span class="m-dot" class:is-active={i === index}></span>
			{/each}
		</div>
	{/if}

	<!-- Desktop: single main image with click-to-zoom -->
	<button type="button" class="d-main" aria-label="Zoom image" onclick={() => openLightbox(index)}>
		{#key current}
			<img src={current} {alt} fetchpriority="high" decoding="async" in:fade={{ duration: 160 }} />
		{/key}
		<span class="zoom-hint"><ZoomIn class="size-3.5" strokeWidth={2} /> Click to zoom</span>
	</button>

	{#if hasMany}
		<div class="thumbs">
			{#each images as image, i (image)}
				<button
					type="button"
					class="thumb"
					class:is-active={i === index}
					aria-label="Show image {i + 1}"
					aria-pressed={i === index}
					onclick={() => select(i)}
				>
					<img src={image} alt="" loading="lazy" decoding="async" />
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if lightbox}
	<div class="lb" role="dialog" aria-modal="true" aria-label="Image viewer">
		<div
			class="lb-backdrop"
			onclick={closeLightbox}
			role="presentation"
			in:fade={{ duration: 160 }}
		></div>

		<button type="button" class="lb-close" aria-label="Close" onclick={closeLightbox}>
			<X class="size-5" />
		</button>

		<div class="lb-stage" in:fade={{ duration: 160 }}>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
			<img
				src={current}
				{alt}
				class="lb-img"
				class:is-zoomed={zoomed}
				style:transform-origin={origin}
				onclick={() => (zoomed = !zoomed)}
				onpointermove={moveZoom}
				draggable="false"
			/>
		</div>

		{#if hasMany}
			<button
				type="button"
				class="lb-nav lb-prev"
				aria-label="Previous"
				onclick={() => select(index - 1)}
			>
				<ChevronLeft class="size-6" />
			</button>
			<button
				type="button"
				class="lb-nav lb-next"
				aria-label="Next"
				onclick={() => select(index + 1)}
			>
				<ChevronRight class="size-6" />
			</button>
			<div class="lb-count">{index + 1} / {images.length}</div>
		{/if}
	</div>
{/if}

<style>
	.gallery {
		position: relative;
		padding: 12px;
	}

	@media (min-width: 640px) {
		.gallery {
			padding: 24px;
		}
	}

	.discount-badge {
		position: absolute;
		top: 14px;
		left: 14px;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		border-radius: 4px;
		background: var(--heat-100);
		padding: 4px 10px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: #fff;
		box-shadow: 0 2px 8px 0 var(--heat-40);
	}

	/* ── Mobile swipe carousel ── */
	.m-track {
		display: flex;
		scroll-snap-type: x mandatory;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
	}

	.m-track::-webkit-scrollbar {
		display: none;
	}

	.m-slide {
		display: grid;
		flex: 0 0 100%;
		scroll-snap-align: center;
		place-items: center;
		height: clamp(240px, 62vw, 320px);
		padding: 4px;
	}

	.m-slide img {
		max-height: 100%;
		max-width: 100%;
		object-fit: contain;
	}

	.m-dots {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin-top: 10px;
	}

	.m-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--black-alpha-20);
		transition:
			width 200ms var(--motion-ease),
			background-color 200ms var(--motion-ease);
	}

	.m-dot.is-active {
		width: 18px;
		background: var(--heat-100);
	}

	/* ── Desktop main + thumbs ── */
	.d-main {
		display: none;
	}

	.thumbs {
		display: none;
	}

	@media (min-width: 640px) {
		.m-track,
		.m-dots {
			display: none;
		}

		.d-main {
			position: relative;
			display: grid;
			width: 100%;
			height: clamp(300px, 34vw, 420px);
			place-items: center;
			cursor: zoom-in;
		}

		.d-main img {
			max-height: 100%;
			max-width: 100%;
			object-fit: contain;
		}

		.zoom-hint {
			position: absolute;
			right: 10px;
			bottom: 10px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
			border-radius: 6px;
			background: var(--black-alpha-72);
			padding: 4px 8px;
			font-size: 11px;
			font-weight: 500;
			color: #fff;
			opacity: 0;
			transition: opacity 160ms var(--motion-ease);
		}

		.d-main:hover .zoom-hint {
			opacity: 1;
		}

		.thumbs {
			display: flex;
			justify-content: center;
			gap: 8px;
			margin-top: 16px;
		}

		.thumb {
			display: grid;
			width: 56px;
			height: 56px;
			flex-shrink: 0;
			place-items: center;
			overflow: hidden;
			border: 2px solid var(--border-faint);
			border-radius: 8px;
			background: #fff;
			padding: 4px;
			opacity: 0.55;
			transition:
				border-color 200ms var(--motion-ease),
				opacity 200ms var(--motion-ease);
		}

		.thumb:hover {
			opacity: 1;
		}

		.thumb.is-active {
			border-color: var(--heat-100);
			opacity: 1;
			box-shadow: 0 0 0 2px var(--heat-8);
		}

		.thumb img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}
	}

	/* ── Lightbox ── */
	.lb {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.lb-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(10, 10, 10, 0.92);
		backdrop-filter: blur(2px);
	}

	.lb-stage {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: max(16px, env(safe-area-inset-top)) 16px 16px;
		overflow: hidden;
	}

	.lb-img {
		max-width: min(94vw, 1100px);
		max-height: 86vh;
		object-fit: contain;
		cursor: zoom-in;
		transition: transform 200ms var(--motion-ease-out);
		touch-action: none;
		user-select: none;
	}

	.lb-img.is-zoomed {
		transform: scale(2.4);
		cursor: zoom-out;
	}

	.lb-close {
		position: absolute;
		top: max(12px, env(safe-area-inset-top));
		right: 12px;
		z-index: 2;
		display: grid;
		width: 42px;
		height: 42px;
		place-items: center;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		transition: background-color 160ms var(--motion-ease);
	}

	.lb-close:hover {
		background: rgba(255, 255, 255, 0.22);
	}

	.lb-nav {
		position: absolute;
		top: 50%;
		z-index: 2;
		display: grid;
		width: 44px;
		height: 44px;
		translate: 0 -50%;
		place-items: center;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
		transition: background-color 160ms var(--motion-ease);
	}

	.lb-nav:hover {
		background: rgba(255, 255, 255, 0.22);
	}

	.lb-prev {
		left: 12px;
	}

	.lb-next {
		right: 12px;
	}

	.lb-count {
		position: absolute;
		bottom: max(14px, env(safe-area-inset-bottom));
		left: 50%;
		z-index: 2;
		translate: -50% 0;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		padding: 4px 12px;
		font-size: 12px;
		font-weight: 500;
		color: #fff;
	}

	@media (prefers-reduced-motion: reduce) {
		.lb-img,
		.m-dot {
			transition: none;
		}
	}
</style>
