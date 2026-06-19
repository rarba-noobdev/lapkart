<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Flame, ArrowLeft, Search } from '@lucide/svelte';

	const status = $derived(page.status);
	const isNotFound = $derived(status === 404);
	const heading = $derived(isNotFound ? 'Page not found' : 'Something went wrong');
	const detail = $derived(
		isNotFound
			? 'The part or page you are looking for has moved, sold out, or never existed.'
			: 'A temporary error stopped this page from loading. Please try again in a moment.'
	);
</script>

<svelte:head>
	<title>{status} - {heading} | LapKart</title>
</svelte:head>

<main class="err-shell">
	<div class="err-card">
		<div class="err-logo">
			<span class="err-flame"><Flame class="size-4" strokeWidth={2.5} /></span>
			lap<span class="err-brand">kart</span>
		</div>
		<p class="err-status">{status}</p>
		<h1 class="err-title">{heading}</h1>
		<p class="err-detail">{detail}</p>
		<div class="err-actions">
			<a href={resolve('/')} class="err-primary">
				<ArrowLeft class="size-4" strokeWidth={2.3} />
				Back home
			</a>
			<a href={resolve('/products')} class="err-secondary">
				<Search class="size-4" strokeWidth={2.3} />
				Browse parts
			</a>
		</div>
	</div>
</main>

<style>
	.err-shell {
		display: grid;
		place-items: center;
		min-height: 60vh;
		padding: 48px 16px;
		background: var(--background-base, #fbfbfb);
	}

	.err-card {
		width: 100%;
		max-width: 440px;
		text-align: center;
	}

	.err-logo {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 700;
		letter-spacing: -0.01em;
		color: var(--foreground, #161616);
	}

	.err-flame {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--heat-100, #fa5d19);
		color: white;
	}

	.err-brand {
		color: var(--heat-100, #fa5d19);
	}

	.err-status {
		margin-top: 28px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.18em;
		color: var(--heat-100, #fa5d19);
	}

	.err-title {
		margin-top: 8px;
		font-size: clamp(24px, 4vw, 32px);
		font-weight: 680;
		letter-spacing: -0.01em;
		color: var(--foreground, #161616);
	}

	.err-detail {
		margin-top: 10px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--black-alpha-56, rgba(0, 0, 0, 0.56));
	}

	.err-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		margin-top: 24px;
	}

	.err-primary,
	.err-secondary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 42px;
		padding: 0 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 650;
	}

	.err-primary {
		background: var(--heat-100, #fa5d19);
		color: white;
	}

	.err-secondary {
		border: 1px solid var(--border-muted, #e3e3e3);
		background: white;
		color: var(--foreground, #161616);
	}

	.err-secondary:hover {
		border-color: var(--heat-100, #fa5d19);
		color: var(--heat-100, #fa5d19);
	}
</style>
