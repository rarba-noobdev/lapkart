// Imports and refreshes Indian-source repair components:
// - ICs from Lonex, LaptopParts.in, and Xfurbish
// - Hinges from Techcommerce
// - Cooling fans and DC power jacks from PartsBaba
//
// Dry run:
//   node scripts/import-indian-repair-components.mjs
//
// Apply:
//   node scripts/import-indian-repair-components.mjs --apply

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = join(root, 'outputs', `india-repair-components-${stamp}`);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const skipStatus = args.has('--skip-status');
const skipTypesense = args.has('--skip-typesense');
const statusOnly = args.has('--status-only');
const limit = numericArg('--limit=');

const TARGET_CATEGORIES = ['ics', 'hinges', 'cooling', 'dc_jacks'];
const SHOPIFY_LIMIT = 250;
const WRITE_BATCH_SIZE = 25;
const STATUS_BATCH_SIZE = 25;
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const SOURCES = {
	lonexIcs: 'https://www.lonex.net.in/laptop-ic.html',
	laptopPartsIcs: 'https://www.laptopparts.in/ic-and-components/laptop-ic/',
	xfurbishIcs: 'https://www.xfurbish.com/laptop-ic',
	techcommerceHinges: 'https://techcommerce.in/collections/hinges',
	partsBabaFans: 'https://partsbaba.com/collections/laptop-fan',
	partsBabaDcJacks: 'https://partsbaba.com/collections/dc-power-jack'
};

const CATEGORY_META = {
	ics: {
		label: 'Laptop IC',
		prefix: 'LK-IC',
		hsn: '85423900',
		minPrice: 40,
		weight_kg: 0.05,
		length_cm: 8,
		breadth_cm: 6,
		height_cm: 2,
		warranty: '7 days replacement support',
		compatibility: 'Match the IC code on the board before ordering.',
		highlights: ['Board repair component', 'Match by IC code', 'Packed for safe transit']
	},
	hinges: {
		label: 'Laptop hinge set',
		prefix: 'LK-HINGE',
		hsn: '83021090',
		minPrice: 100,
		weight_kg: 0.25,
		length_cm: 25,
		breadth_cm: 10,
		height_cm: 4,
		warranty: '7 days replacement support',
		compatibility: 'Match the laptop model and hinge side before ordering.',
		highlights: ['Model-specific hinge fit', 'Left/right fit must match', 'Packed for safe transit']
	},
	cooling: {
		label: 'Laptop cooling fan',
		prefix: 'LK-FAN',
		hsn: '84145990',
		minPrice: 100,
		weight_kg: 0.18,
		length_cm: 16,
		breadth_cm: 14,
		height_cm: 5,
		warranty: '7 days replacement support',
		compatibility: 'Match the laptop model, connector and fan side before ordering.',
		highlights: ['For overheating or fan-noise repairs', 'Match connector and side', 'Packed for safe transit']
	},
	dc_jacks: {
		label: 'Laptop DC power jack',
		prefix: 'LK-DCJ',
		hsn: '85366990',
		minPrice: 80,
		weight_kg: 0.08,
		length_cm: 10,
		breadth_cm: 8,
		height_cm: 3,
		warranty: '7 days replacement support',
		compatibility: 'Match the laptop model and jack cable/connector before ordering.',
		highlights: ['Power-input replacement part', 'Match cable and connector', 'Packed for safe transit']
	}
};

const BRAND_PATTERNS = [
	['alienware', 'Dell'],
	['acer', 'Acer'],
	['apple', 'Apple'],
	['macbook', 'Apple'],
	['asus', 'Asus'],
	['compaq', 'HP'],
	['dell', 'Dell'],
	['hp', 'HP'],
	['ibm', 'Lenovo'],
	['lenovo', 'Lenovo'],
	['thinkpad', 'Lenovo'],
	['ideapad', 'Lenovo'],
	['msi', 'MSI'],
	['samsung', 'Samsung'],
	['sony', 'Sony'],
	['toshiba', 'Toshiba'],
	['bq', 'BQ'],
	['isl', 'ISL'],
	['tps', 'TPS'],
	['maxim', 'Maxim'],
	['nuvoton', 'Nuvoton'],
	['ite', 'ITE'],
	['ene', 'ENE'],
	['smsc', 'SMSC'],
	['realtek', 'Realtek'],
	['alc', 'Realtek'],
	['intel', 'Intel'],
	['nvidia', 'Nvidia'],
	['amd', 'AMD']
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

function numericArg(prefix) {
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	if (!value) return 0;
	const parsed = Number(value.slice(prefix.length));
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function loadDotEnv(path = join(root, '.env')) {
	if (!existsSync(path)) return;
	for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
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
		if (!process.env[key]) process.env[key] = value;
	}
}

function ensureDir(path) {
	mkdirSync(path, { recursive: true });
}

function writeJson(name, value) {
	ensureDir(outputDir);
	writeFileSync(join(outputDir, name), JSON.stringify(value, null, 2));
}

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&([a-z]+);/gi, (entity, name) => ENTITY_MAP[name.toLowerCase()] ?? entity);
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return decodeHtml(value)
		.replace(/\u00a0/g, ' ')
		.replace(/[–—]/g, '-')
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
}

