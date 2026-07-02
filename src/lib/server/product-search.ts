import type { SupabaseClient } from '@supabase/supabase-js';
import { hiddenCategories, type Product } from '$lib/catalog';
import { isPrivateSupplierQuery, sanitizePublicProduct } from '$lib/public-product';
import { listCatalogProductPage } from '$lib/products';
import { searchTypesenseProducts } from '$lib/server/typesense-products';
import type { Database } from '$lib/supabase/types';

type ProductClient = SupabaseClient<Database>;

export type ProductSort =
	| 'relevance'
	| 'price-asc'
	| 'price-desc'
	| 'rating-desc'
	| 'discount-desc'
	| 'newest';

export type ProductSearchOptions = {
	query?: string;
	category?: string;
	brand?: string;
	minPrice?: number;
	maxPrice?: number;
	inStock?: boolean;
	minRating?: number;
	sort?: ProductSort;
	limit?: number;
	page?: number;
};

export type ProductSearchResult = {
	products: Product[];
	total: number;
	source: 'typesense' | 'postgres' | 'supabase';
};

type ProductSearchRow = {
	id: string;
	title: string;
	brand: string;
	category: string;
	image: string;
	images: string[] | null;
	source_url: string | null;
	price: number;
	mrp: number;
	rating: number;
	reviews: number;
	stock: number;
	compatibility: string | null;
	warranty: string | null;
	highlights: string[] | null;
	authenticity_grade: Product['authenticity_grade'] | null;
	condition_grade: Product['condition_grade'] | null;
	local_delivery_eligible: boolean | null;
	cod_eligible: boolean | null;
	updated_at: string;
	total_count: number;
};

type ProductSearchCacheEntry = {
	expiresAt: number;
	result?: ProductSearchResult;
	pending?: Promise<ProductSearchResult>;
};

const SEARCH_CACHE_TTL_MS = 30_000;
const SEARCH_CACHE_MAX_ENTRIES = 200;
const searchCache = new Map<string, ProductSearchCacheEntry>();
const COMMON_QUERY_TOKEN_CORRECTIONS = new Map([
	['keybord', 'keyboard'],
	['keyboad', 'keyboard'],
	['keybrd', 'keyboard'],
	['latitde', 'latitude'],
	['lattitude', 'latitude'],
	['batery', 'battery'],
	['battri', 'battery'],
	['chargr', 'charger'],
	['chargar', 'charger'],
	['chager', 'charger'],
	['disply', 'display'],
	['diplay', 'display'],
	['screeen', 'screen'],
	['adaptor', 'adapter'],
	['motherbord', 'motherboard'],
	['procesor', 'processor'],
	['proccessor', 'processor'],
	['speker', 'speaker'],
	['hing', 'hinge']
]);
const CATEGORY_QUERY_ALIASES = new Map([
	['ram', 'ram'],
	['memory', 'ram'],
	['ssd', 'ssd'],
	['storage', 'ssd'],
	['motherboard', 'motherboards'],
	['motherboards', 'motherboards'],
	['battery', 'batteries'],
	['batteries', 'batteries'],
	['display', 'displays'],
	['displays', 'displays'],
	['screen', 'displays'],
	['screens', 'displays'],
	['lcd', 'displays'],
	['keyboard', 'keyboards'],
	['keyboards', 'keyboards'],
	['processor', 'processors'],
	['processors', 'processors'],
	['cpu', 'processors'],
	['cooling fan', 'cooling'],
	['cooling fans', 'cooling'],
	['fan', 'cooling'],
	['fans', 'cooling'],
	['charger', 'chargers'],
	['chargers', 'chargers'],
	['adapter', 'chargers'],
	['adapters', 'chargers'],
	['wifi card', 'wifi_cards'],
	['wifi cards', 'wifi_cards'],
	['dc jack', 'dc_jacks'],
	['dc jacks', 'dc_jacks'],
	['bottom case', 'bottom_cases'],
	['bottom cases', 'bottom_cases'],
	['palmrest', 'palmrests'],
	['palmrests', 'palmrests'],
	['hinge', 'hinges'],
	['hinges', 'hinges'],
	['speaker', 'speakers'],
	['speakers', 'speakers'],
	['hdd board', 'hdd_boards'],
	['hdd boards', 'hdd_boards'],
	['power button', 'power_buttons'],
	['power buttons', 'power_buttons'],
	['flex cable', 'flex_cables'],
	['flex cables', 'flex_cables']
]);
const STRICT_DEVICE_DISPLAY_PATTERN = /\b(surface\s+pro|tablet|all[-\s]*in[-\s]*one|\baio\b)\b/i;
const DISPLAY_TERM_PATTERN = /\b(display|screen|lcd|panel)\b/i;

export function clearProductSearchCache() {
	searchCache.clear();
}

