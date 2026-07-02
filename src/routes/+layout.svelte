<script lang="ts">
	import { goto, invalidate, preloadCode } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page, navigating, updated } from '$app/state';
	import { onMount } from 'svelte';
	import '../app.css';
	import { setAuthContext } from '$lib/auth-context';
	import type { LayoutProps } from './$types';
	import AppUpdatePrompt from '$lib/components/AppUpdatePrompt.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Header from '$lib/components/Header.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import NavigationLoader from '$lib/components/NavigationLoader.svelte';
	import NativeOnboarding from '$lib/components/NativeOnboarding.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import RouteSkeleton from '$lib/components/RouteSkeleton.svelte';
	import CookieConsent from '$lib/components/CookieConsent.svelte';
	import OfflineBanner from '$lib/components/OfflineBanner.svelte';
	import { hydrateCart } from '$lib/cart';
	import { loadStoredConsent } from '$lib/cookie-consent.svelte';
	import { isNativeApp, setupNativeAppShell } from '$lib/native/capacitor';
	import { runWhenIdle } from '$lib/performance';
	import { organizationJsonLd, safeJsonLd, shouldNoIndexPath, websiteJsonLd } from '$lib/seo';

	let { data, children }: LayoutProps = $props();
	let { supabase, session, user, role, claims } = $derived(data);
	const isLoginRoute = $derived(page.url.pathname === '/login');
	const isAdminRoute = $derived(
		page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/')
	);
	const robotsNoIndex = $derived(shouldNoIndexPath(page.url.pathname));
	const siteJsonLd = $derived(
		safeJsonLd([organizationJsonLd(page.url.origin), websiteJsonLd(page.url.origin)])
	);

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
		let disposed = false;
		let nativeCleanup: (() => void | Promise<void>) | undefined;
		const cancelRouteWarmup = runWhenIdle(
			() => {
				// Warm route code without issuing speculative data requests that
				// compete with product images on constrained mobile connections.
				for (const route of ['/products', '/cart', user ? '/orders' : '/login']) {
					void preloadCode(route);
				}
			},
			{ timeout: 2500 }
		);
		const cancelNativeCatalogWarmup = runWhenIdle(
			() => {
				void isNativeApp()
					.then((native) => {
						if (!native || !navigator.onLine) return;
						for (const endpoint of [
							'/api/catalog/home',
							'/api/catalog/category-counts',
							'/api/search/products?limit=24'
						]) {
							void fetch(endpoint, { credentials: 'omit' }).catch(() => null);
						}
					})
					.catch(() => {});
			},
			{ timeout: 4500 }
		);

		void setupNativeAppShell({
			getPathname: () => window.location.pathname,
			navigate: (path) => goto(resolve(path as unknown as '/')),
			onResume: () => {
				void updated.check();
			}
		}).then((cleanup) => {
			if (disposed) {
				void cleanup();
				return;
			}
			nativeCleanup = cleanup;
		});

		// Keep analytics off the first render path; native WebView sessions skip it.
		const cancelAnalytics = runWhenIdle(
			() => {
				void isNativeApp()
					.then((native) => {
						if (!native) installGoogleAnalytics();
					})
					.catch(() => installGoogleAnalytics());
			},
			{ timeout: 3500 }
		);

		const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_OUT') {
				// Purge any cached page HTML so a signed-out (or next) user can't
				// pull a previous session's pages from the service worker cache.
				navigator.serviceWorker?.controller?.postMessage({ type: 'clear-pages' });
			}
			if (session?.expires_at !== claims?.exp) void invalidate('supabase:auth');
			if (session?.user?.id !== user?.id) void invalidate('app:profile');
		});

		return () => {
			disposed = true;
			cancelRouteWarmup();
			cancelNativeCatalogWarmup();
			cancelAnalytics();
			void nativeCleanup?.();
			authListener.subscription.unsubscribe();
		};
	});

	function installGoogleAnalytics() {
		if (window.gtag) return;

		const GA_ID = 'G-154H1YG3SM';
		window.dataLayer = window.dataLayer || [];
		function gtag(...args: unknown[]) {
			window.dataLayer.push(args);
		}
		window.gtag = gtag;
		gtag('consent', 'default', {
			analytics_storage: 'denied',
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
			wait_for_update: 500
		});
		const storedConsent = loadStoredConsent();
		if (storedConsent === 'granted') {
			gtag('consent', 'update', {
				analytics_storage: 'granted',
				ad_storage: 'granted',
				ad_user_data: 'granted',
				ad_personalization: 'granted'
			});
		}
		const gaScript = document.createElement('script');
		gaScript.async = true;
		gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
		document.head.appendChild(gaScript);
		gtag('js', new Date());
		gtag('config', GA_ID);
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={asset('/brand/lapkart-logo.svg')} />
	<link rel="icon" type="image/png" sizes="32x32" href={asset('/brand/lapkart-icon-32.png')} />
	<link rel="apple-touch-icon" href={asset('/brand/apple-touch-icon.png')} />
	<link rel="manifest" href={asset('/site.webmanifest')} />
	<meta property="og:site_name" content="LapKart" />
	<meta name="application-name" content="LapKart" />
	<meta name="mobile-web-app-capable" content="yes" />
	{#if robotsNoIndex}
		<meta name="robots" content="noindex,nofollow" />
	{/if}
	<svelte:element this={'script'} type="application/ld+json">{siteJsonLd}</svelte:element>
</svelte:head>

<NavigationLoader />

<NativeOnboarding />

<OfflineBanner />

<AppUpdatePrompt />

<CookieConsent />

<div
	data-sveltekit-preload-data="hover"
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
		<div
			class="mobile-search-header sticky top-0 z-40 border-b border-[var(--border-faint)] bg-white/95 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-xl md:hidden"
		>
			<SearchBar size="md" placeholder="Search parts" />
		</div>
	{/if}
	<main class="flex w-full min-w-0 flex-1 flex-col">
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
