// Import IPC advanced-search display results for a keyword such as MNF601.
//
// Dry run:
//   node scripts/import-ipc-advanced-search-displays.mjs --keyword=MNF601
//
// Apply:
//   node scripts/import-ipc-advanced-search-displays.mjs --keyword=MNF601 --apply

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(root, '.firecrawl', 'ipc-advanced-search-import');
const auditFile = join(cacheDir, 'audit.json');
const parsedCacheFile = join(cacheDir, 'parsed-cache.json');

const WARRANTY = '6 months replacement warranty';
const EUR_TO_INR = 110.0195;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 30;
const DEFAULT_HEIGHT_CM = 8;
const DISPLAY_IMAGE =
	'https://www.power-x.in/cdn/shop/files/laptop-screen-156-40-pin-full-hdpowerx-the-technology-people-104400.png?v=1739959776&width=800';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refresh = args.has('--refresh');
const keyword = stringArg('--keyword=') || 'MNF601';
const limit = numericArg('--limit=');
const concurrency = numericArg('--concurrency=') || DEFAULT_CONCURRENCY;

function stringArg(prefix) {
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	return value ? value.slice(prefix.length).trim() : '';
}

function numericArg(prefix) {
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	if (!value) return 0;
	const parsed = Number(value.slice(prefix.length));
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function parseEnv() {
	const envText = readFileSync(join(root, '.env'), 'utf8');
	const env = {};
	for (const line of envText.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const index = trimmed.indexOf('=');
		if (index < 0) continue;
		env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
	}
	return env;
}

function loadJson(file, fallback) {
	if (refresh || !existsSync(file)) return fallback;
	return JSON.parse(readFileSync(file, 'utf8'));
}

function saveJson(file, value) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, JSON.stringify(value, null, 2));
}

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#034;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ');
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(?:p|div|li|tr|dd|dt|h[1-6])>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return stripHtml(value).replace(/\s+([,.)])/g, '$1').replace(/[(]\s+/g, '(').trim();
}

