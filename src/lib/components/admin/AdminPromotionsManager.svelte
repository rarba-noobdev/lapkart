<script lang="ts">
	import { onMount } from 'svelte';
	import { Sparkles, Gift, Trophy, Zap, Power } from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import { requestAdmin } from '$lib/admin';

	type Promotion = {
		id: string;
		type: string;
		name: string;
		active: boolean;
		budgetCap: number | null;
		spent: number;
		rewardsIssued: number;
		creditIssued: number;
		creditRedeemed: number;
		creditOutstanding: number;
		creditExpired: number;
	};

	let promotions = $state<Promotion[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state<string | null>(null);

	const typeIcon: Record<string, typeof Sparkles> = {
		scratch_card: Sparkles,
		referral: Gift,
		streak: Trophy,
		flash_sale: Zap,
		festival: Zap,
		coupon: Zap
	};

	async function load() {
		loading = promotions.length === 0;
		error = null;
		try {
			const response = await requestAdmin<{ promotions: Promotion[] }>('/admin/promotions');
			promotions = response.promotions ?? [];
		} catch (loadError) {
			error = loadError instanceof Error ? loadError.message : 'Could not load promotions';
		} finally {
			loading = false;
		}
	}

	async function toggleActive(promo: Promotion) {
		busy = promo.id;
		try {
			await requestAdmin(`/admin/promotions/${promo.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ active: !promo.active })
			});
			await load();
		} catch (toggleError) {
			error = toggleError instanceof Error ? toggleError.message : 'Could not update promotion';
		} finally {
			busy = null;
		}
	}

	function budgetPct(promo: Promotion) {
		if (!promo.budgetCap || promo.budgetCap <= 0) return 0;
		return Math.min(100, Math.round((promo.spent / promo.budgetCap) * 100));
	}

	onMount(load);
</script>

<section>
	<div class="flex items-center justify-between gap-2">
		<div>
			<h3 class="text-[14px] font-medium text-foreground">Promotions &amp; rewards</h3>
			<p class="text-[11px] text-[var(--black-alpha-48)]">
				Scratch cards, streak, referral. Kill switch + budget + breakage per promotion.
			</p>
		</div>
		<button
			type="button"
			class="inline-flex h-8 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
			disabled={loading}
			onclick={load}
		>
			{loading ? 'Loading…' : 'Refresh'}
		</button>
	</div>

	{#if error}
		<p
			class="mt-3 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 px-3 py-2 text-[12px] text-[var(--accent-crimson)]"
		>
			{error}
		</p>
	{/if}

	<div class="mt-3 space-y-2">
		{#if loading && !promotions.length}
			<p class="text-[12px] text-[var(--black-alpha-48)]">Loading…</p>
		{:else if !promotions.length}
			<p class="text-[12px] text-[var(--black-alpha-48)]">No promotions yet.</p>
		{:else}
			{#each promotions as promo (promo.id)}
				{@const Icon = typeIcon[promo.type] ?? Zap}
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="flex min-w-0 items-start gap-2.5">
							<span
								class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]"
							>
								<Icon class="size-4" strokeWidth={2} />
							</span>
							<div class="min-w-0">
								<p class="truncate text-[13px] font-medium text-foreground">{promo.name}</p>
								<p class="text-[11px] tracking-wide text-[var(--black-alpha-40)] uppercase">
									{promo.type.replaceAll('_', ' ')}
								</p>
							</div>
						</div>
						<button
							type="button"
							disabled={busy === promo.id}
							onclick={() => toggleActive(promo)}
							class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors disabled:opacity-50
								{promo.active
								? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
								: 'border-[var(--border-muted)] bg-white text-[var(--black-alpha-48)]'}"
						>
							<Power class="size-3" strokeWidth={2.4} />
							{promo.active ? 'Active' : 'Paused'}
						</button>
					</div>

					{#if promo.budgetCap}
						<div class="mt-3">
							<div class="flex justify-between text-[11px] text-[var(--black-alpha-48)]">
								<span>Budget</span>
								<span class="tabular-nums"
									>{formatINR(promo.spent)} / {formatINR(promo.budgetCap)}</span
								>
							</div>
							<div class="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--background-lighter)]">
								<div
									class="h-full rounded-full {budgetPct(promo) >= 100
										? 'bg-[var(--accent-crimson)]'
										: 'bg-[var(--heat-100)]'}"
									style="width: {budgetPct(promo)}%"
								></div>
							</div>
						</div>
					{/if}

					<div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each [{ label: 'Issued', value: promo.creditIssued }, { label: 'Redeemed', value: promo.creditRedeemed }, { label: 'Outstanding', value: promo.creditOutstanding }, { label: 'Breakage', value: promo.creditExpired }] as stat (stat.label)}
							<div class="rounded-md bg-[var(--background-lighter)] p-2">
								<p class="text-[9px] tracking-wide text-[var(--black-alpha-40)] uppercase">
									{stat.label}
								</p>
								<p class="mt-0.5 text-[13px] font-medium text-foreground tabular-nums">
									{formatINR(stat.value)}
								</p>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[10px] text-[var(--black-alpha-40)]">
						{promo.rewardsIssued} reward{promo.rewardsIssued === 1 ? '' : 's'} issued
					</p>
				</div>
			{/each}
		{/if}
	</div>
</section>
