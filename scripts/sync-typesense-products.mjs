import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_COLLECTION = 'products';
const PAGE_SIZE = 500;
const HIDDEN_CATEGORIES = new Set();
const PRIVATE_SUPPLIER_PATTERNS = [
	/parts[-\s]*people/gi,
	/ipc[-\s]*computer/gi,
	/\bipc\b/gi,
	/my\s*laptop\s*screen/gi,
	/mylaptopscreen/gi,
	/\bpc[-\s]*tech\b/gi,
	/laptop[-\s]*screen\.com/gi
];

const SELECT_FIELDS = [
	'id',
	'title',
	'brand',
	'category',
	'image',
	'images',
	'description',
	'sku',
	'search_keywords',
	'status',
	'created_at',
	'updated_at',
	'price',
	'mrp',
	'rating',
	'reviews',
	'stock',
	'compatibility',
	'warranty',
	'highlights',
	'specifications',
	'authenticity_grade',
	'condition_grade',
	'local_delivery_eligible',
	'cod_eligible'
].join(',');

async function loadEnv() {
	const values = { ...process.env };
	if (!existsSync('.env')) return values;

	const text = await readFile('.env', 'utf8');
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const separator = line.indexOf('=');
		if (separator === -1) continue;
		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in values)) values[key] = value;
	}
	return values;
}

function requireEnv(env, key) {
	const value = env[key]?.trim();
	if (!value) throw new Error(`Missing ${key}`);
	return value;
}

function typesenseAdminKey(env) {
	const value = env.TYPESENSE_ADMIN_API_KEY?.trim() || env.TYPESENSE_API_KEY?.trim();
	if (!value) throw new Error('Missing TYPESENSE_ADMIN_API_KEY');
	return value;
}

function parseArgs() {
	const args = new Set(process.argv.slice(2));
	return {
		full: args.has('--full') || (!args.has('--queue') && !args.has('--health')),
		queue: args.has('--queue'),
		recreate: args.has('--recreate'),
		health: args.has('--health'),
		limit:
			Number(
				process.argv.find((arg) => arg.startsWith('--limit='))?.slice('--limit='.length) ?? '200'
			) || 200
	};
}

function sanitizeInlineText(value) {
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

function isPrivateSupplierQuery(value) {
	if (!value) return false;
	return PRIVATE_SUPPLIER_PATTERNS.some((pattern) => {
		pattern.lastIndex = 0;
		return pattern.test(value);
	});
}

function sanitizeNarrativeText(value) {
	const text = sanitizeInlineText(value);
	if (!text) return '';
	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.map((part) => part.trim())
		.filter((part) => part && !isPrivateSupplierQuery(part))
		.join(' ')
		.trim();
}

function sanitizeArray(values) {
	return Array.isArray(values)
		? values.map((value) => sanitizeNarrativeText(value)).filter(Boolean)
		: [];
}

function sanitizeKeywords(values) {
	return Array.isArray(values)
		? values.map((value) => sanitizeInlineText(value)).filter(Boolean)
		: [];
}

function numberOrZero(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
}

function integerOrZero(value) {
	return Math.max(0, Math.floor(numberOrZero(value)));
}

function timestampSeconds(value) {
	const ms = value ? Date.parse(value) : Number.NaN;
	return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function normalizeToken(value) {
	return value
		.toUpperCase()
		.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, '')
		.trim();
}

function addSearchTerm(output, value) {
	const normalized = normalizeToken(value ?? '');
	if (normalized.length < 2) return;
	output.add(normalized);
	const compact = normalized.replace(/[^A-Z0-9]+/g, '');
	if (compact.length >= 3 && compact !== normalized) output.add(compact);
}

function addModelCodeAliases(output, value) {
	if (!value) return;
	const pattern = /[A-Z]?\d{2,4}[-.](?=[A-Z0-9]*\d)[A-Z0-9]{2,}/gi;
	for (const match of value.matchAll(pattern)) {
		const token = match[0];
		const previous = match.index ? value[match.index - 1] : '';
		if (/^\d/.test(token) && previous && /[A-Z0-9]/i.test(previous)) continue;
		addSearchTerm(output, token);
	}
}

function compatibilityPartSection(value) {
	const text = value ?? '';
	const match = text.match(
		/(?:compatible\s+)?(?:panel\s+)?part numbers?:\s*(.*?)(?:\|\s*models?:|\.?\s*compatible laptop models?:|$)/i
	);
	return match?.[1] ?? '';
}

function compatibilityModelSection(value) {
	const text = value ?? '';
	const match = text.match(/(?:compatible laptop models?|models?):\s*(.*)$/i);
	return match?.[1] ?? '';
}

function addIdentifierAliases(output, value) {
	if (!value) return;
	extractPartNumberCandidates(value, output);
	addModelCodeAliases(output, value);
}

function extractPartNumberCandidates(value, output) {
	if (!value) return;
	const patterns = [
		/\b(?=[A-Z0-9.-]{5,}\b)(?=[A-Z0-9.-]*[A-Z])(?=[A-Z0-9.-]*\d)[A-Z0-9]{5,}(?:[-.][A-Z0-9]{2,})*\b/gi,
		/\b[A-Z]{1,4}\d{2,}[A-Z0-9.-]{1,}\b/gi,
		/\b\d{2,}[A-Z]{1,4}[A-Z0-9.-]{1,}\b/gi,
		/\b[A-Z0-9]{2,}[-.][A-Z0-9.-]{2,}\b/gi
	];

	for (const pattern of patterns) {
		for (const match of value.match(pattern) ?? []) {
			const token = normalizeToken(match);
			if (token.length >= 3 && /[A-Z]/.test(token) && /\d/.test(token)) {
				addSearchTerm(output, token);
				addModelCodeAliases(output, token);
			}
		}
	}
}

function flattenSpecText(value) {
	if (value === undefined || value === null) return [];
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return [String(value)];
	}
	if (Array.isArray(value)) return value.flatMap(flattenSpecText);
	if (typeof value === 'object') {
		return Object.entries(value).flatMap(([key, nested]) => [key, ...flattenSpecText(nested)]);
	}
	return [];
}

