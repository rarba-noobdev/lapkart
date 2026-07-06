// Update display pricing from Indian in-stock competitor product pages.
//
// Dry run:
//   node scripts/update-display-prices-india.mjs
//
// Apply:
//   node scripts/update-display-prices-india.mjs --apply
//
// Rules:
// - Indian sources only.
// - A source price must come from a product/catalog page with an in-stock signal.
// - DB updates use the lowest matched price.
// - Exact panel/OEM part-number matches are always eligible.
// - Model+spec matches are eligible only when size + resolution match and the source is model-specific.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join(root, 'outputs', `india-display-pricing-${runStamp}`);
const cacheDir = join(root, '.firecrawl', 'india-display-pricing-cache');

const apply = process.argv.includes('--apply');
const refresh = process.argv.includes('--refresh');
const quoteLimit = numericArg('--quote-limit=');
const rowLimit = numericArg('--row-limit=');
const iServiceLimit = numericArg('--iservice-limit=');
const concurrency = numericArg('--concurrency=') || 8;

const MIN_VALID_PRICE = 1200;
const MAX_VALID_PRICE = 80000;

const SOURCE_DOMAINS = {
	lapgadgets: 'lapgadgets.co.in',
	powerx: 'power-x.in',
	iservice: 'iserviceindia.in'
};

const KNOWN_BRANDS = [
	'Acer',
	'Apple',
	'Asus',
	'Dell',
	'HP',
	'Lenovo',
	'LG',
	'MSI',
	'Samsung',
	'Toshiba',
	'Fujitsu',
	'Sony',
	'Microsoft',
	'Honor',
	'Avita'
];

const MODEL_FAMILIES = [
	'ThinkPad',
	'IdeaPad',
	'ThinkBook',
	'Yoga',
	'Legion',
	'LOQ',
	'Inspiron',
	'Latitude',
	'Vostro',
	'Precision',
	'XPS',
	'Alienware',
	'Pavilion',
	'EliteBook',
	'ProBook',
	'ZBook',
	'Victus',
	'Omen',
	'Envy',
	'Spectre',
	'Aspire',
	'TravelMate',
	'Swift',
	'Nitro',
	'Predator',
	'Extensa',
	'Vivobook',
	'VivoBook',
	'ZenBook',
	'ExpertBook',
	'TUF',
	'ROG',
	'Modern',
	'Katana',
	'Creator',
	'Prestige',
	'Summit',
	'Galaxy Book',
	'Laptop',
	'Chromebook'
].sort((a, b) => b.length - a.length);

function numericArg(prefix) {
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	if (!value) return 0;
	const parsed = Number(value.slice(prefix.length));
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function loadEnv() {
	const text = readFileSync(join(root, '.env'), 'utf8');
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const index = line.indexOf('=');
		if (index < 0) continue;
		let value = line.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[line.slice(0, index).trim()] ||= value;
	}
}

function saveJson(file, value) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(value, null, 2));
}

function loadJson(file, fallback) {
	if (refresh || !existsSync(file)) return fallback;
	return JSON.parse(readFileSync(file, 'utf8'));
}

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
		.replace(/&quot;|&#034;/g, '"')
		.replace(/&#039;|&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ');
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<br\s*\/?\s*>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return stripHtml(value)
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
}

function normalizeCompact(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '');
}

function unique(values, max = Infinity) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = cleanText(value);
		if (!text) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function moneyFromMinor(prices, key = 'price') {
	const minor = Number(prices?.currency_minor_unit ?? 2);
	const raw = Number(prices?.[key] ?? 0);
	if (!Number.isFinite(raw) || raw <= 0) return 0;
	return Math.round(raw / 10 ** minor);
}

function validPrice(value) {
	const price = Math.round(Number(value));
	return Number.isFinite(price) && price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE ? price : 0;
}

function buildMrp(price, currentMrp = 0) {
	return Math.max(
		Math.round(Number(currentMrp) || 0),
		price + 500,
		Math.round((price * 1.18) / 50) * 50 - 1
	);
}

