<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { getAuthContext } from '$lib/auth-context';
	import {
		requestAdmin,
		toneClasses,
		type AdminProductQuestion,
		type AdminStockNotificationEvent
	} from '$lib/admin';

	const auth = getAuthContext();

	let questions = $state<AdminProductQuestion[]>([]);
	let events = $state<AdminStockNotificationEvent[]>([]);
	let answers = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeAction = $state<string | null>(null);
	let realtimeRefreshTimer: number | null = null;

	async function loadSupport(showLoading = questions.length === 0 && events.length === 0) {
		try {
			if (showLoading) loading = true;
			error = null;

			const [questionResponse, eventResponse] = await Promise.all([
				requestAdmin<{ questions: AdminProductQuestion[] }>('/admin/product-questions'),
				requestAdmin<{ events: AdminStockNotificationEvent[] }>('/admin/stock-notification-events')
			]);

			questions = questionResponse.questions ?? [];
			events = eventResponse.events ?? [];

			const nextAnswers = { ...answers };
			for (const question of questions) {
				if (nextAnswers[question.id] === undefined)
					nextAnswers[question.id] = question.answer ?? '';
			}
			answers = nextAnswers;
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not load support';
		} finally {
			if (showLoading) loading = false;
		}
	}

	function scheduleSupportRefresh() {
		if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
		realtimeRefreshTimer = window.setTimeout(() => {
			void loadSupport(false);
		}, 350);
	}

	async function updateQuestion(questionId: string, status: AdminProductQuestion['status']) {
		try {
			activeAction = `question:${questionId}:${status}`;
			await requestAdmin(`/admin/product-questions/${questionId}`, {
				method: 'PATCH',
				body: JSON.stringify({
					status,
					answer: answers[questionId]?.trim() || undefined
				})
			});
			await loadSupport(false);
		} catch (requestError) {
			error = requestError instanceof Error ? requestError.message : 'Could not update question';
		} finally {
			activeAction = null;
		}
	}

	async function updateStockEvent(eventId: string, status: AdminStockNotificationEvent['status']) {
		try {
			activeAction = `stock:${eventId}:${status}`;
			await requestAdmin(`/admin/stock-notification-events/${eventId}`, {
				method: 'PATCH',
				body: JSON.stringify({ status })
			});
			await loadSupport(false);
		} catch (requestError) {
			error =
				requestError instanceof Error ? requestError.message : 'Could not update notification';
		} finally {
			activeAction = null;
		}
	}

	async function sendStockEvent(eventId: string) {
		try {
			activeAction = `stock:${eventId}:send`;
			await requestAdmin(`/admin/stock-notification-events/${eventId}/send`, {
				method: 'POST'
			});
			await loadSupport(false);
		} catch (requestError) {
			error =
				requestError instanceof Error
					? requestError.message
					: 'Could not send back-in-stock notification';
		} finally {
			activeAction = null;
		}
	}

	function stockTitle(event: AdminStockNotificationEvent) {
		const payloadTitle = event.payload.title;
		return event.products?.title ?? (typeof payloadTitle === 'string' ? payloadTitle : 'Product');
	}

	function isStockSendable(status: AdminStockNotificationEvent['status']) {
		return status === 'pending' || status === 'failed';
	}

	onMount(() => {
		void loadSupport();
		const channel = auth.supabase
			.channel('admin-support-manager')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'product_questions' }, scheduleSupportRefresh)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'stock_notification_events' },
				scheduleSupportRefresh
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'stock_notifications' }, scheduleSupportRefresh)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleSupportRefresh)
			.subscribe();

		return () => {
			if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
			void auth.supabase.removeChannel(channel);
		};
	});
</script>