function extractPartNumbers(row, searchKeywords, highlights) {
	const values = new Set();
	const specs =
		row.specifications && typeof row.specifications === 'object' ? row.specifications : {};
	const sources = [
		row.sku,
		row.title,
		row.compatibility,
		row.description,
		row.warranty,
		...highlights,
		...searchKeywords,
		...Object.entries(specs).flatMap(([key, value]) => [key, ...flattenSpecText(value)])
	];

	for (const source of sources) extractPartNumberCandidates(source, values);
	return Array.from(values).slice(0, 80);
}

function extractIdentifierTerms(row, searchKeywords, highlights) {
	const values = new Set();
	const specs =
		row.specifications && typeof row.specifications === 'object' ? row.specifications : {};
	const compatibilityPartNumbers = compatibilityPartSection(row.compatibility);
	const sources = [
		row.sku,
		row.title,
		compatibilityPartNumbers,
		row.warranty,
		...highlights,
		...searchKeywords,
		...Object.entries(specs).flatMap(([key, value]) => [key, ...flattenSpecText(value)])
	];

	for (const source of sources) addIdentifierAliases(values, source);
	return Array.from(values).slice(0, 140);
}

function extractModelTerms(row, searchKeywords, highlights) {
	const values = new Set();
	const compatibilityModels = compatibilityModelSection(row.compatibility);
	const sources = [row.title, compatibilityModels, ...highlights, ...searchKeywords];

	for (const source of sources) addModelCodeAliases(values, source);
	return Array.from(values).slice(0, 180);
}

function documentFromRow(row) {
	const title = sanitizeInlineText(row.title) || row.title || '';
	const brand = sanitizeInlineText(row.brand) || row.category || '';
	const compatibility = sanitizeNarrativeText(row.compatibility);
	const warranty = sanitizeNarrativeText(row.warranty);
	const highlights = sanitizeArray(row.highlights);
	const searchKeywords = sanitizeKeywords(row.search_keywords);
	const images = Array.isArray(row.images)
		? row.images
				.filter((image) => typeof image === 'string' && image.trim())
				.map((image) => image.trim())
		: [];
	const image =
		typeof row.image === 'string' && row.image.trim() ? row.image.trim() : images[0] || '';
	const price = numberOrZero(row.price);
	const mrp = numberOrZero(row.mrp);

	return {
		id: row.id,
		title,
		brand,
		category: row.category || '',
		image,
		images: images.length ? images : image ? [image] : [],
		sku: sanitizeInlineText(row.sku),
		identifier_terms: extractIdentifierTerms(row, searchKeywords, highlights),
		model_terms: extractModelTerms(row, searchKeywords, highlights),
		part_numbers: extractPartNumbers(row, searchKeywords, highlights),
		price,
		mrp,
		rating: numberOrZero(row.rating),
		reviews: integerOrZero(row.reviews),
		stock: Math.floor(numberOrZero(row.stock)),
		discount_amount: Math.max(0, mrp - price),
		updated_at: row.updated_at || '',
		updated_at_ts: timestampSeconds(row.updated_at),
		created_at_ts: timestampSeconds(row.created_at),
		compatibility,
		warranty,
		highlights,
		search_keywords: searchKeywords,
		description: sanitizeNarrativeText(row.description),
		authenticity_grade: sanitizeInlineText(row.authenticity_grade) || 'compatible',
		condition_grade: sanitizeInlineText(row.condition_grade) || 'new',
		local_delivery_eligible: Boolean(row.local_delivery_eligible),
		cod_eligible: Boolean(row.cod_eligible)
	};
}

