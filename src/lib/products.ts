import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '$lib/catalog';
import { supabase } from '$lib/supabase/client';
import type { Database } from '$lib/supabase/types';

type ProductRow = {
	id: string;
	title: string;
	brand: string;
	category: string;
	image: string;
	images: string[] | null;
	source_url: string | null;
	price: string | number;
	mrp: string | number;
	rating: string | number;
	reviews: number;
	stock: number;
	compatibility: string | null;
	warranty: string | null;
	highlights: string[] | null;
};

const selectFields =
	'id,title,brand,category,image,images,source_url,price,mrp,rating,reviews,stock,compatibility,warranty,highlights';

type ProductClient = SupabaseClient<Database>;

export type ListProductsOptions = {
	category?: string;
	query?: string;
	inStock?: boolean;
	sort?: 'relevance' | 'price-asc' | 'price-desc' | 'rating-desc' | 'discount-desc';
	limit?: number;
};

function getClient(client?: ProductClient) {
	return client ?? supabase;
}

function normalize(row: ProductRow): Product {
	return {
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
		authenticity_grade: 'compatible',
		condition_grade: 'new',
		hsn_code: undefined,
		gst_rate: 18,
		doa_policy_days: 7,
		local_delivery_eligible: true,
		cod_eligible: true
	};
}

export async function listProducts(client?: ProductClient) {
	const { data, error } = await getClient(client)
		.from('products')
		.select(selectFields)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return ((data ?? []) as ProductRow[]).map(normalize);
}

export async function getProduct(id: string, client?: ProductClient) {
	const { data, error } = await getClient(client)
		.from('products')
		.select(selectFields)
		.eq('id', id)
		.maybeSingle();

	if (error) throw error;
	return data ? normalize(data as ProductRow) : null;
}

export async function listProductsByIds(ids: string[]) {
	const key = [...new Set(ids)].sort();
	if (key.length === 0) return [];

	const { data, error } = await supabase.from('products').select(selectFields).in('id', key);
	if (error) throw error;

	return ((data ?? []) as ProductRow[]).map(normalize);
}

export async function listCatalogProducts(
	options: ListProductsOptions = {},
	client?: ProductClient
) {
	let query = getClient(client).from('products').select(selectFields);

	if (options.category) {
		query = query.eq('category', options.category);
	}

	if (options.query) {
		const escaped = options.query.replace(/[%_]/g, '\\$&');
		query = query.or(`title.ilike.%${escaped}%,brand.ilike.%${escaped}%`);
	}

	if (options.inStock) {
		query = query.gt('stock', 0);
	}

	if (options.sort === 'price-asc') query = query.order('price', { ascending: true });
	else if (options.sort === 'price-desc') query = query.order('price', { ascending: false });
	else if (options.sort === 'rating-desc') query = query.order('rating', { ascending: false });
	else query = query.order('created_at', { ascending: false });

	if (options.limit) {
		query = query.limit(options.limit);
	}

	const { data, error } = await query;
	if (error) throw error;

	const products = ((data ?? []) as ProductRow[]).map(normalize);

	if (options.sort === 'discount-desc') {
		return products.sort((a, b) => b.mrp - b.price - (a.mrp - a.price));
	}

	return products;
}

export async function listRelatedProducts(
	category: string,
	excludeId: string,
	limit = 4,
	client?: ProductClient
) {
	const { data, error } = await getClient(client)
		.from('products')
		.select(selectFields)
		.eq('category', category)
		.neq('id', excludeId)
		.order('rating', { ascending: false })
		.limit(limit);

	if (error) throw error;
	return ((data ?? []) as ProductRow[]).map(normalize);
}
