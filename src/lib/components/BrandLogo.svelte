<script lang="ts">
	import { asset } from '$app/paths';

	type LogoVariant = 'header' | 'footer' | 'auth' | 'admin' | 'error' | 'search';

	let {
		variant = 'header',
		suffix = '',
		showText = true,
		class: className = ''
	}: {
		variant?: LogoVariant;
		suffix?: string;
		showText?: boolean;
		class?: string;
	} = $props();

	const logoSrc = asset('/brand/lapkart-logo.svg');
</script>

<span class="brand-logo brand-logo--{variant} {className}">
	<img src={logoSrc} alt="LapKart" width="1254" height="1254" decoding="async" />
	{#if showText}
		<span class="brand-logo__copy">
			<span class="brand-logo__name">lap<span>kart</span></span>
			{#if suffix}
				<span class="brand-logo__suffix">{suffix}</span>
			{/if}
		</span>
	{/if}
</span>

<style>
	.brand-logo {
		display: inline-flex;
		min-width: 0;
		align-items: center;
		gap: 8px;
		line-height: 1;
	}

	.brand-logo img {
		display: block;
		width: var(--brand-logo-size, 34px);
		height: var(--brand-logo-size, 34px);
		flex: 0 0 auto;
		object-fit: contain;
	}

	:global(html[data-lapkart-native]) .brand-logo img {
		box-sizing: border-box;
		border-radius: calc(var(--brand-logo-size, 34px) * 0.18);
		padding: calc(var(--brand-logo-size, 34px) * 0.06);
	}

	.brand-logo__copy {
		display: inline-flex;
		min-width: 0;
		align-items: baseline;
		gap: 6px;
		line-height: 1;
	}

	.brand-logo__name {
		color: var(--brand-logo-name, var(--foreground, #161616));
		font-family: var(--font-display, inherit);
		font-size: var(--brand-logo-name-size, 22px);
		font-weight: var(--brand-logo-name-weight, 500);
		letter-spacing: 0;
	}

	.brand-logo__name span {
		color: var(--heat-100, #fa5d19);
	}

	.brand-logo__suffix {
		color: var(--brand-logo-suffix, var(--black-alpha-40, rgba(0, 0, 0, 0.4)));
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.brand-logo--footer {
		--brand-logo-size: 44px;
		--brand-logo-name: #ffffff;
		--brand-logo-name-size: 28px;
		--brand-logo-suffix: rgba(255, 255, 255, 0.48);
	}

	.brand-logo--auth {
		--brand-logo-size: 40px;
		--brand-logo-name: #ffffff;
		--brand-logo-name-size: 20px;
		--brand-logo-name-weight: 600;
	}

	.brand-logo--admin {
		--brand-logo-size: 34px;
		--brand-logo-name: #ffffff;
		--brand-logo-name-size: 15px;
		--brand-logo-name-weight: 600;
	}

	.brand-logo--error {
		--brand-logo-size: 36px;
		--brand-logo-name-size: 18px;
		--brand-logo-name-weight: 700;
	}

	.brand-logo--search {
		--brand-logo-size: 18px;
		gap: 6px;
	}
</style>
