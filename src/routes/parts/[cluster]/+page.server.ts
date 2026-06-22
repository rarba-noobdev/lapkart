import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLanding } from '$lib/seo/landing-content';
import { getGuideBySlug } from '$lib/guides';
import { PUBLIC_CATALOG_CACHE } from '$lib/server/cache-control';
import { searchProducts } from '$lib/server/product-search';

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	const landing = getLanding(params.cluster);
	if (!landing) error(404, 'Page not found');

	// Most landings use a single category; a few (RAM & SSD) merge several.
	const cats = landing.categories ?? (landing.category ? [landing.category] : []);
	let products = [] as Awaited<ReturnType<typeof searchProducts>>['products'];
	if (cats.length) {
		const results = await Promise.all(
			cats.map((category) =>
				searchProducts(
					{
						category,
						query: landing.productQuery || undefined,
						inStock: true,
						sort: 'relevance',
						limit: 12,
						page: 1
					},
					locals.supabase
				)
					.then((r) => r.products)
					.catch(() => [])
			)
		);
		const seen = new Set<string>();
		for (const p of results.flat()) {
			if (seen.has(p.id)) continue;
			seen.add(p.id);
			products.push(p);
		}
		products = products.slice(0, 12);
	}

	const guides = landing.relatedGuideSlugs
		.map((slug) => getGuideBySlug(slug))
		.filter((g): g is NonNullable<typeof g> => Boolean(g))
		.map((g) => ({ title: g.shortTitle, href: `/guides/${g.slug}`, description: g.description }));

	// Hub pages link out to the part clusters; cluster pages link to brand pages
	// (or to sibling clusters when they have no brand sub-pages).
	const categoryLinks = landing.isHub
		? landing.relatedClusters
				.map((slug) => getLanding(slug))
				.filter((l): l is NonNullable<typeof l> => Boolean(l))
				.map((l) => ({ title: l.name, href: `/parts/${l.slug}`, description: l.metaDescription }))
		: [];

	const siblings = landing.brands.length
		? landing.brands.map((b) => ({ title: b.name, href: `/parts/${landing.slug}/${b.slug}` }))
		: landing.relatedClusters
				.map((slug) => getLanding(slug))
				.filter((l): l is NonNullable<typeof l> => Boolean(l))
				.map((l) => ({ title: l.name, href: `/parts/${l.slug}` }));

	const productHref = landing.category ? `/products?category=${landing.category}` : '/products';

	setHeaders({ 'cache-control': PUBLIC_CATALOG_CACHE });

	return {
		view: {
			h1: landing.h1,
			title: landing.title,
			metaDescription: landing.metaDescription,
			keywords: landing.keywords,
			intro: landing.intro,
			faqs: landing.faqs,
			breadcrumbs: [
				{ name: 'Home', path: '/' },
				{ name: 'Parts', path: '/parts' },
				{ name: landing.name, path: `/parts/${landing.slug}` }
			],
			canonicalPath: `/parts/${landing.slug}`,
			productHref,
			productHrefLabel: `Browse all ${landing.name.toLowerCase()}`,
			products,
			siblingHeading: landing.brands.length ? 'Browse by brand' : 'Related parts',
			siblings,
			guides,
			categoryLinks
		}
	};
};
