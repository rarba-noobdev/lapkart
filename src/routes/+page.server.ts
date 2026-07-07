import type { PageServerLoad } from './$types';
import { getCachedHomeProducts } from '$lib/server/catalog-cache';
import { publicCatalogCacheControl } from '$lib/server/cache-control';

export const load: PageServerLoad = async ({ depends, locals, parent, setHeaders }) => {
	depends('app:products');

	const [layoutData, products] = await Promise.all([
		parent(),
		getCachedHomeProducts(locals.supabase).catch((error) => {
			console.warn('Home product load failed; rendering fallback home.', error);
			return [];
		})
	]);

	setHeaders({ 'cache-control': publicCatalogCacheControl(layoutData.user) });

	return {
		products
	};
};
