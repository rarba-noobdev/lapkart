import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isStaffRole } from '$lib/roles';

export const load: PageServerLoad = async ({ parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/checkout');
	}

	if (isStaffRole(role)) {
		redirect(307, '/admin');
	}

	return {};
};
