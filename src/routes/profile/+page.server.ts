import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listOrdersForUser } from '$lib/orders';
import { isStaffRole, normalizeAppRole } from '$lib/roles';
import { CONSENT_POLICY_VERSION, MARKETING_PURPOSES, type ConsentPurpose } from '$lib/consent';

const MARKETING_PURPOSE_SET = new Set<ConsentPurpose>(MARKETING_PURPOSES.map((p) => p.purpose));

export const load: PageServerLoad = async ({ depends, locals, parent }) => {
	const { user, role } = await parent();

	if (!user) {
		redirect(307, '/login?redirect=/profile');
	}

	if (isStaffRole(role)) {
		redirect(307, '/admin');
	}

	depends('app:profile');
	depends(`orders:user:${user.id}`);
	depends('app:consents');

	const [
		profileResult,
		orders,
		orderTotalsResult,
		addressesResult,
		consentsResult,
		deletionRequestResult
	] = await Promise.all([
		locals.supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
		listOrdersForUser(user.id, locals.supabase, 10),
		locals.supabase.from('orders').select('id,total').eq('user_id', user.id),
		locals.supabase
			.from('addresses')
			.select(
				'id,user_id,full_name,phone,line1,line2,city,state,pincode,is_default,created_at,latitude,longitude,location_source,ola_place_id,formatted_address'
			)
			.eq('user_id', user.id)
			.order('is_default', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(20),
		locals.supabase
			.from('user_consents')
			.select('purpose,granted,created_at')
			.eq('user_id', user.id)
			.in('purpose', [...MARKETING_PURPOSE_SET])
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('data_deletion_requests')
			.select('id,status,requested_at')
			.eq('user_id', user.id)
			.eq('status', 'pending')
			.maybeSingle()
	]);

	if (profileResult.error) {
		throw profileResult.error;
	}

	// Latest row per purpose wins (append-only ledger). Default to not-granted.
	const marketingConsent: Record<string, boolean> = {};
	for (const row of consentsResult.data ?? []) {
		if (!(row.purpose in marketingConsent)) marketingConsent[row.purpose] = row.granted;
	}

	if (orderTotalsResult.error) {
		throw orderTotalsResult.error;
	}

	return {
		profile: {
			fullName: profileResult.data?.full_name ?? user.user_metadata?.full_name ?? '',
			phone: profileResult.data?.phone ?? ''
		},
		orders,
		orderCount: orderTotalsResult.data?.length ?? orders.length,
		totalSpent: (orderTotalsResult.data ?? []).reduce(
			(sum, order) => sum + Number(order.total ?? 0),
			0
		),
		addresses: addressesResult.data ?? [],
		marketingPurposes: MARKETING_PURPOSES,
		marketingConsent,
		pendingDeletionRequest: deletionRequestResult.data ?? null
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

		const role = normalizeAppRole(roleData?.role);

		if (isStaffRole(role)) {
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

	updateMarketingConsent: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const purpose = String(fd.get('purpose') ?? '') as ConsentPurpose;
		const granted = fd.get('granted') === 'true';

		if (!MARKETING_PURPOSE_SET.has(purpose)) {
			return fail(400, { success: false, message: 'Unknown consent option.' });
		}

		const { error } = await locals.supabase.rpc('record_consent', {
			p_purpose: purpose,
			p_granted: granted,
			p_policy_version: CONSENT_POLICY_VERSION,
			p_source: 'profile',
			p_user_agent: request.headers.get('user-agent') ?? null
		});

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: granted ? 'Preference enabled.' : 'Preference disabled.' };
	},

	requestAccountDeletion: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const reason = String(fd.get('reason') ?? '').trim().slice(0, 1000);

		const { error } = await locals.supabase.from('data_deletion_requests').insert({
			user_id: user.id,
			status: 'pending',
			reason: reason || null
		});

		if (error) {
			// Unique partial index rejects a second open request.
			if (error.code === '23505') {
				return fail(400, {
					success: false,
					message: 'You already have a deletion request in progress.'
				});
			}
			return fail(400, { success: false, message: error.message });
		}

		return {
			success: true,
			message: 'Deletion request received. Our team will process it and confirm by email.'
		};
	},

	cancelAccountDeletion: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		if (!user) redirect(303, '/login?redirect=/profile');

		const fd = await request.formData();
		const requestId = String(fd.get('requestId') ?? '');
		if (!requestId) {
			return fail(400, { success: false, message: 'Request ID missing.' });
		}

		const { error } = await locals.supabase
			.from('data_deletion_requests')
			.update({ status: 'cancelled' })
			.eq('id', requestId)
			.eq('user_id', user.id)
			.eq('status', 'pending');

		if (error) {
			return fail(400, { success: false, message: error.message });
		}

		return { success: true, message: 'Deletion request cancelled.' };
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
