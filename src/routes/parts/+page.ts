import type { PageLoad } from './$types';
import { landings, partsHub } from '$lib/seo/landing-content';
import { getGuideBySlug } from '$lib/guides';

export const load: PageLoad = () => {
	const categoryLinks = landings.map((l) => ({
		title: l.name,
		href: `/parts/${l.slug}`,
		description: l.metaDescription
	}));

	const guides = [
		'how-to-find-laptop-model-number',
		'laptop-not-turning-on',
		'laptop-battery-price-india'
	]
		.map((slug) => getGuideBySlug(slug))
		.filter((g): g is NonNullable<typeof g> => Boolean(g))
		.map((g) => ({ title: g.shortTitle, href: `/guides/${g.slug}`, description: g.description }));

	return {
		view: {
			h1: partsHub.h1,
			title: partsHub.title,
			metaDescription: partsHub.metaDescription,
			keywords: partsHub.keywords,
			intro: partsHub.intro,
			faqs: partsHub.faqs,
			breadcrumbs: [
				{ name: 'Home', path: '/' },
				{ name: 'Parts', path: '/parts' }
			],
			canonicalPath: '/parts',
			productHref: '/products',
			productHrefLabel: 'Browse the full catalogue',
			products: [],
			siblingHeading: '',
			siblings: [],
			guides,
			categoryLinks
		}
	};
};