function productSchema(collection) {
	return {
		name: collection,
		// Split compound part numbers (e.g. "L43245-LG4", "HPM1-L43245-LG4") into
		// their component tokens so an exact SKU query like "L43245" matches as a
		// full token (high relevance) instead of only a low-scored infix substring.
		// Without this, a near-miss like "L43248" typo-matched and outranked exact hits.
		token_separators: ['-', '/', '.', '_', ',', ':'],
		fields: [
			{ name: 'title', type: 'string' },
			{ name: 'brand', type: 'string', facet: true },
			{ name: 'category', type: 'string', facet: true },
			{ name: 'image', type: 'string', optional: true },
			{ name: 'images', type: 'string[]', optional: true },
			{ name: 'sku', type: 'string', optional: true, infix: true },
			{ name: 'identifier_terms', type: 'string[]', optional: true, infix: true },
			{ name: 'model_terms', type: 'string[]', optional: true },
			{ name: 'part_numbers', type: 'string[]', optional: true, infix: true },
			{ name: 'price', type: 'float', sort: true, range_index: true },
			{ name: 'mrp', type: 'float', sort: true },
			{ name: 'rating', type: 'float', sort: true, range_index: true },
			{ name: 'reviews', type: 'int32', sort: true },
			{ name: 'stock', type: 'int32', sort: true, range_index: true },
			{ name: 'discount_amount', type: 'float', sort: true },
			{ name: 'updated_at', type: 'string', optional: true },
			{ name: 'updated_at_ts', type: 'int64', sort: true },
			{ name: 'created_at_ts', type: 'int64', sort: true },
			{ name: 'compatibility', type: 'string', optional: true },
			{ name: 'warranty', type: 'string', optional: true },
			{ name: 'highlights', type: 'string[]', optional: true },
			{ name: 'search_keywords', type: 'string[]', optional: true },
			{ name: 'description', type: 'string', optional: true },
			{ name: 'authenticity_grade', type: 'string', optional: true, facet: true },
			{ name: 'condition_grade', type: 'string', optional: true, facet: true },
			{ name: 'local_delivery_eligible', type: 'bool', optional: true, facet: true },
			{ name: 'cod_eligible', type: 'bool', optional: true, facet: true }
		]
	};
}

function makeTypesense(env) {
	const host = requireEnv(env, 'TYPESENSE_HOST').replace(/\/+$/, '');
	const key = typesenseAdminKey(env);

	async function request(path, options = {}) {
		const response = await fetch(`${host}${path}`, {
			...options,
			headers: {
				...(options.body ? { 'content-type': 'application/json' } : {}),
				...options.headers,
				'X-TYPESENSE-API-KEY': key
			}
		});
		const text = await response.text();
		if (!response.ok) {
			const error = new Error(`Typesense ${response.status}: ${text.slice(0, 500)}`);
			error.status = response.status;
			throw error;
		}
		return text ? JSON.parse(text) : null;
	}

	async function requestText(path, body, contentType = 'text/plain') {
		const response = await fetch(`${host}${path}`, {
			method: 'POST',
			body,
			headers: {
				'content-type': contentType,
				'X-TYPESENSE-API-KEY': key
			}
		});
		const text = await response.text();
		if (!response.ok) throw new Error(`Typesense ${response.status}: ${text.slice(0, 500)}`);
		return text;
	}

	return { request, requestText };
}

async function ensureCollection(typesense, collection, recreate) {
	if (recreate) {
		await typesense.request(`/collections/${collection}`, { method: 'DELETE' }).catch((error) => {
			if (error.status !== 404) throw error;
		});
	}

	const exists = await typesense
		.request(`/collections/${collection}`)
		.then(() => true)
		.catch((error) => {
			if (error.status === 404) return false;
			throw error;
		});

	if (!exists) {
		await typesense.request('/collections', {
			method: 'POST',
			body: JSON.stringify(productSchema(collection))
		});
		console.log(`Created Typesense collection: ${collection}`);
	}
}

function parseImportResponse(text) {
	let imported = 0;
	const failures = [];
	for (const line of text.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const result = JSON.parse(line);
		if (result.success) imported += 1;
		else failures.push(result);
	}
	return { imported, failures };
}