function absoluteUrl(value, base) {
	const raw = decodeHtml(String(value ?? '').trim());
	if (!raw) return '';
	try {
		return new URL(raw, base).toString();
	} catch {
		return '';
	}
}

function compactKey(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/&AMP;/g, '&')
		.replace(/[^A-Z0-9]+/g, '')
		.trim();
}

function slugPart(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

function unique(values, limitValue = 200) {
	const seen = new Set();
	const out = [];
	for (const raw of values.flat()) {
		const value = cleanText(raw);
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= limitValue) break;
	}
	return out;
}

function resolveBrand(...values) {
	const haystack = ` ${cleanText(values.join(' ')).toLowerCase()} `;
	for (const [needle, brand] of BRAND_PATTERNS) {
		if (haystack.includes(` ${needle} `) || haystack.includes(`${needle}-`)) return brand;
	}
	return 'Compatible';
}

function moneyFromText(value) {
	const text = decodeHtml(value)
		.replace(/₹|&#x20b9;|&#8377;/gi, 'Rs.')
		.replace(/,/g, '');
	const matches = [...text.matchAll(/(?:Rs\.?|INR)\s*([0-9]+(?:\.[0-9]+)?)/gi)]
		.map((match) => Number(match[1]))
		.filter((price) => Number.isFinite(price) && price > 0);
	return matches.length ? Math.round(matches[matches.length - 1]) : 0;
}

function moneyFromShopify(value) {
	const parsed = Number(String(value ?? '').replace(/,/g, ''));
	return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

async function fetchText(url, attempt = 1) {
	const response = await fetch(url, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
		}
	});
	if (!response.ok) {
		if (attempt < 4 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
			await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
			return fetchText(url, attempt + 1);
		}
		throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
	}
	return response.text();
}

async function fetchJson(url, attempt = 1) {
	const response = await fetch(url, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'application/json,text/plain,*/*'
		}
	});
	if (!response.ok) {
		if (attempt < 4 && [408, 429, 500, 502, 503, 504].includes(response.status)) {
			await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
			return fetchJson(url, attempt + 1);
		}
		throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
	}
	return response.json();
}

function extractUrls(html, base, pattern) {
	const urls = [];
	for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
		const url = absoluteUrl(match[1], base);
		if (url && pattern.test(url)) urls.push(url);
	}
	return unique(urls, 1000);
}

function extractImageFromBlock(block, base) {
	const src =
		block.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ??
		block.match(/\bsrc=["']([^"']+)["']/i)?.[1] ??
		'';
	return absoluteUrl(src, base);
}

function extractIcCodes(...values) {
	const text = cleanText(values.join(' ')).toUpperCase();
	const candidates = new Set();
	const patterns = [
		/\b(?:BQ|TPS|ISL|MAX|NPCE|NCP|ITE|ENE|SMSC|ALC|RT|ADP|BCM|CX|KB|IT|PU|BD|W25|WPCE|SL|FW|AO|MOSFET)\s*-?\s*[A-Z0-9]{2,12}(?:[-.][A-Z0-9]{1,8})*\b/g,
		/\b[A-Z]{1,5}\d{2,6}[A-Z0-9-]{0,8}\b/g,
		/\b\d{2,4}[A-Z]{1,5}[A-Z0-9-]{1,8}\b/g
	];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			const token = cleanText(match[0]).replace(/\s+/g, '');
			if (token.length < 4 || token.length > 24) continue;
			if (/^(?:LAPTOP|POWER|CHIP|IC|NEW|USED|FOR|THE|AND|WITH)$/i.test(token)) continue;
			if (!/[A-Z]/.test(token) || !/\d/.test(token)) continue;
			candidates.add(token);
		}
	}
	return Array.from(candidates).slice(0, 20);
}

