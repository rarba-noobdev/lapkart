<script lang="ts">
	import { onMount } from 'svelte';
	import { getAuthContext } from '$lib/auth-context';
	import { GRIEVANCE_STATUS_LABEL, type GrievanceStatus } from '$lib/grievances';

	const auth = getAuthContext();

	type Grievance = {
		id: string;
		user_id: string;
		order_id: string | null;
		category: string;
		subject: string;
		description: string;
		status: GrievanceStatus;
		resolution_note: string | null;
		acknowledged_at: string | null;
		created_at: string;
	};
	type DeletionRequest = {
		id: string;
		user_id: string;
		status: string;
		reason: string | null;
		requested_at: string;
		admin_note: string | null;
	};

	let grievances = $state<Grievance[]>([]);
	let deletionRequests = $state<DeletionRequest[]>([]);
	let notes = $state<Record<string, string>>({});
	let delNotes = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let busy = $state<string | null>(null);

	async function load() {
		loading = grievances.length === 0 && deletionRequests.length === 0;
		error = null;
		const [g, d] = await Promise.all([
			auth.supabase
				.from('grievances')
				.select(
					'id,user_id,order_id,category,subject,description,status,resolution_note,acknowledged_at,created_at'
				)
				.order('created_at', { ascending: false })
				.limit(100),
			auth.supabase
				.from('data_deletion_requests')
				.select('id,user_id,status,reason,requested_at,admin_note')
				.order('requested_at', { ascending: false })
				.limit(100)
		]);

		if (g.error || d.error) {
			error = g.error?.message ?? d.error?.message ?? 'Could not load';
			loading = false;
			return;
		}

		grievances = (g.data as Grievance[]) ?? [];
		deletionRequests = (d.data as DeletionRequest[]) ?? [];
		const nextNotes = { ...notes };
		for (const row of grievances)
			if (nextNotes[row.id] === undefined) nextNotes[row.id] = row.resolution_note ?? '';
		notes = nextNotes;
		loading = false;
	}

	async function setStatus(g: Grievance, status: GrievanceStatus) {
		busy = `g:${g.id}`;
		const patch: {
			status: GrievanceStatus;
			resolution_note: string | null;
			acknowledged_at?: string;
		} = {
			status,
			resolution_note: notes[g.id]?.trim() || null
		};
		if (!g.acknowledged_at && status !== 'open') patch.acknowledged_at = new Date().toISOString();
		const { error: e } = await auth.supabase.from('grievances').update(patch).eq('id', g.id);
		if (e) error = e.message;
		busy = null;
		await load();
	}

	async function setDeletionStatus(req: DeletionRequest, status: 'completed' | 'rejected') {
		busy = `d:${req.id}`;
		const { error: e } = await auth.supabase
			.from('data_deletion_requests')
			.update({
				status,
				admin_note: delNotes[req.id]?.trim() || null,
				processed_at: new Date().toISOString(),
				processed_by: auth.user?.id ?? null
			})
			.eq('id', req.id);
		if (e) error = e.message;
		busy = null;
		await load();
	}

	function fmt(value: string) {
		return new Date(value).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	const STATUSES: GrievanceStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
	const pendingDeletions = $derived(deletionRequests.filter((r) => r.status === 'pending'));
	const openGrievances = $derived(
		grievances.filter((g) => g.status === 'open' || g.status === 'in_progress')
	);

	onMount(load);
</script>

<div class="space-y-8">
	{#if error}
		<p
			class="rounded-md border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 px-3 py-2 text-[12px] text-[var(--accent-crimson)]"
		>
			{error}
		</p>
	{/if}

	<!-- Deletion requests -->
	<section>
		<h3 class="text-[14px] font-medium text-foreground">
			Account deletion requests
			{#if pendingDeletions.length > 0}
				<span
					class="ml-1 rounded-full bg-[var(--accent-crimson)]/10 px-2 py-0.5 text-[11px] text-[var(--accent-crimson)]"
				>
					{pendingDeletions.length} pending
				</span>
			{/if}
		</h3>
		<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
			Mark completed only after erasing the user's data (auth user delete is a service-role step).
		</p>
		<div class="mt-3 space-y-2">
			{#if pendingDeletions.length === 0}
				<p class="text-[12px] text-[var(--black-alpha-48)]">No pending deletion requests.</p>
			{:else}
				{#each pendingDeletions as req (req.id)}
					<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
						<p class="text-[12px] font-medium text-foreground">User {req.user_id.slice(0, 8)}</p>
						<p class="text-[11px] text-[var(--black-alpha-48)]">
							Requested {fmt(req.requested_at)}
						</p>
						{#if req.reason}
							<p class="mt-1 text-[12px] text-[var(--black-alpha-56)]">"{req.reason}"</p>
						{/if}
						<input
							bind:value={delNotes[req.id]}
							placeholder="Internal note (optional)"
							class="input-field mt-3 text-[12px]"
						/>
						<div class="mt-2 flex gap-2">
							<button
								type="button"
								disabled={busy === `d:${req.id}`}
								onclick={() => setDeletionStatus(req, 'completed')}
								class="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-[11px] font-medium text-white disabled:opacity-50"
							>
								Mark completed
							</button>
							<button
								type="button"
								disabled={busy === `d:${req.id}`}
								onclick={() => setDeletionStatus(req, 'rejected')}
								class="inline-flex h-8 items-center rounded-md border border-[var(--border-muted)] px-3 text-[11px] font-medium text-foreground disabled:opacity-50"
							>
								Reject
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<!-- Grievances -->
	<section>
		<h3 class="text-[14px] font-medium text-foreground">
			Customer complaints
			{#if openGrievances.length > 0}
				<span
					class="ml-1 rounded-full bg-[var(--heat-8)] px-2 py-0.5 text-[11px] text-[var(--heat-100)]"
				>
					{openGrievances.length} open
				</span>
			{/if}
		</h3>
		<div class="mt-3 space-y-2">
			{#if loading}
				<p class="text-[12px] text-[var(--black-alpha-48)]">Loading…</p>
			{:else if grievances.length === 0}
				<p class="text-[12px] text-[var(--black-alpha-48)]">No complaints.</p>
			{:else}
				{#each grievances as g (g.id)}
					<div class="rounded-lg border border-[var(--border-faint)] bg-white p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate text-[13px] font-medium text-foreground">{g.subject}</p>
								<p class="mt-0.5 text-[11px] text-[var(--black-alpha-48)]">
									{g.category} · {fmt(g.created_at)} · User {g.user_id.slice(0, 8)}
									{#if g.order_id}· Order #{g.order_id.slice(0, 8)}{/if}
								</p>
							</div>
							<span
								class="shrink-0 rounded-full bg-[var(--background-base)] px-2.5 py-1 text-[10px] font-medium text-[var(--black-alpha-56)]"
							>
								{GRIEVANCE_STATUS_LABEL[g.status]}
							</span>
						</div>
						<p class="mt-2 text-[12px] leading-relaxed text-[var(--black-alpha-56)]">
							{g.description}
						</p>
						<textarea
							bind:value={notes[g.id]}
							rows="2"
							placeholder="Resolution note shown to the customer"
							class="input-field mt-3 !h-auto resize-none text-[12px]"
						></textarea>
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each STATUSES as s (s)}
								<button
									type="button"
									disabled={busy === `g:${g.id}` || g.status === s}
									onclick={() => setStatus(g, s)}
									class="inline-flex h-8 items-center rounded-md border px-3 text-[11px] font-medium disabled:opacity-40
										{g.status === s
										? 'border-foreground bg-foreground text-white'
										: 'border-[var(--border-muted)] text-foreground'}"
								>
									{GRIEVANCE_STATUS_LABEL[s]}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>
