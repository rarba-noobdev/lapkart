import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listOrdersForUser } from '$lib/orders';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/dashboard');
	}

	if (role === 'admin') {
		redirect(307, '/admin');
	}

	const [profileResult, orders] = await Promise.all([
		locals.supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
		listOrdersForUser(user.id, locals.supabase)
	]);

	if (profileResult.error) {
		throw profileResult.error;
	}

	return {
		profile: {
			fullName: profileResult.data?.full_name ?? user.user_metadata?.full_name ?? '',
			phone: profileResult.data?.phone ?? ''
		},
		orderCount: orders.length,
		totalSpent: orders.reduce((sum, order) => sum + order.total, 0)
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();

		if (!user) {
			redirect(303, '/login?redirect=/dashboard');
		}

		const { data: roleData } = await locals.supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', user.id)
			.maybeSingle();

		const role = roleData?.role === 'admin' ? 'admin' : 'user';

		if (role === 'admin') {
			redirect(303, '/admin');
		}

		const formData = await request.formData();
		const fullName = String(formData.get('fullName') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();

		if (fullName.length < 2) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: 'Enter your full name.'
			});
		}

		if (phone && phone.replace(/\D/g, '').length < 10) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: 'Enter a valid 10-digit phone number.'
			});
		}

		const [profileResult, orderCountResult] = await Promise.all([
			locals.supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle(),
			locals.supabase
				.from('orders')
				.select('id', { count: 'exact', head: true })
				.eq('user_id', user.id)
		]);

		if (profileResult.error) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: profileResult.error.message
			});
		}

		if (orderCountResult.error) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: orderCountResult.error.message
			});
		}

		const currentPhone = profileResult.data?.phone ?? '';
		const hasOrderHistory = (orderCountResult.count ?? 0) > 0;

		if (hasOrderHistory && phone !== currentPhone) {
			return fail(400, {
				success: false,
				fullName,
				phone: currentPhone,
				message: 'Phone number is locked after your first order.'
			});
		}

		const { data: updatedProfile, error } = await locals.supabase
			.from('profiles')
			.update({
				full_name: fullName,
				phone: phone || null,
				updated_at: new Date().toISOString()
			})
			.eq('id', user.id)
			.select('id')
			.maybeSingle();

		if (error) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: error.message
			});
		}

		if (!updatedProfile) {
			return fail(400, {
				success: false,
				fullName,
				phone,
				message: 'Profile was not found. Sign out and sign in again before updating it.'
			});
		}

		return {
			success: true,
			fullName,
			phone,
			message: 'Profile saved.'
		};
	}
};
