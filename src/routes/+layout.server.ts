import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('supabase:auth');

	const { session, user } = await locals.safeGetSession().catch((error) => {
		console.warn('Layout session lookup failed; rendering as signed out.', error);
		return { session: null, user: null };
	});

	const role = user
		? await locals.getRole().catch((error) => {
				console.warn('Layout role lookup failed; rendering without role.', error);
				return null;
			})
		: null;

	const { data: claimsData, error: claimsError } = user
		? await locals.supabase.auth
				.getClaims()
				.catch(() => ({ data: null, error: new Error('Could not read auth claims') }))
		: { data: null, error: null };

	return {
		cookies: user ? cookies.getAll().filter((cookie) => cookie.name.startsWith('sb-')) : [],
		claims: claimsError ? null : (claimsData?.claims ?? null),
		session,
		user,
		role
	};
};
