import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('supabase:auth');

	const { session, user } = await locals.safeGetSession().catch((error) => {
		console.warn('Layout session lookup failed; rendering as signed out.', error);
		return { session: null, user: null };
	});

	const [role, claimsResult] = user
		? await Promise.all([
				locals.getRole().catch((error) => {
					console.warn('Layout role lookup failed; rendering without role.', error);
					return null;
				}),
				locals.supabase.auth
					.getClaims()
					.catch(() => ({ data: null, error: new Error('Could not read auth claims') }))
			])
		: [null, { data: null, error: null }];

	return {
		cookies: user ? cookies.getAll().filter((cookie) => cookie.name.startsWith('sb-')) : [],
		claims: claimsResult.error ? null : (claimsResult.data?.claims ?? null),
		session,
		user,
		role
	};
};
