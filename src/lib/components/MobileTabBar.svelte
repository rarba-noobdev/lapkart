<script lang="ts">
	import { resolve } from '$app/paths';
	import { page, navigating } from '$app/state';
	import {
		Home,
		LayoutDashboard,
		PackageSearch,
		ReceiptText,
		ShoppingCart,
		Truck,
		UserRound
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
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
		{ label: 'Orders', href: '/orders', icon: ReceiptText },
		{ label: 'Account', href: auth.user ? '/profile' : '/login', icon: UserRound }
	]);

	const adminTabs: MobileTab[] = [
		{ label: 'Ops', href: '/admin', icon: LayoutDashboard },
		{ label: 'Ship', href: '/admin?section=fulfillment', icon: Truck },
		{ label: 'Shop', href: '/products', icon: PackageSearch },
		{ label: 'Orders', href: '/admin?section=orders', icon: ReceiptText }
	];

	const tabs = $derived<MobileTab[]>(isAdmin ? adminTabs : customerTabs);

	// Drive the active state off the pending navigation target when a navigation
	// is in flight, so the tab highlight switches the instant a tab is tapped
	// instead of waiting for the destination's blocking server load to resolve.
	const activeUrl = $derived(navigating.to?.url ?? page.url);

	function isActive(href: string) {
		const target = new URL(href, activeUrl.origin);
		if (target.pathname === '/') return activeUrl.pathname === '/';
		if (target.pathname === '/profile' || target.pathname === '/login') {
			return activeUrl.pathname === '/profile' || activeUrl.pathname === '/login';
		}
		if (target.pathname !== activeUrl.pathname) return false;
		const targetSection = target.searchParams.get('section');
		if (target.pathname === '/admin') {
			return targetSection
				? activeUrl.searchParams.get('section') === targetSection
				: !activeUrl.searchParams.get('section');
		}
		return true;
	}

	const activeIndex = $derived(tabs.findIndex((tab) => isActive(tab.href)));

	onMount(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<nav
		class="mobile-tabbar"
		style="--tab-count: {tabs.length}"
		aria-label="Mobile primary navigation"
		data-sveltekit-preload-data="tap"
		in:fly={{ y: prefersReducedMotion.current ? 0 : 72, duration: 360, easing: quintOut }}
	>
		<span
			class="tab-pill"
			class:tab-pill-hidden={activeIndex < 0}
			style="transform: translateX({Math.max(activeIndex, 0) * 100}%)"
			aria-hidden="true"
		></span>
		{#each tabs as tab (tab.href)}
			{@const Icon = tab.icon}
			<a href={resolve(tab.href as '/')} aria-current={isActive(tab.href) ? 'page' : undefined}>
				<span class="icon-wrap">
					<Icon size={20} strokeWidth={2.1} aria-hidden="true" />
					{#if tab.badge && tab.badge > 0}
						<span
							class="badge"
							aria-label={`${tab.badge} items in cart`}
							in:fly={{ y: -2, duration: 160, easing: quintOut }}
						>
							{#key tab.badge}
								<span class="badge-count tab-pop">{tab.badge > 9 ? '9+' : tab.badge}</span>
							{/key}
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
		grid-template-columns: repeat(var(--tab-count, 5), minmax(0, 1fr));
		border: 1px solid var(--border-muted);
		border-radius: 999px;
		background: #ffffff;
		padding: 6px;
		box-shadow:
			0 8px 32px -8px rgba(0, 0, 0, 0.12),
			0 2px 8px -2px rgba(0, 0, 0, 0.06);
	}

	/* Active-tab pill: one element sliding between tabs (transform-only, GPU). */
	.tab-pill {
		position: absolute;
		top: 6px;
		bottom: 6px;
		left: 6px;
		width: calc((100% - 12px) / var(--tab-count, 5));
		border-radius: 999px;
		background: var(--heat-12);
		pointer-events: none;
		transition:
			transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
			opacity 200ms var(--motion-ease);
	}

	.tab-pill-hidden {
		opacity: 0;
	}

	.mobile-tabbar a {
		position: relative;
		z-index: 1;
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
		transition:
			color 200ms var(--motion-ease),
			background-color 200ms var(--motion-ease),
			transform 140ms var(--motion-ease-out);
	}

	.mobile-tabbar a :global(svg) {
		color: var(--black-alpha-48);
		transition:
			color 200ms var(--motion-ease),
			transform 200ms var(--motion-ease-out);
	}

	.mobile-tabbar a[aria-current='page'] {
		color: var(--heat-100);
		box-shadow: none;
	}

	.mobile-tabbar a[aria-current='page'] :global(svg) {
		color: var(--heat-100);
		animation: tab-pop 320ms cubic-bezier(0.16, 1, 0.3, 1);
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
		transition: border-color 200ms var(--motion-ease);
	}

	.mobile-tabbar a:not([aria-current='page']) .badge {
		border-color: #fff;
	}

	.badge-count {
		display: inline-block;
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
