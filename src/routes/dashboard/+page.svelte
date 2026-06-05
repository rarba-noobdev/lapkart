<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ArrowRight,
		CreditCard,
		Lock,
		Package,
		Save,
		Settings,
		ShoppingBag,
		User
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	let saving = $state(false);
	const orderCount = $derived(data.orderCount);
	const totalSpent = $derived(data.totalSpent);
	const phoneLocked = $derived(orderCount > 0);
	const activeMessage = $derived(form?.message ?? null);
	const isSuccessMessage = $derived(Boolean(form?.success));
	const fullNameValue = $derived(form?.fullName ?? data.profile.fullName);
	const phoneValue = $derived(form?.phone ?? data.profile.phone);
	const accountName = $derived(fullNameValue || data.user.email?.split('@')[0] || 'Customer');
	const formattedSpend = $derived(`₹${Math.round(totalSpent).toLocaleString('en-IN')}`);

	const handleSubmit: SubmitFunction = () => {
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
		};
	};
</script>

<svelte:head>
	<title>Account - LapKart</title>
</svelte:head>

<!-- Header -->
<div class="border-b border-[var(--border-faint)] bg-white">
	<div class="container mx-auto px-4 py-8 md:py-12">
		<div class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
			<div>
				<p
					class="text-mono-small mb-2 font-medium tracking-widest text-[var(--heat-100)] uppercase"
				>
					My Account
				</p>
				<h1 class="text-title-h2 font-display text-foreground">Welcome, {accountName}</h1>
				<p class="text-body-medium mt-2 max-w-lg text-[var(--black-alpha-56)]">
					Manage your profile, track your orders, and view your purchase history.
				</p>
			</div>
			<div class="flex flex-wrap gap-3">
				<a
					href={resolve('/products')}
					class="button button-secondary text-label-medium inline-flex h-11 items-center gap-2 rounded-md px-5"
				>
					<ShoppingBag class="size-4" />
					Continue Shopping
				</a>
				<a
					href={resolve('/orders')}
					class="button button-primary text-label-medium inline-flex h-11 items-center gap-2 rounded-md px-5 text-white"
				>
					<Package class="size-4" />
					Track Orders
				</a>
			</div>
		</div>
	</div>
</div>

