<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Wallet, Sparkles, ArrowRight, Gift, Share2, Copy, Check, Trophy } from '@lucide/svelte';
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

	let streak = $state<{
		delivered: number;
		next_target: number | null;
		next_credit: number | null;
	}>({ delivered: 0, next_target: null, next_credit: null });
	let referralCode = $state('');
	let copied = $state(false);

	async function load() {
		loading = rewards.length === 0;
		const [rewardResult, balanceResult, streakResult, codeResult] = await Promise.all([
			auth.supabase.rpc('list_my_rewards'),
			auth.supabase.rpc('my_store_credit_balance'),
			auth.supabase.rpc('my_streak_progress'),
			auth.supabase.rpc('my_referral_code')
		]);
		if (rewardResult.error) {
			error = rewardResult.error.message;
		} else {
			rewards = (rewardResult.data as Reward[]) ?? [];
		}
		if (!balanceResult.error) balance = Number(balanceResult.data ?? 0);
		if (!streakResult.error && Array.isArray(streakResult.data) && streakResult.data[0]) {
			streak = streakResult.data[0];
		}
		if (!codeResult.error && codeResult.data) referralCode = String(codeResult.data);
		loading = false;
	}

	const referralMessage = $derived(
		`LapKart la genuine laptop parts, 1 naal la delivery! Use my code ${referralCode} — neenga first order la credit pannunga. / Get LapKart store credit on your first order with my code ${referralCode}.`
	);
	const referralShareUrl = $derived(`https://wa.me/?text=${encodeURIComponent(referralMessage)}`);

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(referralCode);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}

	let applyCodeInput = $state('');
	let applyCodeMsg = $state<{ ok: boolean; text: string } | null>(null);
	let applyingCode = $state(false);

	async function submitReferralCode() {
		const code = applyCodeInput.trim().toUpperCase();
		if (!code) return;
		applyingCode = true;
		applyCodeMsg = null;
		const { data, error: rpcError } = await auth.supabase.rpc('apply_referral_code', {
			p_code: code
		});
		applyingCode = false;
		if (rpcError) {
			applyCodeMsg = { ok: false, text: rpcError.message };
			return;
		}
		const result = String(data);
		const messages: Record<string, { ok: boolean; text: string }> = {
			ok: { ok: true, text: 'Code applied. Credit lands on your first delivered prepaid order.' },
			already_referred: { ok: false, text: 'You already used a referral code.' },
			not_new_customer: { ok: false, text: 'Referral codes are for new customers only.' },
			invalid_code: { ok: false, text: 'That code is not valid.' },
			self_referral: { ok: false, text: 'You cannot use your own code.' }
		};
		applyCodeMsg = messages[result] ?? { ok: false, text: 'Could not apply code.' };
	}

	const streakProgress = $derived(
		streak.next_target && streak.next_target > 0
			? Math.min(100, Math.round((streak.delivered / streak.next_target) * 100))
			: 100
	);

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
		Store credit is applied automatically at checkout. Credits expire — check each card's date.
	</p>

	<!-- Repeat-purchase streak -->
	<div class="mt-4 rounded-xl border border-[var(--border-faint)] bg-white p-4">
		<div class="flex items-center gap-2">
			<Trophy class="size-4 text-[var(--accent-honey)]" strokeWidth={2} />
			<p class="text-[13px] font-medium text-foreground">Repeat-purchase rewards</p>
		</div>
		{#if streak.next_target && streak.next_credit}
			<p class="mt-2 text-[12px] text-[var(--black-alpha-56)]">
				{streak.delivered} of {streak.next_target} delivered orders to your next
				<span class="font-medium text-[var(--accent-forest)]">{formatINR(streak.next_credit)}</span>
				credit.
			</p>
			<div class="mt-2 h-2 overflow-hidden rounded-full bg-[var(--background-lighter)]">
				<div
					class="h-full rounded-full bg-[var(--accent-honey)] transition-[width] duration-500"
					style="width: {streakProgress}%"
				></div>
			</div>
		{:else}
			<p class="mt-2 text-[12px] text-[var(--black-alpha-56)]">
				{streak.delivered} delivered orders — you've earned every streak reward. Pro customer.
			</p>
		{/if}
	</div>

	<!-- Referral -->
	<div class="mt-3 rounded-xl border border-[var(--border-faint)] bg-white p-4">
		<div class="flex items-center gap-2">
			<Gift class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
			<p class="text-[13px] font-medium text-foreground">Refer a friend</p>
		</div>
		<p class="mt-1 text-[12px] text-[var(--black-alpha-56)]">
			They get credit on their first order; you get credit after their return window closes.
		</p>
		<div class="mt-3 flex items-center gap-2">
			<code
				class="flex-1 rounded-md border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] px-3 py-2 text-center text-[15px] font-semibold tracking-[0.18em] text-foreground"
			>
				{referralCode || '········'}
			</code>
			<button
				type="button"
				onclick={copyCode}
				class="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
			>
				{#if copied}<Check class="size-3.5" />Copied{:else}<Copy class="size-3.5" />Copy{/if}
			</button>
		</div>
		<a
			href={referralShareUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="button button-primary mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md text-[12px] font-medium text-white"
		>
			<Share2 class="size-3.5" /> Share on WhatsApp
		</a>

		<div class="mt-3 border-t border-[var(--border-faint)] pt-3">
			<p class="text-[11px] text-[var(--black-alpha-48)]">Got a code from a friend?</p>
			<div class="mt-1.5 flex gap-2">
				<input
					bind:value={applyCodeInput}
					placeholder="Enter referral code"
					class="input-field h-9 flex-1 text-[12px] uppercase"
					maxlength="12"
				/>
				<button
					type="button"
					disabled={applyingCode || !applyCodeInput.trim()}
					onclick={submitReferralCode}
					class="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-50"
				>
					{applyingCode ? 'Applying' : 'Apply'}
				</button>
			</div>
			{#if applyCodeMsg}
				<p
					class="mt-1.5 text-[11px] {applyCodeMsg.ok
						? 'text-[var(--accent-forest)]'
						: 'text-[var(--accent-crimson)]'}"
				>
					{applyCodeMsg.text}
				</p>
			{/if}
		</div>
	</div>

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
