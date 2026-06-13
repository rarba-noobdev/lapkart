import { json, type RequestHandler } from '@sveltejs/kit';
import { isStaffRole } from '$lib/roles';
import { clearCatalogCache } from '$lib/server/catalog-cache';
import { clearProductSearchCache } from '$lib/server/product-search';

export const POST: RequestHandler = async ({ locals }) => {
	const role = await locals.getRole();

	if (!isStaffRole(role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	clearCatalogCache();
	clearProductSearchCache();

	return json({ ok: true });
};
