import type { RequestHandler } from './$types';
import { absoluteUrl } from '$lib/seo';

export const GET: RequestHandler = ({ url }) => {
	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /admin',
		'Disallow: /api',
		'Disallow: /auth',
		'Disallow: /cart',
		'Disallow: /checkout',
		'Disallow: /login',
		'Disallow: /order',
		'Disallow: /orders',
		'Disallow: /profile',
		`Sitemap: ${absoluteUrl(url.origin, '/sitemap.xml')}`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'
		}
	});
};
