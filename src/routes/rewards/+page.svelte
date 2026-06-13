<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Wallet, Sparkles, ArrowRight } from '@lucide/svelte';
	import { getAuthContext } from '$lib/auth-context';
	import { formatINR } from '$lib/catalog';
	import ScratchCard from '$lib/components/ScratchCard.svelte';

	const auth = getAuthContext();

	type Reward = {
		id: string;
		type: string;
		status: string;
		value: number | null;
		expires_at: string | null;
		created_at: string;
		revealed_at: string | null;
	};

	let rewards = $state<Reward[]>([]);
	let balance = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = rewards.length === 0;
		const [rewardResult, balanceResult] = await Promise.all([
			auth.supabase.rpc('list_my_rewards'),
			auth.supabase.rpc('my_store_credit_balance')
		]);
		if (rewardResult.error) {
			error = rewardResult.error.message;
		} else {
			rewards = (rewardResult.data as Reward[]) ?? [];
		}
		if (!balanceResult.error) balance = Number(balanceResult.data ?? 0);
		loading = false;
	}

	async function reveal(id: string): Promise<number | null> {
		const { data, error: revealError } = await auth.supabase.rpc('reveal_scratch_card', {
			p_reward_id: id
		});
		if (revealError) {
			error = revealError.message;
			return null;
		}
		// Refresh balance + reward statuses after a successful scratch.
		void load();
		return Number(data ?? 0);
	}

	const scratchCards = $derived(rewards.filter((r) => r.type === 'scratch_card'));
	const lockedCount = $derived(scratchCards.filter((r) => r.status === 'locked').length);

	function fmtDate(value: string | null) {
		if (!value) return '';
		return new Date(value).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	onMount(load);
</script>

<svelte:head>
	<title>Rewards - LapKart</title>
</svelte:head>

<section class="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
	<div class="flex items-center gap-2">
		<Sparkles class="size-5 text-[var(--heat-100)]" strokeWidth={2} />
		<h1 class="text-[22px] font-medium tracking-tight text-foreground sm:text-[26px]">Rewards</h1>
		{#if lockedCount > 0}
			<span
				class="rounded-full bg-[var(--heat-100)] px-2 py-0.5 text-[11px] font-semibold text-white"
			>
				{lockedCount} to scratch
			</span>
		{/if}
	</div>

	<!-- Store credit balance -->
	<div
		class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-faint)] bg-gradient-to-br from-[var(--accent-forest)]/8 to-white p-4"
	>
		<div class="flex items-center gap-3">
			<span
				class="grid size-10 place-items-center rounded-lg bg-[var(--accent-forest)]/12 text-[var(--accent-forest)]"
			>
				<Wallet class="size-5" strokeWidth={2} />
			</span>
			<div>
				<p class="text-[11px] tracking-[0.1em] text-[var(--black-alpha-48)] uppercase">
					Store credit
				</p>
				<p class="text-[22px] font-semibold text-foreground tabular-nums">{formatINR(balance)}</p>
			</div>
		</div>
		<a
			href={resolve('/products')}
			class="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-120)]"
		>
			Shop now <ArrowRight class="size-3.5" />
		</a>
	</div>
	<p class="mt-1.5 px-1 text-[11px] text-[var(--black-alpha-40)]">
		Store credit applies at checkout (rollout in progress). Credits expire — check each card's date.
	</p>

	{#if error}
		<p
			class="mt-4 rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 px-3 py-2 text-[12px] text-[var(--accent-crimson)]"
		>
			{error}
		</p>
	{/if}

	<!-- Scratch cards -->
	<h2 class="mt-7 text-[14px] font-medium text-foreground">Scratch cards</h2>
	{#if loading}
		<p class="mt-3 text-[12px] text-[var(--black-alpha-48)]">Loading…</p>
	{:else if scratchCards.length === 0}
		<div
			class="mt-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-white px-5 py-10 text-center"
		>
			<Sparkles class="mx-auto size-6 text-[var(--black-alpha-32)]" />
			<p class="mt-2 text-[13px] font-medium text-foreground">No scratch cards yet</p>
			<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">
				Pay online and get a scratch card when your order is delivered.
			</p>
		</div>
	{:else}
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			{#each scratchCards as card (card.id)}
				<div class="rounded-xl border border-[var(--border-faint)] bg-white p-3">
					{#if card.status === 'expired'}
						<div
							class="grid h-32 place-items-center rounded-xl bg-[var(--background-lighter)] text-[12px] text-[var(--black-alpha-40)]"
						>
							Expired
						</div>
					{:else}
						<ScratchCard
							revealed={card.status !== 'locked'}
							value={card.value}
							onReveal={() => reveal(card.id)}
						/>
					{/if}
					<div class="mt-2 flex items-center justify-between px-1 text-[11px]">
						<span class="text-[var(--black-alpha-48)]">Earned {fmtDate(card.created_at)}</span>
						{#if card.expires_at}
							<span class="text-[var(--black-alpha-40)]">Expires {fmtDate(card.expires_at)}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
