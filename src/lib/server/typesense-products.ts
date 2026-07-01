import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { hiddenCategories, type Product, type ProductSpecificationValue } from '$lib/catalog';
import { normalizeProductRow, productSelectFields, type ProductRow } from '$lib/products';
import { isPrivateSupplierQuery, sanitizePublicProduct } from '$lib/public-product';
import { getSupabaseAdminClient } from '$lib/server/supabase-admin';
import type { Database } from '$lib/supabase/types';

type ProductClient = SupabaseClient<Database>;

export type TypesenseProductDocument = {
	id: string;
	title: string;
	brand: string;
	category: string;
	image: string;
	images: string[];
	sku: string;
	part_numbers: string[];
	price: number;
	mrp: number;
	rating: number;
	reviews: number;
	stock: number;
	discount_amount: number;
	updated_at: string;
	updated_at_ts: number;
	created_at_ts: number;
	compatibility: string;
	warranty: string;
	highlights: string[];
	search_keywords: string[];
	description: string;
	authenticity_grade: string;
	condition_grade: string;
	local_delivery_eligible: boolean;
	cod_eligible: boolean;
};

type TypesenseSearchHit = {
	document?: TypesenseProductDocument;
};

type TypesenseSearchResponse = {
	found?: number;
	hits?: TypesenseSearchHit[];
};

type ProductSearchOptions = {
	query?: string;
	category?: string;
	brand?: string;
	minPrice?: number;
	maxPrice?: number;
	inStock?: boolean;
	minRating?: number;
	sort?: 'relevance' | 'price-asc' | 'price-desc' | 'rating-desc' | 'discount-desc' | 'newest';
	limit: number;
	page: number;
};

type TypesenseSearchResult = {
	products: Product[];
	total: number;
};

type QueueRow = {
	id: number;
	product_id: string;
	operation: 'upsert' | 'delete';
	attempts: number;
};

type ProductIndexRow = ProductRow & {
	created_at?: string | null;
};

const TYPESENSE_COLLECTION_DEFAULT = 'products';
const PRODUCT_INDEX_FIELDS = `${productSelectFields},created_at`;
const MAX_QUEUE_EVENTS_PER_REQUEST = 50;
const TYPESENSE_SEARCH_TIMEOUT_MS = 900;
const TYPESENSE_WRITE_TIMEOUT_MS = 12_000;
const TYPESENSE_FAILURE_COOLDOWN_MS = 30_000;
let typesenseSearchUnavailableUntil = 0;
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

function typesenseHost() {
	return env.TYPESENSE_HOST?.trim().replace(/\/+$/, '') || '';
}

function typesenseSearchKey() {
	return (
		env.TYPESENSE_SEARCH_API_KEY?.trim() ||
		env.TYPESENSE_ADMIN_API_KEY?.trim() ||
		env.TYPESENSE_API_KEY?.trim() ||
		''
	);
}

function typesenseAdminKey() {
	return env.TYPESENSE_ADMIN_API_KEY?.trim() || env.TYPESENSE_API_KEY?.trim() || '';
}

function typesenseCollection() {
	return env.TYPESENSE_PRODUCTS_COLLECTION?.trim() || TYPESENSE_COLLECTION_DEFAULT;
}

export function isTypesenseSearchConfigured() {
	return Boolean(typesenseHost() && typesenseSearchKey());
}

function isTypesenseAdminConfigured() {
	return Boolean(typesenseHost() && typesenseAdminKey());
}

function numberOrZero(value: number | undefined) {
	return Number.isFinite(value) ? Number(value) : 0;
}

function timestampSeconds(value: string | null | undefined) {
	const ms = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalizeToken(value: string) {
	return value
		.toUpperCase()
		.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '')
		.trim();
}

function extractPartNumberCandidates(value: string | undefined, output: Set<string>) {
	if (!value) return;

	const patterns = [
		/\b[A-Z]{1,4}\d{2,}[A-Z0-9.-]{1,}\b/gi,
		/\b\d{2,}[A-Z]{1,4}[A-Z0-9.-]{1,}\b/gi,
		/\b[A-Z0-9]{2,}[-.][A-Z0-9.-]{2,}\b/gi
	];

	for (const pattern of patterns) {
		const matches = value.match(pattern) ?? [];
		for (const match of matches) {
			const token = normalizeToken(match);
			if (token.length >= 3 && /[A-Z]/.test(token) && /\d/.test(token)) output.add(token);
		}
	}
}

function flattenSpecificationText(value: ProductSpecificationValue | undefined): string[] {
	if (value === undefined || value === null) return [];
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}
	if (Array.isArray(value)) {
		return value.flatMap((item) => flattenSpecificationText(item as ProductSpecificationValue));
	}
	if (typeof value === 'object') {
		return Object.entries(value).flatMap(([key, nested]) => [
			key,
			...flattenSpecificationText(nested as ProductSpecificationValue)
		]);
	}
	return [];
}

