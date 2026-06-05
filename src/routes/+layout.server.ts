import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { session, user } = await locals.safeGetSession();
	const role = user ? await locals.getRole() : null;

	return {
		cookies: cookies.getAll(),
		session,
		user,
		role
	};
};