<div class="grid w-full gap-6 xl:grid-cols-2">
	<!-- Product Questions Section -->
	<section class="rounded-lg border border-[var(--border-faint)] bg-white p-5">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-[13px] font-medium text-foreground">Product questions</p>
				<p class="text-[11px] text-[var(--black-alpha-40)]">
					Publish compatibility, condition, and packing answers from the admin desk.
				</p>
			</div>
			<button
				type="button"
				class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				disabled={loading}
				onclick={() => void loadSupport()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		{#if error}
			<div
				class="mt-4 rounded-lg border border-[var(--accent-crimson)]/20 bg-[var(--accent-crimson)]/6 p-3 text-[12px] text-[var(--accent-crimson)]"
			>
				{error}
			</div>
		{/if}

		<div class="mt-4 space-y-2">
			{#if loading}
				<div class="space-y-2">
					{#each Array(3) as _, i}
						<div class="animate-pulse rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
							<div class="flex gap-3">
								<div class="h-12 w-12 shrink-0 rounded-md bg-[var(--black-alpha-6)]"></div>
								<div class="flex-1 space-y-2">
									<div class="h-3 w-2/3 rounded bg-[var(--black-alpha-6)]"></div>
									<div class="h-3 w-1/3 rounded bg-[var(--black-alpha-6)]"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if !questions.length}
				<div
					class="rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-center text-[12px] text-[var(--black-alpha-56)]"
				>
					No product questions are waiting for review.
				</div>
			{:else}
				{#each questions as question, idx (question.id)}
					<article
						class="rounded-lg border border-[var(--border-faint)] p-3"
						in:fly={{ y: 6, duration: 200, delay: idx * 30 }}
					>
						<div class="flex gap-3">
							{#if question.products?.image}
								<img
									src={question.products.image}
									alt={question.products.title}
									class="h-12 w-12 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1"
								/>
							{:else}
								<div
									class="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[9px] text-[var(--black-alpha-40)]"
								>
									No img
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<p class="truncate text-[12px] font-medium text-foreground">
										{question.products?.title ?? 'Deleted product'}
									</p>
									<span
										class="rounded-sm border border-[var(--border-faint)] bg-[var(--background-lighter)] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[var(--black-alpha-48)] uppercase"
									>
										{question.status}
									</span>
								</div>
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">
									{question.products?.brand ?? 'Unknown brand'}
								</p>
								<p class="mt-2 text-[12px] text-foreground">Q: {question.question}</p>
							</div>
						</div>

						<label class="mt-3 block">
							<span
								class="mb-1.5 block text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
							>
								Answer
							</span>
							<textarea
								bind:value={answers[question.id]}
								rows="2"
								placeholder="Answer with exact compatibility, condition, or packing details"
								class="input-field min-h-20 py-2 text-[12px]"
							></textarea>
						</label>

						<div class="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								class="button button-primary inline-flex h-8 items-center justify-center rounded-md px-3 text-[12px] text-white disabled:opacity-50"
								disabled={activeAction !== null}
								onclick={() => void updateQuestion(question.id, 'published')}
							>
								{activeAction === `question:${question.id}:published` ? 'Publishing...' : 'Publish'}
							</button>
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-50"
								disabled={activeAction !== null}
								onclick={() => void updateQuestion(question.id, 'rejected')}
							>
								{activeAction === `question:${question.id}:rejected` ? 'Rejecting...' : 'Reject'}
							</button>
						</div>
					</article>
				{/each}
			{/if}
		</div>
	</section>

	<!-- Back-in-Stock Notifications Section -->
	<section class="rounded-lg border border-[var(--border-faint)] bg-white p-5">
		<div>
			<p class="text-[13px] font-medium text-foreground">Back-in-stock outbox</p>
			<p class="text-[11px] text-[var(--black-alpha-40)]">
				Review queued stock notifications and manually send or retire stuck entries.
			</p>
		</div>

		<div class="mt-4 space-y-2">
			{#if loading}
				<div class="space-y-2">
					{#each Array(3) as _, i}
						<div class="animate-pulse rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
							<div class="flex gap-3">
								<div class="h-12 w-12 shrink-0 rounded-md bg-[var(--black-alpha-6)]"></div>
								<div class="flex-1 space-y-2">
									<div class="h-3 w-2/3 rounded bg-[var(--black-alpha-6)]"></div>
									<div class="h-3 w-1/3 rounded bg-[var(--black-alpha-6)]"></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if !events.length}
				<div
					class="rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-center text-[12px] text-[var(--black-alpha-56)]"
				>
					No stock notification events have been queued.
				</div>
			{:else}
				{#each events as event, idx (event.id)}
					<article
						class="rounded-lg border border-[var(--border-faint)] p-3"
						in:fly={{ y: 6, duration: 200, delay: idx * 30 }}
					>
						<div class="flex gap-3">
							{#if event.products?.image}
								<img
									src={event.products.image}
									alt={stockTitle(event)}
									class="h-12 w-12 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1"
								/>
							{:else}
								<div
									class="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[9px] text-[var(--black-alpha-40)]"
								>
									No img
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<p class="truncate text-[12px] font-medium text-foreground">{stockTitle(event)}</p>
									<span
										class="rounded-sm border border-[var(--border-faint)] bg-[var(--background-lighter)] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-[var(--black-alpha-48)] uppercase"
									>
										{event.status}
									</span>
								</div>
								<p class="mt-0.5 text-[12px] text-[var(--black-alpha-56)]">{event.email}</p>
								<p
									class="mt-2 text-[10px] tracking-[0.14em] text-[var(--black-alpha-48)] uppercase"
								>
									Queued {new Date(event.created_at).toLocaleString('en-IN')}
								</p>
							</div>
						</div>

						<div class="mt-2 flex flex-wrap gap-2">
							<button
								type="button"
								class="button button-primary inline-flex h-8 items-center justify-center rounded-md px-3 text-[12px] text-white disabled:opacity-50"
								disabled={!isStockSendable(event.status) || activeAction !== null}
								onclick={() => void sendStockEvent(event.id)}
							>
								{activeAction === `stock:${event.id}:send` ? 'Sending...' : 'Send now'}
							</button>
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-50"
								disabled={activeAction !== null}
								onclick={() => void updateStockEvent(event.id, 'sent')}
							>
								Mark sent
							</button>
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-50"
								disabled={activeAction !== null}
								onclick={() => void updateStockEvent(event.id, 'failed')}
							>
								Failed
							</button>
							<button
								type="button"
								class="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-[12px] font-medium text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-50"
								disabled={activeAction !== null}
								onclick={() => void updateStockEvent(event.id, 'cancelled')}
							>
								Cancel
							</button>
						</div>
					</article>
				{/each}
			{/if}
		</div>
	</section>
</div>
