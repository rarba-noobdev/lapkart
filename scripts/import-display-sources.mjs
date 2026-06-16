// Additive display importer for IPC Computer and LaptopScreen part-number pages.
//
// Dry run:
//   node scripts/import-display-sources.mjs --ipc-limit=5 --laptopscreen-limit=10
//   node scripts/import-display-sources.mjs --apply --skip-ipc --laptopscreen-offset=1000 --laptopscreen-limit=1000
//   node scripts/import-display-sources.mjs --ipc-all-category --skip-laptopscreen --ipc-page-limit=5
//   node scripts/import-display-sources.mjs --ipc-all-category --skip-laptopscreen --only-size=17.3
//
// Apply:
//   node scripts/import-display-sources.mjs --apply
//   node scripts/import-display-sources.mjs --apply --ipc-all-category --skip-laptopscreen
//
// LaptopScreen rows marked Discontinued are skipped.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(root, '.firecrawl', 'display-import');
const auditFile = join(cacheDir, 'audit.json');
const parsedCacheFile = join(cacheDir, 'parsed-cache.json');

const PLACEHOLDER_IMAGE =
	'https://www.power-x.in/cdn/shop/files/laptop-screen-156-40-pin-full-hdpowerx-the-technology-people-104400.png?v=1739959776&width=800';
const WARRANTY = '6 months replacement warranty';
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 30;
const DEFAULT_HEIGHT_CM = 8;
const EUR_TO_INR = 110.0195;
const USD_TO_INR = 95.12;
const DEFAULT_CONCURRENCY = 10;

const IPC_CATEGORY_URLS = [
	'https://www.ipc-computer.eu/lp/acer/display',
	'https://www.ipc-computer.eu/lp/asus/display',
	'https://www.ipc-computer.eu/lp/hp/display',
	'https://www.ipc-computer.eu/lp/lenovo/display'
];
const IPC_ALL_DISPLAYS_URL = 'https://www.ipc-computer.eu/laptop-spare-parts/displays';
const IPC_EXTRA_PRODUCT_URLS = [
	'https://www.ipc-computer.eu/laptop-spare-parts/displays/display-n173fge-l13-72055051'
];
const LAPTOPSCREEN_PARTS_URL = 'https://www.laptopscreen.com/English/section/screen-part-number/';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refresh = args.has('--refresh');
const skipIpc = args.has('--skip-ipc');
const skipLaptopScreen = args.has('--skip-laptopscreen');
const ipcAllCategory = args.has('--ipc-all-category');
const skipExisting = !args.has('--no-skip-existing');
const ipcLimit = numericArg('--ipc-limit=');
const ipcPageLimit = numericArg('--ipc-page-limit=');
const ipcPageOffset = numericArg('--ipc-page-offset=');
const laptopScreenLimit = numericArg('--laptopscreen-limit=');
const laptopScreenOffset = numericArg('--laptopscreen-offset=');
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
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(?:p|div|li|tr|dd|dt|h[1-6])>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return decodeHtml(value)
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
}

