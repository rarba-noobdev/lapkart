import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SOURCES = [
	{
		label: 'Laptop Battery',
		categoryId: 35922,
		category: 'batteries',
		prefix: 'TSB',
		type: 'battery',
		sourceUrl: 'https://techiestore.in/product-category/laptop-battery/'
	},
	{
		label: 'Laptop Adapter',
		categoryId: 35921,
		category: 'chargers',
		prefix: 'TSA',
		type: 'adapter',
		sourceUrl: 'https://techiestore.in/product-category/laptop-adapter/'
	},
	{
		label: 'Laptop Keyboard',
		categoryId: 36290,
		category: 'keyboards',
		prefix: 'TSK',
		type: 'keyboard',
		sourceUrl: 'https://techiestore.in/product-category/laptop-keyboard/'
	}
];

const STORE_API = 'https://techiestore.in/wp-json/wc/store/v1/products';
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const OUTPUT_PATH = 'outputs/techiestore-components-import.json';
const UPSERT_BATCH_SIZE = 10;
const BLOCKED_PRODUCT_IMAGE_FILENAMES = [
	'fits-perfectly_1.png',
	'giving-new-life-to-your-laptop_1.jpg',
	'advanced-safety-for-laptop-battery.png',
	'battery-box.png'
];
const BLOCKED_PRODUCT_IMAGE_PATTERNS = [/(?:^|[-_/])battery[-_ ]?box\.(?:jpe?g|png|webp|gif)\b/i];

const OEMS = [
	['alienware', 'Dell'],
	['apple', 'Apple'],
	['macbook', 'Apple'],
	['imac', 'Apple'],
	['acer', 'Acer'],
	['asus', 'Asus'],
	['avita', 'Avita'],
	['benq', 'BenQ'],
	['clevo', 'Clevo'],
	['compaq', 'HP'],
	['dell', 'Dell'],
	['fujitsu', 'Fujitsu'],
	['getac', 'Getac'],
	['hcl', 'HCL'],
	['hp', 'HP'],
	['huawei', 'Huawei'],
	['ibm', 'IBM'],
	['infinix', 'Infinix'],
	['lenovo', 'Lenovo'],
	['thinkpad', 'Lenovo'],
	['ideapad', 'Lenovo'],
	['lg', 'LG'],
	['medion', 'Medion'],
	['microsoft', 'Microsoft'],
	['surface', 'Microsoft'],
	['msi', 'MSI'],
	['panasonic', 'Panasonic'],
	['samsung', 'Samsung'],
	['sony', 'Sony'],
	['vaio', 'Sony'],
	['toshiba', 'Toshiba'],
	['xiaomi', 'Xiaomi']
];

const ENTITY_MAP = {
	amp: '&',
	apos: "'",
	gt: '>',
	lt: '<',
	nbsp: ' ',
	quot: '"',
	rsquo: "'",
	lsquo: "'",
	rdquo: '"',
	ldquo: '"',
	ndash: '-',
	mdash: '-',
	times: 'x'
};

