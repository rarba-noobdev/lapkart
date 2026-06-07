import type { PageServerLoad } from './$types';
import { searchProducts, type ProductSort } from '$lib/server/product-search';

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

export const load: PageServerLoad = async ({ depends, locals, url }) => {
	depends('app:products');

	const category = url.searchParams.get('category') ?? '';
	const query = url.searchParams.get('q') ?? '';
	const brand = url.searchParams.get('brand') ?? '';
	const sort = parseSort(url.searchParams.get('sort'));
	const inStock = url.searchParams.get('inStock') === 'true';
	const minPrice = parseNumber(url.searchParams.get('minPrice'));
	const maxPrice = parseNumber(url.searchParams.get('maxPrice'));
	const minRating = parseNumber(url.searchParams.get('minRating'));
	const result = await searchProducts(
		{
			category: category || undefined,
			query: query || undefined,
			brand: brand || undefined,
			sort,
			inStock,
			minPrice,
			maxPrice,
			minRating
		},
		locals.supabase
	);

	return {
		products: result.products,
		productTotal: result.total,
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
		searchSource: result.source
	};
};
