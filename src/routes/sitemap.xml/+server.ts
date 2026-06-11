import type { RequestHandler } from './$types';
import { absoluteUrl } from '$lib/seo';
import { SITEMAP_PRODUCT_LIMIT, XML_HEADERS, sitemapIndexXml, xmlDate } from '$lib/server/sitemap';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { count, data } = await locals.supabase
		.from('products')
		.select('updated_at', { count: 'exact' })
		.eq('status', 'active')
		.order('updated_at', { ascending: false })
		.limit(1);

	const productSitemapCount = Math.max(1, Math.ceil((count ?? 0) / SITEMAP_PRODUCT_LIMIT));
	const latestProductUpdate = xmlDate(data?.[0]?.updated_at);
	const entries = [
		{ loc: absoluteUrl(url.origin, '/sitemap-static.xml') },
		{ loc: absoluteUrl(url.origin, '/sitemap-categories.xml'), lastmod: latestProductUpdate },
		...Array.from({ length: productSitemapCount }, (_, index) => ({
			loc: absoluteUrl(url.origin, `/sitemap-products.xml?page=${index}`),
			lastmod: latestProductUpdate
		}))
	];

	return new Response(sitemapIndexXml(entries), { headers: XML_HEADERS });
};
