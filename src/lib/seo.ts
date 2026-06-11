import { categories, discountPct, formatINR, type Product } from '$lib/catalog';

export const SITE_NAME = 'LapKart';
export const DEFAULT_DESCRIPTION =
	'Shop laptop SSDs, RAM, batteries, displays, chargers, keyboards, processors, and replacement parts with fitment guidance and fast dispatch.';

const PRIVATE_ROUTE_PREFIXES = [
	'/admin',
	'/api',
	'/auth',
	'/cart',
	'/checkout',
	'/login',
	'/order',
	'/orders',
	'/profile'
];

export function absoluteUrl(origin: string, pathOrUrl: string) {
	try {
		return new URL(pathOrUrl).toString();
	} catch {
		return new URL(pathOrUrl || '/', origin).toString();
	}
}

export function categoryName(slug: string) {
	return categories.find((category) => category.slug === slug)?.name ?? slug.replace(/_/g, ' ');
}

export function categorySeoTitle(slug: string) {
	return `${categoryName(slug)} Laptop Parts - ${SITE_NAME}`;
}

export function categorySeoDescription(slug: string, count?: number) {
	const name = categoryName(slug);
	const prefix = count && count > 0 ? `Browse ${count.toLocaleString('en-IN')} ${name}` : `Browse ${name}`;
	return `${prefix} for laptop repair and upgrades with compatibility guidance, stock visibility, and secure checkout.`;
}

export function productSeoTitle(product: Product) {
	return `${product.title} - ${SITE_NAME}`;
}

export function productSeoDescription(product: Product) {
	const discount = discountPct(product);
	const offer = discount > 0 ? ` Save ${discount}% against MRP.` : '';
	return `${product.title} by ${product.brand}. ${formatINR(product.price)} ${categoryName(product.category)} with ${product.stock > 0 ? 'live stock availability' : 'current out-of-stock status'}.${offer}`;
}

export function productsSeoTitle({
	category,
	query
}: {
	category?: string;
	query?: string;
}) {
	if (query) return `Search results for "${query}" - ${SITE_NAME}`;
	if (category) return categorySeoTitle(category);
	return `Laptop Parts Catalog - ${SITE_NAME}`;
}

export function productsSeoDescription({
	category,
	query,
	total
}: {
	category?: string;
	query?: string;
	total?: number;
}) {
	if (query) {
		return `Search LapKart for "${query}" across laptop replacement parts, upgrade components, compatibility notes, and live stock.`;
	}
	if (category) return categorySeoDescription(category, total);
	return `Browse ${total ? total.toLocaleString('en-IN') : 'thousands of'} laptop parts across RAM, SSDs, batteries, displays, chargers, keyboards, processors, and repair hardware.`;
}

export function shouldNoIndexPath(pathname: string) {
	return PRIVATE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeJsonLd(value: unknown) {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}

function conditionUrl(condition: Product['condition_grade']) {
	if (condition === 'used') return 'https://schema.org/UsedCondition';
	if (condition === 'refurbished') return 'https://schema.org/RefurbishedCondition';
	return 'https://schema.org/NewCondition';
}

function productImages(product: Product, origin: string) {
	return Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean))).map((image) =>
		absoluteUrl(origin, image)
	);
}

export function organizationJsonLd(origin: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: SITE_NAME,
		url: absoluteUrl(origin, '/'),
		logo: absoluteUrl(origin, '/favicon.svg')
	};
}

export function websiteJsonLd(origin: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: absoluteUrl(origin, '/'),
		potentialAction: {
			'@type': 'SearchAction',
			target: `${absoluteUrl(origin, '/products')}?q={search_term_string}`,
			'query-input': 'required name=search_term_string'
		}
	};
}

export function productJsonLd(product: Product, origin: string, productUrl: string) {
	const json: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.title,
		description: productSeoDescription(product),
		image: productImages(product, origin),
		url: productUrl,
		brand: {
			'@type': 'Brand',
			name: product.brand
		},
		category: categoryName(product.category),
		itemCondition: conditionUrl(product.condition_grade ?? 'new'),
		offers: {
			'@type': 'Offer',
			url: productUrl,
			priceCurrency: 'INR',
			price: Number(product.price.toFixed(2)),
			availability:
				product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
			itemCondition: conditionUrl(product.condition_grade ?? 'new'),
			seller: {
				'@type': 'Organization',
				name: SITE_NAME
			}
		}
	};

	if (product.rating > 0 && product.reviews > 0) {
		json.aggregateRating = {
			'@type': 'AggregateRating',
			ratingValue: Number(product.rating.toFixed(1)),
			reviewCount: product.reviews
		};
	}

	return json;
}

export function breadcrumbListJsonLd(
	origin: string,
	items: Array<{ name: string; path: string }>
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: absoluteUrl(origin, item.path)
		}))
	};
}

export function itemListJsonLd(
	origin: string,
	items: Array<{ id: string; title: string }>,
	basePosition = 1
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: basePosition + index,
			name: item.title,
			url: absoluteUrl(origin, `/product/${item.id}`)
		}))
	};
}
