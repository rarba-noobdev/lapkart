<script lang="ts">
	import { formatINR } from '$lib/catalog';
	import type { AdminAnalytics } from './admin-page-types';
	import {
		Activity,
		ArrowUpRight,
		Boxes,
		Package,
		ShieldAlert,
		TrendingUp,
		Truck,
		Users
	} from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	type OverviewCard = {
		id: string;
		label: string;
		value: string | number;
	};

	type NeedsActionCard = {
		id: string;
		label: string;
		count: number;
		hint: string;
		action: () => void;
	};

	type Props = {
		analytics: AdminAnalytics | null;
		overviewError: string | null;
		overviewCards: OverviewCard[];
		needsActionCards: NeedsActionCard[];
		maxMonthlyRevenue: number;
		loading: boolean;
		openOperations: (section: 'orders' | 'fulfillment', ordersFilter?: string | null) => void;
		openOrder: (order: AdminAnalytics['recentOrders'][number]) => void;
	};

	let {
		analytics,
		overviewError,
		overviewCards,
		needsActionCards,
		maxMonthlyRevenue,
		loading,
		openOperations,
		openOrder
	}: Props = $props();

	const overviewIcons: Record<string, typeof TrendingUp> = {
		orders: Package,
		products: Boxes,
		users: Users,
		revenue: TrendingUp,
		margin: Activity
	};

	const maxOrderStatusCount = $derived(
		Math.max(...(analytics?.statusBreakdown ?? []).map((item) => item.count), 1)
	);
	const maxPaymentCount = $derived(
		Math.max(...(analytics?.paymentBreakdown ?? []).map((item) => item.count), 1)
	);
	const maxCategoryProducts = $derived(
		Math.max(...(analytics?.categoryBreakdown ?? []).map((item) => item.products), 1)
	);
	const maxFunnelCount = $derived(
		Math.max(...(analytics?.fulfillmentFunnel ?? []).map((item) => item.count), 1)
	);

	function barWidth(value: number, max: number, min = 5) {
		if (value <= 0) return 0;
		return Math.max(min, Math.min(100, (value / max) * 100));
	}
</script>

