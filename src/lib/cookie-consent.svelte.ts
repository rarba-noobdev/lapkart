import { browser } from '$app/environment';

export type CookieConsent = 'granted' | 'denied';

const STORAGE_KEY = 'lapkart_cookie_consent_v1';

// Reactive consent state. `null` means the user has not chosen yet, so the
// banner should be shown and analytics must stay disabled (Consent Mode v2
// defaults to denied until an explicit grant).
export const cookieConsent = $state<{ value: CookieConsent | null }>({ value: null });

export function loadStoredConsent(): CookieConsent | null {
	if (!browser) return null;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'granted' || stored === 'denied') {
		cookieConsent.value = stored;
		return stored;
	}
	return null;
}

export function setCookieConsent(value: CookieConsent) {
	cookieConsent.value = value;
	if (browser) localStorage.setItem(STORAGE_KEY, value);
	if (browser && typeof window.gtag === 'function') {
		const state = value === 'granted' ? 'granted' : 'denied';
		window.gtag('consent', 'update', {
			analytics_storage: state,
			ad_storage: state,
			ad_user_data: state,
			ad_personalization: state
		});
	}
}
