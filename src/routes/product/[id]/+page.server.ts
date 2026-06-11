import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCachedProduct, getCachedRelatedProducts } from '$lib/server/catalog-cache';
import { publicCatalogCacheControl } from '$lib/server/cache-control';

export const load: PageServerLoad = async ({ depends, locals, params, setHeaders }) => {
	depends(`product:${params.id}`);

	const [{ user }, product] = await Promise.all([
		locals.safeGetSession(),
		getCachedProduct(params.id, locals.supabase)
	]);
	setHeaders({ 'cache-control': publicCatalogCacheControl(user) });

	if (!product) {
		error(404, 'Product not found');
	}

	return {
		product,
		related: await getCachedRelatedProducts(product.category, product.id, 4, locals.supabase)
	};
};
