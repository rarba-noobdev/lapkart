<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Account use',
			body: [
				'Customers are responsible for keeping login credentials secure and for providing accurate name, phone, email, delivery, payment, and compatibility details during checkout.',
				'You must not misuse the service, attempt unauthorized access, submit false support or return claims, or interfere with the catalog, checkout, payment, or admin systems.'
			]
		},
		{
			title: 'LapKart as seller',
			body: [
				'LapKart is the customer-facing seller, merchant, and reseller for orders placed through this website and Android app. Customer order confirmation, payment collection, dispatch support, cancellation, return, replacement, and refund communication are handled by LapKart.',
				'Procurement partners may supply or bill goods to LapKart for internal purchasing, but customers buy from LapKart and should contact only LapKart for order, payment, receipt, delivery, and support questions.'
			]
		},
		{
			title: 'Product information',
			body: [
				'We aim to keep prices, stock, specifications, images, condition notes, compatibility details, delivery charges, and availability accurate. Laptop replacement parts can vary by model, panel number, connector, bracket, voltage, and condition, so customers should verify compatibility before ordering.',
				'If a catalog, price, stock, compatibility, or payment issue is found before dispatch, support may contact you for correction, replacement choice, or cancellation.'
			]
		},
		{
			title: 'Orders and payments',
			body: [
				'Orders are confirmed only after successful server-side payment verification or approved cash-on-delivery eligibility. Fulfillment, cancellation, return, refund, and support actions are recorded against the order.',
				'Online payments are processed by Razorpay and the selected payment provider. Do not share UPI PINs, card PINs, OTPs, or banking passwords with LapKart support.'
			]
		},
		{
			title: 'Delivery, returns and refunds',
			body: [
				'Delivery is handled manually within the currently supported service area and depends on stock, payment verification, packaging, courier pickup, address accuracy, weather, holidays, and local delivery constraints.',
				'Cancellations, returns, replacements, and refunds are handled under the Shipping policy, Return policy, and Cancellation and refund policy published on this site.'
			]
		},
		{
			title: 'Data and app operation',
			body: [
				'Use of LapKart is also governed by the Privacy policy, which explains account data, order data, payment references, delivery information, support records, local cart storage, service-worker cache, and deletion/correction request paths.',
				'The Android app may cache public catalog data for speed and limited offline browsing. Checkout, orders, payments, account, support, and admin workflows require a live connection.'
			]
		},
		{
			title: 'Support and limitation',
			body: [
				'Support requests and grievances can be sent to support@lapkart.store or raised from the Support & complaints page. We may request order details or evidence needed to investigate the issue.',
				'To the extent permitted by applicable law, LapKart is not liable for indirect losses, customer-side installation mistakes, unsupported compatibility assumptions, third-party payment downtime, courier delay, or force-majeure events.'
			]
		}
	];
</script>

<StaticPage
	eyebrow="Terms"
	title="Terms and conditions"
	description="These terms describe how LapKart orders, payments, account access, and support workflows operate."
	{sections}
/>