function loadDotEnv(path = '.env') {
	if (!existsSync(path)) return;

	const text = readFileSync(path, 'utf8');
	for (const line of text.split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (process.env[key]) continue;
		process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
	}
}

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&([a-z]+);/gi, (entity, name) => ENTITY_MAP[name.toLowerCase()] ?? entity);
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function compact(value) {
	return decodeHtml(value)
		.replace(/\u00a0/g, ' ')
		.replace(/[–—]/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}

function decodedImageReference(value) {
	let text = String(value ?? '').toLowerCase();

	for (let index = 0; index < 3; index += 1) {
		try {
			const decoded = decodeURIComponent(text);
			if (decoded === text) break;
			text = decoded;
		} catch {
			break;
		}
	}

	return text;
}

function isBlockedProductImage(value) {
	const src = String(value ?? '').trim();
	if (!src) return false;

	const decoded = decodedImageReference(src);
	return (
		BLOCKED_PRODUCT_IMAGE_FILENAMES.some((filename) => decoded.includes(filename)) ||
		BLOCKED_PRODUCT_IMAGE_PATTERNS.some((pattern) => pattern.test(decoded))
	);
}

function scrubVisibleText(value) {
	let clean = compact(value)
		.replace(/\btechie\s*store\b/gi, 'Compatible')
		.replace(/\btechiestore\b/gi, 'Compatible')
		.replace(/\btechie\b/gi, 'Compatible')
		.replace(/\bcompatible\s+compatible\b/gi, 'Compatible')
		.replace(/\bCompatible\s+Compatible\b/g, 'Compatible')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/([(/])\s+/g, '$1')
		.replace(/\s{2,}/g, ' ')
		.trim();

	if (!clean) return clean;

	if (!/\bcompatible\b/i.test(clean)) {
		clean = `Compatible ${clean}`;
	}

	return clean.replace(/\bCompatible\s+Compatible\b/g, 'Compatible').trim();
}

function scrubDescription(value) {
	return scrubVisibleText(stripHtml(value))
		.replace(/\bAt Compatible\b/g, 'We')
		.replace(/\bCompatible stands for\b/gi, 'This product stands for')
		.slice(0, 900)
		.trim();
}

function resolveBrand(title, categories = []) {
	const haystack = ` ${compact(`${title} ${categories.map((c) => c.name).join(' ')}`).toLowerCase()} `;
	for (const [needle, brand] of OEMS) {
		if (haystack.includes(` ${needle} `) || haystack.includes(`${needle}-`)) return brand;
	}
	return 'Compatible';
}

function money(prices, key) {
	const minor = Number(prices?.currency_minor_unit ?? 0);
	const divisor = 10 ** minor;
	const parsed = Number(prices?.[key]);
	return Number.isFinite(parsed) ? Math.round(parsed / divisor) : 0;
}

function unique(values, limit = 500) {
	const seen = new Set();
	const out = [];
	for (const raw of values.flat()) {
		const value = compact(raw)
			.replace(/\btechie\s*store\b/gi, ' ')
			.replace(/\btechiestore\b/gi, ' ')
			.replace(/\btechie\b/gi, ' ')
			.replace(/\bcompatible\b/gi, '')
			.replace(
				/\b(for|laptop|notebook|battery|batteries|adapter|adaptor|charger|keyboard)\b/gi,
				' '
			)
			.replace(/\s+/g, ' ')
			.trim();
		if (!value || value.length < 2 || value.length > 120) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= limit) break;
	}
	return out;
}

function uniqueRaw(values, limit = 500) {
	const seen = new Set();
	const out = [];
	for (const raw of values.flat()) {
		const value = compact(raw);
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= limit) break;
	}
	return out;
}

function parseLiItems(html) {
	const items = [];
	for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
		const text = stripHtml(match[1]);
		if (text) items.push(text);
	}
	return items;
}

function extractSectionList(html, headingPattern) {
	const match = headingPattern.exec(html);
	if (!match) return [];

	const afterHeading = html.slice(match.index);
	const ulStart = afterHeading.search(/<ul\b/i);
	if (ulStart < 0) return [];

	const afterUl = afterHeading.slice(ulStart);
	const ulEnd = afterUl.search(/<\/ul>/i);
	if (ulEnd < 0) return [];

	return unique(parseLiItems(afterUl.slice(0, ulEnd + 5)), 2000);
}

function extractAnySectionList(html, headingPatterns) {
	return unique(
		headingPatterns.flatMap((pattern) => extractSectionList(html, pattern)),
		2000
	);
}

function extractStrongTexts(html) {
	const values = [];
	for (const match of html.matchAll(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi)) {
		const text = stripHtml(match[1]);
		if (text) values.push(text);
	}
	return unique(values, 300);
}

