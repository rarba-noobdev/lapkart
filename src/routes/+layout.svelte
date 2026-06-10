<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page, navigating } from '$app/state';
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setAuthContext } from '$lib/auth-context';
	import type { LayoutProps } from './$types';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import NavigationLoader from '$lib/components/NavigationLoader.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import RouteSkeleton from '$lib/components/RouteSkeleton.svelte';
	import { hydrateCart } from '$lib/cart';

	let { data, children }: LayoutProps = $props();
	let { supabase, session, user, role, claims } = $derived(data);
	const isLoginRoute = $derived(page.url.pathname === '/login');
	const isAdminRoute = $derived(page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/'));

	// Show a route-matched skeleton in <main> while a client navigation's load
	// resolves, so tapping a tab swaps to a loading shell immediately instead of
	// holding the previous page until the blocking server load returns. A short
	// delay suppresses the skeleton for near-instant (preloaded/cached) navs so
	// it never flashes.
	const navTarget = $derived(navigating.to?.url.pathname ?? null);
	const skeletonRoute = $derived.by(() => {
		const path = navTarget;
		if (!path) return null;
		if (path === '/login' || path === '/admin' || path.startsWith('/admin/')) return null;
		return path;
	});
	let showSkeleton = $state(false);
	$effect(() => {
		if (!skeletonRoute) {
			showSkeleton = false;
			return;
		}
		const timer = setTimeout(() => (showSkeleton = true), 90);
		return () => clearTimeout(timer);
	});

	const auth = {
		get supabase() {
			return supabase;
		},
		get session() {
			return session;
		},
		get user() {
			return user;
		},
		get role() {
			return role;
		},
		get claims() {
			return claims;
		}
	};
	setAuthContext(auth);

	onMount(() => {
		hydrateCart();

		let profileChannel: ReturnType<typeof supabase.channel> | null = null;
		let currentProfileChannelUserId: string | null = null;

		const syncProfileChannel = (userId: string | null | undefined) => {
			if (currentProfileChannelUserId === (userId ?? null)) return;
			currentProfileChannelUserId = userId ?? null;

			if (profileChannel) {
				void supabase.removeChannel(profileChannel);
				profileChannel = null;
			}

			if (!userId) return;

			profileChannel = supabase
				.channel(`profile:${userId}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'profiles',
						filter: `id=eq.${userId}`
					},
					() => {
						void invalidate('app:profile');
					}
				)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'user_roles',
						filter: `user_id=eq.${userId}`
					},
					() => {
						void invalidate('supabase:auth');
					}
				)
				.subscribe();
		};

		syncProfileChannel(user?.id);

		const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
			syncProfileChannel(session?.user?.id);
			if (event === 'SIGNED_OUT') {
				// Purge any cached page HTML so a signed-out (or next) user can't
				// pull a previous session's pages from the service worker cache.
				navigator.serviceWorker?.controller?.postMessage({ type: 'clear-pages' });
			}
			if (session?.expires_at !== claims?.exp) void invalidate('supabase:auth');
		});

		return () => {
			authListener.subscription.unsubscribe();
			if (profileChannel) void supabase.removeChannel(profileChannel);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<NavigationLoader />

<div
	class={[
		'flex min-h-screen w-full flex-col bg-[var(--background-base)] text-foreground',
		isAdminRoute ? 'pb-0' : 'pb-[calc(82px+env(safe-area-inset-bottom))] md:pb-0'
	]}
>
	{#if !isLoginRoute && !isAdminRoute}
		<div class="hidden md:block">
			<Header />
		</div>
	{/if}
	{#if !isLoginRoute && !isAdminRoute}
		<div class="sticky top-0 z-40 border-b border-[var(--border-faint)] bg-white/95 backdrop-blur-xl px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 md:hidden">
			<SearchBar size="md" placeholder="Search parts" />
		</div>
	{/if}
	<main class="flex min-w-0 w-full flex-1 flex-col">
		{#if showSkeleton && skeletonRoute}
			<RouteSkeleton pathname={skeletonRoute} />
		{:else}
			{@render children()}
		{/if}
	</main>
	{#if !isLoginRoute && !isAdminRoute}
		<div class="hidden md:block">
			<Footer />
		</div>
		<MobileTabBar />
	{/if}
</div>
