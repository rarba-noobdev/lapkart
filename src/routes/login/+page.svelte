<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowRight, Flame, LoaderCircle, Lock, Mail, User } from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { getAuthContext } from '$lib/auth-context';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	const auth = getAuthContext();
	let mode = $state<'signin' | 'signup'>('signin');
	let loading = $state(false);
	let password = $state('');
	let activeMessage = $derived(form?.mode === mode ? (form?.message ?? null) : null);
	let isSuccessMessage = $derived(Boolean(form?.success && form?.mode === mode));
	let fullNameValue = $derived(form?.mode === mode ? (form?.fullName ?? '') : '');
	let emailValue = $derived(form?.mode === mode ? (form?.email ?? '') : '');

	const handleSubmit: SubmitFunction = () => {
		loading = true;
		return async ({ update }) => {
			await update();
			loading = false;
		};
	};

	async function signInWithGoogle() {
		loading = true;
		const { error: oauthError } = await auth.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(data.redirectTarget)}`
			}
		});

		if (oauthError) {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign in' : 'Create account'} - LapKart</title>
</svelte:head>

<section class="grid min-h-screen md:grid-cols-[1.1fr_1fr] lg:grid-cols-[1.2fr_1fr]">
	<!-- Left Side: Branding / Value Prop -->
	<aside
		class="relative hidden overflow-hidden bg-[var(--accent-black)] p-10 text-white md:flex md:flex-col md:justify-between lg:p-14"
	>
		<!-- Subtle grain/texture instead of glowing blobs -->
		<div class="grain absolute inset-0 opacity-20"></div>

		<!-- Logo -->
		<a href={resolve('/')} class="relative z-10 flex items-baseline gap-2">
			<Flame class="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
			<span class="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
				lap<span class="text-[var(--heat-100)]">kart</span>
			</span>
		</a>

		<!-- Value Proposition -->
		<div class="relative z-10 space-y-8">
			<p class="text-mono-x-small tracking-[0.18em] text-white/40 uppercase">Account access</p>
			<h2 class="text-title-h2 font-display leading-[1.05] text-balance text-white">
				Every part your laptop deserves.
				<br />
				<span class="text-[var(--heat-100)]">Delivered fast.</span>
			</h2>
			<p class="text-body-large max-w-md text-white/65">
				Sign in to track orders, save delivery addresses, and check out faster when the right part
				is in stock.
			</p>
		</div>

		<!-- Footer area -->
		<div class="relative z-10 flex items-center justify-between">
			<p class="text-mono-x-small tracking-[0.18em] text-white/35 uppercase">
				lapkart &copy; {new Date().getFullYear()}
			</p>
			<div class="text-label-small flex gap-6 text-white/40">
				<a href={resolve('/terms')} class="transition-colors hover:text-white">Terms</a>
				<a href={resolve('/privacy')} class="transition-colors hover:text-white">Privacy</a>
			</div>
		</div>
	</aside>

	<!-- Right Side: Auth Form -->
	<main
		class="flex flex-col items-center justify-center bg-[var(--background-base)] px-6 py-12 lg:px-12"
	>
		<div class="w-full max-w-[420px]">
			<!-- Mobile Logo -->
			<a href={resolve('/')} class="mb-10 flex items-center gap-2 md:hidden">
				<div class="flex size-8 items-center justify-center rounded-lg bg-[var(--heat-100)]">
					<Flame class="size-5 text-white" strokeWidth={2.5} />
				</div>
				<span class="font-display text-2xl font-semibold tracking-tight text-foreground">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
			</a>

			<div class="mb-8">
				<h1 class="font-display text-3xl tracking-tight text-foreground">
					{mode === 'signin' ? 'Welcome back' : 'Create an account'}
				</h1>
				<p class="mt-2 text-sm text-[var(--black-alpha-56)]">
					{mode === 'signin'
						? 'Enter your details to sign in to your account.'
						: 'Join LapKart to start shopping for laptop parts.'}
				</p>
			</div>

			<!-- Google Auth -->
			<button
				type="button"
				disabled={loading}
				class="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[var(--border-muted)] bg-white px-4 text-sm font-medium text-foreground shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50"
				onclick={signInWithGoogle}
			>
				<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
					<path
						fill="#FFC107"
						d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
					/>
					<path
						fill="#FF3D00"
						d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
					/>
					<path
						fill="#4CAF50"
						d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
					/>
					<path
						fill="#1976D2"
						d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
					/>
				</svg>
				Continue with Google
			</button>

			<div class="relative my-7">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-[var(--border-faint)]"></div>
				</div>
				<div class="relative flex justify-center text-xs tracking-widest uppercase">
					<span class="bg-[var(--background-base)] px-4 text-[var(--black-alpha-40)]">or</span>
				</div>
			</div>

			<!-- Email Auth Form -->
			<form
				method="POST"
				action={mode === 'signin' ? '?/signin' : '?/signup'}
				use:enhance={handleSubmit}
				class="space-y-4"
			>
				<input type="hidden" name="redirectTo" value={data.redirectTarget} />

				{#if mode === 'signup'}
					<div class="space-y-1.5">
						<label for="fullName" class="text-sm font-medium text-foreground">Full name</label>
						<div class="relative">
							<User
								class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-40)]"
							/>
							<input
								id="fullName"
								name="fullName"
								value={fullNameValue}
								autocomplete="name"
								placeholder="John Doe"
								class="h-11 w-full rounded-lg border border-[var(--border-muted)] bg-white pr-4 pl-10 text-sm transition-shadow outline-none focus:border-[var(--heat-100)] focus:ring-2 focus:ring-[var(--heat-12)]"
								required
							/>
						</div>
					</div>
				{/if}

				<div class="space-y-1.5">
					<label for="email" class="text-sm font-medium text-foreground">Email address</label>
					<div class="relative">
						<Mail
							class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-40)]"
						/>
						<input
							id="email"
							name="email"
							type="email"
							value={emailValue}
							autocomplete="email"
							autocapitalize="none"
							spellcheck="false"
							placeholder="you@example.com"
							class="h-11 w-full rounded-lg border border-[var(--border-muted)] bg-white pr-4 pl-10 text-sm transition-shadow outline-none focus:border-[var(--heat-100)] focus:ring-2 focus:ring-[var(--heat-12)]"
							required
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<div class="flex items-center justify-between">
						<label for="password" class="text-sm font-medium text-foreground">Password</label>
						{#if mode === 'signin'}
							<a href="#forgot" class="text-xs font-medium text-[var(--heat-100)] hover:underline"
								>Forgot password?</a
							>
						{/if}
					</div>
					<div class="relative">
						<Lock
							class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-40)]"
						/>
						<input
							id="password"
							bind:value={password}
							name="password"
							type="password"
							minlength="6"
							autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
							placeholder="Minimum 6 characters"
							class="h-11 w-full rounded-lg border border-[var(--border-muted)] bg-white pr-4 pl-10 text-sm transition-shadow outline-none focus:border-[var(--heat-100)] focus:ring-2 focus:ring-[var(--heat-12)]"
							required
						/>
					</div>
				</div>

				{#if activeMessage}
					<div
						class={`rounded-lg p-3 text-sm ${
							isSuccessMessage
								? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
								: 'border border-red-200 bg-red-50 text-red-700'
						}`}
					>
						{activeMessage}
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="button button-primary mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-70"
				>
					{#if loading}
						<LoaderCircle class="size-4 animate-spin" />
					{:else}
						{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight class="size-4" />
					{/if}
				</button>
			</form>

			<p class="mt-8 text-center text-sm text-[var(--black-alpha-56)]">
				{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
				<button
					type="button"
					class="ml-1 font-medium text-foreground underline decoration-[var(--border-muted)] underline-offset-4 transition-colors hover:text-[var(--heat-100)]"
					onclick={() => (mode = mode === 'signin' ? 'signup' : 'signin')}
				>
					{mode === 'signin' ? 'Sign up' : 'Log in'}
				</button>
			</p>
		</div>
	</main>
</section>