function asNullableNumber(value: number | undefined) {
	return Number.isFinite(value) ? value : undefined;
}

function correctedQueryText(value: string | undefined) {
	const query = value?.trim();
	if (!query) return undefined;

	const corrected = query
		.split(/\s+/)
		.map((token) => {
			const normalized = token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
			return COMMON_QUERY_TOKEN_CORRECTIONS.get(normalized) ?? token;
		})
		.join(' ');

	return corrected === query ? value : corrected;
}

function withCorrectedQuery(options: ProductSearchOptions): ProductSearchOptions {
	const query = correctedQueryText(options.query);
	if (query === options.query) return options;
	return { ...options, query };
}

function normalizeCategoryQuery(value: string) {
	return value
		.toLowerCase()
		.replace(/[_-]+/g, ' ')
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function inferCategoryFromQuery(options: ProductSearchOptions) {
	if (options.category || options.brand) return '';
	const query = normalizeCategoryQuery(options.query ?? '');
	if (!query) return '';
	return CATEGORY_QUERY_ALIASES.get(query) ?? '';
}

function withInferredCategory(options: ProductSearchOptions): ProductSearchOptions {
	const inferredCategory = inferCategoryFromQuery(options);
	return inferredCategory ? { ...options, category: inferredCategory } : options;
}

function hasStrictDeviceDisplayIntent(queryText: string) {
	return STRICT_DEVICE_DISPLAY_PATTERN.test(queryText) && DISPLAY_TERM_PATTERN.test(queryText);
}

function productSearchText(product: Product) {
	return [
		product.title,
		product.brand,
		product.category,
		product.compatibility,
		product.description,
		product.warranty,
		...(product.highlights ?? []),
		...(product.search_keywords ?? [])
	]
		.filter(Boolean)
		.join(' ');
}

function filterStrictDeviceDisplayIntent(result: ProductSearchResult, queryText: string) {
	if (!hasStrictDeviceDisplayIntent(queryText)) return result;

	const products = result.products.filter((product) =>
		STRICT_DEVICE_DISPLAY_PATTERN.test(productSearchText(product))
	);
	return {
		...result,
		products,
		total: Math.min(result.total, products.length)
	};
}

function searchCacheKey(options: ProductSearchOptions, limit: number, page: number) {
	return JSON.stringify({
		query: options.query?.trim().toLowerCase() || '',
		category: options.category || '',
		brand: options.brand || '',
		minPrice: asNullableNumber(options.minPrice) ?? null,
		maxPrice: asNullableNumber(options.maxPrice) ?? null,
		inStock: options.inStock === true,
		minRating: asNullableNumber(options.minRating) ?? null,
		sort: options.sort ?? 'relevance',
		limit,
		page
	});
}

function readSearchCache(key: string) {
	const cached = searchCache.get(key);
	if (!cached) return null;

	if (cached.result && cached.expiresAt > Date.now()) {
		searchCache.delete(key);
		searchCache.set(key, cached);
		return cached.result;
	}

	if (cached.pending) return cached.pending;

	if (cached.expiresAt <= Date.now()) searchCache.delete(key);
	return null;
}

function writeSearchCache(key: string, result: ProductSearchResult) {
	searchCache.set(key, {
		expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
		result
	});

	if (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
		const oldest = searchCache.keys().next().value;
		if (oldest) searchCache.delete(oldest);
	}
}

function writePendingSearch(key: string, pending: Promise<ProductSearchResult>) {
	searchCache.set(key, {
		expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
		pending
	});

	if (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
		const oldest = searchCache.keys().next().value;
		if (oldest) searchCache.delete(oldest);
	}
}

function fromSearchRow(row: ProductSearchRow): Product {
	return sanitizePublicProduct({
		id: row.id,
		title: row.title,
		brand: row.brand,
		category: row.category,
		image: row.image,
		images: row.images ?? undefined,
		source_url: row.source_url ?? undefined,
		price: Number(row.price),
		mrp: Number(row.mrp),
		rating: Number(row.rating),
		reviews: row.reviews,
		stock: row.stock,
		compatibility: row.compatibility ?? '',
		warranty: row.warranty ?? '',
		highlights: row.highlights ?? [],
		authenticity_grade: row.authenticity_grade ?? 'compatible',
		condition_grade: row.condition_grade ?? 'new',
		local_delivery_eligible: row.local_delivery_eligible ?? undefined,
		cod_eligible: row.cod_eligible ?? undefined
	});
}

async function shouldUseFallbackForStockOrder(
	options: ProductSearchOptions,
	client: ProductClient,
	rows: ProductSearchRow[],
	limit: number,
	page: number
) {
	if (options.inStock || rows.length === 0 || rows.every((row) => Number(row.stock ?? 0) > 0)) {
		return false;
	}

	const inStockOnPage = rows.filter((row) => Number(row.stock ?? 0) > 0).length;
	const offset = (page - 1) * limit;

	const { data, error } = await client.rpc('search_active_products', {
		p_brand: options.brand || null,
		p_category: options.category || null,
		p_in_stock: true,
		p_limit: 1,
		p_max_price: asNullableNumber(options.maxPrice) ?? null,
		p_min_price: asNullableNumber(options.minPrice) ?? null,
		p_min_rating: asNullableNumber(options.minRating) ?? null,
		p_offset: 0,
		p_query: options.query?.trim() || null,
		p_sort: options.sort ?? 'relevance'
	});

	if (error) return false;

	const inStockTotal = Number(((data ?? []) as ProductSearchRow[])[0]?.total_count ?? 0);
	return offset + inStockOnPage < inStockTotal;
}

async function loadFallbackSearchProducts(
	options: ProductSearchOptions,
	client: ProductClient,
	limit: number,
	page: number
): Promise<ProductSearchResult> {
	const fallback = await listCatalogProductPage(
		{
			category: options.category,
			query: options.query,
			brand: options.brand,
			minPrice: options.minPrice,
			maxPrice: options.maxPrice,
			inStock: options.inStock,
			minRating: options.minRating,
			sort: options.sort,
			limit,
			page
		},
		client
	);

	return {
		products: fallback.products,
		total: fallback.total,
		source: 'supabase'
	};
}

export async function searchProducts(
	options: ProductSearchOptions,
	client: ProductClient
): Promise<ProductSearchResult> {
	const limit = Math.min(Math.max(1, Math.floor(options.limit ?? 96)), 250);
	const page = Math.max(1, Math.floor(options.page ?? 1));
	const correctedOptions = withCorrectedQuery(options);
	const cacheKey = searchCacheKey(correctedOptions, limit, page);
	const cached = readSearchCache(cacheKey);
	if (cached) return cached;

	const pending = loadSearchProducts(correctedOptions, client, limit, page)
		.then((result) => {
			writeSearchCache(cacheKey, result);
			return result;
		})
		.catch((error) => {
			searchCache.delete(cacheKey);
			throw error;
		});
	writePendingSearch(cacheKey, pending);
	return pending;
}

async function loadSearchProducts(
	options: ProductSearchOptions,
	client: ProductClient,
	limit: number,
	page: number
): Promise<ProductSearchResult> {
	const queryText = options.query?.trim() ?? '';
	const searchOptions = withInferredCategory(options);

	if (searchOptions.category && hiddenCategories.includes(searchOptions.category)) {
		return { products: [], total: 0, source: 'postgres' };
	}
	if (isPrivateSupplierQuery(queryText)) {
		return { products: [], total: 0, source: 'postgres' };
	}
	if (!queryText) {
		return loadFallbackSearchProducts(searchOptions, client, limit, page);
	}

	try {
		const typesenseResult = await searchTypesenseProducts({
			...searchOptions,
			limit,
			page
		});
		if (typesenseResult) {
			return filterStrictDeviceDisplayIntent(
				{
					...typesenseResult,
					source: 'typesense'
				},
				queryText
			);
		}
	} catch (typesenseError) {
		console.warn('Typesense product search failed, falling back to Postgres.', typesenseError);
	}

	try {
		const { data, error } = await client.rpc('search_active_products', {
			p_brand: searchOptions.brand || null,
			p_category: searchOptions.category || null,
			p_in_stock: searchOptions.inStock || null,
			p_limit: limit,
			p_max_price: asNullableNumber(searchOptions.maxPrice) ?? null,
			p_min_price: asNullableNumber(searchOptions.minPrice) ?? null,
			p_min_rating: asNullableNumber(searchOptions.minRating) ?? null,
			p_offset: (page - 1) * limit,
			p_query: queryText,
			p_sort: searchOptions.sort ?? 'relevance'
		});

		if (error) throw error;

		const rows = ((data ?? []) as ProductSearchRow[]).filter(
			(row) => !hiddenCategories.includes(row.category)
		);
		if (await shouldUseFallbackForStockOrder(searchOptions, client, rows, limit, page)) {
			console.warn(
				'Postgres product search RPC returned stale stock ordering; falling back to stock-first catalog query.'
			);
			return loadFallbackSearchProducts(searchOptions, client, limit, page);
		}

		return filterStrictDeviceDisplayIntent(
			{
				products: rows.map(fromSearchRow),
				total: rows[0]?.total_count ?? 0,
				source: 'postgres'
			},
			queryText
		);
	} catch (searchError) {
		console.warn(
			'Postgres product search RPC failed, falling back to basic catalog query.',
			searchError
		);
	}

	return filterStrictDeviceDisplayIntent(
		await loadFallbackSearchProducts(searchOptions, client, limit, page),
		queryText
	);
}
