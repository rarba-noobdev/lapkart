<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Customer support',
			body: 'Email support@lapkart.store with your order id, registered phone number, and a short description of the issue. Support is handled Monday to Saturday, 10 AM to 6 PM IST.'
		},
		{
			title: 'Order issues',
			body: 'For active orders, open your order detail page to view status, cancellation eligibility, return eligibility, refund status, delivery proof, and receipt information.'
		},
		{
			title: 'Business information',
			body: 'LapKart operates as the seller for laptop components and replacement hardware. For legal, receipt, data protection, grievance, or statutory communication, email support@lapkart.store or raise a request through Support & complaints.'
		},
		{
			title: 'Privacy and grievances',
			body: 'Use Support & complaints for complaints, privacy/data requests, cancellation and refund questions, delivery issues, product defects, and account concerns. We acknowledge complaints within 48 hours and aim to resolve them within the published grievance timeline.'
		}
	];
</script>

<StaticPage
	eyebrow="Contact"
	title="Contact and support"
	description="Use this page for order support, returns, delivery questions, and catalog compatibility help."
	{sections}
/>
