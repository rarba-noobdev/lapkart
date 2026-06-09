<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import {
		ArrowRight,
		BadgeCheck,
		Eye,
		EyeOff,
		Flame,
		LoaderCircle,
		Lock,
		Mail,
		RotateCcw,
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
	let showPassword = $state(false);
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
		if (oauthError) oauthLoading = false;
	}
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign in' : 'Create account'} - LapKart</title>
</svelte:head>

<section class="grid min-h-[100dvh] lg:grid-cols-2">
	<!-- Left: Brand panel (desktop only) -->
	<aside class="relative hidden overflow-hidden bg-[var(--accent-black)] lg:flex lg:flex-col lg:justify-between p-10 xl:p-14">
		<div class="grid-pattern absolute inset-0 opacity-30"></div>
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,var(--heat-12)_0%,transparent_60%)] pointer-events-none"></div>

		<!-- Logo -->
		<a href={resolve('/')} class="relative z-10 inline-flex items-center gap-2.5">
			<div class="grid size-9 place-items-center rounded-lg bg-[var(--heat-100)] shadow-[0_0_20px_var(--heat-40)]">
				<Flame class="size-4.5 text-white" strokeWidth={2.5} />
			</div>
			<span class="text-[20px] font-semibold tracking-tight text-white">
				lap<span class="text-[var(--heat-100)]">kart</span>
			</span>
		</a>

		<!-- Pitch -->
		<div class="relative z-10 max-w-md">
			<h2 class="text-[32px] font-medium leading-[1.15] tracking-tight text-white xl:text-[38px]">
				Genuine laptop parts,<br />
				<span class="text-[var(--heat-100)]">shipped fast.</span>
			</h2>
			<p class="mt-3 text-[14px] leading-relaxed text-white/60 xl:text-[15px]">
				RAM, SSDs, batteries, displays — with fitment guidance and same-day dispatch from verified inventory.
			</p>

			<div class="mt-8 space-y-4">
				<div class="flex items-center gap-3">
					<div class="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.06] border border-white/[0.08]">
						<BadgeCheck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					</div>
					<div>
						<p class="text-[13px] font-medium text-white">Genuine parts</p>
						<p class="text-[11px] text-white/55">OEM-verified with grade transparency</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.06] border border-white/[0.08]">
						<Truck class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					</div>
					<div>
						<p class="text-[13px] font-medium text-white">Same-day dispatch</p>
						<p class="text-[11px] text-white/55">In-stock items ship from local inventory</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<div class="grid size-8 shrink-0 place-items-center rounded-md bg-white/[0.06] border border-white/[0.08]">
						<RotateCcw class="size-4 text-[var(--heat-100)]" strokeWidth={2} />
					</div>
					<div>
						<p class="text-[13px] font-medium text-white">DOA replacements</p>
						<p class="text-[11px] text-white/55">Clear return windows on every order</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="relative z-10 flex items-center justify-between text-[10px] tracking-[0.12em] text-white/45 uppercase">
			<span>&copy; {new Date().getFullYear()} LapKart</span>
			<div class="flex gap-5">
				<a href={resolve('/terms')} class="transition-colors hover:text-white/60">Terms</a>
				<a href={resolve('/privacy')} class="transition-colors hover:text-white/60">Privacy</a>
			</div>
		</div>
	</aside>

	<!-- Right: Form -->
	<main class="flex flex-col items-center justify-center bg-[var(--background-lighter)] p-5 sm:p-8 lg:p-12">
		<div class="motion-section w-full max-w-[400px] space-y-6">
			<!-- Mobile logo -->
			<a href={resolve('/')} class="inline-flex items-center gap-2 lg:hidden">
				<div class="grid size-8 place-items-center rounded-lg bg-[var(--heat-100)]">
					<Flame class="size-4 text-white" strokeWidth={2.5} />
				</div>
				<span class="text-[18px] font-semibold tracking-tight text-foreground">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
			</a>

			<!-- Heading -->
			<div>
				<h1 class="text-[22px] font-medium tracking-tight text-foreground sm:text-[26px]">
					{mode === 'signin' ? 'Welcome back' : 'Create account'}
				</h1>
				<p class="mt-1 text-[13px] text-[var(--black-alpha-48)]">
					{mode === 'signin'
						? 'Sign in to your LapKart account.'
						: 'Create an account to start ordering parts.'}
				</p>
			</div>

			<!-- Tab toggle -->
			<div class="relative flex rounded-lg bg-[var(--background-base)] p-1 border border-[var(--border-faint)]">
				<button
					type="button"
					class="relative z-10 flex-1 py-2 text-[13px] font-medium rounded-md transition-colors
						{mode === 'signin' ? 'text-foreground' : 'text-[var(--black-alpha-48)]'}"
					onclick={() => { mode = 'signin'; password = ''; }}
				>
					Sign in
				</button>
				<button
					type="button"
					class="relative z-10 flex-1 py-2 text-[13px] font-medium rounded-md transition-colors
						{mode === 'signup' ? 'text-foreground' : 'text-[var(--black-alpha-48)]'}"
					onclick={() => { mode = 'signup'; password = ''; }}
				>
					Create account
				</button>
				<div
					class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md bg-white shadow-sm border border-[var(--border-faint)] transition-all duration-200 ease-out"
					style="left: {mode === 'signin' ? '4px' : 'calc(50%)'}"
				></div>
			</div>

			<!-- Form card -->
			<div class="rounded-lg border border-[var(--border-faint)] bg-white p-5 sm:p-6">
				<form method="POST" action={mode === 'signin' ? '?/signin' : '?/signup'} use:enhance={handleSubmit} class="space-y-4">
					<input type="hidden" name="redirectTo" value={data.redirectTarget} />

					{#if mode === 'signup'}
						<label class="block">
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Full name</span>
							<div class="relative">
								<User class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-32)] pointer-events-none" />
								<input name="fullName" value={fullNameValue} autocomplete="name" placeholder="John Doe" class="input-field !h-10 pl-10 text-[13px]" required />
							</div>
						</label>
					{/if}

					<label class="block">
						<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Email</span>
						<div class="relative">
							<Mail class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-32)] pointer-events-none" />
							<input name="email" type="email" value={emailValue} autocomplete="email" placeholder="you@example.com" class="input-field !h-10 pl-10 text-[13px]" required />
						</div>
					</label>

					<label class="block">
						<span class="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--black-alpha-56)]">
							Password
							{#if mode === 'signin'}
								<a href="#forgot" class="text-[var(--heat-100)] hover:underline">Forgot?</a>
							{/if}
						</span>
						<div class="relative">
							<Lock class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--black-alpha-32)] pointer-events-none" />
							<input bind:value={password} name="password" type={showPassword ? 'text' : 'password'} minlength="8" autocomplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="••••••••" class="input-field !h-10 pl-10 pr-10 text-[13px]" required />
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--black-alpha-32)] transition-colors hover:text-foreground"
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{#if showPassword}
									<EyeOff class="size-4" />
								{:else}
									<Eye class="size-4" />
								{/if}
							</button>
						</div>
					</label>

					{#if activeMessage}
						<div class="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]
							{isSuccessMessage
								? 'border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/6 text-[var(--accent-forest)]'
								: 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]'}">
							<span class="mt-1 size-1.5 shrink-0 rounded-full bg-current"></span>
							<span>{activeMessage}</span>
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading || oauthLoading}
						class="button button-primary flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-medium text-white disabled:opacity-50"
					>
						{#if loading}
							<LoaderCircle class="size-4 animate-spin" />
							{mode === 'signin' ? 'Signing in...' : 'Creating...'}
						{:else}
							{mode === 'signin' ? 'Sign in' : 'Create account'}
							<ArrowRight class="size-3.5" />
						{/if}
					</button>
				</form>

				<!-- Divider -->
				<div class="relative my-5 flex items-center">
					<div class="h-px flex-1 bg-[var(--border-faint)]"></div>
					<span class="px-3 text-[10px] tracking-[0.1em] text-[var(--black-alpha-32)] uppercase">or</span>
					<div class="h-px flex-1 bg-[var(--border-faint)]"></div>
				</div>

				<!-- Google -->
				<button
					type="button"
					disabled={oauthLoading || loading}
					onclick={signInWithGoogle}
					class="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[var(--border-muted)] bg-white text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--background-lighter)] disabled:opacity-50"
				>
					{#if oauthLoading}
						<LoaderCircle class="size-4 animate-spin" />
						Connecting...
					{:else}
						<svg width="16" height="16" viewBox="0 0 48 48">
							<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
							<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
							<path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
							<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
						</svg>
						Continue with Google
					{/if}
				</button>
			</div>

			<!-- Terms -->
			<p class="text-center text-[11px] text-[var(--black-alpha-40)]">
				By continuing, you agree to our
				<a href={resolve('/terms')} class="underline underline-offset-2 hover:text-foreground">Terms</a>
				and
				<a href={resolve('/privacy')} class="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
			</p>
		</div>
	</main>
</section>
