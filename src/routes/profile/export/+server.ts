import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// DPDP data portability: a signed-in user downloads a machine-readable copy of
// the personal data we hold. Every query is RLS-scoped to the caller, so this
// only ever returns the requester's own records.
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(307, '/login?redirect=/profile');

	const [profile, addresses, orders, orderItems, payments, consents] = await Promise.all([
		locals.supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
		locals.supabase.from('addresses').select('*').eq('user_id', user.id),
		locals.supabase.from('orders').select('*').eq('user_id', user.id),
		locals.supabase.from('order_items').select('*, orders!inner(user_id)').eq('orders.user_id', user.id),
		locals.supabase.from('payments').select('*, orders!inner(user_id)').eq('orders.user_id', user.id),
		locals.supabase.from('user_consents').select('*').eq('user_id', user.id)
	]);

	const firstError =
		profile.error ||
		addresses.error ||
		orders.error ||
		orderItems.error ||
		payments.error ||
		consents.error;
	if (firstError) {
		error(500, 'Could not assemble your data export. Please try again.');
	}

	const payload = {
		exported_at: new Date().toISOString(),
		account: {
			id: user.id,
			email: user.email,
			created_at: user.created_at
		},
		profile: profile.data ?? null,
		addresses: addresses.data ?? [],
		orders: orders.data ?? [],
		order_items: orderItems.data ?? [],
		payments: payments.data ?? [],
		consents: consents.data ?? []
	};

	return new Response(JSON.stringify(payload, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="lapkart-data-${user.id}.json"`,
			'Cache-Control': 'no-store'
		}
	});
};
