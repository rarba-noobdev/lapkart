<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Delivery estimates',
			body: 'Delivery estimates shown during checkout are based on your selected location, route data, package weight, and the current LapKart manual delivery rate card.'
		},
		{
			title: 'Dispatch',
			body: 'Paid orders are reviewed by the operations team, packed, and handed to the manual courier workflow. Live map tracking is not provided at this stage.'
		},
		{
			title: 'Delays',
			body: 'Courier delays, address issues, weather, or serviceability limits may affect delivery. Order status updates are shown on the order detail page as staff updates the dispatch workflow.'
		}
	];
</script>

<StaticPage
	eyebrow="Shipping"
	title="Shipping policy"
	description="Delivery cost is calculated before payment using LapKart manual delivery rules."
	{sections}
/>
