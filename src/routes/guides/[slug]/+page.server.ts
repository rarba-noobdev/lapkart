import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGuideBySlug, getRelatedGuideLinks } from '$lib/guides';
import { PUBLIC_CATALOG_CACHE } from '$lib/server/cache-control';
import { searchProducts, type ProductSearchResult } from '$lib/server/product-search';

const emptyResult: ProductSearchResult = { products: [], total: 0, source: 'supabase' };

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const guide = getGuideBySlug(params.slug);

	if (!guide) {
		error(404, 'Guide not found');
	}

	// '' means "all catalog" (no category filter); undefined keeps the legacy
	// screen-guide default of 'displays'.
	const category = guide.productCategory === '' ? undefined : (guide.productCategory ?? 'displays');

	const result = await searchProducts(
		{
			category,
			query: guide.productQuery || undefined,
			inStock: true,
			sort: 'relevance',
			limit: 8,
			page: 1
		},
		locals.supabase
	).catch((searchError) => {
		console.warn(`Guide product search failed for ${guide.slug}.`, searchError);
		return emptyResult;
	});

	setHeaders({ 'cache-control': PUBLIC_CATALOG_CACHE });

	return {
		guide,
		relatedGuides: getRelatedGuideLinks(guide),
		relatedProducts: result.products
	};
};