function cleanSpecValue(label, value) {
	let text = cleanText(value);
	if (!text) return '';

	if (label === 'Size') text = text.replace(/\bZoll\b/gi, 'in');
	if (label === 'Surface') {
		if (/^matt$/i.test(text)) text = 'Matte';
		if (/^glossy$/i.test(text)) text = 'Glossy';
	}
	if (label === 'Thickness' && /^normal$/i.test(text)) text = 'Normal';
	if (label === 'Brackets' && /^no bracket$/i.test(text)) text = 'No bracket';
	if (label === 'Position of display connector') {
		text = text.replace(/\bbottom\b/i, 'Bottom').replace(/\bleft\b/i, 'left').replace(/\bright\b/i, 'right');
	}
	if (label === 'Condition' && /^new\b/i.test(text)) text = 'New';
	return text;
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
		const text = String(value ?? '').trim();
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
		.replace(/~/g, '-')
		.replace(/[^A-Z0-9.-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function urlId(url) {
	return String(url).match(/-(\d+)(?:[/?#]|$)/)?.[1] ?? '';
}

function titleCaseBrand(value) {
	const text = cleanText(value);
	const known = new Map([
		['hp', 'HP'],
		['asus', 'Asus'],
		['acer', 'Acer'],
		['lenovo', 'Lenovo'],
		['dell', 'Dell'],
		['samsung', 'Samsung'],
		['msi', 'MSI'],
		['packard bell', 'Packard Bell'],
		['toshiba', 'Toshiba'],
		['dynabook', 'Dynabook'],
		['sony', 'Sony'],
		['fujitsu', 'Fujitsu'],
		['microsoft', 'Microsoft'],
		['medion', 'Medion'],
		['huawei', 'Huawei'],
		['apple', 'Apple'],
		['lg', 'LG']
	]);
	return known.get(text.toLowerCase()) ?? text;
}

function knownLaptopBrand(value) {
	const match = cleanText(value).match(
		/\b(Acer|Asus|HP|Hewlett[ -]?Packard|Lenovo|Dell|Samsung|MSI|Packard Bell|Toshiba|Dynabook|Sony|Fujitsu|Microsoft|Medion|Huawei|Apple|LG)\b/i
	);
	if (!match) return '';
	return titleCaseBrand(match[1].replace(/^Hewlett[ -]?Packard$/i, 'HP'));
}

function inferBrands(models) {
	const brands = [];
	for (const model of models) {
		const brand = knownLaptopBrand(model);
		if (brand) brands.push(brand);
	}
	return unique(brands, 6);
}

function inferSourceBrand({ manufacturer = '', title = '' } = {}) {
	return knownLaptopBrand(manufacturer) || knownLaptopBrand(title);
}

function splitKeywords(values, max = 120) {
	const expanded = [];
	for (const value of values) {
		const text = cleanText(value);
		if (!text) continue;
		expanded.push(text);
		expanded.push(...text.split(/[\s,;/|()]+/).filter((token) => token.length >= 2));
	}
	return unique(expanded.map((value) => value.slice(0, 80)), max);
}

function convertedPrice(amount, rate) {
	const value = Number(amount);
	if (!Number.isFinite(value) || value <= 0) return 3499;
	const converted = value * rate;
	return Math.max(999, Math.round(converted / 50) * 50 - 1);
}

function buildMrp(price) {
	return Math.max(price + 500, Math.round((price * 1.18) / 50) * 50 - 1);
}

async function fetchText(url) {
	let lastError;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: {
					accept: 'text/html,*/*',
					'user-agent': 'LapKart display importer'
				},
				signal: AbortSignal.timeout(25000)
			});
			if (!response.ok) {
				throw new Error(`${response.status} ${response.statusText} for ${url}`);
			}
			return response.text();
		} catch (error) {
			lastError = error;
			if (attempt < 3) await sleep(attempt * 750);
		}
	}
	throw lastError;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

function parseDisplayLinks(html, baseUrl) {
	const links = [];
	for (const match of html.matchAll(/href=["']([^"']*\/laptop-spare-parts\/displays\/display-[^"']+)["']/gi)) {
		links.push(new URL(decodeHtml(match[1]), baseUrl).toString());
	}
	return uniqueUrls(links);
}

function parsePaginationUrls(html, baseUrl) {
	const maxPage = [...String(html ?? '').matchAll(/[?&]page=(\d+)/gi)].reduce(
		(max, match) => Math.max(max, Number(match[1])),
		1
	);
	const urls = [baseUrl];
	for (let page = 2; page <= maxPage; page += 1) {
		urls.push(`${baseUrl}?page=${page}`);
	}
	return uniqueUrls(urls);
}

async function fetchExistingIpcDisplaySourceUrls(supabase) {
	const urls = new Set();
	for (let from = 0; ; from += 1000) {
		const to = from + 999;
		const { data, error } = await supabase
			.from('products')
			.select('source_url')
			.eq('category', 'displays')
			.ilike('source_url', 'https://www.ipc-computer.eu/laptop-spare-parts/displays/display-%')
			.range(from, to);
		if (error) throw new Error(`Failed to read existing IPC display source URLs: ${error.message}`);
		for (const row of data ?? []) {
			if (row.source_url) urls.add(sourceUrlKey(row.source_url));
		}
		if (!data || data.length < 1000) break;
	}
	return urls;
}

function parseDtDdPairs(html) {
	const pairs = [];
	for (const match of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
		const label = stripHtml(match[1]);
		const valueHtml = match[2];
		const value = stripHtml(valueHtml);
		if (label || value) pairs.push({ label, value, valueHtml });
	}
	return pairs;
}

function anchorTexts(html) {
	return unique(
		[...String(html ?? '').matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) =>
			stripHtml(match[1])
		)
	);
}

function canonicalIpcSpecLabel(label) {
	const text = cleanText(label);
	if (/^Displayansteuerung$/i.test(text)) return 'Display Interface';
	if (/^Number of pins$/i.test(text)) return 'Connector Pins';
	if (/^Position of display connector$/i.test(text)) return 'Connector Position';
	if (/^Width of display connector$/i.test(text)) return 'Connector Width';
	return text;
}

function parseIpcProduct(url, html) {
	const pairs = parseDtDdPairs(html);
	const title =
		stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '') ||
		stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
	const price = Number(html.match(/itemprop=["']price["']\s+content=["']([0-9.]+)["']/i)?.[1] ?? 0);
	const specs = {};
	let itemNumber = '';
	let primaryPartNumber = '';
	let subPartNumbers = [];
	let models = [];

	for (const pair of pairs) {
		const label = cleanText(pair.label);
		if (!label || /^Safety information$/i.test(label)) continue;

		if (/^Item Number$/i.test(label)) {
			itemNumber = cleanText(pair.value).split(/\s+Primary Partnummer/i)[0];
			const primaryMatch = cleanText(pair.value).match(/Primary Partnummer\s+([A-Z0-9.-]+)/i);
			if (primaryMatch) primaryPartNumber = primaryMatch[1];
			continue;
		}

		if (/^Sub-Partnumbers/i.test(label)) {
			subPartNumbers = unique(anchorTexts(pair.valueHtml).concat(pair.value.split(/\s*,\s*/)), 20);
			continue;
		}

		if (/^Excerpt of suitable models/i.test(label)) {
			models = unique(anchorTexts(pair.valueHtml).concat(pair.value.split(/\s*,\s*/)), 80);
			continue;
		}

		const canonical = canonicalIpcSpecLabel(label);
		if (
			[
				'Manufacturer',
				'Condition',
				'Size',
				'Resolution',
				'Panel',
				'Surface',
				'Frame rate',
				'Backlight',
				'Length / Width',
				'Thickness',
				'Brackets',
				'Connector Position',
				'Connector Width',
				'Connector Pins',
				'Display Interface',
				'Category',
				'Usage'
			].includes(canonical)
		) {
			specs[canonical] = truncate(cleanSpecValue(label, pair.value), 180);
		}
	}

	const partFromUrl = String(url).match(/\/display-([^/?#]+?)-\d+(?:[/?#]|$)/i)?.[1]?.replace(/-/g, ' ').toUpperCase() ?? '';
	if (!itemNumber) itemNumber = partFromUrl;
	if (!primaryPartNumber) primaryPartNumber = itemNumber;
	if (!itemNumber) return null;
	if (/^IPC[-\s]?Computer$/i.test(specs.Manufacturer ?? '')) return null;

	const allPartNumbers = unique([itemNumber, primaryPartNumber, ...subPartNumbers], 30);
	const brandList = inferBrands(models);
	const sourceBrand = inferSourceBrand({ manufacturer: specs.Manufacturer, title });
	const brand = brandList.length === 1 ? brandList[0] : models.length ? 'Compatible' : sourceBrand || 'Compatible';
	const size = specs.Size?.replace(/\s*\/.*$/, '') ?? '';
	const resolution = specs.Resolution ?? '';
	const pins = specs['Connector Pins'] ? `${specs['Connector Pins']}-pin` : '';
	const interfaceType = specs['Display Interface'] ?? '';
	const titlePrefix = brand === 'Compatible' ? 'Compatible Display' : `${brand} Display`;
	const titleParts = [titlePrefix, itemNumber, size, resolution, pins, interfaceType].filter(Boolean);
	const normalizedTitle = truncate(titleParts.join(' '), 190);
	const compatibility = truncate(
		[
			`Panel part numbers: ${allPartNumbers.join(', ')}`,
			models.length ? `Compatible laptop models: ${models.join(', ')}` : '',
			'Match screen size, resolution, connector pins, connector position and bracket style before ordering.'
		]
			.filter(Boolean)
			.join('. '),
		4000
	);
	const displaySpecs = {
		...specs,
		'Panel Part Number': itemNumber,
		'Primary Part Number': primaryPartNumber,
		'Sub-Partnumbers': subPartNumbers.join(', '),
		'Compatible Device Models': models.join(', '),
		'Compatibility Source': `IPC Computer (${itemNumber})`
	};
	const priceInr = convertedPrice(price, EUR_TO_INR);
	const sourceId = urlId(url) || slugPart(itemNumber);

	return {
		title: normalizedTitle,
		brand,
		category: 'displays',
		image: PLACEHOLDER_IMAGE,
		images: [PLACEHOLDER_IMAGE],
		source_url: url,
		description: truncate(
			[
				title || normalizedTitle,
				`Panel part number: ${itemNumber}`,
				subPartNumbers.length ? `Sub-partnumbers: ${subPartNumbers.join(', ')}` : '',
				Object.entries(displaySpecs)
					.filter(([, value]) => value)
					.map(([key, value]) => `${key}: ${value}`)
					.join('. '),
				`Warranty: ${WARRANTY}`
			]
				.filter(Boolean)
				.join('. '),
			1200
		),
		sku: truncate(`IPC-DISPLAY-${slugPart(itemNumber)}-${sourceId}`, 120),
		specifications: displaySpecs,
		search_keywords: splitKeywords([
			normalizedTitle,
			brand,
			'display',
			'screen',
			'laptop display',
			...allPartNumbers,
			...models,
			...Object.values(displaySpecs)
		]),
		price: priceInr,
		selling_price: priceInr,
		cost_price: 0,
		mrp: buildMrp(priceInr),
		rating: 4.5,
		reviews: 0,
		stock: /\b(in stock|immediately available)\b/i.test(stripHtml(html)) ? 10 : 0,
		weight_kg: DEFAULT_WEIGHT_KG,
		length_cm: DEFAULT_LENGTH_CM,
		breadth_cm: DEFAULT_BREADTH_CM,
		height_cm: DEFAULT_HEIGHT_CM,
		compatibility,
		warranty: WARRANTY,
		highlights: unique(
			[
				'Laptop display replacement',
				itemNumber ? `Panel Part Number: ${itemNumber}` : '',
				specs.Size,
				specs.Resolution,
				specs['Connector Pins'] ? `${specs['Connector Pins']}-pin connector` : '',
				'Compatibility checked by panel part number',
				WARRANTY
			],
			10
		),
		status: 'active',
		authenticity_grade: 'compatible',
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

function parseLaptopScreenDirectory(html) {
	const entries = [];
	for (const match of html.matchAll(
		/<a\b[^>]*href=["']([^"']*\/English\/screen-part-number\/([^"'?#]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi
	)) {
		const href = decodeHtml(match[1]);
		const slug = decodeURIComponent(match[2]).replace(/\/$/, '');
		const label = stripHtml(match[3]).replace(/\s+V\./i, ' V.');
		const partNumber = cleanText(label || slug.replace(/~/g, ' '));
		if (!partNumber || partNumber.toLowerCase() === 'screen-part-number') continue;
		entries.push({
			url: new URL(href, LAPTOPSCREEN_PARTS_URL).toString(),
			partNumber
		});
	}

	const seen = new Set();
	const out = [];
	for (const entry of entries) {
		const key = slugPart(entry.partNumber);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(entry);
	}
	return out;
}

function textOf(html) {
	return stripHtml(html);
}

function extractLabeledSpecs(segment) {
	const labels = [
		'Compatibility',
		'Comments',
		'Laptop OS',
		'Part Type',
		'Size',
		'Screen Size',
		'Resolution',
		'Surface Type',
		'Video Connector',
		'Mountings',
		'Optical Technology',
		'Refresh Rate',
		'Condition',
		'Warranty'
	];
	const specs = {};
	for (let i = 0; i < labels.length; i += 1) {
		const label = labels[i];
		const nextLabels = labels
			.slice(i + 1)
			.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
		const stop = nextLabels
			? `(?=\\s+(?:${nextLabels}):|\\s+\\$\\d|\\s+Out of Stock|\\s+\\d+\\+?\\s+in stock|$)`
			: `(?=\\s+\\$\\d|\\s+Out of Stock|\\s+\\d+\\+?\\s+in stock|$)`;
		const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([\\s\\S]*?)${stop}`, 'i');
		const match = segment.match(pattern);
		if (!match) continue;
		const value = truncate(cleanLaptopScreenSpecValue(label, match[1]), 180);
		if (value) specs[label] = value;
	}
	return specs;
}

function extractLaptopScreenOfferBlocks(text) {
	const normalized = cleanText(text);
	const blocks = [];
	const matches = [...normalized.matchAll(/item ID:\s*(\d+)/gi)];
	for (let index = 0; index < matches.length; index += 1) {
		const start = matches[index].index ?? 0;
		const end = matches[index + 1]?.index ?? normalized.length;
		const block = normalized.slice(start, end).trim();
		if (!block) continue;
		blocks.push({
			itemId: matches[index][1],
			text: block
		});
	}
	return blocks;
}

function cleanLaptopScreenSpecValue(label, value) {
	let text = cleanText(value);
	const words = text.split(/\s+/);
	if (words.length > 1 && words.length % 2 === 0) {
		const mid = words.length / 2;
		const first = words.slice(0, mid).join(' ');
		const second = words.slice(mid).join(' ');
		if (first.toLowerCase() === second.toLowerCase()) text = first;
	}

	if (label === 'Screen Size') {
		text = text.replace(/\s+Screen$/i, ' Screen').replace(/\s+WideScreen$/i, ' WideScreen');
	}
	return text;
}

function parseLaptopScreenProduct(entry, html) {
	const text = textOf(html);
	const h1 = stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
	const offerBlocks = extractLaptopScreenOfferBlocks(text);
	const activeOffer =
		offerBlocks.find((block) => !/\bDiscontinued\b/i.test(block.text)) ?? null;

	if (!activeOffer) {
		return { skipped: true, reason: 'discontinued', row: null };
	}

	const specs = extractLabeledSpecs(activeOffer.text);
	const sourceCompatibility = specs.Compatibility || entry.partNumber;
	const partNumber = entry.partNumber;
	if (sourceCompatibility && sourceCompatibility.toLowerCase() !== partNumber.toLowerCase()) {
		specs['Compatibility Notes'] = sourceCompatibility;
	}
	specs.Compatibility = partNumber;
	const priceUsd =
		Number(activeOffer.text.match(/\$([0-9]+\.[0-9]{2})/i)?.[1] ?? 0) ||
		Number(h1.match(/from\s+\$([0-9.]+)/i)?.[1] ?? 0) ||
		Number(text.match(/\$([0-9]+\.[0-9]{2})\s+USD/i)?.[1] ?? 0);
	if (!partNumber || !priceUsd) {
		return { skipped: true, reason: 'missing part number or price', row: null };
	}

	const stockText = activeOffer.text.match(/(?:Out of Stock|\d+\+?\s+in stock)/i)?.[0] ?? '';
	const stock = /out of stock/i.test(stockText) ? 0 : /\bin stock\b/i.test(stockText) ? 10 : 0;
	const priceInr = convertedPrice(priceUsd, USD_TO_INR);
	const size = specs.Size ?? specs['Screen Size'] ?? '';
	const resolution = specs.Resolution ?? '';
	const connector = specs['Video Connector'] ?? '';
	const partType = specs['Part Type'] ?? 'LCD Screen';
	const title = truncate(
		['Compatible Display', partNumber, size.replace(/\s+WideScreen\b/i, ''), resolution, connector]
			.filter(Boolean)
			.join(' '),
		190
	);
	const compatibility = truncate(
		[
			`Panel part number: ${partNumber}`,
			`Part type: ${partType}`,
			size ? `Screen size: ${size}` : '',
			resolution ? `Resolution: ${resolution}` : '',
			connector ? `Connector: ${connector}` : '',
			'Match screen size, resolution, connector pins, connector position and bracket style before ordering.'
		]
			.filter(Boolean)
			.join('. '),
		1200
	);
	const displaySpecs = {
		...specs,
		'Panel Part Number': partNumber,
		'Compatibility Source': `LaptopScreen part-number page (${partNumber})`
	};
	const sourceId = activeOffer.itemId || slugPart(partNumber);

	return {
		skipped: false,
		reason: '',
		row: {
			title,
			brand: 'Compatible',
			category: 'displays',
			image: PLACEHOLDER_IMAGE,
			images: [PLACEHOLDER_IMAGE],
			source_url: entry.url,
			description: truncate(
				[
					h1 || title,
					Object.entries(displaySpecs)
						.filter(([, value]) => value)
						.map(([key, value]) => `${key}: ${value}`)
						.join('. '),
					`Source price: USD ${priceUsd.toFixed(2)}`,
					`Warranty: ${WARRANTY}`
				]
					.filter(Boolean)
					.join('. '),
				1000
			),
			sku: truncate(`LS-DISPLAY-${slugPart(partNumber)}-${sourceId}`, 120),
			specifications: displaySpecs,
			search_keywords: splitKeywords([
				title,
				'display',
				'screen',
				'laptop display',
				partNumber,
				entry.partNumber,
				...Object.values(displaySpecs)
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
					'Laptop display replacement',
					`Panel Part Number: ${partNumber}`,
					partType,
					size,
					resolution,
					connector,
					'Compatibility checked by panel part number',
					WARRANTY
				],
				10
			),
			status: 'active',
			authenticity_grade: 'compatible',
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
		}
	};
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

function expectedScreenSizeFromPanelPart(value) {
	const part = String(value ?? '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');
	const match = part.match(/^(?:B|N|NV|NT|LP|LTN|LM|LQ)(\d{3})/);
	return match ? Number(match[1]) / 10 : 0;
}

function isReliableLaptopScreenRow(row) {
	const size = screenSizeFromRow(row);
	if (!(size >= 10 && size <= 18.5)) return false;

	const expectedSize = expectedScreenSizeFromPanelPart(
		row?.specifications?.['Panel Part Number'] ?? row?.title
	);
	if (expectedSize && Math.abs(size - expectedSize) > 0.45) return false;
	if (/Upgrade Options|Full specs/i.test(row?.specifications?.Warranty ?? '')) return false;
	if (/~HW/i.test(row?.source_url ?? '')) return false;

	return true;
}

async function collectIpcProducts(parsedCache, supabase) {
	if (skipIpc) return { products: [], errors: [] };

	const categoryUrls = ipcAllCategory ? [IPC_ALL_DISPLAYS_URL] : IPC_CATEGORY_URLS;
	const categoryIndexes = await mapLimit(categoryUrls, Math.min(4, concurrency), async (url) => {
		const html = await fetchText(url);
		return {
			url,
			pageUrls: parsePaginationUrls(html, url)
		};
	});
	const allCategoryPageUrls = uniqueUrls(categoryIndexes.flatMap((page) => page.pageUrls));
	const categoryPageUrls = allCategoryPageUrls.slice(
		Math.min(ipcPageOffset, allCategoryPageUrls.length),
		ipcPageLimit ? Math.min(ipcPageOffset + ipcPageLimit, allCategoryPageUrls.length) : undefined
	);
	const categoryPages = await mapLimit(categoryPageUrls, Math.min(8, concurrency), async (url) => {
		const html = await fetchText(url);
		return { url, links: parseDisplayLinks(html, url) };
	});
	const productUrls = uniqueUrls([
		...(ipcAllCategory ? [] : IPC_EXTRA_PRODUCT_URLS),
		...categoryPages.flatMap((page) => page.links)
	]);
	const existingSourceUrls =
		skipExisting && supabase ? await fetchExistingIpcDisplaySourceUrls(supabase) : new Set();
	const missingUrls = existingSourceUrls.size
		? productUrls.filter((url) => !existingSourceUrls.has(sourceUrlKey(url)))
		: productUrls;
	const limitedUrls = ipcLimit ? missingUrls.slice(0, ipcLimit) : missingUrls;
	const products = [];
	const errors = [];

	await mapLimit(limitedUrls, concurrency, async (url, index) => {
		try {
			const cacheKey = `ipc:${url}`;
			let parsed = parsedCache[cacheKey];
			if (!parsed) {
				const html = await fetchText(url);
				parsed = parseIpcProduct(url, html);
				parsedCache[cacheKey] = parsed;
			}
			if (parsed) products.push(parsed);
		} catch (error) {
			errors.push({ url, error: error instanceof Error ? error.message : String(error) });
		}
		if ((index + 1) % 25 === 0 || index + 1 === limitedUrls.length) {
			saveJson(parsedCacheFile, parsedCache);
			process.stdout.write(`IPC pages ${index + 1}/${limitedUrls.length}\r`);
		}
	});
	process.stdout.write('\n');

	return {
		products,
		errors,
		discovered: productUrls.length,
		categoryPages: allCategoryPageUrls.length,
		scannedCategoryPages: categoryPageUrls.length,
		skippedExisting: productUrls.length - missingUrls.length,
		selected: limitedUrls.length,
		imported: products.length
	};
}

async function collectLaptopScreenProducts(parsedCache) {
	if (skipLaptopScreen) return { products: [], skipped: [], errors: [] };

	const directoryHtml = await fetchText(LAPTOPSCREEN_PARTS_URL);
	const entries = parseLaptopScreenDirectory(directoryHtml);
	const start = Math.min(laptopScreenOffset, entries.length);
	const end = laptopScreenLimit ? Math.min(start + laptopScreenLimit, entries.length) : entries.length;
	const limitedEntries = entries.slice(start, end);
	const products = [];
	const skipped = [];
	const errors = [];

	await mapLimit(limitedEntries, concurrency, async (entry, index) => {
		try {
			const cacheKey = `laptopscreen:${entry.url}`;
			let parsed = parsedCache[cacheKey];
			if (!parsed) {
				const html = await fetchText(entry.url);
				parsed = parseLaptopScreenProduct(entry, html);
				parsedCache[cacheKey] = parsed;
			}
			if (parsed?.row && isReliableLaptopScreenRow(parsed.row)) {
				products.push(parsed.row);
			} else {
				skipped.push({
					url: entry.url,
					partNumber: entry.partNumber,
					reason: parsed?.row ? 'unreliable laptop screen specs' : parsed?.reason ?? 'unknown'
				});
			}
		} catch (error) {
			errors.push({
				url: entry.url,
				partNumber: entry.partNumber,
				error: error instanceof Error ? error.message : String(error)
			});
		}
		if ((index + 1) % 100 === 0 || index + 1 === limitedEntries.length) {
			saveJson(parsedCacheFile, parsedCache);
			process.stdout.write(
				`LaptopScreen pages ${start + index + 1}/${entries.length} (chunk ${index + 1}/${limitedEntries.length})\r`
			);
		}
	});
	process.stdout.write('\n');

	return {
		products,
		skipped,
		errors,
		discovered: entries.length,
		offset: start,
		limit: limitedEntries.length,
		imported: products.length
	};
}

function dedupeProducts(products) {
	const seen = new Map();
	const out = [];
	for (const product of products) {
		const baseSku = product.sku;
		const count = seen.get(baseSku) ?? 0;
		seen.set(baseSku, count + 1);
		if (count > 0) {
			product.sku = truncate(`${baseSku}-${count + 1}`, 120);
			product.search_keywords = unique([baseSku, ...(product.search_keywords ?? [])], 120);
		}
		out.push(product);
	}
	return out;
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
			sources: {
				ipc: !skipIpc,
				laptopScreen: !skipLaptopScreen
			},
			limits: {
				ipcLimit,
				ipcPageLimit,
				ipcPageOffset,
				laptopScreenLimit,
				laptopScreenOffset,
				concurrency
			},
			ipcAllCategory,
			skipExisting,
			rates: {
				EUR_TO_INR,
				USD_TO_INR,
				rateDate: '2026-06-12'
			}
		},
		null,
		2
	)
);

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const [ipcResult, laptopScreenResult] = await Promise.all([
	collectIpcProducts(parsedCache, supabase),
	collectLaptopScreenProducts(parsedCache)
]);
const collectedProducts = [...ipcResult.products, ...laptopScreenResult.products];
const products = dedupeProducts(collectedProducts.filter(isRequestedScreenSize));

const bySource = {
	ipc: ipcResult.products.length,
	laptopScreen: laptopScreenResult.products.length
};
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
	sources: {
		ipc: {
			discovered: ipcResult.discovered ?? 0,
			categoryPages: ipcResult.categoryPages ?? 0,
			scannedCategoryPages: ipcResult.scannedCategoryPages ?? 0,
			skippedExisting: ipcResult.skippedExisting ?? 0,
			selected: ipcResult.selected ?? 0,
			imported: ipcResult.products.length,
			errors: ipcResult.errors
		},
		laptopScreen: {
			discovered: laptopScreenResult.discovered ?? 0,
			offset: laptopScreenResult.offset ?? 0,
			limit: laptopScreenResult.limit ?? 0,
			imported: laptopScreenResult.products.length,
			skipped: laptopScreenResult.skipped.length,
			skippedSamples: laptopScreenResult.skipped.slice(0, 50),
			errors: laptopScreenResult.errors
		}
	},
	totalProducts: products.length,
	bySource,
	byStock,
	upserted: applyResult.upserted,
	upsertErrors: applyResult.errors,
	samples: products.slice(0, 20).map((row) => ({
		title: row.title,
		sku: row.sku,
		price: row.price,
		stock: row.stock,
		compatibility: row.compatibility.slice(0, 300),
		source_url: row.source_url
	}))
});

console.log(
	JSON.stringify(
		{
			mode: apply ? 'apply' : 'dry-run',
			ipc: {
				discovered: ipcResult.discovered ?? 0,
				categoryPages: ipcResult.categoryPages ?? 0,
				scannedCategoryPages: ipcResult.scannedCategoryPages ?? 0,
				skippedExisting: ipcResult.skippedExisting ?? 0,
				selected: ipcResult.selected ?? 0,
				imported: ipcResult.products.length,
				errors: ipcResult.errors.length
			},
			laptopScreen: {
				discovered: laptopScreenResult.discovered ?? 0,
				offset: laptopScreenResult.offset ?? 0,
				limit: laptopScreenResult.limit ?? 0,
				imported: laptopScreenResult.products.length,
				skipped: laptopScreenResult.skipped.length,
				errors: laptopScreenResult.errors.length
			},
			totalProducts: products.length,
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