function titleAfterFor(title) {
	const clean = compact(title).replace(/\([^)]*\)/g, ' ');
	const match = clean.match(
		/\b(?:for|compatible for)\s+(.+?)(?:\s+(?:laptop|notebook)\s+(?:battery|charger|adapter|keyboard)\b|\s+\d+(?:\.\d+)?\s*[vV]|\s+\d+\s*[wW]|\s+\d+\s*mAh|\s+\d+-Cell|$)/i
	);
	return match?.[1] ? [match[1]] : [];
}

function extractCompatibilityCaptures(text) {
	const patterns = [
		/\bHighly\s+Compatible\s+for\s+(.+?)(?:\s+laptop|\s+notebook|[.])/gi,
		/\b(?:crafted|built|designed|purpose-built)\s+to\s+fit\s+(.+?)(?:\s+laptop|\s+notebook|[.])/gi,
		/\bcompatible\s+with\s+(.+?)(?:\s+laptop|\s+notebook|[.])/gi,
		/\bfits?\s+(?:a\s+range\s+of\s+)?(.+?)(?:\s+laptop|\s+notebook|[.])/gi,
		/\bfor\s+(.+?)(?:\s+laptop\s+(?:charger|adapter|keyboard|battery)|\s+notebook|[.])/gi
	];
	const captures = [];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			if (match[1]) captures.push(match[1]);
		}
	}
	return captures;
}

function shouldKeepModelTerm(value) {
	const text = compact(value);
	if (!text || text.length < 2 || text.length > 100) return false;
	if (
		/\b(power|voltage|current|pin|cord|warranty|capacity|cell|output|input|safe|quality|replacement|certification|charging|charge|overheat|circuit|protection)\b/i.test(
			text
		)
	) {
		return false;
	}
	if (/^\d+(?:\.\d+)?\s*(?:w|v|a|mah|wh|mm)$/i.test(text)) return false;
	return /[a-z].*\d|\d.*[a-z]|\b(series|pavilion|inspiron|latitude|vostro|thinkpad|ideapad|aspire|vivobook|zenbook|macbook|victus|elitebook|probook|chromebook|vaio|satellite|portege|xps|precision|alienware|surface)\b/i.test(
		text
	);
}

function splitCompatibilityPhrase(phrase, brand) {
	let clean = compact(phrase)
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\btechie\s*store\b/gi, ' ')
		.replace(/\btechiestore\b/gi, ' ')
		.replace(/\btechie\b/gi, ' ')
		.replace(/\b(?:laptops?|notebooks?|charger|adapter|keyboard|battery|series)\b\.?/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!clean) return [];

	const pieces = clean
		.split(/\s*,\s*|\s*;\s*|\s+\|\s+/)
		.map((piece) => piece.trim())
		.filter(Boolean);

	const out = [clean];
	for (const piece of pieces) {
		if (!shouldKeepModelTerm(piece)) continue;
		out.push(piece);
		if (brand !== 'Compatible' && !new RegExp(`^${brand}\\b`, 'i').test(piece)) {
			out.push(`${brand} ${piece}`);
		}
	}
	return unique(out, 200);
}

function extractSpecsFromText(text) {
	const specs = {};
	const checks = [
		['Capacity', /\b(\d{3,5}\s*mAh)\b/i],
		['Voltage', /\b(\d+(?:\.\d+)?\s*V)\b/i],
		['Cells', /\b(\d+\s*-?\s*Cell)\b/i],
		['Wattage', /\b(\d+(?:\.\d+)?\s*W)\b/i],
		['Current', /\b(\d+(?:\.\d+)?\s*A)\b/i],
		['Pin size', /\b(\d+(?:\.\d+)?\s*[x*]\s*\d+(?:\.\d+)?\s*mm)\b/i]
	];

	for (const [label, pattern] of checks) {
		const match = text.match(pattern);
		if (match?.[1]) specs[label] = compact(match[1]).replace(/\s+/g, '');
	}

	return specs;
}

