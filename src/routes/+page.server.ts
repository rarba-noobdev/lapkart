import type { PageServerLoad } from './$types';
import { listProducts } from '$lib/products';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		products: await listProducts(locals.supabase)
	};
};
