import type { PageServerLoad } from './$types';
import { listCatalogProducts } from '$lib/products';

export const load: PageServerLoad = async ({ locals, url }) => {
	const category = url.searchParams.get('category') ?? '';
	const query = url.searchParams.get('q') ?? '';
	const sort =
		(url.searchParams.get('sort') as
			| 'relevance'
			| 'price-asc'
			| 'price-desc'
			| 'rating-desc'
			| 'discount-desc'
			| null) ?? 'relevance';
	const inStock = url.searchParams.get('inStock') === 'true';

	return {
		products: await listCatalogProducts(
			{
				category: category || undefined,
				query: query || undefined,
				sort,
				inStock
			},
			locals.supabase
		)
	};
};
