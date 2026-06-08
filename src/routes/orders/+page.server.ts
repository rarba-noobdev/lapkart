import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listOrdersPageForUser } from '$lib/orders';
import { isStaffRole } from '$lib/roles';

function parsePage(value: string | null) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const load: PageServerLoad = async ({ depends, locals, parent, url }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/orders');
	}

	if (isStaffRole(role)) {
		redirect(307, '/admin');
	}

	depends(`orders:user:${user.id}`);

	const result = await listOrdersPageForUser(user.id, locals.supabase, {
		page: parsePage(url.searchParams.get('page')),
		pageSize: 20
	});

	return result;
};
