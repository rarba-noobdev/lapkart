import { error, json, type RequestHandler } from '@sveltejs/kit';
import { syncPendingProductSearchEvents } from '$lib/server/product-search';

export const POST: RequestHandler = async ({ locals }) => {
	const role = await locals.getRole();
	if (role !== 'admin') error(403, 'Admin access required');

	const result = await syncPendingProductSearchEvents(locals.supabase);
	return json(result);
};