function extractModelTerms(title, brand = '') {
	const text = cleanText(title)
		.replace(new RegExp(`\\b${brand}\\b`, 'i'), ' ')
		.replace(
			/\b(laptop|lcd|hinges?|for|cpu|cooling|fan|dc|power|jack|cable|connector|replacement|series|compatible|new|ic|chip|controller|high-efficiency|management)\b/gi,
			' '
		)
		.replace(/\s+/g, ' ')
		.trim();

	const models = [];
	for (const match of text.matchAll(/\b[A-Z]?\d{2,4}[-A-Z0-9]{1,12}\b/gi)) {
		models.push(match[0]);
	}
	const shortText = text.replace(/\s*\/\s*/g, ', ');
	if (shortText && shortText.length <= 120) models.push(shortText);
	return unique(models, 40);
}

function categoryKey(item) {
	const brand = item.brand && item.brand !== 'Compatible' ? item.brand : '';
	if (item.category === 'ics') {
		const icCode = extractIcCodes(item.partNumber, item.sku, item.title)[0];
		if (icCode) return `ics:${compactKey(icCode)}`;
	}
	const modelText = unique([item.partNumber, item.sku, ...extractModelTerms(item.title, brand)], 20).join(' ');
	const base = modelText || item.title;
	return `${item.category}:${compactKey(`${brand} ${base}`) || compactKey(item.title)}`;
}

function sourcePriority(source) {
	const priority = {
		LaptopParts: 1,
		Xfurbish: 2,
		Lonex: 3,
		PartsBaba: 4,
		Techcommerce: 5
	};
	return priority[source] ?? 99;
}

function betterCandidate(current, next) {
	if (!current) return next;
	if (current.inStock !== next.inStock) return next.inStock ? next : current;
	if (current.inStock && next.price !== current.price) return next.price < current.price ? next : current;
	if (sourcePriority(next.source) !== sourcePriority(current.source)) {
		return sourcePriority(next.source) < sourcePriority(current.source) ? next : current;
	}
	return next.images.length > current.images.length ? next : current;
}

