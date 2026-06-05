import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function sanitizeNext(next: string | null) {
	if (!next) return '/';
	return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = sanitizeNext(url.searchParams.get('next'));

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

		if (!error) {
			redirect(303, next);
		}
	}

	redirect(303, '/auth/auth-code-error');
};
