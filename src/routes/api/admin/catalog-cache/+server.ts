import { json, type RequestHandler } from '@sveltejs/kit';
import { isStaffRole } from '$lib/roles';
import { clearCatalogCache } from '$lib/server/catalog-cache';
import { clearProductSearchCache } from '$lib/server/product-search';
import { syncPendingProductSearchEvents } from '$lib/server/typesense-products';

export const POST: RequestHandler = async ({ locals }) => {
	const role = await locals.getRole();

	if (!isStaffRole(role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	clearCatalogCache();
	clearProductSearchCache();
	const sync = await syncPendingProductSearchEvents().catch((error) => {
		console.warn('Typesense product sync skipped after cache refresh.', error);
		return { processed: 0, failed: 0, skipped: 'error' };
	});

	return json({ ok: true, sync });
};