function truncate(value, max) {
	const text = cleanText(value);
	if (text.length <= max) return text;
	return text.slice(0, max - 1).trimEnd();
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

function uniqueUrls(values, max = Infinity) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		let text = String(value ?? '').trim();
		if (text.startsWith('//')) text = `https:${text}`;
		if (text.startsWith('/')) text = new URL(text, 'https://www.ipc-computer.eu').toString();
		if (!/^https?:\/\//i.test(text)) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function slugPart(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/~/g, '-')
		.replace(/[^A-Z0-9.-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function splitKeywords(values, max = 180) {
	const expanded = [];
	for (const value of values) {
		const text = cleanText(value);
		if (!text) continue;
		expanded.push(text);
		expanded.push(...text.split(/[\s,;/|()]+/).filter((token) => token.length >= 2));
	}
	return unique(expanded.map((value) => value.slice(0, 80)), max);
}

function convertedPrice(amount) {
	const value = Number(amount);
	if (!Number.isFinite(value) || value <= 0) return 3499;
	const converted = value * EUR_TO_INR;
	return Math.max(999, Math.round(converted / 50) * 50 - 1);
}

function buildMrp(price) {
	return Math.max(price + 500, Math.round((price * 1.18) / 50) * 50 - 1);
}

function urlId(url) {
	return String(url).match(/-(\d+)(?:[/?#]|$)/)?.[1] ?? String(url).match(/[?&]id=(\d+)/)?.[1] ?? '';
}

function stableHash(value) {
	let hash = 0;
	for (const char of String(value ?? '')) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return hash.toString(36);
}

function inferResultType(url) {
	if (/\/displayunits\//i.test(url)) return 'display unit';
	if (/\/display-\d+\/nup/i.test(url)) return 'model-specific display';
	return 'display';
}

function extractPartNumbers(text, keywordValue) {
	const tokens = String(text ?? '').match(/\b[A-Z0-9]{2,}(?:[-.][A-Z0-9]{1,})+\b|\b[A-Z]{2,}\d[A-Z0-9]{3,}\b|\b\d[A-Z0-9]{4,}\b/gi) ?? [];
	const keywordTokens = keywordValue
		? [...String(text ?? '').matchAll(new RegExp(`\\b[A-Z0-9.-]*${keywordValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Z0-9.-]*\\b`, 'gi'))].map((match) => match[0])
		: [];
	return unique([...keywordTokens, ...tokens].map((value) => value.toUpperCase()), 60);
}

function extractCompatibleModel(title) {
	const match = cleanText(title).match(/\bfor\s+(.+)$/i);
	return match ? cleanText(match[1]) : '';
}

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: {
					accept: 'text/html,*/*',
					'user-agent': 'LapKart IPC advanced search importer'
				},
				signal: AbortSignal.timeout(30000)
			});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
			return response.text();
		} catch (error) {
			lastError = error;
			if (attempt < 3) await sleep(attempt * 800);
		}
	}
	throw lastError;
}

async function mapLimit(values, limitValue, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workerCount = Math.min(Math.max(1, limitValue), Math.max(1, values.length));
	const workers = Array.from({ length: workerCount }, async () => {
		while (index < values.length) {
			const current = index;
			index += 1;
			results[current] = await mapper(values[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

function searchUrl(page = 1) {
	const params = new URLSearchParams({ keywords: keyword });
	if (page > 1) params.set('page', String(page));
	return `https://www.ipc-computer.eu/advanced_search_result.php?${params.toString()}`;
}

function parseMaxPage(html) {
	const decoded = decodeHtml(html);
	const pages = [1];
	for (const match of decoded.matchAll(/[?&]page=(\d+)/gi)) {
		pages.push(Number(match[1]));
	}
	return Math.max(...pages.filter((page) => Number.isInteger(page) && page > 0));
}

function parseExpectedCount(html) {
	const count = cleanText(String(html).match(/product-listing-count[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
	return Number(count) || 0;
}

function parseSearchResultCards(html, pageUrl, pageNumber) {
	const cards = [];
	let index = 0;
	for (const match of String(html ?? '').matchAll(/<div class="product-item[\s\S]*?(?=<div class="product-item|<nav|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/gi)) {
		const block = match[0];
		const href = block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["']stretched-link["']/i)?.[1] ?? '';
		const url = uniqueUrls([new URL(decodeHtml(href), pageUrl).toString()])[0] ?? '';
		const title = cleanText(block.match(/<h4\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? '');
		const image = uniqueUrls([block.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i)?.[1] ?? ''])[0] ?? '';
		const price = Number(block.match(/itemprop=["']price["']\s+content=["']([0-9.]+)["']/i)?.[1] ?? 0);
		const availability = cleanText(block.match(/<div\b[^>]*class=["']availability["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
		if (!url || !title) continue;
		index += 1;
		cards.push({ url, title, image, price, availability, searchPage: pageNumber, searchIndex: index });
	}
	return cards;
}

function parseDetailText(html) {
	const h1 = cleanText(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
	const title = cleanText(String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
	const pairs = [];
	for (const match of String(html ?? '').matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
		const label = cleanText(match[1]);
		const value = cleanText(match[2]);
		if (label || value) pairs.push(`${label}: ${value}`);
	}
	return unique([h1, title, ...pairs], 120).join('. ');
}

function parseAdvancedSearchProduct(entry, detailHtml) {
	const detailText = parseDetailText(detailHtml);
	const sourceId = urlId(entry.url) || slugPart(entry.title);
	const resultType = inferResultType(entry.url);
	const partNumbers = extractPartNumbers(`${entry.title} ${detailText}`, keyword);
	const compatibleModel = extractCompatibleModel(entry.title);
	const image = DISPLAY_IMAGE;
	const priceInr = convertedPrice(entry.price);
	const stock = /\bin stock\b|shipping today|available/i.test(entry.availability) ? 10 : 0;
	const specifications = {
		'Source': 'IPC Computer advanced search',
		'Advanced Search Keyword': keyword,
		'Result Type': resultType,
		'Source ID': sourceId,
		'Part Numbers': partNumbers.join(', '),
		'Compatible Device Models': compatibleModel,
		'Availability': entry.availability,
		'Source Price EUR': entry.price ? entry.price.toFixed(2) : ''
	};
	const title = truncate(entry.title, 190);
	const compatibility = truncate(
		[
			`IPC advanced-search match for ${keyword}`,
			partNumbers.length ? `Part numbers: ${partNumbers.join(', ')}` : '',
			compatibleModel ? `Compatible device model: ${compatibleModel}` : '',
			`Result type: ${resultType}`,
			'Match laptop model, FRU/part number, panel part number, connector, resolution and assembly type before ordering.'
		]
			.filter(Boolean)
			.join('. '),
		4000
	);

	return {
		title,
		brand: title.match(/\bLenovo\b/i) ? 'Lenovo' : 'Compatible',
		category: 'displays',
		image,
		images: image ? [image] : [],
		source_url: entry.url,
		description: truncate(
			[
				title,
				`Advanced search keyword: ${keyword}`,
				partNumbers.length ? `Part numbers: ${partNumbers.join(', ')}` : '',
				compatibleModel ? `Compatible model: ${compatibleModel}` : '',
				entry.availability,
				`Warranty: ${WARRANTY}`
			]
				.filter(Boolean)
				.join('. '),
			1200
		),
		sku: truncate(
			`IPC-ADV-DISPLAY-${slugPart(partNumbers[0] || keyword)}-${sourceId}-${stableHash(`${entry.searchPage}:${entry.searchIndex}:${entry.title}`)}`,
			120
		),
		specifications,
		search_keywords: splitKeywords([
			title,
			keyword,
			'display',
			'laptop display',
			'IPC Computer',
			resultType,
			compatibleModel,
			...partNumbers,
			detailText
		]),
		price: priceInr,
		selling_price: priceInr,
		cost_price: 0,
		mrp: buildMrp(priceInr),
		rating: 4.5,
		reviews: 0,
		stock,
		weight_kg: DEFAULT_WEIGHT_KG,
		length_cm: DEFAULT_LENGTH_CM,
		breadth_cm: DEFAULT_BREADTH_CM,
		height_cm: DEFAULT_HEIGHT_CM,
		compatibility,
		warranty: WARRANTY,
		highlights: unique(
			[
				'IPC advanced-search display match',
				`Keyword: ${keyword}`,
				partNumbers[0] ? `Part Number: ${partNumbers[0]}` : '',
				compatibleModel,
				resultType,
				WARRANTY
			],
			10
		),
		status: 'active',
		authenticity_grade: title.match(/\bLenovo\b/i) ? 'oem' : 'compatible',
		condition_grade: 'new',
		hsn_code: null,
		gst_rate: 18,
		doa_policy_days: 7,
		local_delivery_eligible: true,
		cod_eligible: true,
		cod_allowed: true,
		returnable: true,
		is_universal: false,
		clearance: false
	};
}

async function collectAdvancedSearchProducts(parsedCache) {
	const firstHtml = await fetchText(searchUrl(1));
	const maxPage = parseMaxPage(firstHtml);
	const expectedCount = parseExpectedCount(firstHtml);
	const pageUrls = Array.from({ length: maxPage }, (_, index) => searchUrl(index + 1));
	const pageHtmlByUrl = new Map([[searchUrl(1), firstHtml]]);
	const pageResults = await mapLimit(pageUrls, Math.min(5, concurrency), async (url) => {
		const html = pageHtmlByUrl.get(url) ?? (await fetchText(url));
		const page = Number(new URL(url).searchParams.get('page') ?? '1') || 1;
		return { url, entries: parseSearchResultCards(html, url, page) };
	});
	const entries = pageResults.flatMap((page) => page.entries);
	const limitedEntries = limit ? entries.slice(0, limit) : entries;
	const products = [];
	const errors = [];

	await mapLimit(limitedEntries, concurrency, async (entry, index) => {
		try {
			const cacheKey = `ipc-advanced:${keyword}:${entry.searchPage}:${entry.searchIndex}:${entry.url}:${entry.title}`;
			let parsed = parsedCache[cacheKey];
			if (!parsed) {
				const html = await fetchText(entry.url);
				parsed = parseAdvancedSearchProduct(entry, html);
				parsedCache[cacheKey] = parsed;
			}
			if (parsed) products.push(parsed);
		} catch (error) {
			errors.push({ url: entry.url, title: entry.title, error: error instanceof Error ? error.message : String(error) });
		}
		if ((index + 1) % 50 === 0 || index + 1 === limitedEntries.length) {
			saveJson(parsedCacheFile, parsedCache);
			process.stdout.write(`IPC advanced products ${index + 1}/${limitedEntries.length}\r`);
		}
	});
	process.stdout.write('\n');

	return {
		expectedCount,
		discovered: entries.length,
		pageCount: pageUrls.length,
		products,
		errors
	};
}

async function upsertProducts(supabase, products) {
	let upserted = 0;
	const errors = [];
	for (let index = 0; index < products.length; index += 100) {
		const batch = products.slice(index, index + 100);
		const { error } = await supabase.from('products').upsert(batch, { onConflict: 'sku' });
		if (error) {
			errors.push({ batch: index / 100 + 1, error: error.message });
			continue;
		}
		upserted += batch.length;
		process.stdout.write(`Supabase upsert ${Math.min(index + batch.length, products.length)}/${products.length}\r`);
	}
	process.stdout.write('\n');
	return { upserted, errors };
}

const env = parseEnv();
const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error('Missing SUPABASE_URL/PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

mkdirSync(cacheDir, { recursive: true });
const parsedCache = loadJson(parsedCacheFile, {});

console.log(
	JSON.stringify(
		{
			mode: apply ? 'apply' : 'dry-run',
			keyword,
			limit,
			concurrency,
			rates: {
				EUR_TO_INR,
				rateDate: '2026-06-12'
			}
		},
		null,
		2
	)
);

const result = await collectAdvancedSearchProducts(parsedCache);
const products = result.products;
const byStock = products.reduce(
	(acc, row) => {
		if (row.stock > 0) acc.inStock += 1;
		else acc.outOfStock += 1;
		return acc;
	},
	{ inStock: 0, outOfStock: 0 }
);

let applyResult = { upserted: 0, errors: [] };
if (apply && products.length > 0) {
	const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
	applyResult = await upsertProducts(supabase, products);
}

saveJson(parsedCacheFile, parsedCache);
saveJson(auditFile, {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	keyword,
	expectedCount: result.expectedCount,
	discovered: result.discovered,
	pageCount: result.pageCount,
	imported: products.length,
	errors: result.errors,
	byStock,
	upserted: applyResult.upserted,
	upsertErrors: applyResult.errors,
	samples: products.slice(0, 20).map((row) => ({
		title: row.title,
		sku: row.sku,
		price: row.price,
		stock: row.stock,
		image: row.image,
		compatibility: row.compatibility.slice(0, 300),
		source_url: row.source_url
	}))
});

console.log(
	JSON.stringify(
		{
			mode: apply ? 'apply' : 'dry-run',
			keyword,
			expectedCount: result.expectedCount,
			discovered: result.discovered,
			pageCount: result.pageCount,
			imported: products.length,
			errors: result.errors.length,
			byStock,
			upserted: applyResult.upserted,
			upsertErrors: applyResult.errors.length,
			auditFile,
			sample: products.slice(0, 8).map((row) => ({
				title: row.title,
				sku: row.sku,
				price: row.price,
				stock: row.stock
			}))
		},
		null,
		2
	)
);
