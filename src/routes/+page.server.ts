import type { PageServerLoad } from './$types';
import { getCachedHomeProducts } from '$lib/server/catalog-cache';
import { publicCatalogCacheControl } from '$lib/server/cache-control';

export const load: PageServerLoad = async ({ depends, locals, setHeaders }) => {
	depends('app:products');

	const [{ user }, products] = await Promise.all([
		locals.safeGetSession(),
		getCachedHomeProducts(locals.supabase)
	]);
	setHeaders({ 'cache-control': publicCatalogCacheControl(user) });

	return {
		products
	};
};
