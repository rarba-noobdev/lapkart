<script lang="ts">
	import { formatINR } from '$lib/catalog';
	import type { AdminAnalytics } from './admin-page-types';
	import {
		Activity,
		ArrowUpRight,
		Boxes,
		ChartPie,
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

	// ── Revenue / orders trend chart ──────────────────────────────────────────
	type TrendMetric = 'revenue' | 'orders';
	let trendMetric = $state<TrendMetric>('revenue');
	let hoverIndex = $state<number | null>(null);

	const CHART_W = 640;
	const CHART_H = 200;
	const PAD_X = 8;
	const PAD_TOP = 16;
	const PAD_BOTTOM = 22;

	const series = $derived(analytics?.monthlySeries ?? []);
	const trendMax = $derived(
		Math.max(...series.map((m) => (trendMetric === 'revenue' ? m.revenue : m.orders)), 1)
	);
	const trendTotal = $derived(
		series.reduce((sum, m) => sum + (trendMetric === 'revenue' ? m.revenue : m.orders), 0)
	);

	type Point = { x: number; y: number; value: number; label: string };
	const trendPoints = $derived.by<Point[]>(() => {
		if (series.length === 0) return [];
		const usableW = CHART_W - PAD_X * 2;
		const usableH = CHART_H - PAD_TOP - PAD_BOTTOM;
		const step = series.length > 1 ? usableW / (series.length - 1) : 0;
		return series.map((m, i) => {
			const value = trendMetric === 'revenue' ? m.revenue : m.orders;
			const x = PAD_X + (series.length > 1 ? i * step : usableW / 2);
			const y = PAD_TOP + usableH - (value / trendMax) * usableH;
			return { x, y, value, label: m.month };
		});
	});

	const linePath = $derived(
		trendPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
	);
	const areaPath = $derived(
		trendPoints.length
			? `${linePath} L${trendPoints[trendPoints.length - 1].x.toFixed(1)} ${CHART_H - PAD_BOTTOM} L${trendPoints[0].x.toFixed(1)} ${CHART_H - PAD_BOTTOM} Z`
			: ''
	);
	const gridLines = [0.25, 0.5, 0.75, 1].map(
		(f) => PAD_TOP + (CHART_H - PAD_TOP - PAD_BOTTOM) * (1 - f)
	);

	function onTrendPointer(event: PointerEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		if (rect.width === 0 || trendPoints.length === 0) return;
		const ratio = (event.clientX - rect.left) / rect.width;
		const idx = Math.round(ratio * (trendPoints.length - 1));
		hoverIndex = Math.max(0, Math.min(trendPoints.length - 1, idx));
	}

	function formatTrend(value: number) {
		return trendMetric === 'revenue' ? formatINR(value) : `${value} orders`;
	}
	function monthLabel(month: string) {
		const [, m] = month.split('-');
		return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
			Number(m)
		];
	}

	// ── Donut breakdowns (conic-gradient, no deps) ────────────────────────────
	const donutPalette = [
		'var(--heat-100)',
		'var(--accent-forest)',
		'var(--accent-honey)',
		'var(--heat-200)',
		'var(--accent-crimson)',
		'var(--black-alpha-40)'
	];

	type DonutSlice = { label: string; count: number; color: string; pct: number };
	function buildDonut(items: Array<{ label: string; count: number }>): {
		slices: DonutSlice[];
		total: number;
		gradient: string;
	} {
		const total = items.reduce((sum, item) => sum + item.count, 0);
		if (total === 0) return { slices: [], total: 0, gradient: 'var(--black-alpha-6)' };
		let cursor = 0;
		const stops: string[] = [];
		const slices = items.map((item, i) => {
			const color = donutPalette[i % donutPalette.length];
			const pct = (item.count / total) * 100;
			stops.push(`${color} ${cursor.toFixed(2)}% ${(cursor + pct).toFixed(2)}%`);
			cursor += pct;
			return { label: item.label, count: item.count, color, pct };
		});
		return { slices, total, gradient: `conic-gradient(${stops.join(', ')})` };
	}

	const paymentDonut = $derived(buildDonut(analytics?.paymentBreakdown ?? []));
	const statusDonut = $derived(buildDonut(analytics?.statusBreakdown ?? []));
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
							<p class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase">
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
			<div
				class="kpi-card group"
				in:fly={{ y: 16, duration: 300, delay: idx * 60, easing: cubicOut }}
			>
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

	{#if series.length}
		<div class="insight-card" in:fly={{ y: 12, duration: 300, delay: 240 }}>
			<div class="insight-head">
				<div>
					<p class="insight-eyebrow">Performance</p>
					<h3 class="insight-title">
						{trendMetric === 'revenue' ? 'Revenue' : 'Orders'} trend
						<span class="ml-1.5 text-[var(--black-alpha-40)]">
							· {trendMetric === 'revenue' ? formatINR(trendTotal) : `${trendTotal} total`}
						</span>
					</h3>
				</div>
				<div class="metric-toggle" role="tablist" aria-label="Trend metric">
					<button
						type="button"
						role="tab"
						aria-selected={trendMetric === 'revenue'}
						class:is-active={trendMetric === 'revenue'}
						onclick={() => (trendMetric = 'revenue')}
					>
						Revenue
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={trendMetric === 'orders'}
						class:is-active={trendMetric === 'orders'}
						onclick={() => (trendMetric = 'orders')}
					>
						Orders
					</button>
				</div>
			</div>

			<div class="relative mt-4">
				<svg
					viewBox="0 0 {CHART_W} {CHART_H}"
					class="trend-svg w-full"
					preserveAspectRatio="none"
					role="img"
					aria-label="{trendMetric} over time"
					onpointermove={onTrendPointer}
					onpointerleave={() => (hoverIndex = null)}
				>
					<defs>
						<linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="var(--heat-100)" stop-opacity="0.22" />
							<stop offset="100%" stop-color="var(--heat-100)" stop-opacity="0" />
						</linearGradient>
					</defs>

					{#each gridLines as gy (gy)}
						<line x1={PAD_X} y1={gy} x2={CHART_W - PAD_X} y2={gy} class="grid-line" />
					{/each}

					{#if areaPath}
						<path d={areaPath} fill="url(#trendFill)" class="area-path" />
						<path d={linePath} fill="none" class="line-path" />
					{/if}

					{#each trendPoints as point, i (point.label)}
						<g>
							{#if hoverIndex === i}
								<line
									x1={point.x}
									y1={PAD_TOP}
									x2={point.x}
									y2={CHART_H - PAD_BOTTOM}
									class="hover-guide"
								/>
							{/if}
							<circle
								cx={point.x}
								cy={point.y}
								r={hoverIndex === i ? 4 : 2.5}
								class="point-dot"
								class:is-hover={hoverIndex === i}
							/>
						</g>
					{/each}
				</svg>

				{#if hoverIndex !== null && trendPoints[hoverIndex]}
					<div class="trend-tip" style="left: {(trendPoints[hoverIndex].x / CHART_W) * 100}%">
						<span class="tip-value">{formatTrend(trendPoints[hoverIndex].value)}</span>
						<span class="tip-label">{trendPoints[hoverIndex].label}</span>
					</div>
				{/if}

				<div class="mt-1 flex justify-between px-1">
					{#each series as month, i (month.month)}
						{#if i % Math.ceil(series.length / 6) === 0 || i === series.length - 1}
							<span class="text-[9px] text-[var(--black-alpha-32)]">{monthLabel(month.month)}</span>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	{/if}

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
		<div
			class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]"
			in:fly={{ y: 12, duration: 300, delay: 310 }}
		>
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
								<span class="bar-fill" style="width: {barWidth(step.count, maxFunnelCount, 10)}%"
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
					<ChartPie class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
				</div>
				<div class="donut-wrap mt-4">
					<div class="donut" style="background: {statusDonut.gradient}">
						<div class="donut-hole">
							<span class="donut-total">{statusDonut.total}</span>
							<span class="donut-cap">orders</span>
						</div>
					</div>
					<ul class="legend">
						{#each statusDonut.slices as slice (slice.label)}
							<li>
								<span class="legend-dot" style="background: {slice.color}"></span>
								<span class="legend-label">{slice.label}</span>
								<span class="legend-val">{slice.count} · {Math.round(slice.pct)}%</span>
							</li>
						{/each}
					</ul>
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
					<ChartPie class="size-4 text-[var(--black-alpha-48)]" strokeWidth={2} />
				</div>
				<div class="donut-wrap mt-4">
					<div class="donut" style="background: {paymentDonut.gradient}">
						<div class="donut-hole">
							<span class="donut-total">{paymentDonut.total}</span>
							<span class="donut-cap">payments</span>
						</div>
					</div>
					<ul class="legend">
						{#each paymentDonut.slices as slice (slice.label)}
							<li>
								<span class="legend-dot" style="background: {slice.color}"></span>
								<span class="legend-label">{slice.label}</span>
								<span class="legend-val">{slice.count} · {Math.round(slice.pct)}%</span>
							</li>
						{/each}
					</ul>
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
									{#if item.lowStock > 0}
										· {item.lowStock} low{/if}
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
			<div
				class="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3"
			>
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
			<div
				class="rounded-lg border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4"
			>
				<div class="flex items-start justify-between">
					<div>
						<p class="text-[10px] font-medium tracking-[0.14em] text-[var(--heat-100)] uppercase">
							Pending fulfillment
						</p>
						<p class="mt-1.5 text-[28px] font-semibold tracking-tight text-foreground">
							{analytics?.pendingFulfillment ?? 0}
						</p>
						<p class="mt-0.5 text-[11px] text-[var(--black-alpha-40)]">Ready to ship</p>
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

	/* ── Trend chart ── */
	.metric-toggle {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border-radius: 999px;
		background: var(--black-alpha-6);
	}

	.metric-toggle button {
		border-radius: 999px;
		padding: 4px 12px;
		font-size: 11px;
		font-weight: 600;
		color: var(--black-alpha-48);
		transition:
			background 160ms ease,
			color 160ms ease;
	}

	.metric-toggle button.is-active {
		background: #fff;
		color: var(--heat-100);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.trend-svg {
		height: 200px;
		overflow: visible;
		touch-action: none;
	}

	.grid-line {
		stroke: var(--black-alpha-6);
		stroke-width: 1;
	}

	.area-path {
		transition: opacity 200ms ease;
	}

	.line-path {
		stroke: var(--heat-100);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	.hover-guide {
		stroke: var(--heat-40);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.point-dot {
		fill: var(--heat-100);
		transition: r 120ms ease;
	}

	.point-dot.is-hover {
		stroke: #fff;
		stroke-width: 2;
	}

	.trend-tip {
		position: absolute;
		top: -4px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		pointer-events: none;
		transform: translateX(-50%);
		border-radius: 6px;
		background: var(--accent-black);
		padding: 5px 9px;
		white-space: nowrap;
	}

	.trend-tip .tip-value {
		font-size: 12px;
		font-weight: 600;
		color: #fff;
	}

	.trend-tip .tip-label {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.6);
	}

	/* ── Donut ── */
	.donut-wrap {
		display: flex;
		align-items: center;
		gap: 20px;
	}

	.donut {
		position: relative;
		width: 108px;
		height: 108px;
		flex-shrink: 0;
		border-radius: 999px;
	}

	.donut-hole {
		position: absolute;
		inset: 26%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: #fff;
	}

	.donut-total {
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
		color: var(--foreground);
	}

	.donut-cap {
		margin-top: 2px;
		font-size: 9px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--black-alpha-40);
	}

	.legend {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 8px;
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}

	.legend-dot {
		width: 9px;
		height: 9px;
		flex-shrink: 0;
		border-radius: 3px;
	}

	.legend-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--foreground);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.legend-val {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
		color: var(--black-alpha-48);
	}
</style>
