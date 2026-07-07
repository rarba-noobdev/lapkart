import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const androidPackageName = 'com.lapkart.store';
const appLinkHost = 'www.lapkart.store';

function sanitizeNext(next: string | null) {
	if (!next) return '/';
	return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function isAndroidBrowserRequest(request: Request) {
	const userAgent = request.headers.get('user-agent') ?? '';
	return /android/i.test(userAgent) && !/;\s*wv[);]/i.test(userAgent);
}

function buildAndroidIntentUrl(callbackUrl: URL) {
	const appCallbackUrl = new URL(callbackUrl);
	appCallbackUrl.hostname = appLinkHost;
	appCallbackUrl.searchParams.set('app_redirect', '1');
	const pathWithSearch = `${appCallbackUrl.pathname}${appCallbackUrl.search}`;

	return `intent://${appLinkHost}${pathWithSearch}#Intent;scheme=https;package=${androidPackageName};S.browser_fallback_url=${encodeURIComponent(appCallbackUrl.toString())};end`;
}

export const GET: RequestHandler = async ({ url, locals, request }) => {
	const code = url.searchParams.get('code');
	const next = sanitizeNext(url.searchParams.get('next'));

	if (code) {
		if (isAndroidBrowserRequest(request) && url.searchParams.get('app_redirect') !== '1') {
			redirect(303, buildAndroidIntentUrl(url));
		}

		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			redirect(303, next);
		}
	}

	redirect(303, `/auth/auth-code-error?next=${encodeURIComponent(next)}`);
};
