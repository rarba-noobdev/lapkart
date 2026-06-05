<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Account use',
			body: 'Customers are responsible for keeping login credentials secure and for providing accurate delivery, phone, and compatibility details during checkout.'
		},
		{
			title: 'Product information',
			body: 'We aim to keep prices, stock, specifications, images, and compatibility details accurate. If an issue is found before dispatch, support may contact you for correction or cancellation.'
		},
		{
			title: 'Orders and payments',
			body: 'Orders are confirmed only after successful server-side payment verification. Fulfillment, cancellation, return, and refund actions are recorded against the order.'
		}
	];
</script>

<svelte:head><title>Terms and Conditions - LapKart</title></svelte:head>

<StaticPage
	eyebrow="Terms"
	title="Terms and conditions"
	description="These terms describe how LapKart orders, payments, account access, and support workflows operate."
	{sections}
/>
