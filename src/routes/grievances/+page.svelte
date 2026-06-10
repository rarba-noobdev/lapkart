<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { MessageSquarePlus, LifeBuoy } from '@lucide/svelte';
	import { formatINR } from '$lib/catalog';
	import {
		GRIEVANCE_CATEGORIES,
		GRIEVANCE_STATUS_LABEL,
		type GrievanceStatus
	} from '$lib/grievances';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	const grievances = $derived(
		(data as any).grievances as {
			id: string;
			category: string;
			subject: string;
			description: string;
			status: GrievanceStatus;
			resolution_note: string | null;
			created_at: string;
			order_id: string | null;
		}[]
	);
	const orders = $derived((data as any).orders as { id: string; created_at: string; total: number }[]);

	let submitting = $state(false);
	let showForm = $state(false);
	const message = $derived(form?.message ?? null);
	const isSuccess = $derived(Boolean(form?.success));

	const handleSubmit: SubmitFunction = () => {
		submitting = true;
		return async ({ update, result }) => {
			await update();
			submitting = false;
			if (result.type === 'success') showForm = false;
		};
	};

	const statusTone: Record<GrievanceStatus, string> = {
		open: 'bg-[var(--heat-4)] text-[var(--heat-100)]',
		in_progress: 'bg-amber-50 text-amber-700',
		resolved: 'bg-emerald-50 text-emerald-700',
		closed: 'bg-[var(--background-base)] text-[var(--black-alpha-56)]'
	};

	function fmtDate(value: string) {
		return new Date(value).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Support & complaints - LapKart</title>
</svelte:head>

<section class="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h1 class="text-[22px] font-medium tracking-tight text-foreground sm:text-[26px]">
				Support & complaints
			</h1>
			<p class="mt-1 text-[13px] text-[var(--black-alpha-48)]">
				Raise a complaint and track its status. We acknowledge within 48 hours and aim to resolve
				within 30 days.
			</p>
		</div>
		<button
			type="button"
			onclick={() => (showForm = !showForm)}
			class="button button-primary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-4 text-[12px] font-medium text-white"
		>
			<MessageSquarePlus class="size-3.5" />
			New
		</button>
	</div>

	{#if message}
		<div
			class="mt-4 flex items-start gap-2 rounded-md border px-3 py-2.5 text-[12px]
				{isSuccess
				? 'border-[var(--heat-16)] bg-[var(--heat-4)] text-[var(--heat-100)]'
				: 'border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 text-[var(--accent-crimson)]'}"
		>
			<span class="mt-0.5 size-1.5 shrink-0 rounded-full bg-current"></span>
			<span>{message}</span>
		</div>
	{/if}

	{#if showForm}
		<form
			method="POST"
			action="?/create"
			use:enhance={handleSubmit}
			class="mt-5 space-y-4 rounded-lg border border-[var(--border-faint)] bg-white p-5"
		>
			<label class="block">
				<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Category</span>
				<select name="category" class="input-field" required>
					<option value="" disabled selected>Select a category</option>
					{#each GRIEVANCE_CATEGORIES as cat (cat.value)}
						<option value={cat.value}>{cat.label}</option>
					{/each}
				</select>
			</label>

			{#if orders.length > 0}
				<label class="block">
					<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">
						Related order <span class="text-[var(--black-alpha-40)]">(optional)</span>
					</span>
					<select name="orderId" class="input-field">
						<option value="">Not about a specific order</option>
						{#each orders as order (order.id)}
							<option value={order.id}>
								#{order.id.slice(0, 8)} · {fmtDate(order.created_at)} · {formatINR(order.total)}
							</option>
						{/each}
					</select>
				</label>
			{/if}

			<label class="block">
				<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Subject</span>
				<input
					name="subject"
					class="input-field"
					minlength="4"
					maxlength="160"
					placeholder="Short summary"
					required
				/>
			</label>

			<label class="block">
				<span class="mb-1 block text-[11px] font-medium text-[var(--black-alpha-56)]">Details</span>
				<textarea
					name="description"
					rows="4"
					minlength="10"
					maxlength="4000"
					class="input-field !h-auto resize-none"
					placeholder="Tell us what went wrong"
					required
				></textarea>
			</label>

			<div class="flex justify-end gap-2 border-t border-[var(--border-faint)] pt-4">
				<button
					type="button"
					onclick={() => (showForm = false)}
					class="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] px-4 text-[12px] font-medium text-foreground"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting}
					class="button button-primary inline-flex h-9 items-center gap-1.5 rounded-md px-5 text-[12px] font-medium text-white disabled:opacity-50"
				>
					{submitting ? 'Submitting...' : 'Submit complaint'}
				</button>
			</div>
		</form>
	{/if}

	<div class="mt-6 space-y-3">
		{#if grievances.length === 0}
			<div
				class="rounded-lg border border-dashed border-[var(--border-muted)] bg-white px-5 py-12 text-center"
			>
				<LifeBuoy class="mx-auto size-7 text-[var(--black-alpha-32)]" />
				<p class="mt-3 text-[13px] font-medium text-foreground">No complaints yet</p>
				<p class="mt-1 text-[12px] text-[var(--black-alpha-48)]">
					If something's wrong with an order, let us know.
				</p>
			</div>
		{:else}
			{#each grievances as g (g.id)}
				<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="truncate text-[14px] font-medium text-foreground">{g.subject}</p>
							<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
								{fmtDate(g.created_at)}
								{#if g.order_id}· Order #{g.order_id.slice(0, 8)}{/if}
							</p>
						</div>
						<span
							class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium {statusTone[g.status]}"
						>
							{GRIEVANCE_STATUS_LABEL[g.status]}
						</span>
					</div>
					<p class="mt-2 text-[12px] leading-relaxed text-[var(--black-alpha-56)]">{g.description}</p>
					{#if g.resolution_note}
						<div class="mt-3 rounded-md bg-[var(--background-lighter)] p-3">
							<p class="text-[10px] tracking-[0.1em] text-[var(--black-alpha-56)] uppercase">
								Response
							</p>
							<p class="mt-1 text-[12px] text-foreground">{g.resolution_note}</p>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</section>
