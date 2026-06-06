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
		{ 
			icon: ShieldCheck, 
			title: 'Verified Supply Chain',
			desc: 'All parts undergo 100% genuine OEM inspection and verification.' 
		},
		{ 
			icon: Truck, 
			title: 'Ultra-Fast Dispatch',
			desc: 'Same-day packaging and fast shipping for high-priority items.' 
		},
		{ 
			icon: CheckCircle2, 
			title: 'Extended Warranty',
			desc: 'Full support, secure return policies, and official technical backing.' 
		}
	];
</script>

<svelte:head>
	<title>{mode === 'signin' ? 'Sign in' : 'Create account'} - lapkart</title>
</svelte:head>

<section class="grid min-h-[100dvh] lg:grid-cols-[1fr_1fr] bg-[var(--background-lighter)]">
	<!-- Left Brand Panel -->
	<aside
		class="relative hidden overflow-hidden bg-[var(--accent-black)] text-white lg:flex lg:flex-col lg:justify-between border-r border-white/10 p-12"
	>
		<!-- Background Effects -->
		<div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--heat-20)_0%,transparent_50%)] pointer-events-none"></div>
		<div class="grain absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"></div>
		<div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+CjxwYXRoIGQ9Ik0gMjQgMEwgMjQgMjRMMCAyNEwwIDBaIiBmaWxsPSJ0cmFuc3BhcmVudCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz4KPC9zdmc+')] pointer-events-none [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

		<!-- Brand Header -->
		<div class="relative z-10">
			<a href={resolve('/')} class="motion-soft-link inline-flex items-center gap-3 group">
				<div class="flex w-10 h-10 items-center justify-center rounded-xl bg-[var(--heat-100)] shadow-[0_0_24px_var(--heat-40)] transition-transform duration-300 group-hover:scale-105">
					<Flame class="w-5 h-5 text-white" strokeWidth={2.5} />
				</div>
				<span class="font-display text-2xl font-semibold tracking-tight text-white leading-none">
					lap<span class="text-[var(--heat-100)]">kart</span>
				</span>
			</a>
		</div>

		<!-- Value Proposition -->
		<div class="relative z-10 max-w-md my-auto space-y-12">
			<div class="space-y-6">
				<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--heat-100)]/10 border border-[var(--heat-100)]/20">
					<span class="w-1.5 h-1.5 rounded-full bg-[var(--heat-100)] animate-flicker"></span>
					<span class="text-[11px] font-mono tracking-widest text-[var(--heat-100)] uppercase font-semibold">Enterprise Access</span>
				</div>
				<h2 class="text-title-h2 font-display leading-[1.1] text-balance text-white font-medium">
					Hardware logistics,<br />
					<span class="text-transparent bg-clip-text bg-gradient-to-r from-[var(--heat-100)] to-[#ff8c42]">reimagined.</span>
				</h2>
				<p class="text-body-large text-white/60 leading-relaxed max-w-sm">
					Access verified components, trace supply chains, and manage orders with developer-grade precision.
				</p>
			</div>

			<div class="space-y-5">
				{#each trustItems as item}
					<div class="group flex items-start gap-4">
						<div class="flex w-10 h-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-[var(--heat-100)] transition-colors duration-300 group-hover:bg-[var(--heat-100)] group-hover:text-white group-hover:border-[var(--heat-100)]">
							<item.icon class="w-5 h-5" strokeWidth={2} />
						</div>
						<div class="space-y-1 mt-0.5">
							<h3 class="text-label-medium text-white font-medium group-hover:text-[var(--heat-100)] transition-colors">{item.title}</h3>
							<p class="text-body-small text-white/50">{item.desc}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Footer -->
		<div class="relative z-10 flex items-center justify-between text-[11px] font-mono tracking-widest text-white/40 uppercase">
			<p>&copy; {new Date().getFullYear()} Lapkart</p>
			<div class="flex gap-6">
				<a href={resolve('/terms')} class="hover:text-white transition-colors">Terms</a>
				<a href={resolve('/privacy')} class="hover:text-white transition-colors">Privacy</a>
			</div>
		</div>
	</aside>

	<!-- Right Form Panel -->
	<main class="flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-y-auto">
		<div class="w-full max-w-[420px] space-y-8 relative z-10">
			<!-- Mobile Header -->
			<div class="flex items-center justify-between lg:hidden">
				<a href={resolve('/')} class="flex items-center gap-2">
					<div class="flex w-8 h-8 items-center justify-center rounded-lg bg-[var(--heat-100)] shadow-[0_0_16px_var(--heat-40)]">
						<Flame class="w-4 h-4 text-white" strokeWidth={2.5} />
					</div>
					<span class="font-display text-xl font-semibold tracking-tight text-[var(--fg-strong)]">
						lap<span class="text-[var(--heat-100)]">kart</span>
					</span>
				</a>
			</div>

			<!-- Intro -->
			<div class="text-center lg:text-left space-y-2">
				<h1 class="text-title-h3 font-display tracking-tight text-[var(--fg-strong)] font-semibold">
					{mode === 'signin' ? 'Welcome back' : 'Create account'}
				</h1>
				<p class="text-body-medium text-[var(--fg-dim)]">
					{mode === 'signin'
						? 'Enter your credentials to access your dashboard.'
						: 'Sign up to start tracking your hardware orders.'}
				</p>
			</div>

			<!-- Custom Tab Toggles -->
			<div class="relative flex rounded-xl bg-[var(--background-base)] p-1 border border-[var(--border-muted)]">
				<button
					type="button"
					class={`relative flex-1 py-2 text-label-medium rounded-lg font-medium transition-all duration-300 z-10 ${
						mode === 'signin' ? 'text-[var(--fg-strong)]' : 'text-[var(--fg-dim)] hover:text-[var(--fg-strong)]'
					}`}
					onclick={() => { mode = 'signin'; password = ''; }}
				>
					Sign in
				</button>
				<button
					type="button"
					class={`relative flex-1 py-2 text-label-medium rounded-lg font-medium transition-all duration-300 z-10 ${
						mode === 'signup' ? 'text-[var(--fg-strong)]' : 'text-[var(--fg-dim)] hover:text-[var(--fg-strong)]'
					}`}
					onclick={() => { mode = 'signup'; password = ''; }}
				>
					Create account
				</button>
				<!-- Active Pill Background -->
				<div 
					class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm border border-[var(--border-faint)] transition-all duration-300 ease-out"
					style={`left: ${mode === 'signin' ? '4px' : 'calc(50%)'};`}
				></div>
			</div>

			<!-- Form Area -->
			<div class="bg-white rounded-2xl border border-[var(--border-muted)] p-6 shadow-sm relative overflow-hidden">
				<form method="POST" action={mode === 'signin' ? '?/signin' : '?/signup'} use:enhance={handleSubmit} class="space-y-5">
					<input type="hidden" name="redirectTo" value={data.redirectTarget} />

					{#if mode === 'signup'}
						<div class="space-y-1.5 animate-fade-in duration-300">
							<label for="fullName" class="text-label-small text-[var(--fg-strong)]">Full Name</label>
							<div class="relative">
								<User class="absolute top-1/2 left-3 w-4 h-4 -translate-y-1/2 text-[var(--black-alpha-40)] pointer-events-none" />
								<input id="fullName" name="fullName" value={fullNameValue} autocomplete="name" placeholder="John Doe" class="input-field pl-10" required />
							</div>
						</div>
					{/if}

					<div class="space-y-1.5">
						<label for="email" class="text-label-small text-[var(--fg-strong)]">Email Address</label>
						<div class="relative">
							<Mail class="absolute top-1/2 left-3 w-4 h-4 -translate-y-1/2 text-[var(--black-alpha-40)] pointer-events-none" />
							<input id="email" name="email" type="email" value={emailValue} autocomplete="email" placeholder="you@example.com" class="input-field pl-10" required />
						</div>
					</div>

					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label for="password" class="text-label-small text-[var(--fg-strong)]">Password</label>
							{#if mode === 'signin'}
								<a href="#forgot" class="text-label-small text-[var(--heat-100)] hover:underline underline-offset-4 decoration-[var(--heat-40)] transition-colors">
									Forgot?
								</a>
							{/if}
						</div>
						<div class="relative">
							<Lock class="absolute top-1/2 left-3 w-4 h-4 -translate-y-1/2 text-[var(--black-alpha-40)] pointer-events-none" />
							<input id="password" bind:value={password} name="password" type="password" minlength="8" autocomplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="••••••••" class="input-field pl-10" required />
						</div>
					</div>

					{#if activeMessage}
						<div class={`text-body-small flex items-start gap-2.5 rounded-lg border p-3 animate-fade-in duration-300 ${isSuccessMessage ? 'border-[var(--accent-forest)]/30 bg-[var(--accent-forest)]/10 text-green-800' : 'border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/10 text-red-800'}`}>
							<span class="mt-0.5"><div class="w-1.5 h-1.5 rounded-full bg-current"></div></span>
							<span class="leading-relaxed font-medium">{activeMessage}</span>
						</div>
					{/if}

					<button type="submit" disabled={loading || oauthLoading} class="button button-primary w-full h-[44px] rounded-lg text-label-medium font-semibold flex items-center justify-center gap-2 transition-all">
						{#if loading}
							<LoaderCircle class="w-4 h-4 animate-spin" />
							{mode === 'signin' ? 'Signing in...' : 'Creating account...'}
						{:else}
							{mode === 'signin' ? 'Sign In' : 'Create Account'}
							<ArrowRight class="w-4 h-4" />
						{/if}
					</button>
				</form>

				<div class="relative flex items-center py-6">
					<div class="h-[1px] flex-1 bg-[var(--border-muted)]"></div>
					<span class="px-3 text-label-x-small text-[var(--black-alpha-40)] uppercase tracking-wider">Or</span>
					<div class="h-[1px] flex-1 bg-[var(--border-muted)]"></div>
				</div>

				<button type="button" disabled={oauthLoading || loading} onclick={signInWithGoogle} class="motion-press w-full h-[44px] rounded-lg border border-[var(--border-loud)] bg-[var(--background-lighter)] hover:bg-[var(--border-muted)] text-[var(--fg-strong)] text-label-medium font-medium flex items-center justify-center gap-3 transition-colors shadow-sm disabled:opacity-50">
					{#if oauthLoading}
						<LoaderCircle class="w-4 h-4 animate-spin" />
						Connecting...
					{:else}
						<svg width="18" height="18" viewBox="0 0 48 48">
							<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
							<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
							<path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
							<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
						</svg>
						Continue with Google
					{/if}
				</button>
			</div>

			<p class="text-body-small text-center text-[var(--fg-dim)]">
				By continuing, you agree to our 
				<a href={resolve('/terms')} class="underline underline-offset-4 decoration-[var(--border-muted)] hover:decoration-[var(--fg-dim)] hover:text-[var(--fg-strong)] transition-all">Terms</a> 
				and 
				<a href={resolve('/privacy')} class="underline underline-offset-4 decoration-[var(--border-muted)] hover:decoration-[var(--fg-dim)] hover:text-[var(--fg-strong)] transition-all">Privacy Policy</a>.
			</p>
		</div>
	</main>
</section>
