<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Who to contact',
			body: [
				'LapKart is the customer-facing seller and storefront responsible for the customer data processed through this website and Android app.',
				'For privacy questions, correction, deletion, consent withdrawal, or grievance requests, contact support@lapkart.store or use the Support & complaints page while signed in.'
			]
		},
		{
			title: 'Data we collect',
			body: [
				'We collect account identifiers, name, email, phone number, delivery address, pincode, optional map-selected delivery coordinates, cart/order records, order receipts, payment references, refund details, support and grievance messages, return evidence, device/app diagnostics, consent choices, and security records needed to protect the service.',
				'If you grant permission or choose a workflow that needs it, the Android app may receive a push notification token, browser/native location result, or camera/gallery file selected for support, delivery, return, or evidence handling.',
				'Payment card numbers, UPI PINs, and banking credentials are not stored by LapKart. Online payment collection is handled by Razorpay and the selected payment provider.'
			]
		},
		{
			title: 'How data is used',
			body: [
				'Data is used to create and secure accounts, keep the cart available on the device, verify payments, generate order receipts and records, estimate delivery charges, manage courier shipping, track order state, process cancellations, returns and refunds, prevent fraud or abuse, respond to support requests, and meet legal or accounting obligations.',
				'Marketing messages are sent only where a valid consent or lawful basis exists. Consent choices can be changed from the available account, support, or consent controls.'
			]
		},
		{
			title: 'Offline cache and local storage',
			body: [
				'The web app and Android app may store non-sensitive app files, public catalog pages, public product data, public search results, product images, cookie-consent choices, and cart contents on the device so browsing is faster and limited catalog viewing can work when the connection drops.',
				'Private pages and data such as checkout, payments, profile, admin, order history, and individual order details are not intentionally cached for offline replay. Cached public catalog data can become stale until the app reconnects.'
			]
		},
		{
			title: 'Processors and sharing',
			body: [
				'Data may be processed by Supabase for database/authentication infrastructure, Razorpay for payment processing, Ola Maps for map and location features, analytics or crash tooling where enabled, and manual courier or support operations where needed to fulfill an order or resolve a request.',
				'We may share information when required by law, payment disputes, fraud prevention, tax/accounting obligations, or a valid request from a competent authority.'
			]
		},
		{
			title: 'Retention and deletion',
			body: [
				'You may request access, correction, updating, deletion, or grievance review through support@lapkart.store or the Support & complaints page. We may ask for the account, order id, phone number, or email needed to identify the request.',
				'Personal data is deleted or anonymized when it is no longer needed for the stated purpose, unless retention is required for order receipts, accounting records, fraud prevention, payment disputes, returns/refunds, security, or another legal obligation.'
			]
		},
		{
			title: 'Security and children',
			body: [
				'We use HTTPS/TLS in transit and restrict access to operational data based on role. No system is risk-free, so report suspected account misuse or data issues to support@lapkart.store.',
				'LapKart is not directed to children. If a parent or guardian believes a child has provided personal data, contact us so the account or data can be reviewed.'
			]
		}
	];
</script>

<StaticPage
	eyebrow="Privacy"
	title="Privacy policy"
	description="LapKart stores only the information needed to run account, checkout, delivery, support, and security workflows."
	{sections}
/>
