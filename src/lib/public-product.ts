import { categories, type Product, type ProductSpecificationValue } from '$lib/catalog';

const PRIVATE_SUPPLIER_PATTERNS = [
	/parts[-\s]*people/gi,
	/ipc[-\s]*computer/gi,
	/\bipc\b/gi,
	/my\s*laptop\s*screen/gi,
	/mylaptopscreen/gi,
	/\bpc[-\s]*tech\b/gi,
	/laptop[-\s]*screen\.com/gi
];

const PRIVATE_SPEC_LABELS = new Set([
	'compatibility source',
	'source',
	'source url',
	'source website',
	'supplier',
	'supplier name',
	'seller',
	'seller name',
	'vendor',
	'vendor name',
	'marketplace seller',
	'merchant',
	'merchant name',
	'manufacturer',
	'manufacturer name'
]);

export function sanitizePublicProduct(product: Product): Product {
	const { source_url: _sourceUrl, ...publicProduct } = product;
	const title = sanitizeInlineText(product.title) || product.title;
	const brand = sanitizePublicBrand(product.brand, product.category);
	const description = sanitizeNarrativeText(product.description);
	const compatibility = sanitizeNarrativeText(product.compatibility);
	const warranty = sanitizeNarrativeText(product.warranty);
	const highlights = product.highlights
		.map((highlight) => sanitizeNarrativeText(highlight))
		.filter(Boolean);
	const searchKeywords = product.search_keywords
		?.map((keyword) => sanitizeInlineText(keyword))
		.filter(Boolean);

	return {
		...publicProduct,
		title,
		brand,
		description: description || undefined,
		compatibility,
		warranty,
		highlights,
		search_keywords: searchKeywords,
		specifications: sanitizePublicSpecifications(product.specifications)
	};
}

export function isPrivateSupplierQuery(value: string | undefined) {
	if (!value) return false;
	return PRIVATE_SUPPLIER_PATTERNS.some((pattern) => {
		pattern.lastIndex = 0;
		return pattern.test(value);
	});
}

function sanitizePublicBrand(brand: string, category: string) {
	const clean = sanitizeInlineText(brand);
	if (!clean || isPrivateSupplierQuery(brand)) return publicCategoryName(category);
	return clean;
}

function sanitizePublicSpecifications(specifications: Product['specifications']) {
	if (!specifications) return undefined;

	const sanitized: Record<string, ProductSpecificationValue> = {};
	for (const [label, value] of Object.entries(specifications)) {
		if (isPrivateSpecLabel(label)) continue;

		const cleanValue = sanitizeSpecValue(value);
		if (isEmptySpecValue(cleanValue)) continue;
		sanitized[label] = cleanValue;
	}

	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeSpecValue(value: ProductSpecificationValue): ProductSpecificationValue | undefined {
	if (Array.isArray(value)) {
		const items = value
			.map((item) =>
				typeof item === 'object' && item !== null && !Array.isArray(item)
					? sanitizeSpecObject(item)
					: sanitizeSpecValue(item as ProductSpecificationValue)
			)
			.filter((item) => !isEmptySpecValue(item));
		return items.length > 0 ? (items as ProductSpecificationValue) : undefined;
	}

	if (value && typeof value === 'object') {
		return sanitizeSpecObject(value);
	}

	if (typeof value === 'string') {
		const clean = sanitizeInlineText(value);
		return clean || undefined;
	}

	return value;
}

function sanitizeSpecObject(value: Record<string, unknown>) {
	const sanitized: Record<string, unknown> = {};

	for (const [label, raw] of Object.entries(value)) {
		if (isPrivateSpecLabel(label)) continue;

		const cleanValue =
			typeof raw === 'string'
				? sanitizeInlineText(raw)
				: Array.isArray(raw)
					? raw.map((item) => (typeof item === 'string' ? sanitizeInlineText(item) : item))
					: raw;
		if (isEmptySpecValue(cleanValue)) continue;
		sanitized[label] = cleanValue;
	}

	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeNarrativeText(value: string | null | undefined) {
	const text = sanitizeInlineText(value);
	if (!text) return '';

	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.map((part) => part.trim())
		.filter((part) => part && !isPrivateSupplierQuery(part) && !looksLikeSourceSentence(part))
		.join(' ')
		.trim();
}

function sanitizeInlineText(value: string | null | undefined) {
	let text = String(value ?? '').trim();
	if (!text) return '';

	for (const pattern of PRIVATE_SUPPLIER_PATTERNS) {
		pattern.lastIndex = 0;
		text = text.replace(pattern, '');
	}

	return text
		.replace(/\b(source|supplier|seller|vendor)\s*:\s*[^.|;\n]+[.|;]?/gi, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.;:])/g, '$1')
		.replace(/^[\s,.;:|/-]+|[\s,.;:|/-]+$/g, '')
		.trim();
}

function isPrivateSpecLabel(label: string) {
	const key = normalizeKey(label);
	return PRIVATE_SPEC_LABELS.has(key);
}

function looksLikeSourceSentence(value: string) {
	const key = normalizeKey(value);
	return (
		key.startsWith('source ') ||
		key.startsWith('seller ') ||
		key.startsWith('supplier ') ||
		key.startsWith('vendor ')
	);
}

function isEmptySpecValue(value: unknown): value is undefined | null | '' {
	if (value === undefined || value === null || value === '') return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'object') return Object.keys(value).length === 0;
	return false;
}

function normalizeKey(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function publicCategoryName(slug: string) {
	return categories.find((category) => category.slug === slug)?.name ?? slug.replace(/_/g, ' ');
}
