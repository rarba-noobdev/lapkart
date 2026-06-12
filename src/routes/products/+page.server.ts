import type { PageServerLoad } from './$types';
import { getCachedActiveCategoryCounts } from '$lib/server/catalog-cache';
import { publicCatalogCacheControl } from '$lib/server/cache-control';
import {
	searchProducts,
	type ProductSearchResult,
	type ProductSort
} from '$lib/server/product-search';

const sortValues = new Set<ProductSort>([
	'relevance',
	'price-asc',
	'price-desc',
	'rating-desc',
	'discount-desc',
	'newest'
]);

function parseNumber(value: string | null) {
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseSort(value: string | null): ProductSort {
	return value && sortValues.has(value as ProductSort) ? (value as ProductSort) : 'relevance';
}

function parsePage(value: string | null) {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const load: PageServerLoad = async ({ depends, locals, url, setHeaders }) => {
	depends('app:products');

	const category = url.searchParams.get('category') ?? '';
	const query = url.searchParams.get('q') ?? '';
	const brand = url.searchParams.get('brand') ?? '';
	const sort = parseSort(url.searchParams.get('sort'));
	const inStock = url.searchParams.get('inStock') === 'true';
	const minPrice = parseNumber(url.searchParams.get('minPrice'));
	const maxPrice = parseNumber(url.searchParams.get('maxPrice'));
	const minRating = parseNumber(url.searchParams.get('minRating'));
	const page = parsePage(url.searchParams.get('page'));
	const emptyResult: ProductSearchResult = { products: [], total: 0, source: 'supabase' };
	const [{ user }, result, categoryCounts] = await Promise.all([
		locals.safeGetSession().catch((error) => {
			console.warn('Product listing session lookup failed; rendering public catalog.', error);
			return { user: null, session: null };
		}),
		searchProducts(
			{
				category: category || undefined,
				query: query || undefined,
				brand: brand || undefined,
				sort,
				inStock,
				minPrice,
				maxPrice,
				minRating,
				limit: 24,
				page
			},
			locals.supabase
		).catch((error) => {
			console.warn('Product listing search failed; rendering empty catalog.', error);
			return emptyResult;
		}),
		getCachedActiveCategoryCounts(locals.supabase).catch((error) => {
			console.warn('Product listing category counts failed; rendering without counts.', error);
			return {};
		})
	]);

	setHeaders({ 'cache-control': publicCatalogCacheControl(user) });

	return {
		products: result.products,
		productTotal: result.total,
		categoryCounts,
		filters: {
			category,
			q: query,
			brand,
			sort,
			inStock,
			minPrice: minPrice?.toString() ?? '',
			maxPrice: maxPrice?.toString() ?? '',
			minRating: minRating?.toString() ?? ''
		},
		page,
		searchSource: result.source
	};
};
