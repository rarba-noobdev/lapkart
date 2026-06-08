import { error, json, type RequestHandler } from '@sveltejs/kit';
import { syncPendingProductSearchEvents } from '$lib/server/product-search';
import { isOwnerOrAdmin } from '$lib/roles';

export const POST: RequestHandler = async ({ locals }) => {
	const role = await locals.getRole();
	if (!isOwnerOrAdmin(role) && role !== 'catalog_manager') error(403, 'Catalog access required');

	const result = await syncPendingProductSearchEvents(locals.supabase);
	return json(result);
};
