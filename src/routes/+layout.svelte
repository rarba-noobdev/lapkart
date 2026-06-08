<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setAuthContext } from '$lib/auth-context';
	import type { LayoutProps } from './$types';
	import { goto } from '$app/navigation';
	import { Search } from '@lucide/svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import NavigationLoader from '$lib/components/NavigationLoader.svelte';
	import { hydrateCart } from '$lib/cart';

	let mobileQuery = $state('');

	let { data, children }: LayoutProps = $props();
	let { supabase, session, user, role, claims } = $derived(data);
	const isLoginRoute = $derived(page.url.pathname === '/login');
	const isAdminRoute = $derived(page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/'));

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

		const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
			syncProfileChannel(session?.user?.id);
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
			<form onsubmit={(e) => { e.preventDefault(); void goto(`/products?q=${encodeURIComponent(mobileQuery.trim())}`); }}>
				<label class="flex h-10 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] focus-within:border-[var(--heat-100)] focus-within:shadow-[0_0_0_3px_var(--heat-12)]">
					<Search class="ml-3 size-[15px] text-[var(--black-alpha-40)]" />
					<input
						bind:value={mobileQuery}
						type="search"
						name="q"
						autocomplete="off"
						placeholder="Search parts"
						class="text-body-medium h-full flex-1 border-none bg-transparent px-3 outline-none placeholder:text-[var(--black-alpha-48)]"
					/>
				</label>
			</form>
		</div>
	{/if}
	<main class="flex min-w-0 w-full flex-1 flex-col">{@render children()}</main>
	{#if !isLoginRoute && !isAdminRoute}
		<div class="hidden md:block">
			<Footer />
		</div>
		<MobileTabBar />
	{/if}
</div>
