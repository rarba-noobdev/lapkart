<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, Flame } from '@lucide/svelte';
	import { getAuthContext } from '$lib/auth-context';

	type FooterColumn = {
		title: string;
		items: {
			label: string;
			to: string;
		}[];
	};

	const auth = getAuthContext();
	const isAdmin = $derived(auth.role === 'admin');
	const footerColumns = $derived<FooterColumn[]>(
		isAdmin
			? [
					{
						title: 'Operations',
						items: [
							{ label: 'Admin dashboard', to: '/admin' },
							{ label: 'Fulfillment queue', to: '/admin?section=fulfillment' }
						]
					},
					{
						title: 'Catalog',
						items: [
							{ label: 'Storefront preview', to: '/products' },
							{ label: 'Home', to: '/' }
						]
					},
					{
						title: 'Policies',
						items: [
							{ label: 'Terms', to: '/terms' },
							{ label: 'Privacy', to: '/privacy' },
							{ label: 'Shipping', to: '/shipping-policy' },
							{ label: 'Returns', to: '/returns-policy' }
						]
					},
					{
						title: 'Company',
						items: [
							{ label: 'About', to: '/about' },
							{ label: 'Contact', to: '/contact' },
							{ label: 'Cancellation & refunds', to: '/cancellation-refunds' }
						]
					}
				]
			: [
					{
						title: 'Shop',
						items: [
							{ label: 'All components', to: '/products' },
							{ label: 'Cart', to: '/cart' },
							{ label: 'Orders', to: '/orders' },
							{ label: 'Account', to: '/dashboard' }
						]
					},
					{
						title: 'Policies',
						items: [
							{ label: 'Terms', to: '/terms' },
							{ label: 'Privacy', to: '/privacy' },
							{ label: 'Shipping', to: '/shipping-policy' },
							{ label: 'Returns', to: '/returns-policy' }
						]
					},
					{
						title: 'Company',
						items: [
							{ label: 'About', to: '/about' },
							{ label: 'Contact', to: '/contact' },
							{ label: 'Cancellation & refunds', to: '/cancellation-refunds' }
						]
					},
					{
						title: 'Account',
						items: [
							{ label: 'Sign in', to: '/login' },
							{ label: 'Checkout', to: '/checkout' }
						]
					}
				]
	);
</script>

<footer
	class="motion-section relative mt-24 overflow-hidden bg-[var(--accent-black)] text-white/70"
>
	<div class="relative container mx-auto px-4 pt-16 pb-8">
		<div class="grid gap-12 border-b border-white/8 pb-12 md:grid-cols-[1.4fr_2fr]">
			<div>
				<div class="flex items-baseline gap-2">
					<Flame class="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
					<span class="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
						lap<span class="text-[var(--heat-100)]">kart</span>
					</span>
				</div>
				<p class="text-body-medium mt-5 max-w-sm leading-relaxed text-white/60">
					{#if isAdmin}
						Operations workspace for catalog control, user management, order visibility, and
						fulfillment monitoring.
					{:else}
						India's marketplace for genuine laptop components, from RAM and SSDs to batteries,
						displays, and replacement hardware.
					{/if}
				</p>
				<p class="text-mono-x-small mt-6 tracking-[0.16em] text-white/40 uppercase">
					{isAdmin ? 'Admin-only session' : 'Fast dispatch, secure checkout, verified sourcing'}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-8 sm:grid-cols-4">
				{#each footerColumns as column (column.title)}
					<div>
						<h3 class="text-mono-x-small mb-4 tracking-[0.18em] text-white/40 uppercase">
							{column.title}
						</h3>
						<ul class="space-y-2.5">
							{#each column.items as item (item.to)}
								<li>
									<a
										href={resolve(item.to as '/')}
										class="group text-body-small inline-flex items-center gap-1 text-white/75 transition-colors hover:text-[var(--heat-100)]"
									>
										{item.label}
										<ArrowUpRight
											class="size-3 -translate-x-1 opacity-0 transition-[transform,opacity] group-hover:translate-x-0 group-hover:opacity-100"
										/>
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
			<p class="text-mono-x-small tracking-[0.16em] text-white/40 uppercase">
				2026 LapKart. {isAdmin ? 'Operations console.' : 'Genuine parts marketplace.'}
			</p>
			<div class="text-mono-x-small tracking-wider text-white/40 uppercase">
				Chennai service desk | Monday to Saturday
			</div>
		</div>
	</div>
</footer>
