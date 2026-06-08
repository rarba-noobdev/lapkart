import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import type { ImportResponse } from 'typesense/lib/Typesense/Documents';
import { discountPct, type Product } from '$lib/catalog';
import {
	listCatalogProductPage,
	normalizeProductRow,
	productSelectFields,
	type ProductRow
} from '$lib/products';
import type { Database, Tables } from '$lib/supabase/types';
import { getTypesenseClient, readTypesenseConfig } from './typesense';

type ProductClient = SupabaseClient<Database>;
type SearchSyncEvent = Tables<'product_search_sync_events'>;

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
	source: 'typesense' | 'supabase';
};

type ProductSearchDocument = {
	id: string;
	title: string;
	brand: string;
	category: string;
	description: string;
	sku: string;
	image: string;
	images: string[];
	source_url: string;
	price: number;
	mrp: number;
	discount: number;
	rating: number;
	reviews: number;
	stock: number;
	in_stock: boolean;
	compatibility: string;
	warranty: string;
	highlights: string[];
	search_keywords: string[];
	status: string;
	authenticity_grade: string;
	condition_grade: string;
	local_delivery_eligible: boolean;
	cod_eligible: boolean;
	updated_at_unix: number;
};

const PRODUCT_QUERY_BY =
	'title,brand,category,description,sku,compatibility,warranty,highlights,search_keywords';

const productsCollectionSchema = (name: string): CollectionCreateSchema => ({
	name,
	fields: [
		{ name: 'id', type: 'string' },
		{ name: 'title', type: 'string' },
		{ name: 'brand', type: 'string', facet: true },
		{ name: 'category', type: 'string', facet: true },
		{ name: 'description', type: 'string', optional: true },
		{ name: 'sku', type: 'string', optional: true },
		{ name: 'compatibility', type: 'string', optional: true },
		{ name: 'warranty', type: 'string', optional: true },
		{ name: 'highlights', type: 'string[]', optional: true },
		{ name: 'search_keywords', type: 'string[]', optional: true },
		{ name: 'status', type: 'string', facet: true },
		{ name: 'price', type: 'float', facet: true },
		{ name: 'mrp', type: 'float' },
		{ name: 'discount', type: 'float' },
		{ name: 'rating', type: 'float', facet: true },
		{ name: 'reviews', type: 'int32' },
		{ name: 'stock', type: 'int32' },
		{ name: 'in_stock', type: 'bool', facet: true },
		{ name: 'authenticity_grade', type: 'string', facet: true, optional: true },
		{ name: 'condition_grade', type: 'string', facet: true, optional: true },
		{ name: 'local_delivery_eligible', type: 'bool', facet: true },
		{ name: 'cod_eligible', type: 'bool', facet: true },
		{ name: 'updated_at_unix', type: 'int64' }
	],
	default_sorting_field: 'updated_at_unix'
});

function asFiniteNumber(value: number | undefined) {
	return Number.isFinite(value) ? value : undefined;
}

function quoteFilterValue(value: string) {
	return `\`${value.replace(/`/g, '\\`')}\``;
}

