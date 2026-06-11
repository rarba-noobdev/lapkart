import type { RequestHandler } from './$types';
import { categories } from '$lib/catalog';
import { absoluteUrl } from '$lib/seo';
import { XML_HEADERS, sitemapXml } from '$lib/server/sitemap';

export const GET: RequestHandler = ({ url }) => {
	const urls = categories.map((category) => ({
		loc: absoluteUrl(url.origin, `/products?category=${category.slug}`),
		changefreq: 'daily' as const,
		priority: '0.8'
	}));

	return new Response(sitemapXml(urls), { headers: XML_HEADERS });
};
