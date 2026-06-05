<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'What we sell',
			body: 'LapKart focuses on laptop components including RAM, SSDs, batteries, displays, chargers, keyboards, hinges, cases, cooling parts, and related replacement hardware.'
		},
		{
			title: 'How orders are fulfilled',
			body: 'Orders are paid through Razorpay, packed by LapKart operations, and fulfilled using configured logistics partners such as Shiprocket with tracking updates shown in your account.'
		},
		{
			title: 'Support promise',
			body: 'We prioritize compatibility clarity, genuine sourcing, safe packaging, and clear post-order support for cancellation, returns, refunds, and delivery tracking.'
		}
	];
</script>

<svelte:head><title>About LapKart</title></svelte:head>

<StaticPage
	eyebrow="About"
	title="Laptop parts commerce built for India"
	description="LapKart helps customers find genuine replacement and upgrade parts with secure checkout, delivery estimates, and tracked fulfillment."
	{sections}
/>
