import type { PageServerLoad } from './$types';
import { getCachedHomeProducts } from '$lib/server/catalog-cache';
import { publicCatalogCacheControl } from '$lib/server/cache-control';

export const load: PageServerLoad = async ({ depends, locals, setHeaders }) => {
	depends('app:products');

	const [{ user }, products] = await Promise.all([
		locals.safeGetSession().catch((error) => {
			console.warn('Home session lookup failed; rendering public home.', error);
			return { user: null, session: null };
		}),
		getCachedHomeProducts(locals.supabase).catch((error) => {
			console.warn('Home product load failed; rendering fallback home.', error);
			return [];
		})
	]);
	setHeaders({ 'cache-control': publicCatalogCacheControl(user) });

	return {
		products
	};
};
