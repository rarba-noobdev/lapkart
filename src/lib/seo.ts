import { categories, discountPct, formatINR, type Product } from '$lib/catalog';
import { calculateManualDeliveryCharge, MANUAL_DELIVERY_REGION } from '$lib/shipping';

export const SITE_NAME = 'LapKart';
export const DEFAULT_DESCRIPTION =
	'Shop laptop SSDs, RAM, batteries, displays, chargers, keyboards, processors, and replacement parts with fitment guidance and fast dispatch.';
const SEO_DESCRIPTION_MAX_LENGTH = 160;
const PRODUCT_KEYWORD_LIMIT = 32;
const PRODUCT_KEYWORD_MAX_LENGTH = 160;
const PRODUCT_PROPERTY_LIMIT = 32;
const HIDDEN_SUPPLIER_BRANDS = new Set(['mylaptopscreen', 'pctech', 'pc tech']);
const LOW_VALUE_KEYWORDS = new Set([
	'brand',
	'condition',
	'new',
	'optical',
	'technology',
	'refresh',
	'rate',
	'resolution',
	'screen',
	'size',
	'compatibility',
	'warranty',
	'weight',
	'dimensions'
]);

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
	const prefix =
		count && count > 0 ? `Browse ${count.toLocaleString('en-IN')} ${name}` : `Browse ${name}`;
	return `${prefix} for laptop repair and upgrades with compatibility guidance, stock visibility, and secure checkout.`;
}

export function productSeoTitle(product: Product) {
	return `${product.title} - ${SITE_NAME}`;
}

export function productSeoDescription(product: Product) {
	const discount = discountPct(product);
	const brand = publicProductBrand(product);
	const category = categoryName(product.category);
	const sku = compactText(product.sku);
	const compatibility = compactText(product.compatibility);
	const warranty = compactText(product.warranty);
	const stock = product.stock > 0 ? 'in stock' : 'currently out of stock';
	const offer = discount > 0 ? `Save ${discount}% against MRP.` : '';
	const heading = brand ? `${product.title} by ${brand}` : product.title;
	const parts = [
		heading,
		sku ? `SKU ${sku}` : '',
		`${formatINR(product.price)} ${category}`,
		compatibility ? `fits ${compatibility}` : '',
		warranty ? warranty : '',
		stock,
		offer
	];
	return truncateSeoText(parts.filter(Boolean).join('. '));
}

export function productSeoKeywords(product: Product) {
	const keywords: string[] = [];
	const category = categoryName(product.category);
	const brand = publicProductBrand(product);

	addKeyword(keywords, product.title, false);
	addKeyword(keywords, brand, false);
	addKeyword(keywords, product.sku, false);
	addKeyword(keywords, category, false);
	addKeyword(keywords, `${category} laptop parts`, false);
	addKeyword(keywords, `${category} replacement`, false);
	addKeyword(keywords, `${product.title} price`, false);
	addKeyword(keywords, `${product.title} replacement`, false);
	addKeyword(keywords, product.compatibility);
	addKeyword(keywords, product.warranty);

	for (const keyword of product.search_keywords ?? []) addKeyword(keywords, keyword);
	for (const [label, value] of Object.entries(product.specifications ?? {})) {
		addKeyword(keywords, value);
		if (isPartNumberLabel(label)) addKeyword(keywords, `${value} ${category}`);
	}
	for (const highlight of product.highlights) {
		const labeled = splitLabeledValue(highlight);
		addKeyword(keywords, labeled?.value ?? highlight);
	}

	return keywords.slice(0, PRODUCT_KEYWORD_LIMIT);
}

export function productSeoKeywordContent(product: Product) {
	return productSeoKeywords(product).join(', ');
}

export function productSeoBrand(product: Product) {
	return publicProductBrand(product);
}

export function productsSeoTitle({ category, query }: { category?: string; query?: string }) {
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
	return PRIVATE_ROUTE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
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
	return Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean))).map(
		(image) => absoluteUrl(origin, image)
	);
}

