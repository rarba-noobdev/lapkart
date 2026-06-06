<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		CheckCircle2,
		Flame,
		LoaderCircle,
		Lock,
		Mail,
		ShieldCheck,
		Truck,
		User
	} from '@lucide/svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { getAuthContext } from '$lib/auth-context';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	const auth = getAuthContext();
	let mode = $state<'signin' | 'signup'>('signin');
	let loading = $state(false);
	let oauthLoading = $state(false);
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
		oauthLoading = true;
		const { error: oauthError } = await auth.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(data.redirectTarget)}`
			}
		});

		if (oauthError) {
			oauthLoading = false;
		}
	}

	const trustItems = [
		{ icon: ShieldCheck, label: 'Verified components, OEM and tested' },
		{ icon: Truck, label: 'Same day dispatch on common parts' },
		{ icon: CheckCircle2, label: 'Returns and warranty support' }
	];
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign in' : 'Create account'} - lapkart</title>
</svelte:head>

<section class="grid min-h-[100dvh] md:grid-cols-[0.95fr_1fr] lg:grid-cols-[0.9fr_1fr]">
	<aside
		class="relative hidden overflow-hidden bg-[var(--accent-black)] p-8 text-white md:flex md:flex-col md:justify-between lg:p-12"
	>
		<div class="grain absolute inset-0 opacity-30"></div>

		<div
			class="pointer-events-none absolute -top-8 -right-8 h-[480px] w-[480px] rounded-full opacity-40 blur-3xl"
			style="background: radial-gradient(circle at center, var(--heat-100) 0%, transparent 60%);"
		></div>
		<div
			class="pointer-events-none absolute -bottom-12 -left-8 h-[380px] w-[380px] rounded-full opacity-25 blur-3xl"
			style="background: radial-gradient(circle at center, var(--heat-200) 0%, transparent 60%);"
		></div>

		<a href={resolve('/')} class="motion-soft-link relative z-10 flex items-baseline gap-2">
			<Flame class="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
			<span class="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
				lap<span class="text-[var(--heat-100)]">kart</span>
			</span>
			<span class="text-mono-x-small ml-1 tracking-[0.18em] text-white/40 uppercase">/parts</span>
		</a>

		<div class="relative z-10 max-w-[460px] space-y-8">
			<p class="text-mono-x-small tracking-[0.18em] text-white/40 uppercase">Account access</p>
			<h2 class="text-title-h2 font-display leading-[1.04] text-balance text-white">
				Original components.<br />
				<span class="text-[var(--heat-100)]">Verified supply.</span>
			</h2>
			<p class="text-body-large text-white/65">
				Sign in to manage orders, track shipments, and check out faster across the LapKart catalog.
			</p>

			<ul class="space-y-4 pt-2">
				{#each trustItems as item (item.label)}
					<li class="flex items-start gap-3">
						<span
							class="flex size-8 shrink-0 items-center justify-center rounded-full border-1 border-white/12 bg-white/4 text-[var(--heat-100)]"
						>
							<item.icon class="size-4" strokeWidth={2} />
						</span>
						<span class="text-body-medium text-white/80">{item.label}</span>
					</li>
				{/each}
			</ul>
		</div>

		<div class="relative z-10 flex items-center justify-between border-t-1 border-white/8 pt-6">
			<p class="text-mono-x-small tracking-[0.18em] text-white/35 uppercase">
				lapkart &copy; {new Date().getFullYear()}
			</p>
			<div class="text-label-small flex gap-6 text-white/40">
				<a href={resolve('/terms')} class="motion-soft-link transition-colors hover:text-white"
					>Terms</a
				>
				<a href={resolve('/privacy')} class="motion-soft-link transition-colors hover:text-white"
					>Privacy</a
				>
			</div>
		</div>
	</aside>

	<main
		class="flex flex-col items-center justify-center bg-[var(--background-base)] px-6 py-10 lg:px-12"
	>
		<div class="w-full max-w-[420px]">
			<a href={resolve('/')} class="motion-soft-link mb-8 flex items-baseline gap-2 md:hidden">
				<Flame class="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
				<span class="font-display text-[24px] font-medium tracking-[-0.02em] text-foreground">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
			</a>

			<div class="mb-6">
				<p class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-48)] uppercase">
					{mode === 'signin' ? 'Welcome back' : 'New account'}
				</p>
				<h1 class="text-title-h4 mt-2 font-display tracking-tight text-foreground">
					{mode === 'signin' ? 'Sign in to LapKart' : 'Create your account'}
				</h1>
				<p class="text-body-medium mt-2 text-[var(--black-alpha-56)]">
					{mode === 'signin'
						? 'Enter your details to access orders and saved addresses.'
						: 'Join LapKart to track orders and check out faster.'}
				</p>
			</div>

			<div
				class="mb-6 grid grid-cols-2 rounded-lg border-1 border-[var(--border-muted)] bg-white p-1"
			>
				<button
					type="button"
					class={`text-label-small h-10 rounded-md transition-colors ${
						mode === 'signin'
							? 'bg-[var(--accent-black)] text-white shadow-card'
							: 'text-[var(--black-alpha-56)] hover:text-foreground'
					}`}
					onclick={() => (mode = 'signin')}
				>
					Sign in
				</button>
				<button
					type="button"
					class={`text-label-small h-10 rounded-md transition-colors ${
						mode === 'signup'
							? 'bg-[var(--accent-black)] text-white shadow-card'
							: 'text-[var(--black-alpha-56)] hover:text-foreground'
					}`}
					onclick={() => (mode = 'signup')}
				>
					Create account
				</button>
			</div>

			<button
				type="button"
				disabled={oauthLoading || loading}
				class="motion-press text-label-medium flex h-11 w-full items-center justify-center gap-3 rounded-lg border-1 border-[var(--border-muted)] bg-white px-4 text-foreground shadow-card transition-all hover:border-[var(--border-loud)] hover:bg-[var(--background-lighter)] disabled:opacity-50"
				onclick={signInWithGoogle}
			>
				{#if oauthLoading}
					<LoaderCircle class="size-4 animate-spin text-[var(--heat-100)]" />
					Connecting to Google
				{:else}
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
				{/if}
			</button>

			<div class="relative my-6 flex items-center gap-3">
				<div class="h-[1px] flex-1 bg-[var(--border-faint)]"></div>
				<span class="text-mono-x-small tracking-[0.18em] text-[var(--black-alpha-40)] uppercase">
					or with email
				</span>
				<div class="h-[1px] flex-1 bg-[var(--border-faint)]"></div>
			</div>

			<form
				method="POST"
				action={mode === 'signin' ? '?/signin' : '?/signup'}
				use:enhance={handleSubmit}
				class="space-y-4"
			>
				<input type="hidden" name="redirectTo" value={data.redirectTarget} />

				{#if mode === 'signup'}
					<div class="space-y-2">
						<label for="fullName" class="text-label-small block text-foreground">Full name</label>
						<div class="relative">
							<User
								class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-40)]"
							/>
							<input
								id="fullName"
								name="fullName"
								value={fullNameValue}
								autocomplete="name"
								placeholder="Aarav Sharma"
								class="input-field pr-3 pl-10"
								required
							/>
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<label for="email" class="text-label-small block text-foreground">Email address</label>
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
							class="input-field pr-3 pl-10"
							required
						/>
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label for="password" class="text-label-small block text-foreground">Password</label>
						{#if mode === 'signin'}
							<a
								href="#forgot"
								class="text-label-small text-[var(--heat-100)] transition-opacity hover:opacity-80"
							>
								Forgot password?
							</a>
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
							placeholder={mode === 'signin' ? 'Your password' : 'Minimum 6 characters'}
							class="input-field pr-3 pl-10"
							required
						/>
					</div>
				</div>

				{#if activeMessage}
					<div
						class={`text-body-small flex items-start gap-2 rounded-md border-1 px-3 py-3 ${
							isSuccessMessage
								? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/8 text-[var(--accent-forest)]'
								: 'border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]'
						}`}
					>
						<span class="mt-2 size-6 shrink-0 rounded-full bg-current"></span>
						<span>{activeMessage}</span>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading || oauthLoading}
					class="button button-primary text-label-medium mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-white disabled:opacity-70"
				>
					{#if loading}
						<LoaderCircle class="size-4 animate-spin" />
						{mode === 'signin' ? 'Signing in' : 'Creating account'}
					{:else}
						{mode === 'signin' ? 'Sign in' : 'Create account'}
						<ArrowRight class="size-4" />
					{/if}
				</button>
			</form>

			<p class="text-body-small mt-8 text-center text-[var(--black-alpha-56)]">
				By continuing you accept the
				<a
					href={resolve('/terms')}
					class="text-foreground underline-offset-2 transition-colors hover:text-[var(--heat-100)] hover:underline"
					>terms</a
				>
				and
				<a
					href={resolve('/privacy')}
					class="text-foreground underline-offset-2 transition-colors hover:text-[var(--heat-100)] hover:underline"
					>privacy policy</a
				>.
			</p>
		</div>
	</main>
</section>
