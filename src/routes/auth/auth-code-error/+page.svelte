<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	const androidPackageName = 'com.lapkart.store';
	const appLinkHost = 'www.lapkart.store';
	const redirectStorageKey = 'lapkart_auth_app_redirect_attempted';

	const nextPath = $derived(sanitizeNext(page.url.searchParams.get('next')));
	const appLoginPath = $derived(
		`${resolve('/login')}?redirect=${encodeURIComponent(nextPath)}&source=android_auth_retry`
	);
	const webFallbackUrl = $derived(`https://${appLinkHost}${appLoginPath}`);
	const androidIntentUrl = $derived(
		`intent://${appLinkHost}${appLoginPath}#Intent;scheme=https;package=${androidPackageName};S.browser_fallback_url=${encodeURIComponent(webFallbackUrl)};end`
	);

	function sanitizeNext(next: string | null) {
		if (!next) return '/profile';
		return next.startsWith('/') && !next.startsWith('//') ? next : '/profile';
	}

	function shouldAutoOpenAndroidApp() {
		const userAgent = navigator.userAgent;
		return /android/i.test(userAgent) && !/;\s*wv[);]/i.test(userAgent);
	}

	function openAndroidApp() {
		window.location.assign(androidIntentUrl);
	}

	function retryInBrowser() {
		window.location.assign(appLoginPath);
	}

	onMount(() => {
		if (!shouldAutoOpenAndroidApp()) return;

		const lastAttempt = Number(sessionStorage.getItem(redirectStorageKey) ?? '0');
		if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 5_000) return;

		sessionStorage.setItem(redirectStorageKey, String(Date.now()));
		window.setTimeout(() => {
			window.location.assign(androidIntentUrl);
		}, 450);
	});
</script>

<svelte:head>
	<title>Authentication Error - lapkart</title>
</svelte:head>

<section class="container mx-auto px-4 py-14">
	<div class="mx-auto max-w-[560px] rounded-[18px] border border-red-200 bg-white p-8">
		<p class="text-mono-x-small tracking-[0.18em] text-red-600 uppercase">Authentication</p>
		<h1 class="text-title-h4 mt-3 font-display text-foreground">Could not complete sign-in</h1>
		<p class="text-body-medium mt-3 text-[var(--black-alpha-64)]">
			The sign-in callback did not return a valid session. On Android, we will open LapKart so
			you can retry safely inside the app.
		</p>

		<div class="mt-6 flex flex-col gap-3 sm:flex-row">
			<button
				type="button"
				class="button button-primary text-label-medium inline-flex h-12 items-center justify-center rounded-md px-6 text-white"
				onclick={openAndroidApp}
			>
				Open LapKart app
			</button>
			<button
				type="button"
				class="button text-label-medium inline-flex h-12 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-6 text-foreground"
				onclick={retryInBrowser}
			>
				Retry in browser
			</button>
		</div>
	</div>
</section>
