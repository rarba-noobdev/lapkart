import type { SupabaseClient } from '@supabase/supabase-js';
import { hiddenCategories, type Product } from '$lib/catalog';
import { supabase } from '$lib/supabase/client';
import type { Database } from '$lib/supabase/types';

export type ProductRow = {
	id: string;
	title: string;
	brand: string;
	category: string;
	image: string;
	images: string[] | null;
	source_url: string | null;
	description: string | null;
	sku: string | null;
	search_keywords: string[] | null;
	status: string;
	updated_at: string;
	price: string | number;
	mrp: string | number;
	rating: string | number;
	reviews: number;
	stock: number;
	weight_kg?: string | number | null;
	length_cm?: string | number | null;
	breadth_cm?: string | number | null;
	height_cm?: string | number | null;
	compatibility: string | null;
	warranty: string | null;
	highlights: string[] | null;
	specifications?: Record<string, string> | null;
	authenticity_grade: 'oem' | 'compatible' | 'refurbished' | 'open_box' | null;
	condition_grade: 'new' | 'open_box' | 'refurbished' | 'used' | null;
	hsn_code: string | null;
	gst_rate: string | number | null;
	doa_policy_days: number | null;
	local_delivery_eligible: boolean | null;
	cod_eligible: boolean | null;
};

export const productSelectFields =
	'id,title,brand,category,image,images,source_url,description,sku,search_keywords,status,updated_at,price,mrp,rating,reviews,stock,weight_kg,length_cm,breadth_cm,height_cm,compatibility,warranty,highlights,specifications,authenticity_grade,condition_grade,hsn_code,gst_rate,doa_policy_days,local_delivery_eligible,cod_eligible';

export const productCardSelectFields =
	'id,title,brand,category,image,source_url,price,mrp,rating,reviews,stock,compatibility,warranty,highlights,authenticity_grade,condition_grade,local_delivery_eligible,cod_eligible';

type ProductClient = SupabaseClient<Database>;

export type ListProductsOptions = {
	category?: string;
	query?: string;
	brand?: string;
	minPrice?: number;
	maxPrice?: number;
	inStock?: boolean;
	minRating?: number;
	sort?: 'relevance' | 'price-asc' | 'price-desc' | 'rating-desc' | 'discount-desc' | 'newest';
	limit?: number;
	page?: number;
};

export type CatalogProductsPage = {
	products: Product[];
	total: number;
};

function getClient(client?: ProductClient) {
	return client ?? supabase;
}

function excludeHiddenCategories<T extends { neq: (column: string, value: string) => T }>(query: T) {
	return hiddenCategories.reduce((nextQuery, category) => nextQuery.neq('category', category), query);
}

