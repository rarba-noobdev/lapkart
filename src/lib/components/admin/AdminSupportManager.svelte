<script lang="ts">
	import { onMount } from 'svelte';
	import {
		requestAdmin,
		toneClasses,
		type AdminProductQuestion,
		type AdminStockNotificationEvent
	} from '$lib/admin';

	let questions = $state<AdminProductQuestion[]>([]);
	let events = $state<AdminStockNotificationEvent[]>([]);
	let answers = $state<Record<string, string>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeAction = $state<string | null>(null);

	async function loadSupport() {
		try {
			loading = true;
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
			loading = false;
		}
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
			await loadSupport();
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
			await loadSupport();
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
			await loadSupport();
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
	});
</script>

<div class="grid gap-6 xl:grid-cols-2">
	<section class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
					Support queue
				</p>
				<p class="text-label-large text-foreground">Product questions</p>
				<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
					Publish exact compatibility, condition, and packing answers from the admin desk.
				</p>
			</div>
			<button
				type="button"
				class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] px-3 text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
				disabled={loading}
				onclick={() => void loadSupport()}
			>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		</div>

		{#if error}
			<div
				class="text-body-small mt-5 rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700"
			>
				{error}
			</div>
		{/if}

		<div class="mt-5 space-y-3">
			{#if loading}
				<div
					class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
				>
					Loading product questions...
				</div>
			{:else if !questions.length}
				<div
					class="text-body-small rounded-[16px] border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-[var(--black-alpha-56)]"
				>
					No product questions are waiting for review.
				</div>
			{:else}
				{#each questions as question (question.id)}
					<article class="rounded-[16px] border border-[var(--border-faint)] p-4">
						<div class="flex gap-3">
							{#if question.products?.image}
								<img
									src={question.products.image}
									alt={question.products.title}
									class="h-16 w-16 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
								/>
							{:else}
								<div
									class="grid h-16 w-16 shrink-0 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-40)]"
								>
									No image
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<p class="text-label-small truncate text-foreground">
										{question.products?.title ?? 'Deleted product'}
									</p>
									<span
										class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses('neutral')}`}
									>
										{question.status}
									</span>
								</div>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
									{question.products?.brand ?? 'Unknown brand'}
								</p>
								<p class="text-body-small mt-3 text-foreground">Q: {question.question}</p>
							</div>
						</div>

						<label class="mt-4 block">
							<span
								class="text-mono-x-small mb-2 block tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
							>
								Answer
							</span>
							<textarea
								bind:value={answers[question.id]}
								rows="3"
								placeholder="Answer with exact compatibility, condition, or packing details"
								class="input-field min-h-28 py-3"
							></textarea>
						</label>

						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
								disabled={activeAction !== null}
								onclick={() => void updateQuestion(question.id, 'published')}
							>
								{activeAction === `question:${question.id}:published` ? 'Publishing...' : 'Publish'}
							</button>
							<button
								type="button"
								class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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

	<section class="rounded-[18px] border border-[var(--border-faint)] bg-white p-6">
		<div>
			<p class="text-mono-x-small tracking-[0.16em] text-[var(--black-alpha-48)] uppercase">
				Notification queue
			</p>
			<p class="text-label-large text-foreground">Back-in-stock outbox</p>
			<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">
				Review queued stock notifications and manually send or retire stuck entries.
			</p>
		</div>

		<div class="mt-5 space-y-3">
			{#if loading}
				<div
					class="text-body-small rounded-[16px] border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-[var(--black-alpha-56)]"
				>
					Loading notification events...
				</div>
			{:else if !events.length}
				<div
					class="text-body-small rounded-[16px] border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-5 text-[var(--black-alpha-56)]"
				>
					No stock notification events have been queued.
				</div>
			{:else}
				{#each events as event (event.id)}
					<article class="rounded-[16px] border border-[var(--border-faint)] p-4">
						<div class="flex gap-3">
							{#if event.products?.image}
								<img
									src={event.products.image}
									alt={stockTitle(event)}
									class="h-16 w-16 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
								/>
							{:else}
								<div
									class="grid h-16 w-16 shrink-0 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-40)]"
								>
									No image
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<p class="text-label-small truncate text-foreground">{stockTitle(event)}</p>
									<span
										class={`text-mono-x-small rounded-full border px-3 py-1 tracking-[0.16em] uppercase ${toneClasses('neutral')}`}
									>
										{event.status}
									</span>
								</div>
								<p class="text-body-small mt-1 text-[var(--black-alpha-56)]">{event.email}</p>
								<p
									class="text-mono-x-small mt-3 tracking-[0.16em] text-[var(--black-alpha-48)] uppercase"
								>
									Queued {new Date(event.created_at).toLocaleString('en-IN')}
								</p>
							</div>
						</div>

						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="button button-primary text-label-small inline-flex h-10 items-center justify-center rounded-md px-4 text-white disabled:opacity-60"
								disabled={!isStockSendable(event.status) || activeAction !== null}
								onclick={() => void sendStockEvent(event.id)}
							>
								{activeAction === `stock:${event.id}:send` ? 'Sending...' : 'Send now'}
							</button>
							<button
								type="button"
								class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
								disabled={activeAction !== null}
								onclick={() => void updateStockEvent(event.id, 'sent')}
							>
								Mark sent
							</button>
							<button
								type="button"
								class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
								disabled={activeAction !== null}
								onclick={() => void updateStockEvent(event.id, 'failed')}
							>
								Failed
							</button>
							<button
								type="button"
								class="text-label-small inline-flex h-10 items-center justify-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-foreground transition-colors hover:border-[var(--heat-40)] disabled:opacity-60"
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
