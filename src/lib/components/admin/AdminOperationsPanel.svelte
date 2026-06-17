<script lang="ts">
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
</script>

<div class="space-y-4">
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

	{#if operationsSection === 'orders'}
		<AdminOrdersManager {initialFilter} {initialSearch} {initialSelectId} />
	{:else if operationsSection === 'returns'}
		<AdminOrdersManager initialFilter="returns" initialSearch={null} initialSelectId={null} />
	{:else}
		<FulfillmentQueue />
	{/if}
</div>