function extractPartNumbers(product: Product) {
	const values = new Set<string>();
	const sources = [
		product.sku,
		product.title,
		product.compatibility,
		product.description,
		product.warranty,
		...(product.highlights ?? []),
		...(product.search_keywords ?? []),
		...Object.entries(product.specifications ?? {}).flatMap(([key, value]) => [
			key,
			...flattenSpecificationText(value)
		])
	];

	for (const source of sources) extractPartNumberCandidates(source, values);
	return Array.from(values).slice(0, 80);
}

function productDocumentFromRow(row: ProductIndexRow): TypesenseProductDocument {
	const product = normalizeProductRow(row);
	const images = product.images?.length ? product.images : product.image ? [product.image] : [];
	const searchKeywords = product.search_keywords ?? [];
	const updatedAt = product.updated_at ?? row.updated_at ?? '';

	return {
		id: product.id,
		title: product.title,
		brand: product.brand,
		category: product.category,
		image: product.image,
		images,
		sku: product.sku ?? '',
		part_numbers: extractPartNumbers(product),
		price: numberOrZero(product.price),
		mrp: numberOrZero(product.mrp),
		rating: numberOrZero(product.rating),
		reviews: Math.max(0, Math.floor(numberOrZero(product.reviews))),
		stock: Math.floor(numberOrZero(product.stock)),
		discount_amount: Math.max(0, numberOrZero(product.mrp) - numberOrZero(product.price)),
		updated_at: updatedAt,
		updated_at_ts: timestampSeconds(updatedAt),
		created_at_ts: timestampSeconds(row.created_at),
		compatibility: product.compatibility ?? '',
		warranty: product.warranty ?? '',
		highlights: product.highlights ?? [],
		search_keywords: searchKeywords,
		description: product.description ?? '',
		authenticity_grade: product.authenticity_grade ?? 'compatible',
		condition_grade: product.condition_grade ?? 'new',
		local_delivery_eligible: product.local_delivery_eligible ?? false,
		cod_eligible: product.cod_eligible ?? false
	};
}

function productFromTypesenseDocument(document: TypesenseProductDocument) {
	return sanitizePublicProduct({
		id: document.id,
		title: document.title,
		brand: document.brand,
		category: document.category,
		image: document.image,
		images: document.images,
		sku: document.sku,
		search_keywords: document.search_keywords,
		updated_at: document.updated_at,
		price: document.price,
		mrp: document.mrp,
		rating: document.rating,
		reviews: document.reviews,
		stock: document.stock,
		compatibility: document.compatibility,
		warranty: document.warranty,
		highlights: document.highlights,
		authenticity_grade: document.authenticity_grade as Product['authenticity_grade'],
		condition_grade: document.condition_grade as Product['condition_grade'],
		local_delivery_eligible: document.local_delivery_eligible,
		cod_eligible: document.cod_eligible
	});
}

async function typesenseRequest<T>(
	path: string,
	options: RequestInit = {},
	key = typesenseSearchKey(),
	timeoutMs = TYPESENSE_SEARCH_TIMEOUT_MS
): Promise<T> {
	const host = typesenseHost();
	if (!host || !key) throw new Error('Typesense is not configured');

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	let response: Response;
	try {
		response = await fetch(`${host}${path}`, {
			...options,
			signal: controller.signal,
			headers: {
				...(options.body ? { 'content-type': 'application/json' } : {}),
				...options.headers,
				'X-TYPESENSE-API-KEY': key
			}
		});
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error(`Typesense request timed out after ${timeoutMs}ms`, { cause: error });
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Typesense ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
	}

	return (await response.json()) as T;
}

function typesenseLiteral(value: string) {
	return `\`${value.replace(/`/g, '\\`')}\``;
}

