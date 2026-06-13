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

	// Honest "ordered N times this week" signal from the real materialized view.
	// Non-fatal: if the view/RPC is unavailable the badge simply doesn't render.
	const [related, weeklyCountResult] = await Promise.all([
		getCachedRelatedProducts(product.category, product.id, 4, locals.supabase),
		locals.supabase
			.from('product_weekly_order_counts')
			.select('orders_count')
			.eq('product_id', product.id)
			.maybeSingle()
	]);

	return {
		product,
		related,
		weeklyOrders: weeklyCountResult.data?.orders_count ?? 0
	};
};