<div class="space-y-5">
	{#if overviewError}
		<div
			class="flex items-start gap-2 rounded-lg border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[13px] text-[var(--accent-crimson)]"
			in:fly={{ y: -8, duration: 200 }}
		>
			<ShieldAlert class="mt-0.5 size-4 shrink-0" strokeWidth={2} />
			<span>{overviewError}</span>
		</div>
	{/if}

	{#if needsActionCards.length}
		<div in:fly={{ y: 12, duration: 300 }}>
			<p
				class="mb-2 text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
			>
				Needs action
			</p>
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{#each needsActionCards as card, idx (card.id)}
					<button
						type="button"
						class="group flex items-center justify-between rounded-lg border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4 text-left transition-colors hover:border-[var(--heat-100)]"
						in:fly={{ y: 12, duration: 250, delay: idx * 50 }}
						onclick={card.action}
					>
						<div>
							<p
								class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase"
							>
								{card.label}
							</p>
							<p class="mt-1.5 text-[24px] font-semibold tracking-tight text-foreground">
								{card.count}
							</p>
							<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
								{card.hint}
							</p>
						</div>
						<ArrowUpRight
							class="size-4 text-[var(--heat-100)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
							strokeWidth={2.5}
						/>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		{#each overviewCards as card, idx (card.id)}
			{@const Icon = overviewIcons[card.id] ?? TrendingUp}
			<div class="kpi-card group" in:fly={{ y: 16, duration: 300, delay: idx * 60, easing: cubicOut }}>
				<div class="flex items-start justify-between">
					<div>
						<p
							class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
						>
							{card.label}
						</p>
						<p class="mt-2 text-[26px] font-semibold tracking-tight text-foreground tabular-nums">
							{card.value}
						</p>
					</div>
					<div class="kpi-icon">
						<Icon class="size-4" strokeWidth={2} />
					</div>
				</div>
				{#if card.id === 'revenue' && analytics?.monthlySeries?.length}
					<div class="mt-3 flex items-end gap-px" style="height: 22px">
						{#each analytics.monthlySeries.slice(-12) as month (month.month)}
							<div
								class="flex-1 rounded-t-[1px] bg-[var(--heat-100)]/25 transition-colors duration-300 group-hover:bg-[var(--heat-100)]/60"
								style="height: {Math.max(8, (month.revenue / maxMonthlyRevenue) * 100)}%"
							></div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if analytics?.periodReports?.length}
		<div class="grid gap-3 sm:grid-cols-3" in:fly={{ y: 12, duration: 300, delay: 280 }}>
			{#each analytics.periodReports as period (period.id)}
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<p
						class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
					>
						{period.label}
					</p>
					<div class="mt-3 grid grid-cols-2 gap-3">
						<div>
							<p class="text-[11px] text-[var(--black-alpha-48)]">Orders</p>
							<p class="text-[16px] font-semibold text-foreground">{period.orders}</p>
						</div>
						<div>
							<p class="text-[11px] text-[var(--black-alpha-48)]">Revenue</p>
							<p class="text-[16px] font-semibold text-foreground">{formatINR(period.revenue)}</p>
						</div>
						<div>
							<p class="text-[11px] text-[var(--black-alpha-48)]">AOV</p>
							<p class="text-[14px] font-medium text-foreground">
								{formatINR(period.averageOrderValue)}
							</p>
						</div>
						<div>
							<p class="text-[11px] text-[var(--black-alpha-48)]">Refunds</p>
							<p class="text-[14px] font-medium text-[var(--accent-crimson)]">
								{formatINR(period.refundAmount)}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if analytics?.fulfillmentFunnel?.length || analytics?.statusBreakdown?.length}
		<div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]" in:fly={{ y: 12, duration: 300, delay: 310 }}>
			<div class="insight-card">
				<div class="insight-head">
					<div>
						<p class="insight-eyebrow">Fulfillment funnel</p>
						<h3 class="insight-title">Orders by next step</h3>
					</div>
					<Truck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
				</div>
				<div class="mt-4 grid gap-2 sm:grid-cols-5">
					{#each analytics.fulfillmentFunnel ?? [] as step (step.id)}
						<button
							type="button"
							class="funnel-step"
							onclick={() =>
								openOperations(
									step.id === 'to_be_shipped' ? 'fulfillment' : 'orders',
									step.id === 'returns' ? 'returns' : step.id === 'delivered' ? 'delivered' : null
								)}
						>
							<span class="text-[20px] font-semibold text-foreground tabular-nums">
								{step.count}
							</span>
							<span class="mt-1 text-[11px] font-medium text-foreground">{step.label}</span>
							<span class="mt-0.5 text-[10px] leading-4 text-[var(--black-alpha-48)]">
								{step.hint}
							</span>
							<span class="bar-track mt-3">
								<span
									class="bar-fill"
									style="width: {barWidth(step.count, maxFunnelCount, 10)}%"
								></span>
							</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="insight-card">
				<div class="insight-head">
					<div>
						<p class="insight-eyebrow">Order status mix</p>
						<h3 class="insight-title">Where orders sit now</h3>
					</div>
					<Activity class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
				</div>
				<div class="mt-4 space-y-3">
					{#each analytics.statusBreakdown ?? [] as item (item.status)}
						<div>
							<div class="mb-1 flex items-center justify-between gap-3">
								<span class="text-[12px] font-medium text-foreground">{item.label}</span>
								<span class="text-[11px] text-[var(--black-alpha-48)]">
									{item.count} / {formatINR(item.revenue)}
								</span>
							</div>
							<span class="bar-track">
								<span
									class="bar-fill"
									style="width: {barWidth(item.count, maxOrderStatusCount)}%"
								></span>
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if analytics?.paymentBreakdown?.length || analytics?.categoryBreakdown?.length}
		<div class="grid gap-4 xl:grid-cols-2" in:fly={{ y: 12, duration: 300, delay: 330 }}>
			<div class="insight-card">
				<div class="insight-head">
					<div>
						<p class="insight-eyebrow">Payment mix</p>
						<h3 class="insight-title">Payment states</h3>
					</div>
					<TrendingUp class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
				</div>
				<div class="mt-4 space-y-3">
					{#each analytics.paymentBreakdown ?? [] as item (item.status)}
						<div>
							<div class="mb-1 flex items-center justify-between gap-3">
								<span class="text-[12px] font-medium text-foreground">{item.label}</span>
								<span class="text-[11px] text-[var(--black-alpha-48)]">
									{item.count} / {formatINR(item.revenue)}
								</span>
							</div>
							<span class="bar-track">
								<span
									class="bar-fill bar-fill-muted"
									style="width: {barWidth(item.count, maxPaymentCount)}%"
								></span>
							</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="insight-card">
				<div class="insight-head">
					<div>
						<p class="insight-eyebrow">Catalog stock</p>
						<h3 class="insight-title">Category risk</h3>
					</div>
					<Boxes class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
				</div>
				<div class="mt-4 space-y-3">
					{#each analytics.categoryBreakdown ?? [] as item (item.category)}
						<div>
							<div class="mb-1 flex items-center justify-between gap-3">
								<span class="text-[12px] font-medium text-foreground">{item.label}</span>
								<span class="text-[11px] text-[var(--black-alpha-48)]">
									{item.products} SKUs
									{#if item.lowStock > 0} · {item.lowStock} low{/if}
								</span>
							</div>
							<span class="bar-track">
								<span
									class="bar-fill {item.lowStock > 0 ? 'bar-fill-risk' : 'bar-fill-muted'}"
									style="width: {barWidth(item.products, maxCategoryProducts)}%"
								></span>
							</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
		<div
			class="rounded-lg border border-[var(--border-faint)] bg-white"
			in:fly={{ y: 12, duration: 300, delay: 340 }}
		>
			<div class="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3">
				<div class="flex items-center gap-2">
					<Activity class="size-4 text-[var(--black-alpha-40)]" strokeWidth={2} />
					<p class="text-[13px] font-medium text-foreground">Recent orders</p>
				</div>
				{#if loading}
					<span
						class="flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-[var(--heat-100)] uppercase"
					>
						<span class="size-1.5 animate-pulse rounded-full bg-[var(--heat-100)]"></span>
						Live
					</span>
				{/if}
			</div>
			<div class="divide-y divide-[var(--border-faint)]">
				{#each analytics?.recentOrders ?? [] as order, idx (order.id)}
					<button
						type="button"
						class="group flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--background-lighter)]"
						in:fly={{ x: -8, duration: 200, delay: idx * 30 }}
						onclick={() => openOrder(order)}
					>
						<div class="flex items-center gap-2.5">
							<div
								class="flex size-7 items-center justify-center rounded bg-[var(--background-lighter)] font-mono text-[10px] font-medium text-[var(--black-alpha-48)] transition-colors group-hover:bg-[var(--heat-8)] group-hover:text-[var(--heat-100)]"
							>
								{order.id.slice(0, 2).toUpperCase()}
							</div>
							<div>
								<p class="font-mono text-[12px] text-foreground">
									#{order.id.slice(0, 8).toUpperCase()}
								</p>
								<p class="text-[11px] text-[var(--black-alpha-40)]">
									{order.shippingName || 'Customer'}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2.5">
							<span
								class="rounded-sm px-1.5 py-0.5 text-[9px] font-medium tracking-wide uppercase
									{order.status === 'cancelled'
									? 'bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
									: order.status === 'delivered'
										? 'bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
										: 'bg-[var(--background-lighter)] text-[var(--black-alpha-48)]'}"
							>
								{order.status}
							</span>
							<span class="font-mono text-[12px] font-medium text-foreground tabular-nums">
								{formatINR(order.total)}
							</span>
							<ArrowUpRight
								class="size-3 text-[var(--black-alpha-24)] opacity-0 transition-opacity group-hover:opacity-100"
								strokeWidth={2.5}
							/>
						</div>
					</button>
				{/each}
				{#if (analytics?.recentOrders ?? []).length === 0}
					<div class="px-4 py-10 text-center text-[12px] text-[var(--black-alpha-32)]">
						No order history yet.
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-3" in:fly={{ y: 12, duration: 300, delay: 400 }}>
			<div class="rounded-lg border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4">
				<div class="flex items-start justify-between">
					<div>
						<p
							class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase"
						>
							Pending fulfillment
						</p>
						<p class="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
							{analytics?.pendingFulfillment ?? 0}
						</p>
						<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">
							Ready to ship
						</p>
					</div>
					<Truck class="size-5 text-[var(--heat-100)]" strokeWidth={1.5} />
				</div>
				<button
					type="button"
					class="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-120)]"
					onclick={() => openOperations('fulfillment')}
				>
					Open queue <ArrowUpRight class="size-3" strokeWidth={2.5} />
				</button>
			</div>

			{#if analytics?.monthlySeries?.length}
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<p
						class="text-[10px] font-medium tracking-[0.14em] text-[var(--black-alpha-40)] uppercase"
					>
						Monthly sales
					</p>
					<div class="mt-3 flex items-end gap-1" style="height: 80px">
						{#each analytics.monthlySeries as month, idx (month.month)}
							<div class="group relative flex flex-1 flex-col items-center justify-end" style="height: 100%">
								<div
									class="chart-bar w-full rounded-t-sm bg-[var(--heat-100)] transition-[height] duration-500 ease-out"
									style="height: {Math.max(
										4,
										(month.revenue / maxMonthlyRevenue) * 100
									)}%; animation-delay: {idx * 60}ms"
								></div>
								<span class="mt-1 text-[8px] text-[var(--black-alpha-32)]">
									{month.month.slice(5)}
								</span>
								<div class="chart-tooltip">
									{formatINR(month.revenue)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
				<p class="text-[13px] font-medium text-foreground">Service health</p>
				<div class="mt-3 space-y-2.5">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="size-1.5 rounded-full bg-[var(--accent-forest)]"></span>
							<span class="text-[12px] text-[var(--black-alpha-56)]">Delivered</span>
						</div>
						<span class="text-[12px] font-medium text-foreground">
							{analytics?.deliveredOrders ?? 0}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="size-1.5 rounded-full bg-[var(--accent-honey)]"></span>
							<span class="text-[12px] text-[var(--black-alpha-56)]">Cancellations</span>
						</div>
						<span class="text-[12px] font-medium text-foreground">
							{analytics?.cancellationReport.total ?? 0}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="size-1.5 rounded-full bg-[var(--accent-crimson)]"></span>
							<span class="text-[12px] text-[var(--black-alpha-56)]">Awaiting review</span>
						</div>
						<span class="text-[12px] font-medium text-foreground">
							{analytics?.cancellationReport.pending ?? 0}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.kpi-card {
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 16px 18px;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.kpi-card:hover {
		border-color: var(--heat-20);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
	}

	.kpi-icon {
		display: flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: var(--heat-8);
		color: var(--heat-100);
		transition: transform 200ms ease;
	}

	.kpi-card:hover .kpi-icon {
		transform: scale(1.08);
	}

	.insight-card {
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: white;
		padding: 16px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
	}

	.insight-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.insight-eyebrow {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--black-alpha-40);
	}

	.insight-title {
		margin-top: 2px;
		font-size: 14px;
		font-weight: 600;
		color: var(--foreground);
	}

	.funnel-step {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		border-radius: 8px;
		border: 1px solid var(--border-faint);
		background: var(--background-lighter);
		padding: 12px;
		text-align: left;
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}

	.funnel-step:hover {
		border-color: var(--heat-40);
		background: var(--heat-4);
	}

	.bar-track {
		display: block;
		width: 100%;
		height: 7px;
		overflow: hidden;
		border-radius: 999px;
		background: var(--black-alpha-6);
	}

	.bar-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--heat-100);
		transition: width 260ms ease;
	}

	.bar-fill-muted {
		background: var(--black-alpha-40);
	}

	.bar-fill-risk {
		background: var(--accent-honey);
	}

	.chart-bar {
		opacity: 0.8;
		transition: opacity 150ms ease;
	}

	.chart-bar:hover {
		opacity: 1;
	}

	.chart-tooltip {
		display: none;
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		z-index: 5;
		transform: translateX(-50%);
		border-radius: 4px;
		background: var(--accent-black);
		padding: 3px 6px;
		color: white;
		font-size: 10px;
		white-space: nowrap;
	}

	.group:hover .chart-tooltip {
		display: block;
	}
</style>
