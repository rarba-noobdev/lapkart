import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProduct, listRelatedProducts } from '$lib/products';

export const load: PageServerLoad = async ({ depends, locals, params, setHeaders }) => {
	depends(`product:${params.id}`);
	setHeaders({ 'cache-control': 'private, max-age=120' });

	const product = await getProduct(params.id, locals.supabase);

	if (!product) {
		error(404, 'Product not found');
	}

	return {
		product,
		related: await listRelatedProducts(product.category, product.id, 4, locals.supabase)
	};
};
