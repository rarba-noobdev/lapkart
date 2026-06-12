<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Tamil Nadu service area',
			body: 'Delivery is currently available only inside Tamil Nadu. Checkout blocks orders outside this service area before payment.'
		},
		{
			title: 'Delivery charges',
			body: 'Shipping is max(INR 50, ceil(package weight in kg) x INR 40). Orders with subtotal of INR 2,000 or more get free delivery.'
		},
		{
			title: 'Dispatch and delivery',
			body: 'A local courier contact picks up from LapKart daily. Paid orders placed before 5 PM are targeted for next-day delivery across Tamil Nadu; later orders move to the next pickup cycle.'
		},
		{
			title: 'Tracking and proof',
			body: 'Live map tracking is not provided. Customer order status moves through Paid, Out for delivery, and Delivered. LapKart records photo and video proof before sending each package.'
		}
	];
</script>

<StaticPage
	eyebrow="Shipping"
	title="Shipping policy"
	description="Courier delivery is available across Tamil Nadu with a fixed weight-based rate card."
	{sections}
/>
