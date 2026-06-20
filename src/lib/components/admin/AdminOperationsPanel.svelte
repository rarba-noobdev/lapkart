<script lang="ts">
	import { Maximize2, Minimize2 } from '@lucide/svelte';
	import { nativeImpact } from '$lib/native/capacitor';
	import AdminOrdersManager from './AdminOrdersManager.svelte';
	import FulfillmentQueue from './FulfillmentQueue.svelte';
	import type { AdminIcon, OperationsSection } from './admin-page-types';

	type Section = {
		id: OperationsSection;
		label: string;
		icon: AdminIcon;
	};

	type Props = {
		sections: Section[];
		operationsSection: OperationsSection;
		pendingFulfillment: number;
		initialFilter: string | null;
		initialSearch: string | null;
		initialSelectId: string | null;
		setOperationsSection: (section: OperationsSection) => void;
	};

	let {
		sections,
		operationsSection,
		pendingFulfillment,
		initialFilter,
		initialSearch,
		initialSelectId,
		setOperationsSection
	}: Props = $props();

	let fullscreen = $state(false);

	const activeSectionLabel = $derived(
		sections.find((section) => section.id === operationsSection)?.label ?? 'Operations'
	);

	function toggleFullscreen() {
		fullscreen = !fullscreen;
		void nativeImpact();
	}

	function exitFullscreen() {
		if (!fullscreen) return;
		fullscreen = false;
	}

	// Lock body scroll + close on Escape while the full-screen overlay is open,
	// mirroring the catalog spreadsheet's full-screen behaviour.
	$effect(() => {
		if (!fullscreen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				exitFullscreen();
			}
		};
		window.addEventListener('keydown', onKeydown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<div class={fullscreen ? 'operations-fs' : 'space-y-4'}>
	<div
		class={fullscreen
			? 'flex items-center justify-between gap-3 border-b border-[var(--border-faint)] bg-gradient-to-b from-white to-[var(--background-lighter)] px-4 py-3'
			: 'flex flex-wrap items-center justify-between gap-3'}
	>
		<div class="flex min-w-0 items-center gap-3">
			{#if fullscreen}
				<h2 class="hidden text-[14px] font-semibold tracking-tight text-foreground sm:block">
					{activeSectionLabel}
				</h2>
			{/if}
			<div
				class="inline-flex rounded-lg border border-[var(--border-faint)] bg-white p-1"
				role="tablist"
				aria-label="Operations sections"
			>
				{#each sections as section (section.id)}
					{@const Icon = section.icon}
					<button
						type="button"
						role="tab"
						aria-selected={operationsSection === section.id}
						class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors {operationsSection ===
						section.id
							? 'bg-[var(--heat-100)] text-white'
							: 'text-[var(--black-alpha-56)] hover:text-foreground'}"
						onclick={() => setOperationsSection(section.id)}
					>
						<Icon class="size-3.5" strokeWidth={2} />
						{section.label}
						{#if section.id === 'fulfillment' && pendingFulfillment > 0}
							<span
								class="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {operationsSection ===
								section.id
									? 'bg-white/20 text-white'
									: 'bg-[var(--heat-8)] text-[var(--heat-100)]'}"
							>
								{pendingFulfillment}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<button
			type="button"
			class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-2.5 text-[12px] font-medium text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
			onclick={toggleFullscreen}
			aria-pressed={fullscreen}
		>
			{#if fullscreen}
				<Minimize2 class="size-3.5" strokeWidth={2} />
				<span class="hidden sm:inline">Exit full screen</span>
				<span class="sm:hidden">Exit</span>
			{:else}
				<Maximize2 class="size-3.5" strokeWidth={2} />
				<span class="hidden sm:inline">Full screen</span>
				<span class="sm:hidden">Expand</span>
			{/if}
		</button>
	</div>

	<div class={fullscreen ? 'operations-fs-body' : ''}>
		{#if operationsSection === 'orders'}
			<AdminOrdersManager
				{initialFilter}
				{initialSearch}
				{initialSelectId}
				title="Orders"
				subtitle="Shipments, returns, refunds"
			/>
		{:else if operationsSection === 'returns'}
			<AdminOrdersManager
				initialFilter="returns"
				initialSearch={null}
				initialSelectId={null}
				title="Returns"
				subtitle="Return requests, RTO, refunds"
			/>
		{:else}
			<FulfillmentQueue />
		{/if}
	</div>
</div>

<style>
	.operations-fs {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100dvh;
		background: white;
		animation: operations-fs-in 240ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.operations-fs-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	@keyframes operations-fs-in {
		from {
			opacity: 0;
			transform: scale(0.985);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.operations-fs {
			animation: none;
		}
	}
</style>