function partNumberScore(value) {
	const token = cleanText(value)
		.toUpperCase()
		.replace(/^[^A-Z0-9]+|[^A-Z0-9)]+$/g, '');
	if (token.length < 5 || token.length > 34 || !/[A-Z]/.test(token) || !/\d/.test(token)) return 0;
	if (
		/\b(?:REPLACEMENT|BRACKETS?|DISPLAY|SCREEN|LAPTOP|PANEL|TOUCH|FHD|UHD|QHD|LCD|LED|IPS|INCH|FULLHD|MODEL|ORIGINAL|COMPATIBLE)\b/i.test(
			token
		)
	) {
		return 0;
	}
	if (/^(?:30|40)[-_/ ]?PINS?$/i.test(token)) return 0;
	if (/^\d{3,4}X\d{3,4}$/i.test(token)) return 0;
	if (/^(?:I[3579]-?\d|RYZEN|CORE|PENTIUM|CELERON)[A-Z0-9.-]*$/i.test(token)) return 0;
	let score = 0;
	if (/^(?:LP|NV|NT|LTN|LQ|NE|LM|B|N)\d{3}[A-Z0-9]/.test(token)) score += 8;
	if (/^(?:5D|01A|02D|03T|04X|0[A-Z0-9])[A-Z0-9.-]{5,}$/.test(token)) score += 6;
	if (/^[A-Z]\d{5}-\d{3}$/.test(token)) score += 7;
	if (/^[A-Z0-9]{2,}-[A-Z0-9.-]{2,}$/.test(token)) score += 3;
	if (/[().-]/.test(token)) score += 2;
	if (token.length >= 8) score += 2;
	return score;
}

function extractPartNumbers(...values) {
	const source = cleanText(values.filter(Boolean).join(' ')).toUpperCase();
	const matches = [
		...(source.match(/\b[A-Z0-9][A-Z0-9()./-]{3,33}\b/g) ?? []),
		...(source.match(/\b(?:LP|LTN|B|N|NV|NT|M|HB|LQ|LM|NE)\d{3}[A-Z0-9()./-]{3,}\b/g) ?? [])
	];
	return unique(
		matches
			.map((value) => value.replace(/\/$/, ''))
			.filter((value) => partNumberScore(value) >= 5)
			.sort((a, b) => partNumberScore(b) - partNumberScore(a) || b.length - a.length),
		80
	);
}

