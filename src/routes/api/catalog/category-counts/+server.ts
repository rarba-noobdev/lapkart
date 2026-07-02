import { json, type RequestHandler } from '@sveltejs/kit';
import { getCachedActiveCategoryCounts } from '$lib/server/catalog-cache';
import {
	publicApiErrorHeaders,
	publicApiHeaders,
	publicApiOptionsResponse
} from '$lib/server/public-api-headers';

export const OPTIONS: RequestHandler = () => publicApiOptionsResponse();

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const categoryCounts = await getCachedActiveCategoryCounts(locals.supabase);
		return json({ categoryCounts }, { headers: publicApiHeaders() });
	} catch (error) {
		console.warn('Category counts API failed.', error);
		return json(
			{ message: 'Category counts are temporarily unavailable.' },
			{ status: 503, headers: publicApiErrorHeaders() }
		);
	}
};
