import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBrandLanding } from '$lib/seo/landing-content';
import { getGuideBySlug } from '$lib/guides';
import { PUBLIC_CATALOG_CACHE } from '$lib/server/cache-control';
import { searchProducts } from '$lib/server/product-search';

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const match = getBrandLanding(params.cluster, params.brand);
	if (!match) error(404, 'Page not found');
	const { landing, brand } = match;

	const products = landing.category
		? await searchProducts(
				{
					category: landing.category,
					brand: brand.brand,
					inStock: true,
					sort: 'relevance',
					limit: 12,
					page: 1
				},
				locals.supabase
			)
				.then((r) => r.products)
				.catch(() => [])
		: [];

	const guides = landing.relatedGuideSlugs
		.map((slug) => getGuideBySlug(slug))
		.filter((g): g is NonNullable<typeof g> => Boolean(g))
		.map((g) => ({ title: g.shortTitle, href: `/guides/${g.slug}`, description: g.description }));

	// Siblings: the other brands for this part, plus a link back to the cluster.
	const siblings = [
		...landing.brands
			.filter((b) => b.slug !== brand.slug)
			.map((b) => ({
				title: `${b.name} ${landing.name.toLowerCase()}`,
				href: `/parts/${landing.slug}/${b.slug}`
			})),
		{ title: `All ${landing.name.toLowerCase()}`, href: `/parts/${landing.slug}` }
	];

	const productHref = landing.category
		? `/products?category=${landing.category}&brand=${encodeURIComponent(brand.brand)}`
		: '/products';

	setHeaders({ 'cache-control': PUBLIC_CATALOG_CACHE });

	return {
		view: {
			h1: brand.h1,
			title: brand.title,
			metaDescription: brand.metaDescription,
			keywords: landing.keywords,
			intro: brand.intro,
			faqs: [...brand.faqs, ...landing.faqs].slice(0, 6),
			breadcrumbs: [
				{ name: 'Home', path: '/' },
				{ name: 'Parts', path: '/parts' },
				{ name: landing.name, path: `/parts/${landing.slug}` },
				{ name: brand.name, path: `/parts/${landing.slug}/${brand.slug}` }
			],
			canonicalPath: `/parts/${landing.slug}/${brand.slug}`,
			productHref,
			productHrefLabel: `Browse all ${brand.name} ${landing.name.toLowerCase()}`,
			products,
			siblingHeading: 'Other brands',
			siblings,
			guides,
			categoryLinks: []
		}
	};
};
