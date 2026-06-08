import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getOrderById } from '$lib/orders';
import { isStaffRole } from '$lib/roles';

export const load: PageServerLoad = async ({ depends, locals, parent, params }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, `/login?redirect=${encodeURIComponent(`/order/${params.id}`)}`);
	}

	if (isStaffRole(role)) {
		redirect(307, '/admin');
	}

	depends(`order:${params.id}`);

	const order = await getOrderById(user.id, params.id, locals.supabase);

	if (!order) {
		error(404, 'Order not found');
	}

	return { order };
};
