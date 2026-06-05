import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (user) {
		await locals.supabase.auth.signOut();
	}

	redirect(303, '/login');
};
