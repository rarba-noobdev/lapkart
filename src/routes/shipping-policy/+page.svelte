<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Delivery estimates',
			body: 'Delivery estimates shown during checkout are based on your selected location, route data, courier availability, package weight, and current logistics responses.'
		},
		{
			title: 'Dispatch',
			body: 'Paid orders are reviewed by the operations team, packed, and assigned to a courier. Tracking begins after shipment creation and AWB assignment.'
		},
		{
			title: 'Delays',
			body: 'Courier delays, address issues, weather, or serviceability limits may affect delivery. Tracking updates are shown on the order detail page as they are received.'
		}
	];
</script>

<svelte:head><title>Shipping Policy - LapKart</title></svelte:head>

<StaticPage
	eyebrow="Shipping"
	title="Shipping policy"
	description="Delivery cost and courier availability are checked before payment wherever serviceability data is available."
	{sections}
/>
