import { json, type RequestHandler } from '@sveltejs/kit';
import { searchProducts, type ProductSort } from '$lib/server/product-search';
import {
	publicApiErrorHeaders,
	publicApiHeaders,
	publicApiOptionsResponse
} from '$lib/server/public-api-headers';

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

export const OPTIONS: RequestHandler = () => publicApiOptionsResponse();

export const GET: RequestHandler = async ({ locals, url }) => {
	const startedAt = performance.now();

	try {
		const result = await searchProducts(
			{
				query: url.searchParams.get('q')?.trim() || undefined,
				category: url.searchParams.get('category') || undefined,
				brand: url.searchParams.get('brand') || undefined,
				minPrice: parseNumber(url.searchParams.get('minPrice')),
				maxPrice: parseNumber(url.searchParams.get('maxPrice')),
				inStock: url.searchParams.get('inStock') === 'true',
				minRating: parseNumber(url.searchParams.get('minRating')),
				sort: parseSort(url.searchParams.get('sort')),
				limit: Math.min(parseNumber(url.searchParams.get('limit')) ?? 60, 250),
				page: Math.max(parseNumber(url.searchParams.get('page')) ?? 1, 1)
			},
			locals.supabase
		);

		return json(result, {
			headers: publicApiHeaders({
				'server-timing': `search;dur=${(performance.now() - startedAt).toFixed(1)}`
			})
		});
	} catch (error) {
		console.warn('Product search API failed.', error);
		return json(
			{ message: 'Search is temporarily unavailable.' },
			{
				status: 503,
				headers: publicApiErrorHeaders({
					'server-timing': `search;dur=${(performance.now() - startedAt).toFixed(1)}`
				})
			}
		);
	}
};
