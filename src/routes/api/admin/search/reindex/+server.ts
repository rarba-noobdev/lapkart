import { error, json, type RequestHandler } from '@sveltejs/kit';
import {
	ensureProductsCollection,
	indexProductRows,
	loadProductRows
} from '$lib/server/product-search';

export const POST: RequestHandler = async ({ locals }) => {
	const role = await locals.getRole();
	if (role !== 'admin') error(403, 'Admin access required');

	const configured = await ensureProductsCollection();
	if (!configured) {
		return json({ configured: false, indexed: 0, failed: 0 });
	}

	const rows = await loadProductRows(locals.supabase);
	const result = await indexProductRows(rows);

	return json({ configured: true, ...result });
};