function extractSize(value) {
	const text = cleanText(value);
	const match = text.match(/\b(\d{2}(?:\.\d)?)\s*(?:inch|inches|in\b|["”])/i);
	return match ? Number(match[1]) : 0;
}

function extractResolution(value) {
	const match = cleanText(value).match(/\b(\d{3,4})\s*(?:x|×)\s*(\d{3,4})\b/i);
	return match ? `${Number(match[1])}x${Number(match[2])}` : '';
}

function extractPins(value) {
	const match = cleanText(value).match(/\b(30|40)\s*(?:pin|pins)\b/i);
	return match ? Number(match[1]) : 0;
}

function modelKey(value) {
	const text = cleanText(value)
		.replace(/\b(?:laptop|screen|display|lcd|led|panel|replacement|compatible|for|with|touch|digitizer|assembly|frame|black|silver|inch|inches|ips|fhd|hd|qhd|uhd|wuxga|full hd)\b/gi, ' ')
		.replace(/\b\d{3,4}\s*(?:x|×)\s*\d{3,4}\b/gi, ' ')
		.replace(/\b(?:30|40)\s*pin\b/gi, ' ')
		.replace(/\b\d{2}(?:\.\d)?\s*(?:inch|inches|["”])\b/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	const key = normalizeCompact(text);
	return key.length >= 7 && /\d/.test(key) ? key : '';
}

function extractModelKeys(...values) {
	const text = cleanText(values.filter(Boolean).join(' '));
	const candidates = [];
	const brandPattern = KNOWN_BRANDS.map((brand) => brand.replace(/\s+/g, '[ -]?')).join('|');
	const familyPattern = MODEL_FAMILIES.map((family) => family.replace(/\s+/g, '[ -]?')).join('|');
	for (const match of text.matchAll(
		new RegExp(
			`\\b(?:(?:${brandPattern})\\s+)?(?:${familyPattern})\\s+[A-Z0-9][A-Z0-9()\\-/ ]{1,45}`,
			'gi'
		)
	)) {
		candidates.push(match[0]);
	}
	for (const match of text.matchAll(
		/\b(?:[A-Z]{1,4}\d{2,5}[A-Z0-9-]*|\d{2}[A-Z]{1,2}\d{2,4}|[A-Z]\d{2,4}-[A-Z0-9]{2,6})\b/gi
	)) {
		candidates.push(match[0]);
	}
	return unique(candidates.map(modelKey).filter(Boolean), 80);
}

function modelKeysFromRow(row) {
	const specs = row.specifications && typeof row.specifications === 'object' ? row.specifications : {};
	const table = Array.isArray(specs['Compatible Device Model Table'])
		? specs['Compatible Device Model Table'].map((item) => `${item.brand ?? ''} ${item.model ?? ''}`)
		: [];
	return extractModelKeys(
		row.title,
		row.compatibility,
		...(row.search_keywords ?? []),
		specs['Compatible Device Models'],
		...table
	);
}

function rowIdentifiers(row) {
	const specs = row.specifications && typeof row.specifications === 'object' ? row.specifications : {};
	const partTable = Array.isArray(specs['Panel Part Number Table'])
		? specs['Panel Part Number Table'].map((item) => item.value)
		: [];
	const partNumbers = extractPartNumbers(
		row.title,
		row.sku,
		specs['Panel Part Number'],
		specs['Primary Part Number'],
		specs['Sub-Partnumbers'],
		specs['Bliss Panel Part Numbers'],
		specs['MPN (Manufacturer Part Number)'],
		...partTable
	);
	const joined = [
		row.title,
		row.compatibility,
		specs.Size,
		specs['Screen Size'],
		specs.Resolution,
		specs.Pixels,
		specs['Connector Pins'],
		specs['Video Connector']
	].join(' ');
	return {
		partNumbers,
		partKeys: new Set(partNumbers.map(normalizeCompact)),
		modelKeys: new Set(modelKeysFromRow(row)),
		size: extractSize(joined),
		resolution: extractResolution(joined),
		pins: extractPins(joined)
	};
}

function quoteIdentifiers(quote) {
	const partNumbers = extractPartNumbers(quote.title, quote.sku, quote.description, quote.url);
	const modelKeys = extractModelKeys(quote.title, quote.description, quote.url);
	const joined = [quote.title, quote.description].join(' ');
	return {
		...quote,
		partNumbers,
		partKeys: new Set(partNumbers.map(normalizeCompact)),
		modelKeys: new Set(modelKeys),
		size: extractSize(joined),
		resolution: extractResolution(joined),
		pins: extractPins(joined)
	};
}

async function fetchWithRetry(url, options = {}) {
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await fetch(url, {
				...options,
				headers: {
					'user-agent': 'Mozilla/5.0 LapKart Indian display pricing updater',
					accept: '*/*',
					...(options.headers ?? {})
				},
				signal: AbortSignal.timeout(options.timeout ?? 45000)
			});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			return response;
		} catch (error) {
			lastError = error;
			if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
		}
	}
	throw lastError;
}

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workers = Array.from({ length: Math.min(Math.max(1, limit), values.length || 1) }, async () => {
		while (index < values.length) {
			const current = index;
			index += 1;
			results[current] = await mapper(values[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function collectLapGadgets() {
	const quotes = [];
	let totalPages = 1;
	for (let page = 1; page <= totalPages; page += 1) {
		const url = `https://lapgadgets.co.in/wp-json/wc/store/v1/products?per_page=100&page=${page}&search=laptop%20screen`;
		const response = await fetchWithRetry(url);
		totalPages = Number(response.headers.get('x-wp-totalpages') ?? totalPages) || totalPages;
		const products = await response.json();
		for (const product of products) {
			const price = validPrice(moneyFromMinor(product.prices, 'price'));
			const title = cleanText(product.name);
			const description = cleanText(
				[
					product.short_description,
					product.description,
					...(product.categories ?? []).map((category) => category.name),
					...(product.images ?? []).map((image) => image.alt || image.name)
				].join(' ')
			);
			if (!price || product.is_in_stock === false || !/\b(screen|display|lcd|led|panel)\b/i.test(title)) {
				continue;
			}
			quotes.push({
				source: 'LapGadgets',
				domain: SOURCE_DOMAINS.lapgadgets,
				url: product.permalink,
				title,
				sku: String(product.sku ?? product.id ?? ''),
				description,
				price,
				inStock: true
			});
		}
		process.stdout.write(`LapGadgets ${page}/${totalPages}\r`);
	}
	process.stdout.write('\n');
	return quotes;
}

async function collectPowerX() {
	const quotes = [];
	for (let page = 1; ; page += 1) {
		const response = await fetchWithRetry(`https://www.power-x.in/products.json?limit=250&page=${page}`);
		const json = await response.json();
		const products = json.products ?? [];
		if (!products.length) break;
		for (const product of products) {
			const text = cleanText([product.title, product.handle, product.body_html, product.product_type].join(' '));
			if (!/\b(screen|display|lcd|led|panel)\b/i.test(text) || /\bmonitor\b/i.test(text)) continue;
			const variants = product.variants ?? [];
			const availableVariants = variants.filter((variant) => variant.available !== false);
			if (!availableVariants.length) continue;
			const prices = availableVariants.map((variant) => validPrice(variant.price)).filter(Boolean);
			const price = prices.length ? Math.min(...prices) : 0;
			if (!price) continue;
			quotes.push({
				source: 'Power-X',
				domain: SOURCE_DOMAINS.powerx,
				url: `https://www.power-x.in/products/${product.handle}`,
				title: cleanText(product.title),
				sku: cleanText(availableVariants[0]?.sku ?? String(product.id ?? '')),
				description: text,
				price,
				inStock: true
			});
		}
		process.stdout.write(`Power-X page ${page} (${quotes.length} quotes)\r`);
	}
	process.stdout.write('\n');
	return quotes;
}

function parseProductJsonLd(html) {
	for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
		try {
			const parsed = JSON.parse(match[1]);
			const candidates = Array.isArray(parsed) ? parsed : [parsed];
			const product = candidates.find((item) => item?.['@type'] === 'Product');
			if (product) return product;
		} catch {
			// ignore malformed non-product JSON-LD
		}
	}
	return null;
}

async function collectIService() {
	const sitemapCache = join(cacheDir, 'iservice-product-urls.json');
	let urls = loadJson(sitemapCache, null);
	if (!urls) {
		const response = await fetchWithRetry('https://www.iserviceindia.in/sitemap-products.xml');
		const xml = await response.text();
		urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
			.map((match) => match[1])
			.filter((url) => /\/product\/laptop-lcd-display-screen-/i.test(url));
		saveJson(sitemapCache, urls);
	}
	const selected = urls.slice(0, iServiceLimit || urls.length);
	const htmlCacheFile = join(cacheDir, 'iservice-products.json');
	const cache = loadJson(htmlCacheFile, {});
	const quotes = [];
	await mapLimit(selected, concurrency, async (url, index) => {
		try {
			let product = cache[url];
			if (!product) {
				const response = await fetchWithRetry(url, { timeout: 60000 });
				product = parseProductJsonLd(await response.text()) ?? { error: 'missing product jsonld' };
				cache[url] = product;
			}
			if (!product.error) {
				const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
				const price = validPrice(offer?.price);
				const availability = String(offer?.availability ?? '');
				const title = cleanText(product.name);
				if (price && /InStock/i.test(availability) && /\b(screen|display|lcd)\b/i.test(title)) {
					quotes.push({
						source: 'iServiceIndia',
						domain: SOURCE_DOMAINS.iservice,
						url,
						title,
						sku: cleanText(product.sku),
						description: cleanText(product.description),
						price,
						inStock: true
					});
				}
			}
		} catch (error) {
			cache[url] = { error: error instanceof Error ? error.message : String(error) };
		}
		if ((index + 1) % 25 === 0 || index + 1 === selected.length) {
			saveJson(htmlCacheFile, cache);
			process.stdout.write(`iService ${index + 1}/${selected.length}\r`);
		}
	});
	process.stdout.write('\n');
	saveJson(htmlCacheFile, cache);
	return quotes;
}

async function fetchDisplayRows(supabase) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		let query = supabase
			.from('products')
			.select(
				'id,title,sku,brand,price,selling_price,mrp,stock,status,compatibility,search_keywords,specifications'
			)
			.eq('category', 'displays')
			.range(from, from + 999)
			.order('id');
		if (rowLimit) query = query.limit(rowLimit);
		const { data, error } = await query;
		if (error) throw new Error(`Failed to read displays: ${error.message}`);
		rows.push(...(data ?? []));
		if (rowLimit || !data || data.length < 1000) break;
	}
	return rows;
}

function intersects(setA, setB) {
	for (const value of setA) if (setB.has(value)) return value;
	return '';
}

function specsCompatible(rowId, quoteId) {
	if (rowId.size && quoteId.size && Math.abs(rowId.size - quoteId.size) > 0.15) return false;
	if (rowId.resolution && quoteId.resolution && rowId.resolution !== quoteId.resolution) return false;
	if (rowId.pins && quoteId.pins && rowId.pins !== quoteId.pins) return false;
	return true;
}

function matchQuotes(row, rowId, quotes) {
	const matches = [];
	for (const quote of quotes) {
		if (!specsCompatible(rowId, quote)) continue;
		const partMatch = intersects(rowId.partKeys, quote.partKeys);
		if (partMatch) {
			matches.push({ quote, method: 'exact_part', key: partMatch, confidence: 100 });
			continue;
		}
		const modelMatch = intersects(rowId.modelKeys, quote.modelKeys);
		if (
			modelMatch &&
			quote.modelKeys.size > 0 &&
			(rowId.size || rowId.resolution || rowId.pins) &&
			(quote.size || quote.resolution || quote.pins)
		) {
			const confidence =
				70 + Number(Boolean(rowId.size && quote.size)) * 8 + Number(Boolean(rowId.pins && quote.pins)) * 8;
			matches.push({ quote, method: 'model_spec', key: modelMatch, confidence });
		}
	}
	return matches.sort(
		(a, b) => a.quote.price - b.quote.price || b.confidence - a.confidence || a.quote.title.localeCompare(b.quote.title)
	);
}

function updatePatch(row, price) {
	return {
		price,
		selling_price: price,
		mrp: buildMrp(price, row.mrp),
		stock: Math.max(Number(row.stock ?? 0), 5),
		updated_at: new Date().toISOString()
	};
}

function csvEscape(value) {
	const text = String(value ?? '');
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, columns) {
	const csv = [
		columns.join(','),
		...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(','))
	].join('\n');
	writeFileSync(file, `${csv}\n`);
}

loadEnv();
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

console.log(
	JSON.stringify({
		mode: apply ? 'apply' : 'dry-run',
		indiaSources: Object.values(SOURCE_DOMAINS),
		quoteLimit,
		rowLimit,
		iServiceLimit: iServiceLimit || 'all',
		concurrency
	})
);

const [displayRows, lapGadgetsQuotes, powerXQuotes, iServiceQuotes] = await Promise.all([
	fetchDisplayRows(supabase),
	collectLapGadgets(),
	collectPowerX(),
	collectIService()
]);

const rawQuotes = [...lapGadgetsQuotes, ...powerXQuotes, ...iServiceQuotes]
	.map(quoteIdentifiers)
	.filter((quote) => quote.inStock && validPrice(quote.price))
	.filter((quote) => quote.partKeys.size > 0 || quote.modelKeys.size > 0);
const quotes = (quoteLimit ? rawQuotes.slice(0, quoteLimit) : rawQuotes).sort(
	(a, b) => a.price - b.price || a.source.localeCompare(b.source)
);

const rowsWithIds = displayRows.map((row) => ({ row, ids: rowIdentifiers(row) }));
const updates = [];
const reviewOnly = [];
for (const { row, ids } of rowsWithIds) {
	const matches = matchQuotes(row, ids, quotes);
	if (!matches.length) continue;
	const winner = matches[0];
	const patch = updatePatch(row, winner.quote.price);
	const currentPrice = Math.round(Number(row.selling_price ?? row.price ?? 0));
	const item = {
		id: row.id,
		title: row.title,
		sku: row.sku,
		current_price: currentPrice,
		new_price: winner.quote.price,
		current_stock: row.stock,
		new_stock: patch.stock,
		method: winner.method,
		match_key: winner.key,
		confidence: winner.confidence,
		source: winner.quote.source,
		source_url: winner.quote.url,
		source_title: winner.quote.title,
		source_price: winner.quote.price,
		alternative_count: matches.length - 1,
		alternative_sources: matches
			.slice(1, 5)
			.map((match) => `${match.quote.source}: ${match.quote.price} (${match.method})`)
			.join(' | '),
		patch
	};
	if (winner.method === 'exact_part' || winner.confidence >= 78) updates.push(item);
	else reviewOnly.push(item);
}

let applied = 0;
const applyErrors = [];
if (apply) {
	for (let index = 0; index < updates.length; index += 1) {
		const item = updates[index];
		const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
		if (error) applyErrors.push({ id: item.id, title: item.title, error: error.message });
		else applied += 1;
		if ((index + 1) % 100 === 0 || index + 1 === updates.length) {
			process.stdout.write(`Supabase updates ${index + 1}/${updates.length}\r`);
		}
	}
	if (updates.length) process.stdout.write('\n');
}

const bySource = {};
for (const quote of quotes) bySource[quote.source] = (bySource[quote.source] ?? 0) + 1;
const byMethod = {};
for (const update of updates) byMethod[update.method] = (byMethod[update.method] ?? 0) + 1;

const audit = {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	rules: {
		indiaSources: Object.values(SOURCE_DOMAINS),
		minValidPrice: MIN_VALID_PRICE,
		maxValidPrice: MAX_VALID_PRICE,
		exactPartMatches: 'eligible',
		modelSpecMatches: 'eligible only when size/resolution/pins evidence is compatible'
	},
	counts: {
		displayRows: displayRows.length,
		rawQuotes: rawQuotes.length,
		quotes: quotes.length,
		quotesBySource: bySource,
		plannedUpdates: updates.length,
		plannedByMethod: byMethod,
		reviewOnly: reviewOnly.length,
		applied,
		applyErrors: applyErrors.length
	},
	updates,
	reviewOnly,
	quotes: quotes.map((quote) => ({
		source: quote.source,
		url: quote.url,
		title: quote.title,
		price: quote.price,
		partNumbers: quote.partNumbers,
		modelKeys: [...quote.modelKeys],
		size: quote.size,
		resolution: quote.resolution,
		pins: quote.pins
	})),
	applyErrors
};

saveJson(join(outDir, 'audit.json'), audit);
saveJson(join(outDir, 'updates.json'), updates);
saveJson(join(outDir, 'review-only.json'), reviewOnly);
saveJson(join(outDir, 'quotes.json'), audit.quotes);
writeCsv(join(outDir, 'updates.csv'), updates, [
	'id',
	'title',
	'sku',
	'current_price',
	'new_price',
	'current_stock',
	'new_stock',
	'method',
	'match_key',
	'confidence',
	'source',
	'source_url',
	'source_title',
	'source_price',
	'alternative_count',
	'alternative_sources'
]);
writeCsv(join(outDir, 'review-only.csv'), reviewOnly, [
	'id',
	'title',
	'sku',
	'current_price',
	'new_price',
	'method',
	'match_key',
	'confidence',
	'source',
	'source_url',
	'source_title',
	'source_price'
]);

console.log(
	JSON.stringify(
		{
			mode: audit.mode,
			...audit.counts,
			outDir,
			sampleUpdates: updates.slice(0, 10).map((item) => ({
				title: item.title,
				current: item.current_price,
				next: item.new_price,
				method: item.method,
				source: item.source,
				key: item.match_key
			}))
		},
		null,
		2
	)
);