function normalizedVariants(value) {
	const clean = compact(value);
	const compacted = clean.toLowerCase().replace(/[^a-z0-9]+/g, '');
	const spaced = clean
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
	const hyphenless = clean.toLowerCase().replace(/[-_/]+/g, '');
	return unique([clean, spaced, compacted, hyphenless], 8);
}

function buildKeywords({ title, brand, category, sourceSku, partNumbers, models, specs }) {
	const base = [
		title,
		brand,
		category,
		sourceSku,
		...Object.values(specs),
		...partNumbers,
		...models,
		...models.map((model) => model.replace(new RegExp(`^${brand}\\s+`, 'i'), '')),
		...partNumbers.flatMap(normalizedVariants),
		...models.flatMap(normalizedVariants)
	];

	return unique(
		base.flatMap((value) => {
			const text = compact(value);
			const words = text.split(/[\s,]+/).filter((word) => word.length >= 2);
			return [text, ...words];
		}),
		2500
	).map((value) => value.toLowerCase());
}

function shortList(values, limit = 2000) {
	const list = unique(values, limit);
	return list.join(', ');
}

function buildCompatibility({ type, brand, partNumbers, models, sourceSku }) {
	const parts = [];
	if (partNumbers.length) parts.push(`Part numbers: ${shortList(partNumbers, 1000)}`);
	if (models.length) parts.push(`Models: ${shortList(models, 2000)}`);
	if (!parts.length && sourceSku) parts.push(`Part number: ${sourceSku}`);
	if (!parts.length) parts.push(`${brand} compatible ${type}`);
	return parts.join(' | ');
}

function buildHighlights(type, brand, specs, partNumbers, models) {
	const productLabel = type === 'adapter' ? 'charger' : type;
	const highlights = [
		`${brand} compatible ${productLabel}`,
		'Fitment terms indexed for model and part-number search',
		'Direct source product images retained'
	];
	if (specs.Capacity || specs.Wattage) {
		highlights.push(
			`Primary spec: ${specs.Capacity ?? specs.Wattage}${specs.Voltage ? `, ${specs.Voltage}` : ''}`
		);
	}
	if (partNumbers.length) highlights.push(`Compatible part numbers: ${partNumbers.length}`);
	if (models.length) highlights.push(`Compatible models: ${models.length}`);
	return highlights.map(scrubVisibleText).slice(0, 6);
}