function escapeSearchTerm(value: string) {
	return value.replace(/[%_,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fallbackSearchTerms(value: string) {
	const base = escapeSearchTerm(value);
	if (!base) return [];

	const terms = new Set([base]);
	const words = base.split(/\s+/);

	for (let index = 0; index < words.length - 1; index += 1) {
		const current = words[index];
		const next = words[index + 1];
		if (!current || !next) continue;

		terms.add([...words.slice(0, index), `${current}-${next}`, ...words.slice(index + 2)].join(' '));
	}

	if (words.length > 1) {
		terms.add(words.join('-'));
	}

	return Array.from(terms).filter(Boolean).slice(0, 8);
}

function normalizedFallbackTerm(value: string) {
	return value.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

export function normalizeProductRow(row: ProductRow): Product {
	const weightKg = Number(row.weight_kg);
	const lengthCm = Number(row.length_cm);
	const breadthCm = Number(row.breadth_cm);
	const heightCm = Number(row.height_cm);
	return {
		id: row.id,
		title: row.title,
		brand: row.brand,
		category: row.category,
		image: row.image,
		images: row.images ?? undefined,
		source_url: row.source_url ?? undefined,
		description: row.description ?? undefined,
		sku: row.sku ?? undefined,
		search_keywords: row.search_keywords ?? undefined,
		updated_at: row.updated_at,
		price: Number(row.price),
		mrp: Number(row.mrp),
		rating: Number(row.rating),
		reviews: row.reviews,
		stock: row.stock,
		weight_kg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : undefined,
		length_cm: Number.isFinite(lengthCm) && lengthCm > 0 ? lengthCm : undefined,
		breadth_cm: Number.isFinite(breadthCm) && breadthCm > 0 ? breadthCm : undefined,
		height_cm: Number.isFinite(heightCm) && heightCm > 0 ? heightCm : undefined,
		compatibility: row.compatibility ?? '',
		warranty: row.warranty ?? '',
		highlights: row.highlights ?? [],
		specifications: row.specifications ?? undefined,
		authenticity_grade: row.authenticity_grade ?? 'compatible',
		condition_grade: row.condition_grade ?? 'new',
		hsn_code: row.hsn_code ?? undefined,
		gst_rate:
			row.gst_rate === null || row.gst_rate === undefined ? undefined : Number(row.gst_rate),
		doa_policy_days: row.doa_policy_days ?? undefined,
		local_delivery_eligible: row.local_delivery_eligible ?? undefined,
		cod_eligible: row.cod_eligible ?? undefined
	};
}

export async function listProducts(client?: ProductClient) {
	const { data, error } = await getClient(client)
		.from('products')
		.select(productSelectFields)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return ((data ?? []) as ProductRow[]).map(normalizeProductRow);
}

export async function getProduct(id: string, client?: ProductClient) {
	const { data, error } = await getClient(client)
		.from('products')
		.select(productSelectFields)
		.eq('id', id)
		.eq('status', 'active')
		.neq('category', 'ics')
		.maybeSingle();

	if (error) throw error;
	return data ? normalizeProductRow(data as ProductRow) : null;
}

export async function listProductsByIds(ids: string[]) {
	const key = [...new Set(ids)].sort();
	if (key.length === 0) return [];

	const { data, error } = await supabase.from('products').select(productSelectFields).in('id', key);
	if (error) throw error;

	return ((data ?? []) as ProductRow[]).map(normalizeProductRow);
}

export async function listCatalogProducts(
	options: ListProductsOptions = {},
	client?: ProductClient
) {
	const result = await listCatalogProductPage(options, client);
	return result.products;
}

export async function listCatalogProductPage(
	options: ListProductsOptions = {},
	client?: ProductClient
): Promise<CatalogProductsPage> {
	if (options.category && hiddenCategories.includes(options.category)) {
		return { products: [], total: 0 };
	}

	let query = getClient(client)
		.from('products')
		.select(productCardSelectFields, { count: 'exact' })
		.eq('status', 'active');

	query = excludeHiddenCategories(query);

	if (options.category) {
		query = query.eq('category', options.category);
	}

	if (options.brand) {
		query = query.eq('brand', options.brand);
	}

	if (options.query) {
		const searchTerms = fallbackSearchTerms(options.query);
		const searchFilters = searchTerms.flatMap((term) => [
			`title.ilike.%${term}%`,
			`brand.ilike.%${term}%`,
			`sku.ilike.%${term}%`,
			`compatibility.ilike.%${term}%`,
			`warranty.ilike.%${term}%`,
			`description.ilike.%${term}%`,
			`source_url.ilike.%${term}%`
		]);
		const normalizedTerm = normalizedFallbackTerm(options.query);
		if (normalizedTerm && normalizedTerm !== options.query.trim().toLowerCase()) {
			searchFilters.push(
				`title.ilike.%${normalizedTerm}%`,
				`sku.ilike.%${normalizedTerm}%`,
				`compatibility.ilike.%${normalizedTerm}%`
			);
		}
		query = query.or(
			searchFilters.length > 0
				? searchFilters.join(',')
				: 'title.ilike.%__lapkart_no_search_term__%'
		);
	}

	if (options.inStock) {
		query = query.gt('stock', 0);
	}

	if (Number.isFinite(options.minPrice)) {
		query = query.gte('price', options.minPrice);
	}

	if (Number.isFinite(options.maxPrice)) {
		query = query.lte('price', options.maxPrice);
	}

	if (Number.isFinite(options.minRating)) {
		query = query.gte('rating', options.minRating);
	}

	if (options.sort === 'price-asc') query = query.order('price', { ascending: true });
	else if (options.sort === 'price-desc') query = query.order('price', { ascending: false });
	else if (options.sort === 'rating-desc') query = query.order('rating', { ascending: false });
	else query = query.order('created_at', { ascending: false });

	if (options.limit) {
		const limit = Math.min(Math.max(1, Math.floor(options.limit)), 250);
		const page = Math.max(1, Math.floor(options.page ?? 1));
		const from = (page - 1) * limit;
		query = query.range(from, from + limit - 1);
	}

	const { data, error, count } = await query;
	if (error) throw error;

	const products = ((data ?? []) as ProductRow[]).map(normalizeProductRow);

	if (options.sort === 'discount-desc') {
		return {
			products: products.sort((a, b) => b.mrp - b.price - (a.mrp - a.price)),
			total: count ?? products.length
		};
	}

	return {
		products,
		total: count ?? products.length
	};
}

export async function listRelatedProducts(
	category: string,
	excludeId: string,
	limit = 4,
	client?: ProductClient
) {
	if (hiddenCategories.includes(category)) return [];

	const { data, error } = await getClient(client)
		.from('products')
		.select(productCardSelectFields)
		.eq('category', category)
		.eq('status', 'active')
		.neq('id', excludeId)
		.order('rating', { ascending: false })
		.limit(limit);

	if (error) throw error;
	return ((data ?? []) as ProductRow[]).map(normalizeProductRow);
}
