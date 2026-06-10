<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ArrowRight,
		Check,
		ChevronRight,
		Lock,
		Mail,
		MapPin,
		Package,
		Pencil,
		Plus,
		Save,
		ShoppingBag,
		Star,
		Trash2,
		User,
		X
	} from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import type { OrderSummary } from '$lib/orders';
	import type { ActionData, PageData } from './$types';
	import type { Tables } from '$lib/supabase/types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	let saving = $state(false);
	let showAddressForm = $state(false);
	let editingAddressId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	const orders = $derived((data as any).orders as OrderSummary[]);
	const addresses = $derived((data as any).addresses as Tables<'addresses'>[]);
	const marketingPurposes = $derived(
		(data as any).marketingPurposes as { purpose: string; label: string; description: string }[]
	);
	const marketingConsent = $derived((data as any).marketingConsent as Record<string, boolean>);
	const orderCount = $derived(data.orderCount);
	const totalSpent = $derived(data.totalSpent);
	const phoneLocked = $derived(orderCount > 0);
	const activeMessage = $derived(form?.message ?? null);
	const isSuccessMessage = $derived(Boolean(form?.success));
	const fullNameValue = $derived(form?.fullName ?? data.profile.fullName);
	const phoneValue = $derived(form?.phone ?? data.profile.phone);
	const accountName = $derived(fullNameValue || data.user.email?.split('@')[0] || 'Customer');
	const formattedSpend = $derived(`₹${Math.round(totalSpent).toLocaleString('en-IN')}`);
	const initials = $derived(
		accountName
			.split(' ')
			.map((w: string) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);
	const editingAddress = $derived(
		editingAddressId ? addresses.find((a) => a.id === editingAddressId) ?? null : null
	);

	const handleSubmit: SubmitFunction = () => {
		saving = true;
		return async ({ update }) => {
			await update();
			saving = false;
		};
	};

	const handleAddressSubmit: SubmitFunction = () => {
		saving = true;
		return async ({ update, result }) => {
			await update();
			saving = false;
			if (result.type === 'success') {
				showAddressForm = false;
				editingAddressId = null;
			}
		};
	};

	const handleDeleteAddress: SubmitFunction = () => {
		return async ({ update }) => {
			await update();
			deletingId = null;
		};
	};

	function statusColor(status: string) {
		switch (status) {
			case 'confirmed':
			case 'delivered':
				return 'var(--accent-forest)';
			case 'shipped':
				return 'var(--accent-bluetron)';
			case 'cancelled':
			case 'refunded':
			case 'returned':
				return 'var(--accent-crimson)';
			default:
				return 'var(--heat-100)';
		}
	}

	function startEdit(addr: Tables<'addresses'>) {
		editingAddressId = addr.id;
		showAddressForm = false;
	}

	function startAdd() {
		editingAddressId = null;
		showAddressForm = true;
	}

	function cancelForm() {
		showAddressForm = false;
		editingAddressId = null;
	}

	const indianStates = [
		'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
		'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
		'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
		'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
		'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
		'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
		'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
		'Chandigarh', 'Andaman and Nicobar', 'Dadra and Nagar Haveli', 'Lakshadweep'
	];
</script>

<svelte:head>
	<title>Profile - LapKart</title>
</svelte:head>

<section class="container mx-auto px-4 py-6 sm:py-10">
	<div class="grid gap-6 lg:grid-cols-[280px_1fr] lg:gap-8 xl:grid-cols-[320px_1fr]">

		<!-- ─── Left sidebar ─── -->
		<div class="motion-section space-y-4 lg:sticky lg:top-24 lg:h-fit">
			<!-- Identity card -->
			<div class="rounded-lg border border-[var(--border-faint)] bg-white p-5">
				<div class="flex items-center gap-3">
					<div class="grid size-12 place-items-center rounded-full bg-[var(--heat-8)] text-[15px] font-semibold text-[var(--heat-100)]">
						{initials}
					</div>
					<div class="min-w-0 flex-1">
						<h1 class="truncate text-[16px] font-medium text-foreground">{accountName}</h1>
						<p class="truncate text-[12px] text-[var(--black-alpha-48)]">{data.user.email}</p>
					</div>
				</div>

				<div class="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border-faint)] pt-4">
					<div>
						<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-56)] uppercase">Orders</p>
						<p class="mt-0.5 text-[16px] font-semibold text-foreground">{orderCount}</p>
					</div>
					<div>
						<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-56)] uppercase">Spent</p>
						<p class="mt-0.5 text-[16px] font-semibold text-foreground">{formattedSpend}</p>
					</div>
					<div>
						<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-56)] uppercase">Phone</p>
						<p class="mt-0.5 truncate text-[13px] font-medium text-foreground">{phoneValue || '—'}</p>
					</div>
				</div>
			</div>

			<!-- Quick actions -->
			<div class="rounded-lg border border-[var(--border-faint)] bg-white">
				<a
					href={resolve('/products')}
					class="flex items-center gap-3 border-b border-[var(--border-faint)] px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--background-lighter)] hover:text-[var(--heat-100)]"
				>
					<ShoppingBag class="size-4 text-[var(--black-alpha-56)]" />
					Shop parts
					<ChevronRight class="ml-auto size-3.5 text-[var(--black-alpha-24)]" />
				</a>
				<a
					href={resolve('/cart')}
					class="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--background-lighter)] hover:text-[var(--heat-100)]"
				>
					<Package class="size-4 text-[var(--black-alpha-56)]" />
					View cart
					<ChevronRight class="ml-auto size-3.5 text-[var(--black-alpha-24)]" />
				</a>
			</div>

			<!-- Account form (desktop sidebar) -->
			<div class="hidden rounded-lg border border-[var(--border-faint)] bg-white lg:block">
				<div class="border-b border-[var(--border-faint)] px-4 py-3">
					<h2 class="flex items-center gap-2 text-[13px] font-medium text-foreground">
						<User class="size-4 text-[var(--black-alpha-56)]" />
						Account details
					</h2>
				</div>

				<form method="POST" action="?/updateProfile" use:enhance={handleSubmit} class="p-4">
					{#if activeMessage}
						<div
							class="mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]
								{isSuccessMessage
									? 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
									: 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]'}"
						>
							<span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-current"></span>
							<span>{activeMessage}</span>
						</div>
					{/if}

					<div class="space-y-3">
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">
								Full name <span class="text-[var(--accent-crimson)]">*</span>
							</span>
							<input
								name="fullName"
								value={fullNameValue}
								class="input-field !h-10 text-[13px]"
								autocomplete="name"
								placeholder="John Doe"
								required
							/>
						</label>

						<label>
							<span class="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--black-alpha-56)]">
								Phone
								{#if phoneLocked}
									<span class="inline-flex items-center gap-0.5 text-[9px] text-[var(--black-alpha-56)]">
										<Lock class="size-2.5" /> Locked
									</span>
								{/if}
							</span>
							{#if phoneLocked}
								<input name="phone" type="hidden" value={phoneValue} />
							{/if}
							<div class="relative">
								<span class="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[var(--black-alpha-32)]">+91</span>
								<input
									name="phone"
									value={phoneValue}
									class="input-field !h-10 pl-10 text-[13px]"
									autocomplete="tel"
									placeholder="98765 43210"
									disabled={phoneLocked}
								/>
							</div>
							{#if phoneLocked}
								<p class="mt-1 text-[10px] text-[var(--black-alpha-56)]">Locked after first purchase.</p>
							{/if}
						</label>

						<div class="flex items-center gap-2 rounded-md bg-[var(--background-lighter)] px-3 py-2">
							<Mail class="size-3.5 text-[var(--black-alpha-56)]" />
							<div>
								<p class="text-[11px] text-[var(--black-alpha-48)]">Email</p>
								<p class="text-[12px] font-medium text-foreground">{data.user.email}</p>
							</div>
						</div>
					</div>

					<button
						type="submit"
						class="button button-primary mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-medium text-white disabled:opacity-50"
						disabled={saving}
					>
						<Save class="size-3.5" />
						{saving ? 'Saving...' : 'Save changes'}
					</button>
				</form>
			</div>
		</div>

		<!-- ─── Right: Main content ─── -->
		<div class="reveal-stagger space-y-6">
			<!-- Orders -->
			<div>
				<div class="mb-4 flex items-center justify-between">
					<h2 class="flex items-center gap-2 text-[16px] font-medium text-foreground sm:text-[18px]">
						<Package class="size-5 text-[var(--heat-100)]" />
						Order history
					</h2>
					{#if orders.length > 0}
						<span class="text-[12px] text-[var(--black-alpha-48)]">{orders.length} order{orders.length === 1 ? '' : 's'}</span>
					{/if}
				</div>

				{#if orders.length === 0}
					<div class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-12 text-center sm:p-16">
						<Package class="mx-auto size-10 text-[var(--black-alpha-24)]" strokeWidth={1.5} />
						<p class="mt-3 text-[14px] font-medium text-foreground">No orders yet</p>
						<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">Your purchase history will appear here.</p>
						<a
							href={resolve('/products')}
							class="button button-primary mt-5 inline-flex h-10 items-center gap-2 rounded-md px-5 text-[12px] text-white"
						>
							Start shopping <ArrowRight class="size-3.5" />
						</a>
					</div>
				{:else}
					<div class="space-y-2">
						{#each orders as order (order.id)}
							<a
								href={resolve(`/order/${order.id}`)}
								class="group flex items-center gap-4 rounded-lg border border-[var(--border-faint)] bg-white p-4 transition-all hover:border-[var(--heat-20)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] sm:p-5"
							>
								<div class="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--heat-4)] text-[var(--heat-100)] sm:size-11">
									<Package class="size-4 sm:size-5" strokeWidth={2} />
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<p class="font-mono text-[12px] font-medium text-foreground sm:text-[13px]">#{order.id.slice(0, 8).toUpperCase()}</p>
										<span
											class="rounded px-1.5 py-px text-[9px] font-medium tracking-wide uppercase sm:text-[10px]"
											style:color={statusColor(order.status)}
											style:background={`color-mix(in srgb, ${statusColor(order.status)} 10%, transparent)`}
										>
											{order.status.replaceAll('_', ' ')}
										</span>
									</div>
									<p class="mt-0.5 text-[11px] text-[var(--black-alpha-56)] sm:text-[12px]">
										{new Date(order.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
										{#if order.items.length > 0}
											· {order.items.length} item{order.items.length > 1 ? 's' : ''}
										{/if}
									</p>
								</div>
								<div class="shrink-0 text-right">
									<p class="text-[14px] font-medium text-foreground sm:text-[15px]">{formatINR(order.total)}</p>
								</div>
								<ChevronRight class="size-4 shrink-0 text-[var(--black-alpha-24)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--heat-100)]" />
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ─── Saved addresses ─── -->
			<div>
				<div class="mb-4 flex items-center justify-between">
					<h2 class="flex items-center gap-2 text-[16px] font-medium text-foreground sm:text-[18px]">
						<MapPin class="size-5 text-[var(--heat-100)]" />
						Saved addresses
					</h2>
					{#if !showAddressForm && !editingAddressId}
						<button
							type="button"
							class="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--heat-100)] transition-colors hover:text-[var(--heat-200)]"
							onclick={startAdd}
						>
							<Plus class="size-3.5" /> Add new
						</button>
					{/if}
				</div>

				<!-- Address form (add or edit) -->
				{#if showAddressForm || editingAddressId}
					<div class="mb-4 rounded-lg border border-[var(--heat-20)] bg-white">
						<div class="flex items-center justify-between border-b border-[var(--border-faint)] px-4 py-3">
							<h3 class="text-[13px] font-medium text-foreground">
								{editingAddress ? 'Edit address' : 'Add new address'}
							</h3>
							<button type="button" onclick={cancelForm} class="text-[var(--black-alpha-56)] hover:text-foreground">
								<X class="size-4" />
							</button>
						</div>

						<form
							method="POST"
							action={editingAddress ? '?/updateAddress' : '?/addAddress'}
							use:enhance={handleAddressSubmit}
							class="p-4"
						>
							{#if editingAddress}
								<input type="hidden" name="addressId" value={editingAddress.id} />
							{/if}

							<div class="grid gap-3 sm:grid-cols-2">
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Full name *</span>
									<input
										name="fullName"
										value={editingAddress?.full_name ?? ''}
										class="input-field !h-10 text-[13px]"
										required
										placeholder="Recipient name"
									/>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Phone *</span>
									<div class="relative">
										<span class="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[var(--black-alpha-32)]">+91</span>
										<input
											name="phone"
											value={editingAddress?.phone ?? ''}
											class="input-field !h-10 pl-10 text-[13px]"
											required
											placeholder="98765 43210"
										/>
									</div>
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Address line 1 *</span>
									<input
										name="line1"
										value={editingAddress?.line1 ?? ''}
										class="input-field !h-10 text-[13px]"
										required
										placeholder="House/flat no, street"
									/>
								</label>
								<label class="sm:col-span-2">
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Address line 2</span>
									<input
										name="line2"
										value={editingAddress?.line2 ?? ''}
										class="input-field !h-10 text-[13px]"
										placeholder="Landmark, area (optional)"
									/>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">City *</span>
									<input
										name="city"
										value={editingAddress?.city ?? ''}
										class="input-field !h-10 text-[13px]"
										required
										placeholder="Chennai"
									/>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">State *</span>
									<select
										name="state"
										class="input-field !h-10 text-[13px]"
										required
									>
										<option value="">Select state</option>
										{#each indianStates as st (st)}
											<option value={st} selected={editingAddress?.state === st}>{st}</option>
										{/each}
									</select>
								</label>
								<label>
									<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Pincode *</span>
									<input
										name="pincode"
										value={editingAddress?.pincode ?? ''}
										class="input-field !h-10 text-[13px]"
										required
										placeholder="600001"
										maxlength="6"
										pattern="[0-9]{6}"
										inputmode="numeric"
									/>
								</label>
								<label class="flex items-center gap-2 self-end">
									<input
										type="checkbox"
										name="isDefault"
										value="true"
										checked={editingAddress?.is_default ?? addresses.length === 0}
										class="size-4 accent-[var(--heat-100)]"
									/>
									<span class="text-[12px] text-[var(--black-alpha-64)]">Set as default</span>
								</label>
							</div>

							<div class="mt-4 flex justify-end gap-2 border-t border-[var(--border-faint)] pt-4">
								<button
									type="button"
									onclick={cancelForm}
									class="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] px-4 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
								>
									Cancel
								</button>
								<button
									type="submit"
									class="button button-primary inline-flex h-9 items-center gap-1.5 rounded-md px-5 text-[12px] font-medium text-white disabled:opacity-50"
									disabled={saving}
								>
									<Save class="size-3.5" />
									{saving ? 'Saving...' : editingAddress ? 'Update' : 'Save address'}
								</button>
							</div>
						</form>
					</div>
				{/if}

				<!-- Address list -->
				{#if addresses.length === 0 && !showAddressForm}
					<div class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-10 text-center">
						<MapPin class="mx-auto size-8 text-[var(--black-alpha-24)]" strokeWidth={1.5} />
						<p class="mt-3 text-[13px] font-medium text-foreground">No saved addresses</p>
						<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">Add an address for faster checkout.</p>
						<button
							type="button"
							class="button button-primary mt-4 inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-[12px] text-white"
							onclick={startAdd}
						>
							<Plus class="size-3.5" /> Add address
						</button>
					</div>
				{:else}
					<div class="grid gap-2 sm:grid-cols-2">
						{#each addresses as addr (addr.id)}
							<div
								class="relative rounded-lg border bg-white p-4 transition-all
									{addr.is_default ? 'border-[var(--heat-20)]' : 'border-[var(--border-faint)]'}"
							>
								{#if addr.is_default}
									<span class="absolute top-3 right-3 inline-flex items-center gap-1 rounded bg-[var(--heat-8)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--heat-100)] uppercase">
										<Star class="size-2.5" /> Default
									</span>
								{/if}

								<p class="text-[13px] font-medium text-foreground">{addr.full_name}</p>
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">{addr.phone}</p>
								<p class="mt-1.5 text-[12px] leading-relaxed text-[var(--black-alpha-64)]">
									{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
									{addr.city}, {addr.state} — {addr.pincode}
								</p>

								<div class="mt-3 flex items-center gap-1 border-t border-[var(--border-faint)] pt-3">
									<button
										type="button"
										class="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--black-alpha-56)] transition-colors hover:bg-[var(--background-lighter)] hover:text-foreground"
										onclick={() => startEdit(addr)}
									>
										<Pencil class="size-3" /> Edit
									</button>

									{#if !addr.is_default}
										<form method="POST" action="?/setDefaultAddress" use:enhance>
											<input type="hidden" name="addressId" value={addr.id} />
											<button
												type="submit"
												class="inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--black-alpha-56)] transition-colors hover:bg-[var(--background-lighter)] hover:text-[var(--heat-100)]"
											>
												<Star class="size-3" /> Set default
											</button>
										</form>
									{/if}

									{#if deletingId === addr.id}
										<form method="POST" action="?/deleteAddress" use:enhance={handleDeleteAddress} class="ml-auto flex items-center gap-1">
											<input type="hidden" name="addressId" value={addr.id} />
											<span class="text-[11px] text-[var(--accent-crimson)]">Delete?</span>
											<button
												type="submit"
												class="inline-flex h-7 items-center rounded px-2 text-[11px] font-medium text-[var(--accent-crimson)] hover:bg-[var(--accent-crimson)]/8"
											>
												Yes
											</button>
											<button
												type="button"
												class="inline-flex h-7 items-center rounded px-2 text-[11px] font-medium text-[var(--black-alpha-56)] hover:bg-[var(--background-lighter)]"
												onclick={() => (deletingId = null)}
											>
												No
											</button>
										</form>
									{:else}
										<button
											type="button"
											class="ml-auto inline-flex h-7 items-center gap-1 rounded px-2 text-[11px] font-medium text-[var(--black-alpha-56)] transition-colors hover:bg-[var(--accent-crimson)]/8 hover:text-[var(--accent-crimson)]"
											onclick={() => (deletingId = addr.id)}
										>
											<Trash2 class="size-3" />
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ─── Communication preferences ─── -->
			<div class="rounded-lg border border-[var(--border-faint)] bg-white">
				<div class="border-b border-[var(--border-faint)] px-5 py-4">
					<h2 class="text-[15px] font-medium text-foreground">Communication preferences</h2>
					<p class="mt-0.5 text-[12px] text-[var(--black-alpha-48)]">
						Choose which promotional messages you receive. Order and delivery updates are always sent.
					</p>
				</div>
				<div class="divide-y divide-[var(--border-faint)]">
					{#each marketingPurposes as item (item.purpose)}
						{@const enabled = marketingConsent[item.purpose] ?? false}
						<div class="flex items-start gap-3 px-5 py-4">
							<div class="min-w-0 flex-1">
								<p class="text-[13px] font-medium text-foreground">{item.label}</p>
								<p class="mt-0.5 text-[11px] leading-relaxed text-[var(--black-alpha-48)]">
									{item.description}
								</p>
							</div>
							<form method="POST" action="?/updateMarketingConsent" use:enhance class="shrink-0">
								<input type="hidden" name="purpose" value={item.purpose} />
								<input type="hidden" name="granted" value={enabled ? 'false' : 'true'} />
								<button
									type="submit"
									role="switch"
									aria-checked={enabled}
									aria-label={item.label}
									class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
										{enabled ? 'bg-[var(--heat-100)]' : 'bg-[var(--border-muted)]'}"
								>
									<span
										class="inline-block size-4 transform rounded-full bg-white transition-transform
											{enabled ? 'translate-x-6' : 'translate-x-1'}"
									></span>
								</button>
							</form>
						</div>
					{/each}
				</div>
			</div>

			<!-- Account form (mobile only) -->
			<div class="rounded-lg border border-[var(--border-faint)] bg-white lg:hidden">
				<div class="border-b border-[var(--border-faint)] px-5 py-4">
					<h2 class="text-[15px] font-medium text-foreground">Account details</h2>
					<p class="mt-0.5 text-[12px] text-[var(--black-alpha-48)]">Contact details for orders and delivery.</p>
				</div>

				<form method="POST" action="?/updateProfile" use:enhance={handleSubmit} class="p-5">
					{#if activeMessage}
						<div
							class="mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px]
								{isSuccessMessage
									? 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
									: 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]'}"
						>
							<span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-current"></span>
							<span>{activeMessage}</span>
						</div>
					{/if}

					<div class="grid gap-4 sm:grid-cols-2">
						<label>
							<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">
								Full name <span class="text-[var(--accent-crimson)]">*</span>
							</span>
							<input
								name="fullName"
								value={fullNameValue}
								class="input-field"
								autocomplete="name"
								placeholder="John Doe"
								required
							/>
						</label>

						<label>
							<span class="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--black-alpha-56)]">
								Phone
								{#if phoneLocked}
									<span class="inline-flex items-center gap-0.5 text-[9px] text-[var(--black-alpha-56)]">
										<Lock class="size-2.5" /> Locked
									</span>
								{/if}
							</span>
							{#if phoneLocked}
								<input name="phone" type="hidden" value={phoneValue} />
							{/if}
							<div class="relative">
								<span class="absolute top-1/2 left-3 -translate-y-1/2 text-[12px] text-[var(--black-alpha-32)]">+91</span>
								<input
									name="phone"
									value={phoneValue}
									class="input-field pl-10"
									autocomplete="tel"
									placeholder="98765 43210"
									disabled={phoneLocked}
								/>
							</div>
							{#if phoneLocked}
								<p class="mt-1 text-[10px] text-[var(--black-alpha-56)]">Locked after first purchase.</p>
							{/if}
						</label>
					</div>

					<div class="mt-4 rounded-md bg-[var(--background-lighter)] p-3">
						<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-56)] uppercase">Email address</p>
						<p class="mt-0.5 text-[13px] font-medium text-foreground">{data.user.email}</p>
						<p class="mt-1 text-[10px] text-[var(--black-alpha-56)]">Managed by your auth provider.</p>
					</div>

					<div class="mt-5 flex justify-end border-t border-[var(--border-faint)] pt-4">
						<button
							type="submit"
							class="button button-primary inline-flex h-9 items-center gap-1.5 rounded-md px-5 text-[12px] font-medium text-white disabled:opacity-50"
							disabled={saving}
						>
							<Save class="size-3.5" />
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</section>

<!-- Bottom spacer for mobile tab bar -->
<div class="h-24 md:hidden"></div>