function normalizeProduct(source, product) {
	const html = `${product.description ?? ''}\n${product.short_description ?? ''}`;
	const text = stripHtml(html);
	const rawTitle = stripHtml(product.name);
	const brand = resolveBrand(rawTitle, product.categories ?? []);
	const images = uniqueRaw(
		(product.images ?? []).map((image) => image.src).filter(Boolean),
		12
	).filter((image) => !isBlockedProductImage(image));
	if (!images.length) return null;

	const sourceSku = compact(product.sku || product.slug || String(product.id));
	const cleanTitle = scrubVisibleText(rawTitle);
	const price = money(product.prices, 'price');
	const regularPrice = money(product.prices, 'regular_price');
	if (!price) return null;

	let partNumbers = [];
	let models = [];

	const listedModels = extractAnySectionList(html, [
		/Compatible\s+Laptop\s+Models?/i,
		/Compatible\s+Notebook\s+Models?/i,
		/Compatible\s+Models?/i
	]);

	if (source.type === 'battery') {
		partNumbers = extractAnySectionList(html, [
			/Compatible\s+Battery\s+Part\s+Numbers?/i,
			/Compatible\s+Part\s+Numbers?/i
		]);
	}

	const strongTerms = extractStrongTexts(html);
	const captures = extractCompatibilityCaptures(text);
	const titleTerms = titleAfterFor(rawTitle);
	const phraseTerms = unique([...titleTerms, ...strongTerms, ...captures], 300);
	const derivedModels = unique(
		phraseTerms.flatMap((term) => splitCompatibilityPhrase(term, brand)),
		350
	).filter(shouldKeepModelTerm);

	models = unique([...listedModels, ...models, ...derivedModels], 2000);

	if (!partNumbers.length) {
		partNumbers = unique([sourceSku].filter(Boolean), 25);
	}

	const specs = extractSpecsFromText(`${rawTitle} ${text} ${sourceSku}`);
	const compatibility = scrubVisibleText(
		buildCompatibility({
			type: source.type,
			brand,
			partNumbers,
			models,
			sourceSku
		})
	);
	const description =
		scrubDescription(product.description || product.short_description || rawTitle) ||
		`${cleanTitle}. ${compatibility}`;
	const mrp = regularPrice > price ? regularPrice : Math.round(price * 1.18);
	const searchKeywords = buildKeywords({
		title: cleanTitle,
		brand,
		category: source.category,
		sourceSku,
		partNumbers,
		models,
		specs
	});

	const specifications = {
		'Product type': source.type === 'adapter' ? 'Compatible charger' : `Compatible ${source.type}`,
		...specs,
		'Compatible part numbers': shortList(partNumbers, 1000),
		'Compatible models': shortList(models, 2000)
	};

	Object.keys(specifications).forEach((key) => {
		if (!specifications[key]) delete specifications[key];
		else specifications[key] = scrubVisibleText(specifications[key]).replace(/^Compatible\s+/i, '');
	});

	return {
		title: cleanTitle.slice(0, 180),
		brand,
		category: source.category,
		image: images[0],
		images,
		source_url: product.permalink,
		description,
		sku: `${source.prefix}-${product.id}-${sourceSku}`
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 96),
		search_keywords: searchKeywords,
		status: 'active',
		price,
		mrp,
		rating: Number(product.average_rating) || 4.6,
		reviews: Number(product.review_count) || 0,
		stock: product.is_in_stock === false ? 0 : 25,
		compatibility,
		warranty:
			source.type === 'battery' ? '1 Year Replacement Warranty' : '6 Months Replacement Warranty',
		highlights: buildHighlights(source.type, brand, specs, partNumbers, models),
		specifications,
		authenticity_grade: 'compatible',
		condition_grade: 'new',
		hsn_code:
			source.type === 'battery' ? '85076000' : source.type === 'adapter' ? '85044090' : '84716040',
		gst_rate: 18,
		doa_policy_days: 7,
		local_delivery_eligible: true,
		cod_eligible: true
	};
}

async function fetchJson(url, attempt = 1) {
	const response = await fetch(url, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'application/json'
		}
	});

	if (!response.ok) {
		if (attempt < 4 && [429, 500, 502, 503, 504].includes(response.status)) {
			await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
			return fetchJson(url, attempt + 1);
		}
		throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
	}

	return {
		data: await response.json(),
		totalPages: Number(response.headers.get('x-wp-totalpages') ?? 1),
		total: Number(response.headers.get('x-wp-total') ?? 0)
	};
}

async function fetchSourceProducts(source) {
	const products = [];
	let totalPages = 1;
	let total = 0;

	for (let page = 1; page <= totalPages; page += 1) {
		const url = `${STORE_API}?per_page=100&page=${page}&category=${source.categoryId}`;
		const response = await fetchJson(url);
		if (!Array.isArray(response.data)) {
			throw new Error(`Unexpected Store API response for ${source.label} page ${page}`);
		}
		totalPages = response.totalPages || totalPages;
		total = response.total || total;
		products.push(...response.data);
		process.stdout.write(
			`\r${source.label}: fetched page ${page}/${totalPages} (${products.length}/${total || '?'})`
		);
	}

	process.stdout.write('\n');
	return products;
}

