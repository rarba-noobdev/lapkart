<script lang="ts">
	import { onMount } from 'svelte';
	import { ShoppingBag } from '@lucide/svelte';
	import { supabase } from '$lib/supabase/client';

	/*
	 * "Recently bought" ticker. Sourced from the public.recent_purchases() RPC,
	 * which is SECURITY DEFINER and projects ONLY product title + city area +
	 * time — never a customer name, phone, pincode, or address line. Every row is
	 * a real, recent order. No fabricated activity.
	 */
	type RecentPurchase = {
		product_id: string;
		product_title: string;
		area: string | null;
		purchased_at: string;
	};

	let purchases = $state<RecentPurchase[]>([]);
	let index = $state(0);
	let loaded = $state(false);

	function relativeTime(iso: string) {
		const diffMs = Date.now() - new Date(iso).getTime();
		const mins = Math.round(diffMs / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.round(hours / 24);
		return `${days}d ago`;
	}

	onMount(() => {
		let timer: ReturnType<typeof setInterval> | null = null;
		(async () => {
			const { data } = await supabase.rpc('recent_purchases', { p_limit: 12 });
			purchases = (data as RecentPurchase[] | null) ?? [];
			loaded = true;
			if (purchases.length > 1) {
				timer = setInterval(() => {
					index = (index + 1) % purchases.length;
				}, 3500);
			}
		})();
		return () => {
			if (timer) clearInterval(timer);
		};
	});

	const current = $derived(purchases[index] ?? null);
</script>

{#if loaded && current}
	<div
		class="flex items-center gap-2.5 rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2.5"
	>
		<span
			class="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]"
		>
			<ShoppingBag class="size-3.5" strokeWidth={2.2} />
		</span>
		{#key index}
			<p class="min-w-0 truncate text-[12px] text-[var(--black-alpha-64)]">
				<span class="font-medium text-foreground">{current.product_title}</span>
				bought{current.area ? ` in ${current.area}` : ''} · {relativeTime(current.purchased_at)}
			</p>
		{/key}
	</div>
{/if}