function compactText(value: unknown) {
	return String(value ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

function truncateSeoText(value: string, maxLength = SEO_DESCRIPTION_MAX_LENGTH) {
	const text = compactText(value);
	if (text.length <= maxLength) return text;
	const trimmed = text
		.slice(0, maxLength - 3)
		.replace(/\s+\S*$/, '')
		.trimEnd();
	return `${trimmed || text.slice(0, maxLength - 3)}...`;
}

function normalizeKey(value: string) {
	return compactText(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function publicProductBrand(product: Product) {
	const brand = compactText(product.brand);
	return HIDDEN_SUPPLIER_BRANDS.has(normalizeKey(brand)) ? '' : brand;
}

function addKeyword(list: string[], value: unknown, split = true) {
	const text = compactText(value);
	if (!text) return;

	for (const part of split ? text.split(/[,\n|]+/) : [text]) {
		const keyword = compactText(part);
		const normalized = normalizeKey(keyword);
		if (
			!keyword ||
			keyword.length < 2 ||
			keyword.length > PRODUCT_KEYWORD_MAX_LENGTH ||
			LOW_VALUE_KEYWORDS.has(normalized)
		) {
			continue;
		}
		const duplicate = list.some((item) => normalizeKey(item) === normalized);
		if (!duplicate) list.push(keyword);
	}
}

function isPartNumberLabel(label: string) {
	const key = normalizeKey(label);
	return (
		key === 'mpn' ||
		key === 'manufacturer part number' ||
		key === 'part number' ||
		key === 'model number' ||
		key === 'model'
	);
}

function splitLabeledValue(value: string) {
	const separator = value.indexOf(':');
	if (separator <= 0) return null;

	const label = compactText(value.slice(0, separator));
	const detail = compactText(value.slice(separator + 1));
	if (!label || !detail || label.length > 48) return null;

	return { label, value: detail };
}

function firstMatchingSpecification(product: Product, predicate: (label: string) => boolean) {
	for (const [label, value] of Object.entries(product.specifications ?? {})) {
		const cleanValue = compactText(value);
		if (predicate(label) && cleanValue) return cleanValue;
	}

	for (const highlight of product.highlights) {
		const labeled = splitLabeledValue(highlight);
		if (labeled && predicate(labeled.label)) return labeled.value;
	}

	return '';
}

function formatSpecNumber(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function formatProductDimensions(product: Product) {
	if (!product.length_cm || !product.breadth_cm || !product.height_cm) return '';
	return `${formatSpecNumber(product.length_cm)} x ${formatSpecNumber(product.breadth_cm)} x ${formatSpecNumber(product.height_cm)} cm`;
}

function gradeLabel(value: string | undefined) {
	return (value ?? 'compatible')
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function productAdditionalProperties(product: Product) {
	const properties: Array<{ '@type': 'PropertyValue'; name: string; value: string }> = [];
	const seen = new Set<string>();

	function addProperty(name: string, value: unknown) {
		const cleanName = compactText(name);
		const cleanValue = compactText(value);
		if (!cleanName || !cleanValue) return;
		const key = `${normalizeKey(cleanName)}:${normalizeKey(cleanValue)}`;
		if (seen.has(key)) return;
		seen.add(key);
		properties.push({ '@type': 'PropertyValue', name: cleanName, value: cleanValue });
	}

	addProperty('SKU', product.sku);
	addProperty('Category', categoryName(product.category));
	addProperty('Compatibility', product.compatibility);
	addProperty('Warranty', product.warranty);
	addProperty('Condition', gradeLabel(product.condition_grade ?? 'new'));
	addProperty('Authenticity', gradeLabel(product.authenticity_grade));
	addProperty('DOA policy', `${product.doa_policy_days ?? 7}-day DOA support`);
	if (product.weight_kg) addProperty('Weight', `${formatSpecNumber(product.weight_kg)} kg`);
	addProperty('Package dimensions', formatProductDimensions(product));

	for (const [label, value] of Object.entries(product.specifications ?? {}))
		addProperty(label, value);
	for (const highlight of product.highlights) {
		const labeled = splitLabeledValue(highlight);
		if (labeled) addProperty(labeled.label, labeled.value);
	}

	return properties.slice(0, PRODUCT_PROPERTY_LIMIT);
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
	const brand = publicProductBrand(product);
	const mpn = firstMatchingSpecification(product, isPartNumberLabel);
	const shippingRate = calculateManualDeliveryCharge(product.weight_kg ?? 0, product.price);
	const offer: Record<string, unknown> = {
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
		},
		shippingDetails: {
			'@type': 'OfferShippingDetails',
			shippingDestination: {
				'@type': 'DefinedRegion',
				addressCountry: 'IN',
				addressRegion: MANUAL_DELIVERY_REGION
			},
			shippingRate: {
				'@type': 'MonetaryAmount',
				value: shippingRate,
				currency: 'INR'
			},
			deliveryTime: {
				'@type': 'ShippingDeliveryTime',
				handlingTime: {
					'@type': 'QuantitativeValue',
					minValue: 0,
					maxValue: 1,
					unitCode: 'DAY'
				},
				transitTime: {
					'@type': 'QuantitativeValue',
					minValue: 1,
					maxValue: 2,
					unitCode: 'DAY'
				}
			}
		},
		hasMerchantReturnPolicy: {
			'@type': 'MerchantReturnPolicy',
			applicableCountry: 'IN',
			returnPolicyCountry: 'IN',
			returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
			merchantReturnDays: product.doa_policy_days ?? 7,
			returnMethod: 'https://schema.org/ReturnByMail',
			returnFees: 'https://schema.org/ReturnShippingFees'
		}
	};
	const json: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: product.title,
		description: productSeoDescription(product),
		image: productImages(product, origin),
		url: productUrl,
		sku: product.sku ?? product.id,
		category: categoryName(product.category),
		itemCondition: conditionUrl(product.condition_grade ?? 'new'),
		additionalProperty: productAdditionalProperties(product),
		offers: offer
	};

	if (brand) {
		json.brand = {
			'@type': 'Brand',
			name: brand
		};
	}

	if (mpn) json.mpn = mpn;

	if (product.rating > 0 && product.reviews > 0) {
		json.aggregateRating = {
			'@type': 'AggregateRating',
			ratingValue: Number(product.rating.toFixed(1)),
			reviewCount: product.reviews
		};
	}

	return json;
}

export function breadcrumbListJsonLd(origin: string, items: Array<{ name: string; path: string }>) {
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