async function upsertProducts(client, products) {
	for (let index = 0; index < products.length; index += UPSERT_BATCH_SIZE) {
		const batch = products.slice(index, index + UPSERT_BATCH_SIZE);
		const { error } = await client.from('products').upsert(batch, { onConflict: 'sku' });
		if (error) throw error;
		process.stdout.write(
			`\rUpserted ${Math.min(index + batch.length, products.length)}/${products.length}`
		);
	}
	process.stdout.write('\n');
}

async function deleteStaleSourceRows(client, products) {
	const wantedSkus = new Set(products.map((product) => product.sku).filter(Boolean));

	for (const category of ['batteries', 'chargers', 'keyboards']) {
		const { data, error } = await client
			.from('products')
			.select('id,sku')
			.eq('category', category)
			.like('source_url', 'https://techiestore.in/product/%');
		if (error) throw error;

		const staleIds = (data ?? [])
			.filter((row) => !row.sku || !wantedSkus.has(row.sku))
			.map((row) => row.id);

		for (const id of staleIds) {
			const { error: deleteError } = await client.from('products').delete().eq('id', id);
			if (deleteError) throw deleteError;
		}
	}
}

function assertNoVisibleLeak(products) {
	const leaked = products.filter((product) =>
		/\btechie\b|techiestore/i.test(
			[
				product.title,
				product.brand,
				product.description,
				product.compatibility,
				product.warranty,
				...(product.highlights ?? []),
				...Object.entries(product.specifications ?? {}).flat(),
				...(product.search_keywords ?? [])
			].join(' ')
		)
	);

	if (leaked.length) {
		throw new Error(
			`Visible Techie wording leak in ${leaked.length} products. First leak: ${leaked[0].title}`
		);
	}
}

function categorySummary(products) {
	return products.reduce((summary, product) => {
		summary[product.category] = (summary[product.category] ?? 0) + 1;
		return summary;
	}, {});
}

loadDotEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const client = createClient(supabaseUrl, serviceRoleKey, {
	auth: { persistSession: false }
});

const rawProducts = [];
for (const source of SOURCES) {
	const products = await fetchSourceProducts(source);
	rawProducts.push(...products.map((product) => ({ source, product })));
}

const normalized = rawProducts
	.map(({ source, product }) => normalizeProduct(source, product))
	.filter(Boolean);

const deduped = [];
const seenSources = new Set();
for (const product of normalized) {
	const key = product.source_url ?? product.sku;
	if (seenSources.has(key)) continue;
	seenSources.add(key);
	deduped.push(product);
}

assertNoVisibleLeak(deduped);
writeFileSync(
	OUTPUT_PATH,
	JSON.stringify(
		{
			generated_at: new Date().toISOString(),
			source_categories: SOURCES.map(({ label, sourceUrl, categoryId, category }) => ({
				label,
				sourceUrl,
				categoryId,
				category
			})),
			counts: categorySummary(deduped),
			products: deduped
		},
		null,
		2
	)
);

console.log('Prepared', deduped.length, 'products', categorySummary(deduped));
console.log('Saved review payload to', OUTPUT_PATH);

await upsertProducts(client, deduped);
await deleteStaleSourceRows(client, deduped);

const sampleQueries = [
	'HP 240 G5',
	'HS04',
	'807611-131',
	'AL15-51M',
	'15-P214NIA',
	'HP Pavilion DM4-1062'
];
for (const query of sampleQueries) {
	const { data, error } = await client.rpc('search_active_products', {
		p_brand: null,
		p_category: null,
		p_in_stock: null,
		p_limit: 5,
		p_max_price: null,
		p_min_price: null,
		p_min_rating: null,
		p_offset: 0,
		p_query: query,
		p_sort: 'relevance'
	});
	if (error) throw error;
	const rows = data ?? [];
	console.log(
		`Search "${query}":`,
		rows.map((row) => `[${row.category}] ${row.title}`).join(' | ') || 'no results'
	);
}
