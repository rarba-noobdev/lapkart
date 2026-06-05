<svelte:head>
	<title>Authentication Error - lapkart</title>
</svelte:head>

<section class="container mx-auto px-4 py-14">
	<div class="mx-auto max-w-[560px] rounded-[18px] border border-red-200 bg-white p-8">
		<p class="text-mono-x-small tracking-[0.18em] text-red-600 uppercase">Authentication</p>
		<h1 class="text-title-h4 mt-3 font-display text-foreground">Could not complete sign-in</h1>
		<p class="text-body-medium mt-3 text-[var(--black-alpha-64)]">
			The sign-in callback did not return a valid session. Retry the login flow or use email and
			password instead.
		</p>

		<a
			href="/login"
			class="button button-primary text-label-medium mt-6 inline-flex h-12 items-center justify-center rounded-md px-6 text-white"
		>
			Back to login
		</a>
	</div>
</section>