<main class="container mx-auto px-4 py-8 md:py-12">
	<!-- Summary Cards -->
	<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mb-12 md:gap-6 lg:grid-cols-4">
		<div
			class="rounded-xl border border-[var(--border-faint)] bg-white p-6 shadow-[0_2px_8px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.04)]"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex size-10 items-center justify-center rounded-full bg-[var(--heat-8)] text-[var(--heat-100)]"
				>
					<User class="size-5" />
				</div>
				<div>
					<p class="text-mono-x-small tracking-wider text-[var(--black-alpha-48)] uppercase">
						Profile
					</p>
					<p class="text-label-medium text-foreground">{accountName}</p>
				</div>
			</div>
			<p class="text-body-small truncate text-[var(--black-alpha-56)]">{data.user.email}</p>
		</div>

		<div
			class="rounded-xl border border-[var(--border-faint)] bg-white p-6 shadow-[0_2px_8px_0_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.04)]"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex size-10 items-center justify-center rounded-full bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]"
				>
					<CreditCard class="size-5" />
				</div>
				<div>
					<p class="text-mono-x-small tracking-wider text-[var(--black-alpha-48)] uppercase">
						Total Spend
					</p>
					<p class="text-label-medium font-medium text-[var(--accent-forest)]">Lifetime</p>
				</div>
			</div>
			<p class="font-display text-3xl text-foreground">{formattedSpend}</p>
		</div>

		<a
			href={resolve('/orders')}
			class="group relative block overflow-hidden rounded-xl border border-[var(--border-faint)] bg-white p-6 shadow-[0_2px_8px_0_rgba(0,0,0,0.02)] transition-all hover:border-[var(--heat-100)] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.04)]"
		>
			<div class="relative z-10 mb-4 flex items-center gap-3">
				<div
					class="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors group-hover:bg-[var(--heat-100)] group-hover:text-white"
				>
					<Package class="size-5" />
				</div>
				<div>
					<p class="text-mono-x-small tracking-wider text-[var(--black-alpha-48)] uppercase">
						Orders
					</p>
					<p class="text-label-medium text-foreground">History</p>
				</div>
			</div>
			<div class="relative z-10 flex items-end justify-between">
				<p class="font-display text-3xl text-foreground">{orderCount}</p>
				<ArrowRight
					class="size-5 text-[var(--black-alpha-32)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--heat-100)]"
				/>
			</div>
		</a>

		<div
			class="flex flex-col justify-center rounded-xl border border-[var(--border-faint)] bg-gradient-to-br from-[var(--background-lighter)] to-white p-6 shadow-[0_2px_8px_0_rgba(0,0,0,0.02)]"
		>
			<h3 class="text-label-medium mb-2 flex items-center gap-2 text-foreground">
				<Settings class="size-4 text-[var(--heat-100)]" /> Account Settings
			</h3>
			<p class="text-body-small mb-4 text-[var(--black-alpha-56)]">
				Update your personal information and contact details securely.
			</p>
			<a
				href="#profile-settings"
				class="text-label-small inline-flex items-center gap-1 text-[var(--heat-100)] transition-colors hover:text-foreground"
			>
				Manage Profile <ArrowRight class="size-3" />
			</a>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="max-w-3xl" id="profile-settings">
		<div class="overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-white shadow-sm">
			<div class="border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-6 py-5">
				<h2 class="text-title-h4 font-display text-foreground">Personal Information</h2>
				<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
					Review and update your contact details used for orders and delivery.
				</p>
			</div>

			<form method="POST" action="?/updateProfile" use:enhance={handleSubmit} class="p-6 md:p-8">
				{#if activeMessage}
					<div
						class={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
							isSuccessMessage
								? 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
								: 'border-red-200 bg-red-50 text-red-700'
						}`}
					>
						<div class="mt-0.5">
							<Settings class="size-4" />
						</div>
						<p class="text-body-small flex-1">{activeMessage}</p>
					</div>
				{/if}

				<div class="grid gap-6 sm:grid-cols-2">
					<div class="space-y-2">
						<label
							for="fullName"
							class="text-label-small flex items-center justify-between text-[var(--black-alpha-64)]"
						>
							Full Name
							<span class="text-mono-x-small text-red-500">*</span>
						</label>
						<input
							id="fullName"
							name="fullName"
							value={fullNameValue}
							class="text-body-medium h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 transition-shadow placeholder:text-[var(--black-alpha-32)] focus:border-transparent focus:ring-2 focus:ring-[var(--heat-100)] focus:outline-none"
							autocomplete="name"
							placeholder="John Doe"
							required
						/>
					</div>

					<div class="space-y-2">
						<label
							for="phone"
							class="text-label-small flex items-center justify-between text-[var(--black-alpha-64)]"
						>
							Phone Number
							{#if phoneLocked}
								<span
									class="text-mono-x-small inline-flex items-center gap-1 rounded bg-[var(--background-lighter)] px-2 py-0.5 text-[var(--black-alpha-48)]"
									><Lock class="size-2.5" /> Locked</span
								>
							{/if}
						</label>
						{#if phoneLocked}
							<input name="phone" type="hidden" value={phoneValue} />
						{/if}
						<div class="relative">
							<span
								class="text-body-medium absolute top-1/2 left-3 -translate-y-1/2 text-[var(--black-alpha-40)]"
								>+91</span
							>
							<input
								id="phone"
								name="phone"
								value={phoneValue}
								class="text-body-medium h-11 w-full rounded-md border border-[var(--border-muted)] bg-white pr-3 pl-10 transition-shadow placeholder:text-[var(--black-alpha-32)] focus:border-transparent focus:ring-2 focus:ring-[var(--heat-100)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--background-lighter)] disabled:text-[var(--black-alpha-48)]"
								autocomplete="tel"
								placeholder="98765 43210"
								disabled={phoneLocked}
							/>
						</div>
						{#if phoneLocked}
							<p class="text-mono-x-small mt-1.5 leading-relaxed text-[var(--black-alpha-48)]">
								For security and order integrity, your phone number cannot be changed after your
								first purchase.
							</p>
						{/if}
					</div>
				</div>

				<div class="mt-8 flex items-center justify-end border-t border-[var(--border-faint)] pt-6">
					<button
						type="submit"
						class="button button-primary inline-flex h-11 items-center gap-2 rounded-md px-6 text-white transition-transform active:scale-95 disabled:opacity-60"
						disabled={saving}
					>
						<Save class="size-4" />
						{saving ? 'Saving Changes...' : 'Save Profile'}
					</button>
				</div>
			</form>
		</div>
	</div>
</main>
