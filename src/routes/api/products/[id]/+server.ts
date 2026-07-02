import { json, type RequestHandler } from '@sveltejs/kit';
import { getCachedProduct, getCachedRelatedProducts } from '$lib/server/catalog-cache';
import {
	publicApiErrorHeaders,
	publicApiHeaders,
	publicApiOptionsResponse
} from '$lib/server/public-api-headers';

export const OPTIONS: RequestHandler = () => publicApiOptionsResponse();

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const productId = params.id;
		if (!productId) {
			return json(
				{ message: 'Product not found.' },
				{ status: 404, headers: publicApiErrorHeaders() }
			);
		}

		const product = await getCachedProduct(productId, locals.supabase);
		if (!product) {
			return json(
				{ message: 'Product not found.' },
				{ status: 404, headers: publicApiErrorHeaders() }
			);
		}

		const [related, weeklyCountResult] = await Promise.all([
			getCachedRelatedProducts(product.category, product.id, 4, locals.supabase),
			locals.supabase
				.from('product_weekly_order_counts')
				.select('orders_count')
				.eq('product_id', product.id)
				.maybeSingle()
		]);

		return json(
			{
				product,
				related,
				weeklyOrders: weeklyCountResult.data?.orders_count ?? 0
			},
			{ headers: publicApiHeaders() }
		);
	} catch (error) {
		console.warn('Product detail API failed.', error);
		return json(
			{ message: 'Product detail is temporarily unavailable.' },
			{ status: 503, headers: publicApiErrorHeaders() }
		);
	}
};
