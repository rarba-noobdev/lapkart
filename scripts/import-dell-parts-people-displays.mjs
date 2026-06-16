// Additive Dell LCD display importer for Parts-People.
//
// Dry run:
//   node scripts/import-dell-parts-people-displays.mjs
//   node scripts/import-dell-parts-people-displays.mjs --only-size=17.3
//
// Apply:
//   node scripts/import-dell-parts-people-displays.mjs --apply
//
// Venue models are intentionally skipped.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(root, '.firecrawl', 'dell-display-import');
const auditFile = join(cacheDir, 'audit.json');
const parsedCacheFile = join(cacheDir, 'parsed-cache.json');

const CATEGORY_URL = 'https://www.parts-people.com/shop/dell-parts/category_lcd-screen/';
const USD_TO_INR = 95.12;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 30;
const DEFAULT_HEIGHT_CM = 8;
const WARRANTY = '1 year Parts-People warranty';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refresh = args.has('--refresh');
const skipExisting = !args.has('--no-skip-existing');
const limit = numericArg('--limit=');
const concurrency = numericArg('--concurrency=') || DEFAULT_CONCURRENCY;
const onlySize = stringArg('--only-size=');

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
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|li|tr|dd|dt|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s+/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function cleanText(value) {
	return stripHtml(value).replace(/\s+/g, ' ').replace(/\s+([,.)])/g, '$1').trim();
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
		if (text.startsWith('/')) text = new URL(text, 'https://www.parts-people.com').toString();
		if (!/^https?:\/\//i.test(text)) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function sourceUrlKey(value) {
	return String(value ?? '')
		.trim()
		.replace(/\/+$/, '')
		.toLowerCase();
}