function toUnixTimestamp(value: string) {
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function toSearchDocument(row: ProductRow): ProductSearchDocument {
	const product = normalizeProductRow(row);

	return {
		id: product.id,
		title: product.title,
		brand: product.brand,
		category: product.category,
		description: row.description ?? '',
		sku: row.sku ?? '',
		image: product.image,
		images: product.images ?? [],
		source_url: product.source_url ?? '',
		price: product.price,
		mrp: product.mrp,
		discount: discountPct(product),
		rating: product.rating,
		reviews: product.reviews,
		stock: product.stock,
		in_stock: product.stock > 0,
		compatibility: product.compatibility,
		warranty: product.warranty,
		highlights: product.highlights,
		search_keywords: row.search_keywords ?? [],
		status: row.status,
		authenticity_grade: product.authenticity_grade ?? 'compatible',
		condition_grade: product.condition_grade ?? 'new',
		local_delivery_eligible: product.local_delivery_eligible !== false,
		cod_eligible: product.cod_eligible !== false,
		updated_at_unix: toUnixTimestamp(row.updated_at)
	};
}

function fromSearchDocument(document: ProductSearchDocument): Product {
	return {
		id: document.id,
		title: document.title,
		brand: document.brand,
		category: document.category,
		image: document.image,
		images: document.images.length ? document.images : undefined,
		source_url: document.source_url || undefined,
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
	};
}

function sortToTypesense(sort: ProductSort | undefined) {
	if (sort === 'price-asc') return 'price:asc';
	if (sort === 'price-desc') return 'price:desc';
	if (sort === 'rating-desc') return 'rating:desc,reviews:desc';
	if (sort === 'discount-desc') return 'discount:desc';
	if (sort === 'newest') return 'updated_at_unix:desc';
	return undefined;
}

function buildFilter(options: ProductSearchOptions) {
	const filters = ['status:=active'];

	if (options.category) filters.push(`category:=${quoteFilterValue(options.category)}`);
	if (options.brand) filters.push(`brand:=${quoteFilterValue(options.brand)}`);
	if (options.inStock) filters.push('in_stock:=true');
	if (asFiniteNumber(options.minPrice) !== undefined) filters.push(`price:>=${options.minPrice}`);
	if (asFiniteNumber(options.maxPrice) !== undefined) filters.push(`price:<=${options.maxPrice}`);
	if (asFiniteNumber(options.minRating) !== undefined)
		filters.push(`rating:>=${options.minRating}`);

	return filters.join(' && ');
}

function orderFallbackProducts(products: Product[], sort: ProductSort | undefined) {
	if (sort === 'discount-desc') {
		return products.sort((a, b) => discountPct(b) - discountPct(a));
	}

	return products;
}

export async function ensureProductsCollection() {
	const config = readTypesenseConfig();
	const client = getTypesenseClient();
	if (!config || !client) return false;

	const collection = client.collections<ProductSearchDocument>(config.collection);
	const exists = await collection.exists();
	if (!exists) {
		await client.collections().create(productsCollectionSchema(config.collection));
	}

	return true;
}

export async function indexProductRows(rows: ProductRow[]) {
	const config = readTypesenseConfig();
	const client = getTypesenseClient();
	if (!config || !client || rows.length === 0) return { indexed: 0, failed: 0 };

	await ensureProductsCollection();
	const results = (await client
		.collections<ProductSearchDocument>(config.collection)
		.documents()
		.import(rows.map(toSearchDocument), {
			action: 'upsert',
			dirty_values: 'coerce_or_reject',
			return_id: true
		})) as ImportResponse<ProductSearchDocument>[];

	const failed = results.filter((result) => !result.success).length;
	return { indexed: results.length - failed, failed };
}

export async function deleteProductFromIndex(productId: string) {
	const config = readTypesenseConfig();
	const client = getTypesenseClient();
	if (!config || !client) return false;

	await ensureProductsCollection();
	await client
		.collections<ProductSearchDocument>(config.collection)
		.documents()
		.delete({ filter_by: `id:=${quoteFilterValue(productId)}`, ignore_not_found: true });
	return true;
}

export async function searchProducts(
	options: ProductSearchOptions,
	client: ProductClient
): Promise<ProductSearchResult> {
	const config = readTypesenseConfig();
	const typesense = getTypesenseClient();

	if (config && typesense) {
		try {
			await ensureProductsCollection();
			const response = await typesense
				.collections<ProductSearchDocument>(config.collection)
				.documents()
				.search({
					q: options.query?.trim() || '*',
					query_by: PRODUCT_QUERY_BY,
					filter_by: buildFilter(options),
					sort_by: sortToTypesense(options.sort),
					page: options.page ?? 1,
					per_page: Math.min(options.limit ?? 250, 250),
					facet_by: 'category,brand,in_stock,rating'
				});

			return {
				products: (response.hits ?? []).map((hit) => fromSearchDocument(hit.document)),
				total: response.found,
				source: 'typesense'
			};
		} catch (error) {
			console.warn('Typesense product search failed, falling back to Supabase.', error);
		}
	}

	const fallbackResult = await listCatalogProductPage(
		{
			category: options.category,
			query: options.query,
			brand: options.brand,
			minPrice: options.minPrice,
			maxPrice: options.maxPrice,
			inStock: options.inStock,
			minRating: options.minRating,
			sort: options.sort,
			limit: options.limit,
			page: options.page
		},
		client
	);
	const products = orderFallbackProducts(fallbackResult.products, options.sort);

	return {
		products,
		total: fallbackResult.total,
		source: 'supabase'
	};
}

export async function loadProductRows(client: ProductClient, ids?: string[]) {
	let query = client.from('products').select(productSelectFields);

	if (ids?.length) {
		query = query.in('id', [...new Set(ids)]);
	}

	const { data, error } = await query;
	if (error) throw error;
	return (data ?? []) as ProductRow[];
}

export async function syncPendingProductSearchEvents(client: ProductClient, limit = 50) {
	if (!readTypesenseConfig()) {
		return { configured: false, processed: 0, failed: 0 };
	}

	const { data: events, error } = await client
		.from('product_search_sync_events')
		.select('id,product_id,operation,status,attempts')
		.in('status', ['pending', 'failed'])
		.order('created_at', { ascending: true })
		.limit(limit);

	if (error) throw error;

	let processed = 0;
	let failed = 0;

	for (const event of (events ?? []) as SearchSyncEvent[]) {
		const nextAttempts = event.attempts + 1;
		await client
			.from('product_search_sync_events')
			.update({ status: 'processing', attempts: nextAttempts, error_message: null })
			.eq('id', event.id);

		try {
			if (event.operation === 'delete') {
				await deleteProductFromIndex(event.product_id);
			} else {
				const rows = await loadProductRows(client, [event.product_id]);
				if (rows.length) await indexProductRows(rows);
				else await deleteProductFromIndex(event.product_id);
			}

			await client
				.from('product_search_sync_events')
				.update({ status: 'synced', processed_at: new Date().toISOString(), error_message: null })
				.eq('id', event.id);
			processed += 1;
		} catch (syncError) {
			await client
				.from('product_search_sync_events')
				.update({
					status: 'failed',
					error_message: syncError instanceof Error ? syncError.message : 'Typesense sync failed'
				})
				.eq('id', event.id);
			failed += 1;
		}
	}

	return { configured: true, processed, failed };
}
