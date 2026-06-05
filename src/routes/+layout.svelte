<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { setAuthContext } from '$lib/auth-context';
	import type { LayoutProps } from './$types';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import { hydrateCart } from '$lib/cart';

	let { data, children }: LayoutProps = $props();
	let { supabase, session, user, role, claims } = $derived(data);
	const isLoginRoute = $derived(page.url.pathname === '/login');

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
		const profileSyncInterval = window.setInterval(() => {
			syncProfileChannel(user?.id);
		}, 500);

		const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.expires_at !== claims?.exp) void invalidate('supabase:auth');
		});

		return () => {
			window.clearInterval(profileSyncInterval);
			authListener.subscription.unsubscribe();
			if (profileChannel) void supabase.removeChannel(profileChannel);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-[var(--background-base)] text-foreground">
	{#if !isLoginRoute}
		<Header />
	{/if}
	<main class="flex flex-1 flex-col">{@render children()}</main>
	{#if !isLoginRoute}
		<Footer />
	{/if}
</div>
