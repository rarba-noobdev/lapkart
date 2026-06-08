<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		Home,
		LayoutDashboard,
		PackageSearch,
		ReceiptText,
		ShoppingCart,
		Truck
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { getAuthContext } from '$lib/auth-context';
	import { cartState } from '$lib/cart';
	import { isStaffRole } from '$lib/roles';

	type MobileTab = {
		label: string;
		href: string;
		icon: typeof Home;
		badge?: number;
	};

	const auth = getAuthContext();

	let mounted = $state(false);
	const isAdmin = $derived(isStaffRole(auth.role));
	const cartCount = $derived($cartState.items.reduce((sum, item) => sum + item.qty, 0));
	const cartBadge = $derived($cartState.hydrated && cartCount > 0 ? cartCount : undefined);

	const customerTabs = $derived<MobileTab[]>([
		{ label: 'Home', href: '/', icon: Home },
		{ label: 'Shop', href: '/products', icon: PackageSearch },
		{ label: 'Cart', href: '/cart', icon: ShoppingCart, badge: cartBadge },
		{ label: 'Orders', href: '/orders', icon: ReceiptText }
	]);

	const adminTabs: MobileTab[] = [
		{ label: 'Ops', href: '/admin', icon: LayoutDashboard },
		{ label: 'Ship', href: '/admin?section=fulfillment', icon: Truck },
		{ label: 'Shop', href: '/products', icon: PackageSearch },
		{ label: 'Orders', href: '/admin?section=orders', icon: ReceiptText }
	];

	const tabs = $derived<MobileTab[]>(isAdmin ? adminTabs : customerTabs);

	function isActive(href: string) {
		const target = new URL(href, page.url.origin);
		if (target.pathname === '/') return page.url.pathname === '/';
		if (target.pathname !== page.url.pathname) return false;
		const targetSection = target.searchParams.get('section');
		if (target.pathname === '/admin') {
			return targetSection
				? page.url.searchParams.get('section') === targetSection
				: !page.url.searchParams.get('section');
		}
		return true;
	}

	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<nav class="mobile-tabbar" aria-label="Mobile primary navigation">
		{#each tabs as tab (tab.href)}
			{@const Icon = tab.icon}
			<a href={resolve(tab.href as '/')} aria-current={isActive(tab.href) ? 'page' : undefined}>
				<span class="icon-wrap">
					<Icon size={20} strokeWidth={2.1} aria-hidden="true" />
					{#if tab.badge && tab.badge > 0}
						<span class="badge" aria-label={`${tab.badge} items in cart`}>
							{tab.badge > 9 ? '9+' : tab.badge}
						</span>
					{/if}
				</span>
				<span>{tab.label}</span>
			</a>
		{/each}
	</nav>
{/if}

<style>
	.mobile-tabbar {
		position: fixed;
		right: 16px;
		bottom: max(16px, env(safe-area-inset-bottom));
		left: 16px;
		z-index: 50;
		display: none;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border: 1px solid var(--border-muted);
		border-radius: 999px;
		background: #ffffff;
		padding: 6px;
		box-shadow:
			0 8px 32px -8px rgba(0, 0, 0, 0.12),
			0 2px 8px -2px rgba(0, 0, 0, 0.06);
	}

	.mobile-tabbar a {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 52px;
		justify-content: center;
		align-items: center;
		gap: 3px;
		border-radius: 999px;
		color: var(--black-alpha-40);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.01em;
		transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
	}

	.mobile-tabbar a :global(svg) {
		color: var(--black-alpha-48);
		transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
	}

	.mobile-tabbar a[aria-current='page'] {
		background: var(--heat-12);
		color: var(--heat-100);
		box-shadow: none;
	}

	.mobile-tabbar a[aria-current='page'] :global(svg) {
		color: var(--heat-100);
		transform: translateY(-1px);
	}

	.icon-wrap {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.badge {
		position: absolute;
		top: -8px;
		right: -10px;
		display: flex;
		min-width: 16px;
		height: 16px;
		justify-content: center;
		align-items: center;
		border: 2px solid var(--accent-black);
		border-radius: 999px;
		background: var(--heat-100);
		padding-inline: 4px;
		color: #fff;
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 700;
		line-height: 1;
		transition: border-color 0.3s cubic-bezier(0.2, 0, 0, 1);
	}

	.mobile-tabbar a:not([aria-current='page']) .badge {
		border-color: #fff;
	}

	.mobile-tabbar a:active {
		transform: scale(0.92);
	}

	@media (max-width: 767px) {
		.mobile-tabbar {
			display: grid;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mobile-tabbar,
		.mobile-tabbar * {
			transition-duration: 0.01ms !important;
		}
	}
</style>
