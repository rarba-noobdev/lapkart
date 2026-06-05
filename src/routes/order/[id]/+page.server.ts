import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOrderById } from '$lib/orders';

export const load: PageServerLoad = async ({ locals, parent, params }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, `/login?redirect=${encodeURIComponent(`/order/${params.id}`)}`);
	}

	if (role === 'admin') {
		redirect(307, '/admin');
	}

	const order = await getOrderById(user.id, params.id, locals.supabase);

	if (!order) {
		error(404, 'Order not found');
	}

	return { order };
};
