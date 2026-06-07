import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/admin');
	}

	if (role !== 'admin') {
		redirect(307, '/profile');
	}

	return {};
};
