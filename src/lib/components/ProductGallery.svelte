<script lang="ts">
	import { onMount } from 'svelte';
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

	const ZOOM = 2.6;
	const PANEL_W = 460;

	let index = $state(0);
	let lightbox = $state(false);
	let lbZoomed = $state(false);
	let canHoverZoom = $state(false);

	let mainWrap = $state<HTMLDivElement>();
	let mainImg = $state<HTMLImageElement>();
	let track = $state<HTMLDivElement>();

	type ZoomState = {
		show: boolean;
		lensX: number;
		lensY: number;
		lensW: number;
		lensH: number;
		panelTop: number;
		panelH: number;
		bgSize: string;
		bgPos: string;
	};
	let zoom = $state<ZoomState>({
		show: false,
		lensX: 0,
		lensY: 0,
		lensW: 0,
		lensH: 0,
		panelTop: 0,
		panelH: 0,
		bgSize: '0px 0px',
		bgPos: '0% 0%'
	});

	const current = $derived(images[index] ?? images[0]);
	const hasMany = $derived(images.length > 1);

	const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

	function select(i: number) {
		index = ((i % images.length) + images.length) % images.length;
	}

	function openLightbox(i: number) {
		select(i);
		lbZoomed = false;
		lightbox = true;
	}

	function closeLightbox() {
		lightbox = false;
		lbZoomed = false;
	}

	function onTrackScroll(event: Event) {
		const el = event.currentTarget as HTMLDivElement;
		const w = el.clientWidth || 1;
		index = Math.round(el.scrollLeft / w);
	}

	// ── Desktop hover zoom (Amazon-style lens + side magnifier) ──
	function onMainMove(event: PointerEvent) {
		if (!canHoverZoom || !mainImg || !mainWrap) return;
		const r = mainImg.getBoundingClientRect();
		const wrap = mainWrap.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return;

		const panelH = r.height;
		const lensW = PANEL_W / ZOOM;
		const lensH = panelH / ZOOM;

		const cx = clamp((event.clientX - r.left) / r.width, 0, 1);
		const cy = clamp((event.clientY - r.top) / r.height, 0, 1);

		const maxLx = Math.max(0, r.width - lensW);
		const maxLy = Math.max(0, r.height - lensH);
		const lx = clamp(cx * r.width - lensW / 2, 0, maxLx);
		const ly = clamp(cy * r.height - lensH / 2, 0, maxLy);

		zoom = {
			show: true,
			lensX: r.left - wrap.left + lx,
			lensY: r.top - wrap.top + ly,
			lensW,
			lensH,
			panelTop: r.top - wrap.top,
			panelH,
			bgSize: `${r.width * ZOOM}px ${r.height * ZOOM}px`,
			bgPos: `${maxLx ? (lx / maxLx) * 100 : 0}% ${maxLy ? (ly / maxLy) * 100 : 0}%`
		};
	}

	function endHoverZoom() {
		zoom = { ...zoom, show: false };
	}

	onMount(() => {
		const mq = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
		const update = () => (canHoverZoom = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

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

	<!-- Desktop: main image with hover lens zoom + side magnifier panel -->
	<div class="d-zone">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="d-main"
			bind:this={mainWrap}
			onpointermove={onMainMove}
			onpointerleave={endHoverZoom}
			onclick={() => openLightbox(index)}
			role="button"
			tabindex="0"
			aria-label="Zoom image"
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					openLightbox(index);
				}
			}}
		>
			{#key current}
				<img
					bind:this={mainImg}
					src={current}
					{alt}
					fetchpriority="high"
					decoding="async"
					draggable="false"
					in:fade={{ duration: 160 }}
				/>
			{/key}

			{#if zoom.show}
				<span
					class="zoom-lens"
					style:left="{zoom.lensX}px"
					style:top="{zoom.lensY}px"
					style:width="{zoom.lensW}px"
					style:height="{zoom.lensH}px"
				></span>
			{:else}
				<span class="zoom-hint"><ZoomIn class="size-3.5" strokeWidth={2} /> Hover to zoom</span>
			{/if}
		</div>

		{#if zoom.show}
			<div
				class="zoom-panel"
				style:top="{zoom.panelTop}px"
				style:height="{zoom.panelH}px"
				style:background-image="url('{current}')"
				style:background-size={zoom.bgSize}
				style:background-position={zoom.bgPos}
			></div>
		{/if}
	</div>

	{#if hasMany}
		<div class="thumbs">
			{#each images as image, i (image)}
				<button
					type="button"
					class="thumb"
					class:is-active={i === index}
					aria-label="Show image {i + 1}"
					aria-pressed={i === index}
					onmouseenter={() => select(i)}
					onclick={() => select(i)}
				>
					<img src={image} alt="" loading="lazy" decoding="async" />
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if lightbox}
	<div
		class="lb"
		role="dialog"
		aria-modal="true"
		aria-label="Image viewer"
		in:fade={{ duration: 160 }}
	>
		<!-- Scroll + click-to-close surface. Clicking anywhere except the image closes. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="lb-scroll"
			class:is-zoomed={lbZoomed}
			onclick={(e) => {
				if (e.target === e.currentTarget) closeLightbox();
			}}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_no_noninteractive_element_interactions -->
			<img
				src={current}
				{alt}
				class="lb-img"
				class:is-zoomed={lbZoomed}
				draggable="false"
				onclick={(e) => {
					e.stopPropagation();
					lbZoomed = !lbZoomed;
				}}
			/>
		</div>

		<button type="button" class="lb-close" aria-label="Close" onclick={closeLightbox}>
			<X class="size-5" />
		</button>

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
		z-index: 4;
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
	.d-zone {
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

		.d-zone {
			position: relative;
			display: block;
		}

		.d-main {
			position: relative;
			display: grid;
			width: 100%;
			height: clamp(300px, 34vw, 420px);
			place-items: center;
			cursor: crosshair;
		}

		.d-main img {
			max-height: 100%;
			max-width: 100%;
			object-fit: contain;
			user-select: none;
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
			pointer-events: none;
		}

		.d-main:hover .zoom-hint {
			opacity: 1;
		}

		.zoom-lens {
			position: absolute;
			z-index: 3;
			border: 1px solid var(--heat-100);
			background: var(--heat-12);
			pointer-events: none;
		}

		/* Magnifier panel overlays the info column to the right, like Amazon. */
		.zoom-panel {
			position: absolute;
			left: calc(100% + 16px);
			z-index: 30;
			width: 460px;
			max-width: 46vw;
			border: 1px solid var(--border-faint);
			border-radius: 10px;
			background-color: #fff;
			background-repeat: no-repeat;
			box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.3);
			pointer-events: none;
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
		background: rgba(10, 10, 10, 0.92);
		backdrop-filter: blur(2px);
	}

	/* Full-surface scroll container: empty-space clicks close, image clicks zoom. */
	.lb-scroll {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		cursor: zoom-out;
	}

	.lb-scroll.is-zoomed {
		align-items: flex-start;
		justify-content: flex-start;
	}

	.lb-img {
		max-width: min(94vw, 1100px);
		max-height: 86vh;
		object-fit: contain;
		cursor: zoom-in;
		user-select: none;
		transition: transform 200ms var(--motion-ease-out);
	}

	/* Zoomed: grow past the viewport so the scroll container lets you pan. */
	.lb-img.is-zoomed {
		max-width: none;
		max-height: none;
		width: min(190vw, 1800px);
		height: auto;
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
		position: fixed;
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
		position: fixed;
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
