import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listOrdersForUser } from '$lib/orders';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/profile');
	}

	if (role === 'admin') {
		redirect(307, '/admin');
	}

	const [profileResult, orders, addressesResult] = await Promise.all([
		locals.supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
		listOrdersForUser(user.id, locals.supabase),
		locals.supabase
			.from('addresses')
			.select('*')
			.eq('user_id', user.id)
			.order('is_default', { ascending: false })
			.order('created_at', { ascending: false })
	]);

	if (profileResult.error) {
		throw profileResult.error;
	}

	return {
		profile: {
			fullName: profileResult.data?.full_name ?? user.user_metadata?.full_name ?? '',
			phone: profileResult.data?.phone ?? ''
		},
		orders,
		orderCount: orders.length,
		totalSpent: orders.reduce((sum, order) => sum + order.total, 0),
		addresses: addressesResult.data ?? []
	};
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();

		if (!user) {
			redirect(303, '/login?redirect=/profile');
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
	},

	addAddress: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const fullName = String(fd.get('fullName') ?? '').trim();
		const phone = String(fd.get('phone') ?? '').trim();
		const line1 = String(fd.get('line1') ?? '').trim();
		const line2 = String(fd.get('line2') ?? '').trim();
		const city = String(fd.get('city') ?? '').trim();
		const state = String(fd.get('state') ?? '').trim();
		const pincode = String(fd.get('pincode') ?? '').trim();
		const isDefault = fd.get('isDefault') === 'true';

		if (!fullName || !phone || !line1 || !city || !state || !pincode) {
			return fail(400, { success: false, message: 'All required fields must be filled.' });
		}

		if (!/^[0-9]{6}$/.test(pincode)) {
			return fail(400, { success: false, message: 'Enter a valid 6-digit pincode.' });
		}

		if (isDefault) {
			await locals.supabase
				.from('addresses')
				.update({ is_default: false })
				.eq('user_id', user.id);
		}

		const { error } = await locals.supabase.from('addresses').insert({
			user_id: user.id,
			full_name: fullName,
			phone,
			line1,
			line2: line2 || null,
			city,
			state,
			pincode,
			is_default: isDefault
		});

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Address added.' };
	},

	updateAddress: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const addressId = String(fd.get('addressId') ?? '');
		const fullName = String(fd.get('fullName') ?? '').trim();
		const phone = String(fd.get('phone') ?? '').trim();
		const line1 = String(fd.get('line1') ?? '').trim();
		const line2 = String(fd.get('line2') ?? '').trim();
		const city = String(fd.get('city') ?? '').trim();
		const state = String(fd.get('state') ?? '').trim();
		const pincode = String(fd.get('pincode') ?? '').trim();
		const isDefault = fd.get('isDefault') === 'true';

		if (!addressId || !fullName || !phone || !line1 || !city || !state || !pincode) {
			return fail(400, { success: false, message: 'All required fields must be filled.' });
		}

		if (!/^[0-9]{6}$/.test(pincode)) {
			return fail(400, { success: false, message: 'Enter a valid 6-digit pincode.' });
		}

		if (isDefault) {
			await locals.supabase
				.from('addresses')
				.update({ is_default: false })
				.eq('user_id', user.id);
		}

		const { error } = await locals.supabase
			.from('addresses')
			.update({
				full_name: fullName,
				phone,
				line1,
				line2: line2 || null,
				city,
				state,
				pincode,
				is_default: isDefault
			})
			.eq('id', addressId)
			.eq('user_id', user.id);

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Address updated.' };
	},

	deleteAddress: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const addressId = String(fd.get('addressId') ?? '');

		if (!addressId) {
			return fail(400, { success: false, message: 'Address ID missing.' });
		}

		const { error } = await locals.supabase
			.from('addresses')
			.delete()
			.eq('id', addressId)
			.eq('user_id', user.id);

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Address deleted.' };
	},

	setDefaultAddress: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const addressId = String(fd.get('addressId') ?? '');

		if (!addressId) {
			return fail(400, { success: false, message: 'Address ID missing.' });
		}

		await locals.supabase
			.from('addresses')
			.update({ is_default: false })
			.eq('user_id', user.id);

		const { error } = await locals.supabase
			.from('addresses')
			.update({ is_default: true })
			.eq('id', addressId)
			.eq('user_id', user.id);

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Default address updated.' };
	}
};
