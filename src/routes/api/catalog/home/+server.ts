import { json, type RequestHandler } from '@sveltejs/kit';
import { getCachedHomeProducts } from '$lib/server/catalog-cache';
import {
	publicApiErrorHeaders,
	publicApiHeaders,
	publicApiOptionsResponse
} from '$lib/server/public-api-headers';

export const OPTIONS: RequestHandler = () => publicApiOptionsResponse();

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const products = await getCachedHomeProducts(locals.supabase);
		return json({ products }, { headers: publicApiHeaders() });
	} catch (error) {
		console.warn('Home catalog API failed.', error);
		return json(
			{ message: 'Home catalog is temporarily unavailable.' },
			{ status: 503, headers: publicApiErrorHeaders() }
		);
	}
};
