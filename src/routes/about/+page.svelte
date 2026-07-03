<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'What we sell',
			body: 'LapKart sells laptop components including RAM, SSDs, batteries, displays, chargers, keyboards, hinges, cases, cooling parts, and related replacement hardware as the customer-facing reseller.'
		},
		{
			title: 'How orders are fulfilled',
			body: 'Customers buy from LapKart. Parts may be sourced through internal procurement partners, then packed by LapKart operations and fulfilled through manual courier dispatch with status updates shown in your account.'
		},
		{
			title: 'Support promise',
			body: 'We prioritize clear compatibility notes, visible product condition, safe packaging, and support for cancellation, returns, refunds, privacy requests, and delivery questions.'
		},
		{
			title: 'Data and transparency',
			body: 'Public catalog data may be cached for speed and limited offline browsing, while private account, order, checkout, and payment workflows require a live connection and are covered by the Privacy policy.'
		}
	];
</script>

<StaticPage
	eyebrow="About"
	title="Laptop parts commerce built for India"
	description="LapKart helps customers find genuine replacement and upgrade parts with secure checkout, delivery estimates, and tracked fulfillment."
	{sections}
/>
