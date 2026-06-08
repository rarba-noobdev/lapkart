import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies, depends }) => {
	depends('supabase:auth');
	const { session, user } = await locals.safeGetSession();
	const role = user ? await locals.getRole() : null;
	const { data: claimsData, error: claimsError } = user
		? await locals.supabase.auth
				.getClaims()
				.catch(() => ({ data: null, error: new Error('Could not read auth claims') }))
		: { data: null, error: null };

	return {
		cookies: cookies.getAll(),
		claims: claimsError ? null : (claimsData?.claims ?? null),
		session,
		user,
		role
	};
};
