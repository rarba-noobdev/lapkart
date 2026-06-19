import type { PageServerLoad } from './$types';
import { getCachedHomeProducts } from '$lib/server/catalog-cache';

export const load: PageServerLoad = async ({ depends, locals }) => {
	depends('app:products');

	const products = await getCachedHomeProducts(locals.supabase).catch((error) => {
		console.warn('Home product load failed; rendering fallback home.', error);
		return [];
	});

	return {
		products
	};
};
