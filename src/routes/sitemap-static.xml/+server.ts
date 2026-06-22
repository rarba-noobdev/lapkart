import type { RequestHandler } from './$types';
import { guideRoutes } from '$lib/guides';
import { landingPaths } from '$lib/seo/landing-content';
import { absoluteUrl } from '$lib/seo';
import { XML_HEADERS, sitemapXml } from '$lib/server/sitemap';

const STATIC_ROUTES = [
	{ path: '/', priority: '1.0', changefreq: 'daily' },
	{ path: '/products', priority: '0.9', changefreq: 'daily' },
	{ path: '/parts', priority: '0.8', changefreq: 'weekly' },
	...landingPaths().map((path) => ({
		path,
		priority: '0.8' as const,
		changefreq: 'weekly' as const
	})),
	{ path: '/guides', priority: '0.7', changefreq: 'weekly' },
	...guideRoutes.map((path) => ({ path, priority: '0.7' as const, changefreq: 'weekly' as const })),
	{ path: '/about', priority: '0.5', changefreq: 'monthly' },
	{ path: '/contact', priority: '0.4', changefreq: 'monthly' },
	{ path: '/shipping-policy', priority: '0.3', changefreq: 'monthly' },
	{ path: '/returns-policy', priority: '0.3', changefreq: 'monthly' },
	{ path: '/cancellation-refunds', priority: '0.3', changefreq: 'monthly' },
	{ path: '/privacy', priority: '0.3', changefreq: 'monthly' },
	{ path: '/terms', priority: '0.3', changefreq: 'monthly' }
] as const;

export const GET: RequestHandler = ({ url }) => {
	const urls = STATIC_ROUTES.map((route) => ({
		loc: absoluteUrl(url.origin, route.path),
		changefreq: route.changefreq,
		priority: route.priority
	}));

	return new Response(sitemapXml(urls), { headers: XML_HEADERS });
};