async function importDocuments(typesense, collection, documents) {
	if (documents.length === 0) return { imported: 0, failures: [] };
	const body = documents.map((document) => JSON.stringify(document)).join('\n');
	const response = await typesense.requestText(
		`/collections/${collection}/documents/import?action=upsert&dirty_values=coerce_or_reject&return_id=true`,
		body
	);
	return parseImportResponse(response);
}

async function deleteDocument(typesense, collection, productId) {
	await typesense
		.request(
			`/collections/${collection}/documents/${encodeURIComponent(productId)}?ignore_not_found=true`,
			{
				method: 'DELETE'
			}
		)
		.catch((error) => {
			if (error.status !== 404) throw error;
		});
}

async function runFullIndex(supabase, typesense, collection, recreate) {
	await ensureCollection(typesense, collection, recreate);

	let from = 0;
	let totalImported = 0;
	let totalFailures = 0;

	for (;;) {
		const { data, error } = await supabase
			.from('products')
			.select(SELECT_FIELDS)
			.eq('status', 'active')
			.order('id', { ascending: true })
			.range(from, from + PAGE_SIZE - 1);

		if (error) throw error;

		const rows = data ?? [];
		const documents = rows
			.filter((row) => row.status === 'active' && !HIDDEN_CATEGORIES.has(row.category))
			.map(documentFromRow);
		const result = await importDocuments(typesense, collection, documents);
		totalImported += result.imported;
		totalFailures += result.failures.length;

		if (result.failures.length) {
			console.error('Import failures:', JSON.stringify(result.failures.slice(0, 3), null, 2));
		}

		console.log(`Indexed ${totalImported} products (${totalFailures} failures)`);
		if (rows.length < PAGE_SIZE) break;
		from += PAGE_SIZE;
	}

	return { imported: totalImported, failed: totalFailures };
}

async function loadProductForIndex(supabase, productId) {
	const { data, error } = await supabase
		.from('products')
		.select(SELECT_FIELDS)
		.eq('id', productId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

async function markEvent(supabase, event, status, errorMessage) {
	await supabase
		.from('product_search_sync_events')
		.update({
			status,
			attempts: event.attempts + 1,
			error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
			processed_at: status === 'synced' ? new Date().toISOString() : null
		})
		.eq('id', event.id);
}

async function runQueueSync(supabase, typesense, collection, limit) {
	await ensureCollection(typesense, collection, false);

	const { data, error } = await supabase
		.from('product_search_sync_events')
		.select('id,product_id,operation,status,attempts')
		.in('status', ['pending', 'failed'])
		.lt('attempts', 5)
		.order('created_at', { ascending: true })
		.limit(Math.min(Math.max(1, limit), 1000));

	if (error?.code === 'PGRST205' || error?.code === '42P01') {
		console.warn('Queue sync skipped: product_search_sync_events is not present in this database.');
		return { processed: 0, failed: 0, skipped: 'missing-queue-table' };
	}
	if (error) throw error;

	let processed = 0;
	let failed = 0;
	for (const event of data ?? []) {
		try {
			if (event.operation === 'delete') {
				await deleteDocument(typesense, collection, event.product_id);
			} else {
				const row = await loadProductForIndex(supabase, event.product_id);
				if (!row || row.status !== 'active' || HIDDEN_CATEGORIES.has(row.category)) {
					await deleteDocument(typesense, collection, event.product_id);
				} else {
					await importDocuments(typesense, collection, [documentFromRow(row)]);
				}
			}
			await markEvent(supabase, event, 'synced');
			processed += 1;
		} catch (syncError) {
			await markEvent(supabase, event, 'failed', syncError.message ?? syncError);
			failed += 1;
		}
	}

	return { processed, failed };
}

async function main() {
	const env = await loadEnv();
	const args = parseArgs();
	const supabaseUrl = requireEnv(env, 'SUPABASE_URL');
	const serviceRoleKey = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
	const collection = env.TYPESENSE_PRODUCTS_COLLECTION?.trim() || DEFAULT_COLLECTION;
	const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
	const typesense = makeTypesense(env);

	if (args.health) {
		const health = await typesense.request('/health');
		console.log(JSON.stringify(health));
	}

	if (args.full) {
		const result = await runFullIndex(supabase, typesense, collection, args.recreate);
		console.log(`Full index complete: ${JSON.stringify(result)}`);
	}

	if (args.queue) {
		const result = await runQueueSync(supabase, typesense, collection, args.limit);
		console.log(`Queue sync complete: ${JSON.stringify(result)}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