function slugPart(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9.-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function splitKeywords(values, max = 160) {
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
	const converted = value * USD_TO_INR;
	return Math.max(999, Math.round(converted / 50) * 50 - 1);
}

function buildMrp(price) {
	return Math.max(price + 500, Math.round((price * 1.18) / 50) * 50 - 1);
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
					'user-agent': 'LapKart Dell display importer'
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

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workerCount = Math.min(Math.max(1, limit), Math.max(1, values.length));
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

function categoryUrl(page) {
	return page <= 1 ? CATEGORY_URL : new URL(`${page}/`, CATEGORY_URL).toString();
}

function parseMaxPage(html) {
	const pages = [1];
	for (const match of String(html ?? '').matchAll(/category_lcd-screen\/(\d+)\/?/gi)) {
		pages.push(Number(match[1]));
	}
	return Math.max(...pages.filter((page) => Number.isInteger(page) && page > 0));
}

function parseListProducts(html, pageUrl) {
	const products = [];
	const seen = new Set();
	for (const match of String(html ?? '').matchAll(
		/<a\b[^>]*href=["']([^"']*index\.php\?action=item&id=(\d+)[^"']*)["'][^>]*title=(["'])([\s\S]*?)\3[^>]*>\s*<img\b([^>]*)>/gi
	)) {
		const href = new URL(decodeHtml(match[1]), pageUrl).toString();
		const id = match[2];
		const title = cleanText(match[4]);
		const image = decodeHtml(match[5].match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? '');
		if (!title || seen.has(id)) continue;
		seen.add(id);
		products.push({ id, url: href, title, image: uniqueUrls([image])[0] ?? '' });
	}
	return products;
}

function metaContent(html, nameOrProperty) {
	const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(
		`<meta\\b[^>]*(?:name|property|itemprop)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
		'i'
	);
	return cleanText(String(html ?? '').match(pattern)?.[1] ?? '');
}

function parseTableSpecs(html) {
	const specs = {};
	for (const match of String(html ?? '').matchAll(/<tr>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
		const label = cleanText(match[1]);
		const value = cleanText(match[2]);
		if (!label || !value) continue;
		specs[label] = value;
	}
	return specs;
}

function parseDescriptionHtml(html) {
	return String(html ?? '').match(/<p\b[^>]*itemprop=["']description["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
}

function linesFromDescription(descriptionHtml) {
	return stripHtml(descriptionHtml)
		.split(/\n+/)
		.map((line) => cleanText(line))
		.filter(Boolean);
}

function parseCompatibleModels(lines) {
	const models = [];
	let collecting = false;
	for (const line of lines) {
		if (/^Compatible Dell Laptops:?$/i.test(line)) {
			collecting = true;
			continue;
		}
		if (collecting && /^(DP\/N|Dell Part|LCD Dell Part|BOE|AUO|LG|Samsung|Sharp|Size|Resolution|Includes|NOTE:|$)/i.test(line)) {
			break;
		}
		if (collecting) models.push(line);
	}
	return unique(models, 80);
}

function valueAfter(lines, labelPattern) {
	const pattern = new RegExp(`^${labelPattern}\\s*:?\\s*(.+)$`, 'i');
	for (const line of lines) {
		const match = line.match(pattern);
		if (match) return cleanText(match[1]);
	}
	return '';
}

function extractSize(title, lines) {
	const fromLine = valueAfter(lines, 'Size');
	if (fromLine) return fromLine;
	return cleanText(title.match(/(\d{1,2}(?:\.\d)?")/)?.[1] ?? '');
}

function screenSizeFromRow(row) {
	const value = row?.specifications?.Size ?? row?.specifications?.['Screen Size'] ?? '';
	const match = String(value).match(/(\d{1,2}(?:\.\d)?)/);
	return match ? Number(match[1]) : 0;
}

function isRequestedScreenSize(row) {
	if (!onlySize) return true;
	const actual = screenSizeFromRow(row);
	const requested = Number(onlySize.replace(',', '.'));
	if (!Number.isFinite(actual) || !Number.isFinite(requested)) return false;
	return Math.abs(actual - requested) < 0.05;
}

function extractResolution(title, lines) {
	const fromLine = valueAfter(lines, 'Resolution');
	if (fromLine) return fromLine;
	return cleanText(title.match(/\b(?:HD|WXGAHD|FHD\+?|QHD\+?|UHD|4K|3K|WQXGA|OLED)\b(?:\s*\([^)]+\))?/i)?.[0] ?? '');
}

function extractConnector(title, lines) {
	const text = `${title}\n${lines.join('\n')}`;
	return cleanText(text.match(/\b(?:30|40|50)\s*Pin\b/i)?.[0] ?? '');
}

function extractTouch(title, lines) {
	const text = `${title}\n${lines.join('\n')}`;
	if (/\b(?:Non[-\s]?Touch|NT)\b/i.test(text)) return 'Non-touch';
	if (/\b(?:Touchscreen|Touch Panel|TS)\b/i.test(text)) return 'Touchscreen';
	return '';
}

function parseDetailProduct(entry, html) {
	const title =
		cleanText(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') ||
		entry.title;
	const descriptionHtml = parseDescriptionHtml(html);
	const lines = linesFromDescription(descriptionHtml);
	const tableSpecs = parseTableSpecs(html);
	const sku = metaContent(html, 'sku') || metaContent(html, 'mpn') || tableSpecs['Part Number'] || '';
	if (!sku || !title) return { skipped: true, reason: 'missing sku or title', row: null };

	const description = cleanText(descriptionHtml) || metaContent(html, 'description') || title;
	const compatibleModels = parseCompatibleModels(lines);
	const dellPartNumbers = unique(
		[
			valueAfter(lines, 'DP\\/N'),
			valueAfter(lines, 'LCD Dell Part Numbers'),
			valueAfter(lines, 'Dell Part Numbers'),
			tableSpecs['Part Number'],
			sku
		]
			.flatMap((value) => String(value ?? '').split(/[,;]/))
			.map((value) => value.replace(/\bDP\/N\b:?/i, '').trim()),
		30
	);
	const manufacturerPartNumbers = unique(
		[
			valueAfter(lines, '[A-Z0-9 ]*Manufacturer P\\/N'),
			valueAfter(lines, 'Manufacturer P\\/N'),
			valueAfter(lines, 'BOE Manufacturer P\\/N'),
			valueAfter(lines, 'AUO Manufacturer P\\/N'),
			valueAfter(lines, 'LG Manufacturer P\\/N')
		]
			.flatMap((value) => String(value ?? '').split(/[,;]/))
			.map((value) => value.trim()),
		30
	);
	const images = uniqueUrls(
		[
			...[...String(html).matchAll(/showimg\([^,]+,\s*["']([^"']*\/images\/products\/[^"']+)["']/gi)].map(
				(match) => match[1]
			),
			...[...String(html).matchAll(/\bsrc=["']([^"']*\/images\/products\/[^"']+)["']/gi)].map(
				(match) => match[1]
			),
			entry.image
		],
		8
	);
	const image = images[0] ?? entry.image;
	if (!image) return { skipped: true, reason: 'missing image', row: null };

	const isVenue = /\bvenue\b/i.test(`${title} ${description} ${compatibleModels.join(' ')}`);
	if (isVenue) return { skipped: true, reason: 'venue model', row: null };

	const priceUsd =
		Number(String(html).match(/itemprop=["']price["'][^>]*>([0-9.]+)/i)?.[1] ?? 0) ||
		Number(String(html).match(/\$([0-9]+\.[0-9]{2})/i)?.[1] ?? 0);
	const priceInr = convertedPrice(priceUsd);
	const stockText =
		cleanText(String(html).match(/<div class=["']pv-stock-box["'][\s\S]*?<\/div>/i)?.[0] ?? '') ||
		metaContent(html, 'availability') ||
		'';
	const stock = /out of stock|sold out|unavailable/i.test(stockText)
		? 0
		: Number(stockText.match(/Only\s+(\d+)\s+Left/i)?.[1] ?? 10);
	const condition = tableSpecs.Condition || cleanText(String(html).match(/itemprop=["']itemCondition["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
	const conditionGrade = /refurb/i.test(condition) ? 'refurbished' : /used/i.test(condition) ? 'used' : 'new';
	const size = extractSize(title, lines);
	const resolution = extractResolution(title, lines);
	const touch = extractTouch(title, lines);
	const connector = extractConnector(title, lines);
	const displaySpecs = {
		'Source': 'Parts-People Dell LCD screen',
		'Part Number': sku,
		'Dell Part Numbers': dellPartNumbers.join(', '),
		'Manufacturer Part Numbers': manufacturerPartNumbers.join(', '),
		'Compatible Dell Models': compatibleModels.join(', '),
		'Size': size,
		'Resolution': resolution,
		'Touch': touch,
		'Connector Pins': connector,
		'Condition': condition,
		'Shipping Weight': tableSpecs['Shipping Weight'] ?? '',
		'Source Price USD': priceUsd ? priceUsd.toFixed(2) : ''
	};
	const compatibility = truncate(
		[
			`Dell LCD screen part number: ${sku}`,
			dellPartNumbers.length ? `Dell part numbers: ${dellPartNumbers.join(', ')}` : '',
			manufacturerPartNumbers.length ? `Panel/manufacturer part numbers: ${manufacturerPartNumbers.join(', ')}` : '',
			compatibleModels.length ? `Compatible Dell models: ${compatibleModels.join(', ')}` : '',
			size ? `Screen size: ${size}` : '',
			resolution ? `Resolution: ${resolution}` : '',
			connector ? `Connector: ${connector}` : '',
			touch ? `Touch: ${touch}` : '',
			'Match laptop model, Dell DP/N, panel part number, touch support, connector pins and assembly style before ordering.'
		]
			.filter(Boolean)
			.join('. '),
		4000
	);

	return {
		skipped: false,
		reason: '',
		row: {
			title: truncate(title, 190),
			brand: 'Dell',
			category: 'displays',
			image,
			images,
			source_url: entry.url,
			description: truncate(
				[
					description,
					`Part number: ${sku}`,
					compatibleModels.length ? `Compatible Dell models: ${compatibleModels.join(', ')}` : '',
					dellPartNumbers.length ? `Dell part numbers: ${dellPartNumbers.join(', ')}` : '',
					manufacturerPartNumbers.length ? `Panel/manufacturer part numbers: ${manufacturerPartNumbers.join(', ')}` : '',
					`Warranty: ${WARRANTY}`
				]
					.filter(Boolean)
					.join('. '),
				1200
			),
			sku: truncate(`PP-DELL-DISPLAY-${slugPart(sku)}-${entry.id}`, 120),
			specifications: displaySpecs,
			search_keywords: splitKeywords([
				title,
				'Dell display',
				'Dell LCD screen',
				sku,
				...dellPartNumbers,
				...manufacturerPartNumbers,
				...compatibleModels,
				size,
				resolution,
				touch,
				connector,
				description
			]),
			price: priceInr,
			selling_price: priceInr,
			cost_price: 0,
			mrp: buildMrp(priceInr),
			rating: 4.5,
			reviews: 0,
			stock: Number.isFinite(stock) && stock > 0 ? stock : 0,
			weight_kg: DEFAULT_WEIGHT_KG,
			length_cm: DEFAULT_LENGTH_CM,
			breadth_cm: DEFAULT_BREADTH_CM,
			height_cm: DEFAULT_HEIGHT_CM,
			compatibility,
			warranty: WARRANTY,
			highlights: unique(
				[
					'Genuine Dell LCD screen',
					`Part Number: ${sku}`,
					size,
					resolution,
					touch,
					connector,
					condition,
					WARRANTY
				],
				10
			),
			status: 'active',
			authenticity_grade: 'oem',
			condition_grade: conditionGrade,
			hsn_code: null,
			gst_rate: 18,
			doa_policy_days: 7,
			local_delivery_eligible: true,
			cod_eligible: true,
			cod_allowed: true,
			returnable: true,
			is_universal: false,
			clearance: false
		}
	};
}

async function fetchExistingDellDisplaySourceUrls(supabase) {
	const urls = new Set();
	for (let from = 0; ; from += 1000) {
		const to = from + 999;
		const { data, error } = await supabase
			.from('products')
			.select('source_url')
			.eq('category', 'displays')
			.ilike('source_url', '%parts-people.com%')
			.range(from, to);
		if (error) throw new Error(`Failed to read existing Parts-People display source URLs: ${error.message}`);
		for (const row of data ?? []) {
			if (row.source_url) urls.add(sourceUrlKey(row.source_url));
		}
		if (!data || data.length < 1000) break;
	}
	return urls;
}

async function collectDellDisplayProducts(parsedCache, supabase) {
	const firstHtml = await fetchText(CATEGORY_URL);
	const maxPage = parseMaxPage(firstHtml);
	const pageUrls = Array.from({ length: maxPage }, (_, index) => categoryUrl(index + 1));
	const pageHtmlByUrl = new Map([[CATEGORY_URL, firstHtml]]);
	const pageResults = await mapLimit(pageUrls, Math.min(4, concurrency), async (url) => {
		const html = pageHtmlByUrl.get(url) ?? (await fetchText(url));
		return { url, products: parseListProducts(html, url) };
	});
	const productEntries = [];
	const seen = new Set();
	for (const entry of pageResults.flatMap((page) => page.products)) {
		if (seen.has(entry.id)) continue;
		seen.add(entry.id);
		productEntries.push(entry);
	}
	const existingSourceUrls =
		skipExisting && supabase ? await fetchExistingDellDisplaySourceUrls(supabase) : new Set();
	const missingEntries = existingSourceUrls.size
		? productEntries.filter((entry) => !existingSourceUrls.has(sourceUrlKey(entry.url)))
		: productEntries;
	const limitedEntries = limit ? missingEntries.slice(0, limit) : missingEntries;
	const products = [];
	const skipped = [];
	const errors = [];

	await mapLimit(limitedEntries, concurrency, async (entry, index) => {
		try {
			const cacheKey = `parts-people:${entry.url}`;
			let parsed = parsedCache[cacheKey];
			if (!parsed) {
				const html = await fetchText(entry.url);
				parsed = parseDetailProduct(entry, html);
				parsedCache[cacheKey] = parsed;
			}
			if (parsed?.row) products.push(parsed.row);
			else skipped.push({ url: entry.url, title: entry.title, reason: parsed?.reason ?? 'unknown' });
		} catch (error) {
			errors.push({ url: entry.url, title: entry.title, error: error instanceof Error ? error.message : String(error) });
		}
		if ((index + 1) % 50 === 0 || index + 1 === limitedEntries.length) {
			saveJson(parsedCacheFile, parsedCache);
			process.stdout.write(`Parts-People pages ${index + 1}/${limitedEntries.length}\r`);
		}
	});
	process.stdout.write('\n');

	return {
		discovered: productEntries.length,
		skippedExisting: productEntries.length - missingEntries.length,
		selected: limitedEntries.length,
		pageCount: pageUrls.length,
		products,
		skipped,
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
			source: CATEGORY_URL,
			limit,
			concurrency,
			onlySize,
			skipExisting,
			rate: {
				USD_TO_INR,
				rateDate: '2026-06-12'
			},
			exclusions: ['Venue']
		},
		null,
		2
	)
);

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const result = await collectDellDisplayProducts(parsedCache, supabase);
const products = result.products.filter(isRequestedScreenSize);
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
	applyResult = await upsertProducts(supabase, products);
}

saveJson(parsedCacheFile, parsedCache);
saveJson(auditFile, {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	source: CATEGORY_URL,
	discovered: result.discovered,
	skippedExisting: result.skippedExisting,
	selected: result.selected,
	pageCount: result.pageCount,
	imported: products.length,
	skipped: result.skipped.length,
	skippedSamples: result.skipped.slice(0, 50),
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
			discovered: result.discovered,
			pageCount: result.pageCount,
			imported: products.length,
			skipped: result.skipped.length,
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
