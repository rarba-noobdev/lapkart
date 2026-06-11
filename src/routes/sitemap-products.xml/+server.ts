import type { RequestHandler } from './$types';
import { absoluteUrl } from '$lib/seo';
import { SITEMAP_PRODUCT_LIMIT, XML_HEADERS, sitemapXml, xmlDate } from '$lib/server/sitemap';

type SitemapProductRow = {
	id: string;
	title: string;
	image: string | null;
	updated_at: string | null;
};

function parsePage(value: string | null) {
	const page = Number(value);
	return Number.isInteger(page) && page >= 0 ? page : 0;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const page = parsePage(url.searchParams.get('page'));
	const from = page * SITEMAP_PRODUCT_LIMIT;
	const to = from + SITEMAP_PRODUCT_LIMIT - 1;
	const { data, error } = await locals.supabase
		.from('products')
		.select('id,title,image,updated_at')
		.eq('status', 'active')
		.order('updated_at', { ascending: false })
		.range(from, to);

	if (error) throw error;

	const urls = ((data ?? []) as SitemapProductRow[]).map((product) => ({
		loc: absoluteUrl(url.origin, `/product/${product.id}`),
		lastmod: xmlDate(product.updated_at),
		changefreq: 'weekly' as const,
		priority: '0.7',
		images: product.image
			? [
					{
						loc: absoluteUrl(url.origin, product.image),
						caption: product.title
					}
				]
			: undefined
	}));

	return new Response(sitemapXml(urls), { headers: XML_HEADERS });
};
