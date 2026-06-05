import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listOrdersForUser } from '$lib/orders';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/orders');
	}

	if (role === 'admin') {
		redirect(307, '/admin');
	}

	return {
		orders: await listOrdersForUser(user.id, locals.supabase)
	};
};
