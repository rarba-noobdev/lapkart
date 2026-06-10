import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isStaffRole } from '$lib/roles';
import { GRIEVANCE_CATEGORY_SET, type GrievanceCategory } from '$lib/grievances';

export const load: PageServerLoad = async ({ depends, locals, parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/grievances');
	}

	if (isStaffRole(role)) {
		redirect(307, '/admin?section=support');
	}

	depends('app:grievances');

	const [grievancesResult, ordersResult] = await Promise.all([
		locals.supabase
			.from('grievances')
			.select('id,category,subject,description,status,resolution_note,created_at,updated_at,order_id')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(50),
		locals.supabase
			.from('orders')
			.select('id,created_at,total')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false })
			.limit(20)
	]);

	return {
		grievances: grievancesResult.data ?? [],
		orders: ordersResult.data ?? []
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/grievances');

		const fd = await request.formData();
		const category = String(fd.get('category') ?? '') as GrievanceCategory;
		const subject = String(fd.get('subject') ?? '').trim();
		const description = String(fd.get('description') ?? '').trim();
		const orderId = String(fd.get('orderId') ?? '').trim();

		if (!GRIEVANCE_CATEGORY_SET.has(category)) {
			return fail(400, { success: false, message: 'Choose a category.' });
		}
		if (subject.length < 4 || subject.length > 160) {
			return fail(400, { success: false, message: 'Subject must be 4–160 characters.' });
		}
		if (description.length < 10 || description.length > 4000) {
			return fail(400, { success: false, message: 'Describe the issue in at least 10 characters.' });
		}

		const { error } = await locals.supabase.from('grievances').insert({
			user_id: user.id,
			category,
			subject,
			description,
			status: 'open',
			order_id: orderId || null
		});

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Complaint submitted. We will acknowledge it within 48 hours.' };
	}
};
