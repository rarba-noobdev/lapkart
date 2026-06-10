// Bump when the Terms or Privacy Notice change materially. Recording the
// version against each consent row makes it auditable which policy text a user
// agreed to, and lets us re-prompt when the version moves.
export const CONSENT_POLICY_VERSION = '2026-06-10';

export type ConsentPurpose = 'terms_privacy' | 'marketing_email' | 'marketing_whatsapp';
export type ConsentSource = 'signup' | 'profile' | 'checkout';

export const MARKETING_PURPOSES: { purpose: ConsentPurpose; label: string; description: string }[] = [
	{
		purpose: 'marketing_email',
		label: 'Promotional emails',
		description: 'Offers, restock alerts and product news by email. Transactional order emails are sent regardless.'
	},
	{
		purpose: 'marketing_whatsapp',
		label: 'WhatsApp updates',
		description: 'Promotional and restock messages on WhatsApp. Order and delivery updates are sent regardless.'
	}
];
