<script lang="ts">
	import StaticPage from '$lib/components/StaticPage.svelte';

	const sections = [
		{
			title: 'Cancellation policy',
			body: 'Orders can be cancelled before shipment. Once an order is placed, you may request cancellation from the order detail page in your account. If the order has not been handed over to the courier, cancellation is processed immediately. After courier pickup or AWB assignment, cancellation requests cannot be accepted through self-service and must be handled via our support team. Orders already in transit cannot be cancelled and must go through the return process after delivery.'
		},
		{
			title: 'Cancellation by LapKart',
			body: 'We reserve the right to cancel orders due to stock unavailability, pricing errors, suspected fraudulent activity, or inability to verify payment. In such cases, the full payment amount is refunded to the original payment method. You will be notified via email if your order is cancelled by us.'
		},
		{
			title: 'Return eligibility',
			body: 'Products may be returned within 7 days of delivery if they are defective, damaged during shipping, or not matching the product description. Items must be unused, in original packaging, and include all accessories and documentation. Compatibility issues arising from incorrect model selection by the customer are not eligible for return. Dead-on-arrival (DOA) products are eligible for immediate replacement or full refund.'
		},
		{
			title: 'Refund policy',
			body: 'Refunds are initiated after the returned item is received and inspected by our team. Approved refunds are processed to the original payment method used during checkout (UPI, credit/debit card, or net banking via Razorpay). Refund processing typically takes 5-7 business days after approval, depending on your bank or payment provider. For COD orders, refunds are processed via bank transfer to the account details you provide.'
		},
		{
			title: 'Refund timelines',
			body: 'UPI payments: 2-4 business days. Credit/debit cards: 5-7 business days. Net banking: 5-10 business days. Wallet payments: 2-3 business days. These timelines begin after the refund is initiated from our end and depend on your bank or payment provider processing speed.'
		},
		{
			title: 'Partial refunds',
			body: 'If only part of a multi-item order is returned or found defective, a partial refund corresponding to the returned item value is issued. Shipping charges are non-refundable unless the return is due to our error (wrong item shipped, defective product, or damaged in transit).'
		},
		{
			title: 'How to request a cancellation or return',
			body: 'Log in to your LapKart account, navigate to your order history, select the order, and use the cancellation or return option. For orders already shipped, select the return option after delivery. You can also reach out to our support team at support@lapkart.store for assistance with cancellations and returns.'
		},
		{
			title: 'Non-returnable items',
			body: 'Products that have been installed, used, or physically altered are not eligible for return. Items without original packaging or missing accessories may be subject to a restocking deduction. Software or digital products are non-returnable once activated.'
		},
		{
			title: 'Contact us',
			body: 'For any questions regarding cancellations, returns, or refunds, contact us at support@lapkart.store. Our support team is available Monday to Saturday, 10 AM to 6 PM IST.'
		}
	];
</script>

<StaticPage
	eyebrow="Policy"
	title="Cancellation and refund policy"
	description="Our cancellation, return, and refund policies for all orders placed on LapKart."
	{sections}
/>