function buildFilterBy(options: ProductSearchOptions) {
	const filters = ['category:!=ics'];
	const inferredCategory = inferCategoryFromQuery(options);

	if (options.category) filters.push(`category:=${typesenseLiteral(options.category)}`);
	else if (inferredCategory) filters.push(`category:=${typesenseLiteral(inferredCategory)}`);
	if (options.brand) filters.push(`brand:=${typesenseLiteral(options.brand)}`);
	if (options.inStock) filters.push('stock:>0');
	if (Number.isFinite(options.minPrice)) filters.push(`price:>=${options.minPrice}`);
	if (Number.isFinite(options.maxPrice)) filters.push(`price:<=${options.maxPrice}`);
	if (Number.isFinite(options.minRating)) filters.push(`rating:>=${options.minRating}`);

	return filters.join(' && ');
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

function sortByFor(options: ProductSearchOptions) {
	switch (options.sort) {
		case 'price-asc':
			return 'stock:desc,price:asc';
		case 'price-desc':
			return 'stock:desc,price:desc';
		case 'rating-desc':
			return 'stock:desc,rating:desc,reviews:desc';
		case 'discount-desc':
			return 'stock:desc,discount_amount:desc';
		case 'newest':
			return 'stock:desc,created_at_ts:desc,updated_at_ts:desc';
		default:
			return '_text_match:desc,stock:desc,updated_at_ts:desc';
	}
}

export async function searchTypesenseProducts(
	options: ProductSearchOptions
): Promise<TypesenseSearchResult | null> {
	const queryText = options.query?.trim() ?? '';
	if (!isTypesenseSearchConfigured() || !queryText || isPrivateSupplierQuery(queryText))
		return null;
	if (Date.now() < typesenseSearchUnavailableUntil) return null;
	if (options.category && hiddenCategories.includes(options.category)) {
		return { products: [], total: 0 };
	}

	const params = new URLSearchParams({
		q: queryText,
		query_by:
			'title,part_numbers,sku,category,compatibility,brand,search_keywords,description,highlights,warranty',
		query_by_weights: '10,12,12,8,7,5,6,2,2,1',
		prefix: 'true',
		infix: 'off,always,always,off,off,off,off,off,off,off',
		num_typos: '2,0,0,1,1,1,1,1,1,1',
		min_len_1typo: '4',
		min_len_2typo: '7',
		limit: String(options.limit),
		page: String(options.page),
		filter_by: buildFilterBy(options),
		sort_by: sortByFor(options)
	});

	let response: TypesenseSearchResponse;
	try {
		response = await typesenseRequest<TypesenseSearchResponse>(
			`/collections/${typesenseCollection()}/documents/search?${params.toString()}`
		);
		typesenseSearchUnavailableUntil = 0;
	} catch (error) {
		typesenseSearchUnavailableUntil = Date.now() + TYPESENSE_FAILURE_COOLDOWN_MS;
		throw error;
	}
	const products = (response.hits ?? [])
		.map((hit) => hit.document)
		.filter((document): document is TypesenseProductDocument => Boolean(document))
		.map(productFromTypesenseDocument)
		.filter((product) => !hiddenCategories.includes(product.category));

	return {
		products,
		total: Number(response.found ?? products.length)
	};
}

async function upsertProductDocument(row: ProductIndexRow) {
	const document = productDocumentFromRow(row);
	await typesenseRequest(
		`/collections/${typesenseCollection()}/documents?action=upsert&dirty_values=coerce_or_reject`,
		{
			method: 'POST',
			body: JSON.stringify(document)
		},
		typesenseAdminKey(),
		TYPESENSE_WRITE_TIMEOUT_MS
	);
}

async function deleteProductDocument(productId: string) {
	try {
		await typesenseRequest(
			`/collections/${typesenseCollection()}/documents/${encodeURIComponent(productId)}?ignore_not_found=true`,
			{ method: 'DELETE' },
			typesenseAdminKey(),
			TYPESENSE_WRITE_TIMEOUT_MS
		);
	} catch (error) {
		if (error instanceof Error && error.message.includes('Typesense 404')) return;
		throw error;
	}
}

async function loadProductForIndex(client: ProductClient, productId: string) {
	const { data, error } = await client
		.from('products')
		.select(PRODUCT_INDEX_FIELDS)
		.eq('id', productId)
		.maybeSingle();

	if (error) throw error;
	return data as ProductIndexRow | null;
}

async function markQueueEvent(
	client: SupabaseClient<any>,
	eventId: number,
	status: 'synced' | 'failed',
	attempts: number,
	errorMessage?: string
) {
	await client
		.from('product_search_sync_events')
		.update({
			status,
			attempts,
			error_message: errorMessage?.slice(0, 1000) ?? null,
			processed_at: status === 'synced' ? new Date().toISOString() : null
		})
		.eq('id', eventId);
}

export async function syncPendingProductSearchEvents(maxEvents = MAX_QUEUE_EVENTS_PER_REQUEST) {
	if (!isTypesenseAdminConfigured()) return { processed: 0, failed: 0, skipped: 'typesense' };

	const adminClient = getSupabaseAdminClient();
	if (!adminClient) return { processed: 0, failed: 0, skipped: 'supabase-service-role' };
	const adminDb = adminClient as SupabaseClient<any>;

	const { data, error } = await adminDb
		.from('product_search_sync_events')
		.select('id,product_id,operation,attempts')
		.in('status', ['pending', 'failed'])
		.lt('attempts', 5)
		.order('created_at', { ascending: true })
		.limit(Math.min(Math.max(1, maxEvents), MAX_QUEUE_EVENTS_PER_REQUEST));

	if (error?.code === 'PGRST205' || error?.code === '42P01') {
		return { processed: 0, failed: 0, skipped: 'missing-queue-table' };
	}
	if (error) throw error;

	let processed = 0;
	let failed = 0;

	for (const event of (data ?? []) as QueueRow[]) {
		const attempts = event.attempts + 1;
		try {
			const row =
				event.operation === 'upsert'
					? await loadProductForIndex(adminClient, event.product_id)
					: null;

			if (!row || row.status !== 'active' || hiddenCategories.includes(row.category)) {
				await deleteProductDocument(event.product_id);
			} else {
				await upsertProductDocument(row);
			}

			await markQueueEvent(adminDb, event.id, 'synced', attempts);
			processed += 1;
		} catch (eventError) {
			failed += 1;
			await markQueueEvent(
				adminDb,
				event.id,
				'failed',
				attempts,
				eventError instanceof Error ? eventError.message : String(eventError)
			);
		}
	}

	return { processed, failed };
}
