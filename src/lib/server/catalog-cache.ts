import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '$lib/catalog';
import { getProduct, listCatalogProducts, listRelatedProducts } from '$lib/products';
import type { Database } from '$lib/supabase/types';

type ProductClient = SupabaseClient<Database>;

type CacheEntry<T> = {
	expiresAt: number;
	value?: T;
	pending?: Promise<T>;
};

const CATALOG_CACHE_TTL_MS = 60_000;
const CATALOG_CACHE_MAX_ENTRIES = 200;
const catalogCache = new Map<string, CacheEntry<unknown>>();

export function clearCatalogCache() {
	catalogCache.clear();
}

function trimCatalogCache() {
	while (catalogCache.size > CATALOG_CACHE_MAX_ENTRIES) {
		const oldest = catalogCache.keys().next().value;
		if (!oldest) return;
		catalogCache.delete(oldest);
	}
}

async function readThrough<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const cached = catalogCache.get(key) as CacheEntry<T> | undefined;

	if (cached?.value !== undefined && cached.expiresAt > now) {
		catalogCache.delete(key);
		catalogCache.set(key, cached);
		return cached.value;
	}

	if (cached?.pending) return cached.pending;

	const pending = load()
		.then((value) => {
			catalogCache.set(key, {
				expiresAt: Date.now() + ttlMs,
				value
			});
			trimCatalogCache();
			return value;
		})
		.catch((error) => {
			catalogCache.delete(key);
			throw error;
		});

	catalogCache.set(key, { expiresAt: now + ttlMs, pending });
	trimCatalogCache();
	return pending;
}

export function getCachedHomeProducts(client: ProductClient, limit = 48) {
	return readThrough(`home-products:${limit}`, CATALOG_CACHE_TTL_MS, () =>
		listCatalogProducts({ limit, sort: 'newest' }, client)
	);
}

export function getCachedProduct(productId: string, client: ProductClient) {
	return readThrough(`product:${productId}`, CATALOG_CACHE_TTL_MS, () =>
		getProduct(productId, client)
	);
}

export function getCachedRelatedProducts(
	category: string,
	excludeId: string,
	limit: number,
	client: ProductClient
) {
	return readThrough(`related:${category}:${excludeId}:${limit}`, CATALOG_CACHE_TTL_MS, () =>
		listRelatedProducts(category, excludeId, limit, client)
	);
}

export function getCachedActiveCategoryCounts(client: ProductClient) {
	return readThrough('active-category-counts', CATALOG_CACHE_TTL_MS, async () => {
		const { data, error } = await client.rpc('active_category_counts');
		if (error) throw error;

		const counts: Record<string, number> = {};
		for (const row of data ?? []) {
			counts[row.category] = Number(row.count);
		}
		return counts;
	});
}