function normalizeCandidate(raw) {
	const meta = CATEGORY_META[raw.category];
	if (!meta) return null;
	const title = cleanText(raw.title).replace(/\bused\b/gi, '').replace(/\s+/g, ' ').trim();
	if (!title || title.length < 4) return null;
	const price = Math.round(Number(raw.price ?? 0));
	if (!Number.isFinite(price) || price < meta.minPrice) return null;
	const brand = resolveBrand(raw.brand, raw.title, raw.sku, raw.partNumber);
	const partNumbers = unique([
		raw.partNumber,
		raw.sku,
		...(raw.category === 'ics' ? extractIcCodes(raw.partNumber, raw.sku, raw.title) : [])
	]).filter((part) => part.length <= 60);
	const models = extractModelTerms(title, brand);
	const images = unique(raw.images ?? [], 10).filter((url) => /^https?:\/\//i.test(url));
	const sourceUrl = raw.url;
	if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return null;

	const candidate = {
		...raw,
		title,
		brand,
		price,
		compareAtPrice: Math.max(Math.round(Number(raw.compareAtPrice ?? 0)), price),
		inStock: raw.inStock !== false,
		stockText: cleanText(raw.stockText),
		partNumbers,
		models,
		images: images.length ? images : ['/product-placeholders/part.svg'],
		url: sourceUrl
	};
	return { ...candidate, key: categoryKey(candidate) };
}

function shortList(values, maxLength = 800) {
	const joined = unique(values, 80).join(', ');
	return joined.length <= maxLength ? joined : `${joined.slice(0, maxLength - 1).trim()},`;
}

function productFromCandidate(candidate, existingRow = null) {
	const meta = CATEGORY_META[candidate.category];
	const partNumberText = shortList(candidate.partNumbers);
	const modelText = shortList(candidate.models);
	const specificCode = candidate.partNumbers[0] ?? candidate.sku ?? '';
	const suffix = specificCode || candidate.title;
	const sku = existingRow?.sku || `${meta.prefix}-${slugPart(suffix)}`.slice(0, 96);
	const title = cleanTitle(candidate);
	const mrp = Math.max(candidate.compareAtPrice, Math.round(candidate.price * 1.22));
	const specifications = {
		'Product type': meta.label,
		'Primary code': specificCode,
		'Part numbers': partNumberText,
		'Compatible models': modelText,
		'Fit check': meta.compatibility,
		'Source availability': candidate.inStock ? 'Available at import time' : 'Out of stock at import time'
	};

	for (const key of Object.keys(specifications)) {
		if (!specifications[key]) delete specifications[key];
	}

	const compatibility =
		modelText && candidate.category !== 'ics'
			? `${meta.compatibility} Models: ${modelText}.`
			: meta.compatibility;

	const keywords = unique(
		[
			title,
			candidate.brand,
			candidate.category,
			sku,
			...candidate.partNumbers,
			...candidate.models,
			meta.label,
			candidate.category === 'ics' ? 'IC chip motherboard board repair' : ''
		],
		120
	);

	return {
		...(existingRow?.id ? { id: existingRow.id } : {}),
		title,
		brand: candidate.brand,
		category: candidate.category,
		image: candidate.images[0],
		images: candidate.images,
		source_url: candidate.url,
		description: `${title}. ${compatibility}`,
		sku,
		search_keywords: keywords,
		status: 'active',
		price: candidate.price,
		selling_price: candidate.price,
		mrp,
		rating: 4.6,
		reviews: 0,
		stock: candidate.inStock ? 10 : 0,
		compatibility,
		warranty: meta.warranty,
		highlights: meta.highlights,
		specifications,
		authenticity_grade: 'compatible',
		condition_grade: 'new',
		hsn_code: meta.hsn,
		gst_rate: 18,
		doa_policy_days: 7,
		local_delivery_eligible: true,
		cod_eligible: true,
		weight_kg: meta.weight_kg,
		length_cm: meta.length_cm,
		breadth_cm: meta.breadth_cm,
		height_cm: meta.height_cm,
		updated_at: new Date().toISOString()
	};
}

function cleanTitle(candidate) {
	const brand = candidate.brand === 'Compatible' ? '' : candidate.brand;
	let title = cleanText(candidate.title)
		.replace(/\brefurbished\b/gi, '')
		.replace(/\bused\b/gi, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (candidate.category === 'ics' && !/\bic\b/i.test(title)) title = `${title} IC`;
	if (candidate.category === 'hinges' && !/\bhinge/i.test(title)) title = `${title} Hinges`;
	if (candidate.category === 'cooling' && !/\bfan\b/i.test(title)) title = `${title} Cooling Fan`;
	if (candidate.category === 'dc_jacks' && !/\bjack\b/i.test(title)) title = `${title} DC Power Jack`;
	if (brand && !new RegExp(`\\b${brand}\\b`, 'i').test(title)) title = `${brand} ${title}`;
	if (!/\bcompatible\b/i.test(title)) title = `Compatible ${title}`;
	return title.replace(/\s+/g, ' ').slice(0, 180);
}

function parseLonexIcs(html) {
	const products = [];
	const base = SOURCES.lonexIcs;
	const ogImage =
		html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? '';
	const genericImage = absoluteUrl(ogImage, base);

	for (const block of html.matchAll(/<div[^>]+class=["'][^"']*(?:prd|product|rht)[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*(?:prd|product|rht)|<\/body>)/gi)) {
		const text = stripHtml(block[0]);
		if (!/\b(?:BQ|TPS|ISL|ENE|SMSC|IC)\b/i.test(text)) continue;
		const price = moneyFromText(text);
		if (!price) continue;
		const heading =
			stripHtml(block[0].match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1] ?? '') ||
			text.split(/Rs\.|INR/i)[0];
		const title = cleanText(heading).replace(/\bask price\b/gi, '').trim();
		if (!title) continue;
		products.push({
			source: 'Lonex',
			category: 'ics',
			title,
			url: base,
			images: [extractImageFromBlock(block[0], base), genericImage].filter(Boolean),
			price,
			compareAtPrice: Math.round(price * 1.2),
			inStock: !/\bout of stock|sold out|unavailable/i.test(text),
			stockText: text.match(/in stock|out of stock|available|sold out/i)?.[0] ?? '',
			sku: '',
			partNumber: extractIcCodes(title)[0] ?? ''
		});
	}

	if (products.length === 0) {
		for (const match of html.matchAll(/\b((?:BQ|TPS|ISL|ENE|SMSC|RT|MAX|NPCE)[A-Z0-9- ]{3,24})[\s\S]{0,160}?(?:Rs\.?|INR)\s*([0-9][0-9,.]*)/gi)) {
			const title = cleanText(`${match[1]} IC`);
			const price = Math.round(Number(match[2].replace(/,/g, '')));
			products.push({
				source: 'Lonex',
				category: 'ics',
				title,
				url: base,
				images: [genericImage].filter(Boolean),
				price,
				compareAtPrice: Math.round(price * 1.2),
				inStock: true,
				stockText: 'Available',
				sku: '',
				partNumber: extractIcCodes(title)[0] ?? ''
			});
		}
	}

	return products;
}

function parseLaptopPartsCategoryLinks(html) {
	return extractUrls(html, SOURCES.laptopPartsIcs, /\/ic-and-components\/laptop-ic\/[^/]+\/?$/i);
}

function parseLaptopPartsProductCards(html, pageUrl) {
	const products = [];
	for (const match of html.matchAll(/<div[^>]+class=["'][^"']*grid_item[^"']*["'][\s\S]*?<\/ul>\s*<\/div>/gi)) {
		const block = match[0];
		const url = absoluteUrl(block.match(/<a[^>]+href=["']([^"']+\.html)["']/i)?.[1] ?? '', pageUrl);
		const title = stripHtml(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
		const prices = [...block.matchAll(/(?:Rs\.?|INR)\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]+)?)/gi)]
			.map((item) => Number(item[1].replace(/,/g, '')))
			.filter((price) => Number.isFinite(price) && price > 0);
		if (!url || !title || prices.length === 0) continue;
		const price = Math.round(prices[prices.length - 1]);
		const compareAtPrice = Math.round(Math.max(...prices));
		products.push({
			source: 'LaptopParts',
			category: 'ics',
			title,
			url,
			images: [extractImageFromBlock(block, pageUrl)].filter(Boolean),
			price,
			compareAtPrice,
			inStock: !/\bout of stock|sold out|unavailable/i.test(stripHtml(block)),
			stockText: 'Available',
			sku: '',
			partNumber: extractIcCodes(title)[0] ?? ''
		});
	}
	return products;
}

function parseXfurbishProductCards(html, pageUrl) {
	const products = [];
	for (const match of html.matchAll(/<div[^>]+class=["'][^"']*product-layout[^"']*["'][\s\S]*?(?=<div[^>]+class=["'][^"']*product-layout|<\/div><\/div><\/div><\/div><\/div>)/gi)) {
		const block = match[0];
		const url = absoluteUrl(block.match(/<a[^>]+href=["']([^"']*\/laptop-ic\/[^"']+)["']/i)?.[1] ?? '', pageUrl);
		const title =
			stripHtml(block.match(/<div[^>]+class=["'][^"']*name[^"']*["'][\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '') ||
			stripHtml(block.match(/alt=["']([^"']+)["']/i)?.[1] ?? '');
		const price =
			Math.round(
				Number(
					(block.match(/class=["']price-new["'][^>]*>[\s\S]*?(?:&#x20b9;|₹)\s*([0-9,.]+)/i)?.[1] ??
						block.match(/class=["']price["'][\s\S]*?(?:&#x20b9;|₹)\s*([0-9,.]+)/i)?.[1] ??
						'')
						.replace(/,/g, '')
				)
			) || 0;
		const oldPrice =
			Math.round(
				Number(
					(block.match(/class=["']price-old["'][^>]*>[\s\S]*?(?:&#x20b9;|₹)\s*([0-9,.]+)/i)?.[1] ??
						'')
						.replace(/,/g, '')
				)
			) || 0;
		if (!url || !title || !price) continue;
		const brand = stripHtml(
			block.match(/<span[^>]*class=["']stats-label["'][^>]*>Brand:<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
		);
		const model = stripHtml(
			block.match(/<span[^>]*class=["']stats-label["'][^>]*>Model:<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''
		);
		products.push({
			source: 'Xfurbish',
			category: 'ics',
			title,
			url,
			images: [extractImageFromBlock(block, pageUrl)].filter(Boolean),
			price,
			compareAtPrice: oldPrice || Math.round(price * 1.2),
			inStock: !/\bout of stock|sold out|unavailable/i.test(stripHtml(block)),
			stockText: 'Available',
			sku: model,
			partNumber: extractIcCodes(model, title)[0] ?? model,
			brand
		});
	}
	return products;
}

function xFurbishPaginationUrls(html) {
	const urls = new Set([`${SOURCES.xfurbishIcs}?limit=100`]);
	for (const url of extractUrls(html, SOURCES.xfurbishIcs, /\/laptop-ic(?:\?|$)/i)) {
		if (/page=\d+/i.test(url) || /limit=100/i.test(url)) urls.add(url.replace(/&amp;/g, '&'));
	}
	return Array.from(urls).slice(0, 20);
}

async function collectLonexIcs() {
	const html = await fetchText(SOURCES.lonexIcs);
	const products = parseLonexIcs(html);
	console.log(`Lonex ICs: ${products.length}`);
	return products;
}

async function collectLaptopPartsIcs() {
	const firstHtml = await fetchText(SOURCES.laptopPartsIcs);
	const categoryUrls = parseLaptopPartsCategoryLinks(firstHtml);
	const products = [];
	for (const categoryUrl of categoryUrls) {
		const html = await fetchText(categoryUrl);
		products.push(...parseLaptopPartsProductCards(html, categoryUrl));
		process.stdout.write(`\rLaptopParts IC categories: ${products.length} products`);
	}
	process.stdout.write('\n');
	return products;
}

async function collectXfurbishIcs() {
	const firstUrl = `${SOURCES.xfurbishIcs}?limit=100`;
	const firstHtml = await fetchText(firstUrl);
	const urls = xFurbishPaginationUrls(firstHtml);
	const products = [];
	for (const url of urls) {
		const html = url === firstUrl ? firstHtml : await fetchText(url);
		products.push(...parseXfurbishProductCards(html, url));
		process.stdout.write(`\rXfurbish IC pages: ${products.length} products`);
	}
	process.stdout.write('\n');
	return products;
}

function normalizeShopifyProduct(source, category, product) {
	const variant = (product.variants ?? []).find((item) => item.available) ?? product.variants?.[0];
	if (!variant) return null;
	const price = moneyFromShopify(variant.price);
	if (!price) return null;
	const images = unique((product.images ?? []).map((image) => image.src).filter(Boolean), 12);
	const sourceUrl = `${source.collectionUrl.replace(/\/+$/, '')}/products/${product.handle}`;
	return {
		source: source.name,
		category,
		title: product.title,
		url: sourceUrl,
		images,
		price,
		compareAtPrice: moneyFromShopify(variant.compare_at_price) || Math.round(price * 1.2),
		inStock: variant.available !== false,
		stockText: variant.available === false ? 'Sold out' : 'Available',
		sku: variant.sku,
		partNumber: variant.sku,
		brand: resolveBrand(product.vendor, product.title, variant.sku)
	};
}

async function collectShopifyCollection(source, category) {
	const products = [];
	for (let page = 1; page <= 20; page += 1) {
		const url = `${source.collectionUrl.replace(/\/+$/, '')}/products.json?limit=${SHOPIFY_LIMIT}&page=${page}`;
		const json = await fetchJson(url);
		const rows = Array.isArray(json.products) ? json.products : [];
		products.push(...rows.map((product) => normalizeShopifyProduct(source, category, product)).filter(Boolean));
		process.stdout.write(`\r${source.name} ${category}: page ${page}, ${products.length} products`);
		if (rows.length < SHOPIFY_LIMIT) break;
	}
	process.stdout.write('\n');
	return products;
}

async function collectAllRawCandidates() {
	const sources = await Promise.all([
		collectLonexIcs(),
		collectLaptopPartsIcs(),
		collectXfurbishIcs(),
		collectShopifyCollection(
			{ name: 'Techcommerce', collectionUrl: SOURCES.techcommerceHinges },
			'hinges'
		),
		collectShopifyCollection({ name: 'PartsBaba', collectionUrl: SOURCES.partsBabaFans }, 'cooling'),
		collectShopifyCollection(
			{ name: 'PartsBaba', collectionUrl: SOURCES.partsBabaDcJacks },
			'dc_jacks'
		)
	]);
	return sources.flat();
}

function dedupeCandidates(rawCandidates) {
	const normalized = rawCandidates.map(normalizeCandidate).filter(Boolean);
	const byKey = new Map();
	const alternatives = new Map();
	for (const candidate of normalized) {
		alternatives.set(candidate.key, [...(alternatives.get(candidate.key) ?? []), candidate]);
		byKey.set(candidate.key, betterCandidate(byKey.get(candidate.key), candidate));
	}
	const deduped = Array.from(byKey.values());
	for (const candidate of deduped) {
		candidate.alternatives = (alternatives.get(candidate.key) ?? [])
			.filter((item) => item.url !== candidate.url)
			.map((item) => ({
				source: item.source,
				price: item.price,
				inStock: item.inStock,
				url: item.url
			}));
	}
	return { normalized, deduped };
}

async function fetchExistingProducts(supabase) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from('products')
			.select(
				'id,title,brand,category,sku,status,source_url,price,mrp,stock,compatibility,search_keywords,specifications'
			)
			.in('category', [...TARGET_CATEGORIES, 'displays'])
			.range(from, from + 999);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < 1000) break;
	}
	return rows;
}

function existingKey(row) {
	return categoryKey({
		category: row.category,
		title: row.title,
		brand: row.brand,
		sku: row.sku,
		partNumber:
			row.specifications?.['Primary code'] ??
			row.specifications?.['Part numbers'] ??
			row.specifications?.['Part Number'] ??
			row.sku,
		price: row.price,
		url: row.source_url,
		images: []
	});
}

function planDatabaseChanges(existingRows, dedupedCandidates) {
	const existingTargets = existingRows.filter((row) => TARGET_CATEGORIES.includes(row.category));
	const existingByKey = new Map();
	for (const row of existingTargets) {
		const key = existingKey(row);
		if (!key) continue;
		existingByKey.set(key, [...(existingByKey.get(key) ?? []), row]);
	}

	const updates = [];
	const inserts = [];
	const chosenExistingIds = new Set();

	for (const candidate of dedupedCandidates) {
		const matchingRows = existingByKey.get(candidate.key) ?? [];
		const existingRow =
			matchingRows.find((row) => row.sku?.startsWith(CATEGORY_META[candidate.category].prefix)) ??
			matchingRows.find((row) => row.source_url === candidate.url) ??
			matchingRows[0] ??
			null;
		const product = productFromCandidate(candidate, existingRow);
		if (existingRow?.id) {
			chosenExistingIds.add(existingRow.id);
			updates.push({
				id: existingRow.id,
				key: candidate.key,
				source: candidate.source,
				source_url: candidate.url,
				patch: product
			});
		} else {
			inserts.push({ key: candidate.key, source: candidate.source, source_url: candidate.url, product });
		}
	}

	const duplicateDrafts = [];
	for (const [key, rows] of existingByKey) {
		const activeRows = rows.filter((row) => row.status !== 'draft');
		if (activeRows.length <= 1) continue;
		const keep =
			activeRows.find((row) => chosenExistingIds.has(row.id)) ??
			activeRows.find((row) => row.sku?.startsWith('LK-')) ??
			activeRows[0];
		for (const row of activeRows) {
			if (row.id === keep.id) continue;
			duplicateDrafts.push({
				id: row.id,
				key,
				title: row.title,
				category: row.category,
				kept_id: keep.id
			});
		}
	}

	return { updates, inserts, duplicateDrafts };
}

async function setCategoryStatuses(supabase) {
	const result = {
		displaysDrafted: 0,
		icsActivated: 0
	};
	if (skipStatus) return result;

	const displayIds = await fetchStatusIds(supabase, 'displays', 'draft');
	result.displaysDrafted = await updateStatusIds(supabase, displayIds, {
		status: 'draft',
		updated_at: new Date().toISOString()
	});

	const icIds = await fetchStatusIds(supabase, 'ics', 'active');
	result.icsActivated = await updateStatusIds(supabase, icIds, {
		status: 'active',
		updated_at: new Date().toISOString()
	});

	return result;
}

async function fetchStatusIds(supabase, category, targetStatus) {
	const ids = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from('products')
			.select('id,status')
			.eq('category', category)
			.order('id', { ascending: true })
			.range(from, from + 999);
		if (error) throw error;
		ids.push(...(data ?? []).filter((row) => row.status !== targetStatus).map((row) => row.id));
		if (!data || data.length < 1000) break;
	}
	return ids;
}

async function updateStatusIds(supabase, ids, patch) {
	let updated = 0;
	for (let index = 0; index < ids.length; index += STATUS_BATCH_SIZE) {
		const batch = ids.slice(index, index + STATUS_BATCH_SIZE);
		updated += await updatePatchIds(supabase, batch, patch);
		process.stdout.write(`\rStatus updates ${Math.min(index + batch.length, ids.length)}/${ids.length}`);
	}
	if (ids.length) process.stdout.write('\n');
	return updated;
}

async function updatePatchIds(supabase, ids, patch) {
	if (ids.length === 0) return 0;
	const { error } = await supabase.from('products').update(patch).in('id', ids);
	if (!error) return ids.length;
	if (error.code === '57014' && ids.length > 1) {
		const middle = Math.ceil(ids.length / 2);
		const first = await updatePatchIds(supabase, ids.slice(0, middle), patch);
		const second = await updatePatchIds(supabase, ids.slice(middle), patch);
		return first + second;
	}
	throw error;
}

async function applyChanges(supabase, plan) {
	const result = {
		updated: 0,
		inserted: 0,
		duplicatesDrafted: 0,
		errors: []
	};

	for (const item of plan.updates) {
		const patch = { ...item.patch };
		delete patch.id;
		const { error } = await supabase.from('products').update(patch).eq('id', item.id);
		if (error) result.errors.push({ type: 'update', id: item.id, error: error.message });
		else result.updated += 1;
	}

	for (let index = 0; index < plan.inserts.length; index += WRITE_BATCH_SIZE) {
		const batch = plan.inserts.slice(index, index + WRITE_BATCH_SIZE).map((item) => item.product);
		try {
			result.inserted += await upsertProductBatch(supabase, batch);
		} catch (error) {
			result.errors.push({
				type: 'insert',
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	for (let index = 0; index < plan.duplicateDrafts.length; index += WRITE_BATCH_SIZE) {
		const ids = plan.duplicateDrafts.slice(index, index + WRITE_BATCH_SIZE).map((item) => item.id);
		const { error } = await supabase
			.from('products')
			.update({ status: 'draft', stock: 0, updated_at: new Date().toISOString() })
			.in('id', ids);
		if (error) result.errors.push({ type: 'duplicate-draft', ids, error: error.message });
		else result.duplicatesDrafted += ids.length;
	}

	return result;
}

async function upsertProductBatch(supabase, products) {
	if (products.length === 0) return 0;
	const { error } = await supabase.from('products').upsert(products, { onConflict: 'sku' });
	if (!error) return products.length;
	if (error.code === '57014' && products.length > 1) {
		const middle = Math.ceil(products.length / 2);
		const first = await upsertProductBatch(supabase, products.slice(0, middle));
		const second = await upsertProductBatch(supabase, products.slice(middle));
		return first + second;
	}
	throw new Error(error.message);
}

function summarizeByCategory(rows) {
	return rows.reduce((summary, row) => {
		const category = row.category ?? row.product?.category ?? 'unknown';
		summary[category] = (summary[category] ?? 0) + 1;
		return summary;
	}, {});
}

function summarizeBySource(rows) {
	return rows.reduce((summary, row) => {
		const source = row.source ?? 'unknown';
		summary[source] = (summary[source] ?? 0) + 1;
		return summary;
	}, {});
}

loadDotEnv();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

if (statusOnly) {
	if (!apply) throw new Error('--status-only must be used with --apply');
	const statusResult = await setCategoryStatuses(supabase);
	const audit = {
		generatedAt: new Date().toISOString(),
		mode: 'status-only',
		sources: SOURCES,
		counts: {
			...statusResult
		},
		outputDir
	};
	writeJson('audit.json', audit);
	console.log(JSON.stringify(audit, null, 2));
	console.log(`Audit saved to ${outputDir}`);
	process.exit(0);
}

const rawCandidates = (await collectAllRawCandidates()).slice(0, limit || undefined);
const { normalized, deduped } = dedupeCandidates(rawCandidates);
const existingRows = await fetchExistingProducts(supabase);
const plan = planDatabaseChanges(existingRows, deduped);

let statusResult = { displaysDrafted: 0, icsActivated: 0 };
let applyResult = { updated: 0, inserted: 0, duplicatesDrafted: 0, errors: [] };
if (apply) {
	statusResult = await setCategoryStatuses(supabase);
	applyResult = await applyChanges(supabase, plan);
}

const audit = {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	sources: SOURCES,
	counts: {
		rawCandidates: rawCandidates.length,
		normalized: normalized.length,
		deduped: deduped.length,
		normalizedByCategory: summarizeByCategory(normalized),
		dedupedByCategory: summarizeByCategory(deduped),
		dedupedBySource: summarizeBySource(deduped),
		updates: plan.updates.length,
		inserts: plan.inserts.length,
		duplicateDrafts: plan.duplicateDrafts.length,
		...statusResult,
		...applyResult,
		errorCount: applyResult.errors.length
	},
	outputDir
};

writeJson('audit.json', audit);
writeJson('raw-candidates.json', rawCandidates);
writeJson('normalized-candidates.json', normalized);
writeJson('deduped-candidates.json', deduped);
writeJson('planned-updates.json', plan.updates);
writeJson('planned-inserts.json', plan.inserts);
writeJson('planned-duplicate-drafts.json', plan.duplicateDrafts);

console.log(JSON.stringify(audit, null, 2));
console.log(`Audit saved to ${outputDir}`);
if (apply && !skipTypesense) {
	console.log('Run npm.cmd run typesense:sync after this script completes.');
}
