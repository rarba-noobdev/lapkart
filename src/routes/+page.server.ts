import type { PageServerLoad } from './$types';
import { listCatalogProducts } from '$lib/products';

export const load: PageServerLoad = async ({ depends, locals, setHeaders }) => {
	depends('app:products');

	setHeaders({ 'cache-control': 'private, max-age=120' });

	return {
		products: await listCatalogProducts({ limit: 96 }, locals.supabase)
	};
};
