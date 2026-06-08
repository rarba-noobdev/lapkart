import type { PageServerLoad } from './$types';
import { listCatalogProducts } from '$lib/products';

export const load: PageServerLoad = async ({ depends, locals }) => {
	depends('app:products');

	return {
		products: await listCatalogProducts({ limit: 96 }, locals.supabase)
	};
};
