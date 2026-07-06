// Import India-relevant non-touch laptop displays from Bliss Computers.
//
// Dry run (default):
//   node scripts/import-bliss-india-displays.mjs
// Apply reviewed inserts and compatibility enrichments:
//   node scripts/import-bliss-india-displays.mjs --apply
// Refresh the source crawl:
//   node scripts/import-bliss-india-displays.mjs --refresh

// The importer never creates a row without both India-market model evidence and
// a strong panel/OEM part number. Existing part-number matches are enriched
// instead of duplicated, and ambiguous matches are quarantined in the audit.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(root, '.firecrawl', 'bliss-india-display-import');
const listingsFile = join(cacheDir, 'listings.json');
const detailsFile = join(cacheDir, 'details.json');
const auditFile = join(cacheDir, 'audit.json');

const CATEGORY_URL = 'https://www.blisscomputers.net/non-touch-screen/';
const PAGE_SIZE = 100;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_DETAIL_LIMIT = 120;
const WARRANTY = '6 months replacement warranty';
const PLACEHOLDER_IMAGE =
	'https://www.power-x.in/cdn/shop/files/laptop-screen-156-40-pin-full-hdpowerx-the-technology-people-104400.png?v=1739959776&width=800';
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 30;
const DEFAULT_HEIGHT_CM = 8;

// Each broad family is backed by an official India catalog. Exact models already
// present in LapKart's non-display catalog are accepted independently.
const INDIA_FAMILY_RULES = [
	{
		brand: 'Lenovo',
		families: ['ideapad', 'thinkpad', 'thinkbook', 'yoga', 'loq', 'legion'],
		source: 'https://store.lenovo.com/in/en/laptops.html'
	},
	{
		brand: 'Dell',
		families: ['inspiron', 'vostro', 'latitude', 'xps', 'precision', 'alienware', 'g15', 'g16'],
		source: 'https://www.dell.com/en-in/shop/dell-laptops/scr/laptops'
	},
	{
		brand: 'HP',
		families: [
			'pavilion',
			'envy',
			'spectre',
			'victus',
			'omen',
			'probook',
			'elitebook',
			'zbook',
			'chromebook'
		],
		source: 'https://www.hp.com/in-en/shop/laptops-tablets.html'
	},
	{
		brand: 'Asus',
		families: ['vivobook', 'zenbook', 'tuf', 'rog', 'expertbook', 'proart', 'chromebook'],
		source: 'https://www.asus.com/in/laptops/'
	},
	{
		brand: 'Acer',
		families: [
			'aspire',
			'swift',
			'nitro',
			'predator',
			'travelmate',
			'travellite',
			'extensa',
			'spin',
			'chromebook',
			'acer one'
		],
		source: 'https://store.acer.com/en-in/acer-laptops'
	},
	{
		brand: 'MSI',
		families: [
			'modern',
			'prestige',
			'summit',
			'katana',
			'sword',
			'cyborg',
			'stealth',
			'raider',
			'titan',
			'vector',
			'pulse',
			'bravo',
			'creator'
		],
		source: 'https://in.msi.com/Laptop'
	},
	{
		brand: 'Samsung',
		families: ['galaxy book'],
		source: 'https://www.samsung.com/in/computers/galaxy-book/'
	},
	{
		brand: 'LG',
		families: ['gram'],
		source: 'https://www.lg.com/in/laptops'
	},
	{
		brand: 'Apple',
		families: ['macbook'],
		source: 'https://www.apple.com/in/mac/'
	}
];

const KNOWN_BRANDS = [
	'Acer',
	'Apple',
	'Asus',
	'Dell',
	'Fujitsu',
	'HP',
	'Lenovo',
	'LG',
	'MSI',
	'Samsung',
	'Sony',
	'Toshiba'
];

const PANEL_MAKERS = new Set([
	'au optronics',
	'auo',
	'boe',
	'boehydis',
	'chi mei',
	'chimei',
	'innolux',
	'lg display',
	'panasonic',
	'sharp'
]);
const MODEL_FAMILIES = uniqueFamilyNames([
	...INDIA_FAMILY_RULES.flatMap((rule) => rule.families),
	'chromebook',
	'lifebook',
	'portege',
	'satellite',
	'tecra',
	'vaio'
]);

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refresh = args.has('--refresh');
const cleanupStale = args.has('--cleanup-stale');
const pageLimit = numericArg('--page-limit=');
const listingLimit = numericArg('--listing-limit=');
const detailLimitArg = numericArg('--detail-limit=');
const detailLimit = process.argv.some((arg) => arg.startsWith('--detail-limit='))
	? detailLimitArg
	: DEFAULT_DETAIL_LIMIT;
const concurrency = numericArg('--concurrency=') || DEFAULT_CONCURRENCY;

function numericArg(prefix) {
	const value = process.argv.find((arg) => arg.startsWith(prefix));
	if (!value) return 0;
	const parsed = Number(value.slice(prefix.length));
	return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function uniqueFamilyNames(values) {
	return [...new Set(values.map((value) => value.toLowerCase()))].sort(
		(a, b) => b.length - a.length
	);
}

function parseEnv() {
	const env = {};
	for (const rawLine of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const index = line.indexOf('=');
		if (index < 1) continue;
		let value = line.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[line.slice(0, index).trim()] = value;
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

function truncate(value, max) {
	const text = cleanText(value);
	return text.length <= max ? text : text.slice(0, max - 1).trimEnd();
}

function unique(values, max = Infinity) {
	const seen = new Set();
	const output = [];
	for (const value of values) {
		const text = cleanText(value);
		if (!text) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(text);
		if (output.length >= max) break;
	}
	return output;
}

function normalizeCompact(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '');
}

function slugPart(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/[^A-Z0-9.-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 70);
}

function sourceId(url) {
	return String(url).match(/-(\d+)\/?(?:[?#].*)?$/)?.[1] ?? slugPart(url).slice(-18);
}

function splitKeywords(values, max = 180) {
	const expanded = [];
	for (const value of values) {
		const text = cleanText(value);
		if (!text) continue;
		expanded.push(text, text.replace(/[-_.()/\s]+/g, ''), text.replace(/[-_.()/]+/g, ' '));
		expanded.push(...text.split(/[\s,;/|()]+/).filter((token) => token.length >= 2));
	}
	return unique(
		expanded.map((value) => value.slice(0, 100)),
		max
	);
}

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
	let lastError;
	for (let attempt = 1; attempt <= 4; attempt += 1) {
		try {
			const response = await fetch(url, {
				headers: {
					accept: 'text/html,*/*',
					'user-agent': 'LapKart catalog importer (+https://www.lapkart.store)'
				},
				signal: AbortSignal.timeout(60000)
			});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
			return response.text();
		} catch (error) {
			lastError = error;
			if (attempt < 4) await sleep(attempt * 1000);
		}
	}
	throw lastError;
}

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workers = Array.from(
		{ length: Math.min(Math.max(1, limit), Math.max(1, values.length)) },
		async () => {
			while (index < values.length) {
				const current = index;
				index += 1;
				results[current] = await mapper(values[current], current);
			}
		}
	);
	await Promise.all(workers);
	return results;
}

function pageUrl(page) {
	return `${CATEGORY_URL}?limit=${PAGE_SIZE}&page=${page}`;
}

function parsePriceInr(value) {
	const text = cleanText(value).replace(/,/g, '');
	const amount = Number(text.match(/[0-9]+(?:\.[0-9]+)?/)?.[0] ?? 0);
	if (!Number.isFinite(amount) || amount <= 0) return 0;
	if (/\$|USD/i.test(text)) return Math.round(amount * 95.12);
	return Math.round(amount);
}

function parseInlineSpec(text, label) {
	const labels =
		'Brand|Series|Model|Size|Resolution|Pixels|Type|Backlight(?: Type| Lamp)?|Connector|Pin Connection|Side|Finish|Condition|Commodity|Technology';
	const match = String(text).match(new RegExp(`${label}:\\s*(.*?)(?=(?:${labels}):|$)`, 'i'));
	return cleanText(match?.[1] ?? '');
}

function inferBrand(text) {
	const source = cleanText(text);
	if (/\bHewlett[ -]?Packard\b/i.test(source)) return 'HP';
	for (const brand of KNOWN_BRANDS) {
		if (new RegExp(`\\b${brand.replace(/\s+/g, '[ -]?')}\\b`, 'i').test(source)) return brand;
	}
	return '';
}

function normalizeBrand(value, context = '') {
	const inferred = inferBrand(`${value} ${context}`);
	if (inferred) return inferred;
	const text = cleanText(value);
	if (!text || PANEL_MAKERS.has(text.toLowerCase()) || /non touch screen/i.test(text)) return '';
	return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferSeriesAndModel(title, currentSeries = '', currentModel = '') {
	const sanitizedCurrentModel = cleanText(currentModel).replace(
		/\s+\b(?:bottom|top|left|right|standard|reverse|narrow)\b.*$/i,
		''
	);
	if (currentSeries && sanitizedCurrentModel)
		return { series: currentSeries, model: sanitizedCurrentModel };
	const source = cleanText(title);
	const lower = source.toLowerCase();
	const family = MODEL_FAMILIES.find((value) => lower.includes(value));
	if (!family) return { series: currentSeries, model: currentModel };
	const familyIndex = lower.indexOf(family);
	const tail = source.slice(familyIndex + family.length).trim();
	const tokens = tail.split(/\s+/);
	const modelTokens = [];
	for (const token of tokens) {
		const cleaned = token.replace(/^[,;/]+|[,;/]+$/g, '');
		if (
			!cleaned ||
			/^(?:replacement|laptop|lcd|led|screen|display|panel|non|touch|assembly|with|for|bottom|top|left|right|standard|reverse|narrow)$/i.test(
				cleaned
			) ||
			/^\d+(?:\.\d+)?["”]?$/.test(cleaned) ||
			/^\d+[- ]?pins?$/i.test(cleaned) ||
			/^(?:wxga|fhd|full|hd|uhd|qhd|wqhd)$/i.test(cleaned)
		) {
			break;
		}
		modelTokens.push(cleaned);
		if (modelTokens.length >= 4) break;
	}
	const inferredModel = cleanText(modelTokens.join(' '));
	return {
		series: currentSeries || family.replace(/\b\w/g, (letter) => letter.toUpperCase()),
		model: sanitizedCurrentModel || (/\d/.test(inferredModel) ? inferredModel : '')
	};
}

function parseListingCards(html, page) {
	const cards = [];
	for (const match of String(html).matchAll(
		/<li\b[^>]*class=["'][^"']*\bproduct\b[^"']*["'][^>]*>[\s\S]*?<\/li>/gi
	)) {
		const block = match[0];
		const titleMatch = block.match(
			/<h4\b[^>]*class=["'][^"']*card-title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i
		);
		if (!titleMatch) continue;
		const url = decodeHtml(titleMatch[1]);
		const title = cleanText(titleMatch[2]);
		if (!url || !title) continue;
		const summary = cleanText(
			block.match(/data-test-info-type=["']summary["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''
		);
		const combined = `${title} ${summary}`;
		const productId = block.match(/data-product-id=["'](\d+)["']/i)?.[1] ?? sourceId(url);
		const priceText = cleanText(block.match(/price--main[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
		const brand = normalizeBrand(parseInlineSpec(combined, 'Brand'), title);
		const inferred = inferSeriesAndModel(
			title,
			parseInlineSpec(combined, 'Series'),
			parseInlineSpec(combined, 'Model')
		);
		cards.push({
			productId,
			url,
			title,
			summary,
			price: parsePriceInr(priceText),
			priceText,
			page,
			brand,
			series: inferred.series,
			model: inferred.model,
			size: parseInlineSpec(combined, 'Size'),
			resolution: parseInlineSpec(combined, 'Resolution'),
			pixels: parseInlineSpec(combined, 'Pixels'),
			connector: parseInlineSpec(combined, 'Connector'),
			pins: parseInlineSpec(combined, 'Pin Connection'),
			side: parseInlineSpec(combined, 'Side')
		});
	}
	return cards;
}

async function collectListings() {
	const cached = loadJson(listingsFile, null);
	if (cached?.listings?.length) return cached;

	const firstHtml = await fetchText(pageUrl(1));
	const total = Number(
		cleanText(firstHtml).match(/Items\s+\d+\s+to\s+\d+\s+of\s+(\d+)\s+total/i)?.[1] ?? 0
	);
	const availablePages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const pages = Math.min(availablePages, pageLimit || availablePages);
	const pageNumbers = Array.from({ length: pages }, (_, index) => index + 1);
	const errors = [];
	const pageResults = await mapLimit(pageNumbers, concurrency, async (page, index) => {
		try {
			const html = page === 1 ? firstHtml : await fetchText(pageUrl(page));
			const cards = parseListingCards(html, page);
			process.stdout.write(
				`Bliss listing pages ${index + 1}/${pages} (${cards.length} products)\r`
			);
			return cards;
		} catch (error) {
			errors.push({ page, error: error instanceof Error ? error.message : String(error) });
			return [];
		}
	});
	process.stdout.write('\n');
	let listings = pageResults.flat();
	if (listingLimit) listings = listings.slice(0, listingLimit);
	const result = { generatedAt: new Date().toISOString(), total, pages, errors, listings };
	saveJson(listingsFile, result);
	return result;
}

function partNumberScore(value) {
	const token = cleanText(value)
		.toUpperCase()
		.replace(/^[^A-Z0-9]+|[^A-Z0-9)]+$/g, '');
	if (token.length < 5 || token.length > 32 || !/[A-Z]/.test(token) || !/\d/.test(token)) return 0;
	if (/(?:REPLACEMENT|BRACKETS?|LISTED|DIODE|SCREEN|LAPTOP|PANEL|TOUCH|SIZE)/i.test(token))
		return 0;
	if (MODEL_FAMILIES.some((family) => token.includes(family.toUpperCase().replace(/\s+/g, '-'))))
		return 0;
	if (/^(?:LED|LCD|FULLHD|WXGA|FHD|UHD|WQHD|E?DP)$/i.test(token)) return 0;
	if (/^\d{3,4}X\d{3,4}$/i.test(token)) return 0;
	if (/^\d+\.[A-Z]/i.test(token)) return 0;
	if ((token.match(/\(/g)?.length ?? 0) !== (token.match(/\)/g)?.length ?? 0)) return 0;
	if (/^(?:I[3579]-?\d|RYZEN|CORE|PENTIUM|CELERON)[A-Z0-9.-]*$/i.test(token)) return 0;
	let score = 0;
	if (/^(?:LP|NV|NT|LTN|LQ|NE)\d{3}[A-Z]/.test(token)) score += 7;
	if (/^[BNM]\d{3}[A-Z]/.test(token)) score += 7;
	if (/^(?:5D|01A|02D|03T|04X|0[A-Z0-9])[A-Z0-9.-]{5,}$/.test(token)) score += 6;
	if (/^[A-Z]\d{5}-\d{3}$/.test(token)) score += 7;
	if (/^P\d{8}$/.test(token)) score += 7;
	if (/[-.()]/.test(token)) score += 3;
	if (token.length >= 8) score += 2;
	if (/^[A-Z0-9]{5,7}$/.test(token)) score += 2;
	return score;
}

function extractPartNumbers(text, excludedModels = []) {
	const excluded = excludedModels.map(normalizeCompact).filter(Boolean);
	const matches =
		String(text)
			.toUpperCase()
			.match(/\b[A-Z0-9][A-Z0-9()./-]{3,31}\b/g) ?? [];
	return unique(
		matches
			.map((value) => value.replace(/\/$/, ''))
			.filter((value) => partNumberScore(value) >= 4)
			.filter((value) => {
				const key = normalizeCompact(value);
				return !excluded.some(
					(model) => model === key || model.endsWith(key) || key.endsWith(model)
				);
			})
			.sort((a, b) => partNumberScore(b) - partNumberScore(a) || b.length - a.length),
		40
	);
}

function sanitizePartAliases(values, models = []) {
	const modelText = normalizeCompact(models.join(' '));
	return unique(
		values
			.filter((value) => partNumberScore(value) >= 4)
			.filter((value) => {
				const key = normalizeCompact(value);
				return partNumberScore(value) >= 6 || !modelText.includes(key);
			})
			.sort((a, b) => partNumberScore(b) - partNumberScore(a) || b.length - a.length),
		50
	);
}

function primaryModelName(entry) {
	return cleanText([entry.brand, entry.series, entry.model].filter(Boolean).join(' '));
}

function splitModelLine(line) {
	const brandPattern = KNOWN_BRANDS.map((brand) => brand.replace(/\s+/g, '[ -]?')).join('|');
	return String(line)
		.split(new RegExp(`(?=\\b(?:${brandPattern})\\b)`, 'i'))
		.map(cleanText)
		.filter(Boolean);
}

function sanitizeModelAliases(values, partNumbers = []) {
	const partKeys = new Set(partNumbers.map(normalizeCompact));
	const candidates = values.flatMap(splitModelLine);
	return unique(
		candidates.filter((value) => {
			const normalized = normalizeCompact(value);
			const lower = value.toLowerCase();
			if (value.length < 5 || value.length > 140 || !/\d/.test(value)) return false;
			if (/\bP\s*\/\s*N\b|\bpart\s*number\b/i.test(value)) return false;
			if (/\d+GB\/|\bi[3579]-\d|\b(?:128|256|512)GB\b|\b[12]TB\b|\bHSPA\b/i.test(value))
				return false;
			if (partKeys.has(normalized)) return false;
			return MODEL_FAMILIES.some((family) => lower.includes(family));
		}),
		80
	);
}

function familyEvidence(entry) {
	const haystack = cleanText(
		`${entry.title} ${entry.summary} ${entry.brand} ${entry.series} ${entry.model}`
	).toLowerCase();
	for (const rule of INDIA_FAMILY_RULES) {
		if (entry.brand.toLowerCase() !== rule.brand.toLowerCase()) continue;
		const family = rule.families.find((value) => haystack.includes(value));
		if (family) return { type: 'official-india-family', family, source: rule.source };
	}
	return null;
}

function existingCatalogEvidence(entry, corpus) {
	const model = normalizeCompact(primaryModelName(entry));
	const shortModel = normalizeCompact(`${entry.brand} ${entry.model}`);
	if (model.length >= 7 && corpus.includes(model))
		return { type: 'lapkart-model', model: primaryModelName(entry) };
	if (shortModel.length >= 7 && corpus.includes(shortModel))
		return { type: 'lapkart-model', model: `${entry.brand} ${entry.model}` };
	return null;
}

function isModelSpecific(entry) {
	if (!entry.brand || !entry.model) return false;
	if (PANEL_MAKERS.has(entry.brand.toLowerCase())) return false;
	if (
		/\b(?:tablet|all[- ]in[- ]one|aio|monitor|surface pro)\b/i.test(
			`${entry.title} ${entry.series} ${entry.model}`
		)
	)
		return false;
	const model = normalizeCompact(entry.model);
	if (model.length < 2 || /^(?:NONTOUCH|LCD|LED|SCREEN|PANEL)$/.test(model)) return false;
	return true;
}

function enrichListingIdentity(entry) {
	const inferred = inferSeriesAndModel(entry.title, entry.series, entry.model);
	const normalizedEntry = { ...entry, series: inferred.series, model: inferred.model };
	const modelName = primaryModelName(normalizedEntry);
	return {
		...normalizedEntry,
		partNumbers: extractPartNumbers(`${entry.title} ${entry.summary}`, [
			normalizedEntry.model,
			modelName
		]),
		models: modelName ? [modelName] : []
	};
}

function titleConnector(value) {
	const text = cleanText(value);
	if (/^eDP(?:\s*1\.4)?$/i.test(text)) return text.replace(/^edp/i, 'eDP');
	if (/^LVDS$/i.test(text)) return 'LVDS';
	if (/^(?:LED|Mini-LED|CCFL)$/i.test(text)) return text;
	return '';
}

function detailDescriptionHtml(html) {
	const start = html.search(/id=["']tab-description["']/i);
	if (start < 0) return '';
	const tail = html.slice(start);
	const endCandidates = [
		tail.search(/id=["']tab-yotpoReviews["']/i),
		tail.search(/id=["']tab-warranty["']/i),
		tail.search(/class=["'][^"']*relatedProducts/i)
	].filter((value) => value > 0);
	return tail.slice(0, endCandidates.length ? Math.min(...endCandidates) : 50000);
}

function htmlLines(value) {
	return decodeHtml(value)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<br\s*\/?\s*>|<\/(?:li|p|div|tr|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.split(/\r?\n/)
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean);
}

function parseDetail(url, html) {
	const descriptionHtml = detailDescriptionHtml(html);
	const specs = {};
	for (const match of descriptionHtml.matchAll(
		/<li\b[^>]*>\s*<(?:b|strong)>\s*([^:<]+):?\s*<\/(?:b|strong)>\s*([\s\S]*?)<\/li>/gi
	)) {
		const label = cleanText(match[1]);
		const value = cleanText(match[2]);
		if (label && value) specs[label] = value;
	}
	const lines = htmlLines(descriptionHtml);
	const compatibilityStart = lines.findIndex((line) => /^Compatibility\s*:/i.test(line));
	const compatibilityLines =
		compatibilityStart >= 0
			? lines
					.slice(compatibilityStart + 1, compatibilityStart + 80)
					.filter((line) => !/^Title\s*-/i.test(line))
			: [];
	const titleLine = lines.find((line) => /^Title\s*-/i.test(line)) ?? '';
	const brand = normalizeBrand(
		specs.Brand,
		html.match(/productView-title[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''
	);
	const series = cleanText(specs.Series ?? '');
	const model = cleanText(specs.Model ?? '');
	const baseModel = cleanText([brand, series, model].filter(Boolean).join(' '));
	const compatibleModels = sanitizeModelAliases([
		baseModel,
		...compatibilityLines.filter((line) => {
			if (
				line.length > 220 ||
				/\d+GB\/|\bi[3579]-\d|\b(?:HSPA|PCNB|BASE MODEL|NOTEBOOK PC)\b/i.test(line)
			)
				return false;
			const lower = line.toLowerCase();
			const startsWithBrand = KNOWN_BRANDS.some((known) =>
				new RegExp(`^${known}\\b`, 'i').test(line)
			);
			const hasFamily = MODEL_FAMILIES.some((family) => lower.includes(family));
			return startsWithBrand && hasFamily;
		})
	]);
	const partNumbers = extractPartNumbers(`${cleanText(descriptionHtml)} ${titleLine}`, [
		model,
		baseModel,
		...compatibleModels
	]);
	return {
		url,
		brand,
		series,
		model,
		size: cleanText(specs.Size ?? ''),
		resolution: cleanText(specs.Resolution ?? ''),
		pixels: cleanText(specs.Pixels ?? ''),
		connector: cleanText(specs.Connector ?? specs['Backlight Type'] ?? ''),
		pins: cleanText(specs['Pin Connection'] ?? ''),
		side: cleanText(specs.Side ?? ''),
		condition: cleanText(specs.Condition ?? ''),
		availability: cleanText(
			html.match(/productView-info-value--availability[^>]*>([\s\S]*?)<\/dd>/i)?.[1] ?? ''
		),
		sourceSku: cleanText(html.match(/data-product-sku[^>]*>([\s\S]*?)<\/dd>/i)?.[1] ?? ''),
		models: compatibleModels,
		partNumbers
	};
}

function mergeDetail(entry, detail) {
	if (!detail) return entry;
	const partNumbers = unique([...(entry.partNumbers ?? []), ...(detail.partNumbers ?? [])], 40);
	return {
		...entry,
		brand: detail.brand || entry.brand,
		series: detail.series || entry.series,
		model: detail.model || entry.model,
		size: detail.size || entry.size,
		resolution: detail.resolution || entry.resolution,
		pixels: detail.pixels || entry.pixels,
		connector: detail.connector || entry.connector,
		pins: detail.pins || entry.pins,
		side: detail.side || entry.side,
		availability: detail.availability,
		sourceSku: detail.sourceSku,
		models: sanitizeModelAliases([...(entry.models ?? []), ...(detail.models ?? [])], partNumbers),
		partNumbers
	};
}

async function fetchDetails(entries) {
	const cache = loadJson(detailsFile, {});
	const prioritized = [...entries].sort((a, b) => {
		const missingA = Number(a.partNumbers.length < 2) + Number(!a.pixels) + Number(!a.pins);
		const missingB = Number(b.partNumbers.length < 2) + Number(!b.pixels) + Number(!b.pins);
		return missingB - missingA;
	});
	const selected = detailLimit
		? prioritized.filter((entry) => !cache[entry.url]).slice(0, detailLimit)
		: [];
	await mapLimit(selected, Math.min(concurrency, 3), async (entry, index) => {
		if (cache[entry.url]) return;
		try {
			cache[entry.url] = parseDetail(entry.url, await fetchText(entry.url));
		} catch (error) {
			cache[entry.url] = { error: error instanceof Error ? error.message : String(error) };
		}
		process.stdout.write(`Bliss detail enrichment ${index + 1}/${selected.length}\r`);
		if ((index + 1) % 20 === 0) saveJson(detailsFile, cache);
	});
	if (selected.length) process.stdout.write('\n');
	saveJson(detailsFile, cache);
	return entries.map((entry) =>
		mergeDetail(entry, cache[entry.url]?.error ? null : cache[entry.url])
	);
}

async function fetchAllRows(supabase, categoryMode) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		let query = supabase
			.from('products')
			.select(
				'id,title,brand,category,sku,status,stock,compatibility,search_keywords,specifications,source_url,price,mrp'
			)
			.range(from, from + 999);
		query =
			categoryMode === 'displays'
				? query.eq('category', 'displays')
				: query.neq('category', 'displays');
		const { data, error } = await query;
		if (error) throw new Error(`Failed to read ${categoryMode} products: ${error.message}`);
		rows.push(...(data ?? []));
		if (!data || data.length < 1000) break;
	}
	return rows;
}

function buildNonDisplayCorpus(rows) {
	return rows
		.map((row) =>
			normalizeCompact(
				`${row.title} ${row.compatibility ?? ''} ${(row.search_keywords ?? []).join(' ')} ${JSON.stringify(row.specifications ?? {})}`
			)
		)
		.join('|');
}

function groupCandidates(entries) {
	const parent = entries.map((_, index) => index);
	const find = (index) => {
		while (parent[index] !== index) {
			parent[index] = parent[parent[index]];
			index = parent[index];
		}
		return index;
	};
	const union = (a, b) => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parent[rootB] = rootA;
	};
	const partOwners = new Map();
	const fingerprints = new Map();
	entries.forEach((entry, index) => {
		for (const part of entry.partNumbers) {
			const key = normalizeCompact(part);
			if (partOwners.has(key)) union(index, partOwners.get(key));
			else partOwners.set(key, index);
		}
		const fingerprint = normalizeCompact(
			`${primaryModelName(entry)} ${entry.size} ${entry.pixels || entry.resolution} ${entry.pins}`
		);
		if (fingerprint.length >= 10) {
			if (fingerprints.has(fingerprint)) union(index, fingerprints.get(fingerprint));
			else fingerprints.set(fingerprint, index);
		}
	});
	const groups = new Map();
	entries.forEach((entry, index) => {
		const rootIndex = find(index);
		if (!groups.has(rootIndex)) groups.set(rootIndex, []);
		groups.get(rootIndex).push(entry);
	});
	return [...groups.values()];
}

function mergeGroup(group) {
	const representative = [...group].sort((a, b) => {
		const score = (entry) =>
			entry.partNumbers.length * 5 +
			entry.models.length * 3 +
			Number(Boolean(entry.pixels)) +
			Number(Boolean(entry.pins));
		return score(b) - score(a);
	})[0];
	const partNumbers = unique(
		group.flatMap((entry) => entry.partNumbers),
		50
	).sort((a, b) => partNumberScore(b) - partNumberScore(a) || b.length - a.length);
	const models = unique(
		group.flatMap((entry) => entry.models),
		100
	);
	return {
		...representative,
		partNumbers,
		models,
		sourceListings: group.map((entry) => entry.url)
	};
}

function existingPartIndex(rows) {
	const index = new Map();
	const sourceIndex = new Map();
	for (const row of rows) {
		if (row.source_url) sourceIndex.set(row.source_url.toLowerCase().replace(/\/$/, ''), row.id);
		const parts = extractPartNumbers(
			`${row.title} ${row.sku ?? ''} ${row.compatibility ?? ''} ${(row.search_keywords ?? []).join(' ')} ${JSON.stringify(row.specifications ?? {})}`
		);
		for (const part of parts) {
			const key = normalizeCompact(part);
			if (!index.has(key)) index.set(key, new Set());
			index.get(key).add(row.id);
		}
	}
	return { index, sourceIndex };
}

function matchExistingIds(candidate, indexes) {
	const ids = new Set();
	for (const url of candidate.sourceListings) {
		const id = indexes.sourceIndex.get(url.toLowerCase().replace(/\/$/, ''));
		if (id) ids.add(id);
	}
	for (const part of candidate.partNumbers) {
		for (const id of indexes.index.get(normalizeCompact(part)) ?? []) ids.add(id);
	}
	return [...ids];
}

function buildCompatibility(partNumbers, models) {
	return truncate(
		[
			`Panel part numbers: ${partNumbers.join(', ')}`,
			`Compatible laptop models: ${models.join(', ')}`,
			'Match screen size, resolution, connector pins, connector position and bracket style before ordering.'
		].join('. '),
		4000
	);
}

function buildNewRow(candidate) {
	const primaryPart = candidate.partNumbers[0];
	const model = candidate.models[0] || primaryModelName(candidate);
	const resolution = candidate.pixels || candidate.resolution;
	const pins = candidate.pins ? `${candidate.pins.replace(/\s*pins?/i, '')}-pin` : '';
	const connector = titleConnector(candidate.connector);
	const title = truncate(
		['Compatible Display', primaryPart, 'for', model, candidate.size, resolution, pins, connector]
			.filter(Boolean)
			.join(' '),
		190
	);
	const price = candidate.price || 3499;
	const specifications = {
		Brand: candidate.brand,
		Series: candidate.series,
		Model: candidate.model,
		Size: candidate.size,
		Resolution: candidate.resolution,
		Pixels: candidate.pixels,
		Connector: candidate.connector,
		'Connector Pins': candidate.pins,
		'Connector Position': candidate.side,
		'Panel Part Numbers': candidate.partNumbers.join(', '),
		'Compatible Device Models': candidate.models.join(', '),
		'Compatibility Source': 'Bliss Computers non-touch display catalog',
		'India Relevance': candidate.indiaEvidence.type,
		'India Evidence Source': candidate.indiaEvidence.source ?? candidate.indiaEvidence.model
	};
	return {
		title,
		brand: candidate.brand,
		category: 'displays',
		image: PLACEHOLDER_IMAGE,
		images: [PLACEHOLDER_IMAGE],
		source_url: candidate.url,
		description: truncate(
			`${title}. Panel part numbers: ${candidate.partNumbers.join(', ')}. Compatible laptop models: ${candidate.models.join(', ')}. ${WARRANTY}.`,
			1200
		),
		sku: truncate(`BLISS-DISPLAY-${slugPart(primaryPart)}-${sourceId(candidate.url)}`, 120),
		specifications,
		search_keywords: splitKeywords([
			title,
			candidate.brand,
			'display',
			'screen',
			'laptop display',
			...candidate.partNumbers,
			...candidate.models,
			...Object.values(specifications)
		]),
		price,
		selling_price: price,
		cost_price: 0,
		mrp: Math.max(price + 500, Math.round((price * 1.18) / 50) * 50 - 1),
		rating: 4.5,
		reviews: 0,
		stock: /out of stock|unavailable/i.test(candidate.availability ?? '') ? 0 : 10,
		weight_kg: DEFAULT_WEIGHT_KG,
		length_cm: DEFAULT_LENGTH_CM,
		breadth_cm: DEFAULT_BREADTH_CM,
		height_cm: DEFAULT_HEIGHT_CM,
		compatibility: buildCompatibility(candidate.partNumbers, candidate.models),
		warranty: WARRANTY,
		highlights: unique(
			[
				'Laptop display replacement',
				`Panel Part Number: ${primaryPart}`,
				candidate.size,
				resolution,
				pins ? `${pins} connector` : '',
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

function buildEnrichment(row, candidate) {
	const compatibilityNote = buildCompatibility(candidate.partNumbers, candidate.models);
	const existingCompatibility = cleanText(row.compatibility ?? '');
	const normalizedExisting = normalizeCompact(existingCompatibility);
	const allAliasesCovered = [...candidate.partNumbers, ...candidate.models].every((value) =>
		normalizedExisting.includes(normalizeCompact(value))
	);
	const compatibility = allAliasesCovered
		? existingCompatibility
		: truncate(`${existingCompatibility}. ${compatibilityNote}`, 4000);
	return {
		compatibility,
		search_keywords: splitKeywords(
			[...(row.search_keywords ?? []), ...candidate.partNumbers, ...candidate.models],
			180
		),
		specifications: {
			...(row.specifications && typeof row.specifications === 'object' ? row.specifications : {}),
			'Bliss Panel Part Numbers': candidate.partNumbers.join(', '),
			'Bliss Compatible Models': candidate.models.join(', '),
			'Bliss Source URL': candidate.url,
			'India Relevance': candidate.indiaEvidence.type
		}
	};
}

async function applyChanges(supabase, newRows, enrichments, staleManagedRows) {
	const errors = [];
	let inserted = 0;
	let enriched = 0;
	let deleted = 0;
	for (let index = 0; index < newRows.length; index += 100) {
		const batch = newRows.slice(index, index + 100);
		const { error } = await supabase.from('products').upsert(batch, { onConflict: 'sku' });
		if (error) errors.push({ operation: 'insert', batch: index / 100 + 1, error: error.message });
		else inserted += batch.length;
	}
	for (let index = 0; index < enrichments.length; index += 1) {
		const item = enrichments[index];
		const { error } = await supabase.from('products').update(item.patch).eq('id', item.id);
		if (error) errors.push({ operation: 'enrich', id: item.id, error: error.message });
		else enriched += 1;
		if ((index + 1) % 25 === 0)
			process.stdout.write(`Supabase enrichment ${index + 1}/${enrichments.length}\r`);
	}
	if (enrichments.length) process.stdout.write('\n');
	if (cleanupStale) {
		for (let index = 0; index < staleManagedRows.length; index += 100) {
			const batch = staleManagedRows.slice(index, index + 100);
			const { error } = await supabase
				.from('products')
				.delete()
				.in(
					'id',
					batch.map((row) => row.id)
				);
			if (error)
				errors.push({ operation: 'delete-stale', batch: index / 100 + 1, error: error.message });
			else deleted += batch.length;
		}
	}
	return { inserted, enriched, deleted, errors };
}

const env = parseEnv();
const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey)
	throw new Error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in .env');

mkdirSync(cacheDir, { recursive: true });
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const [listingResult, displayRows, nonDisplayRows] = await Promise.all([
	collectListings(),
	fetchAllRows(supabase, 'displays'),
	fetchAllRows(supabase, 'other')
]);
const corpus = buildNonDisplayCorpus(nonDisplayRows);
const rejected = [];
let candidates = listingResult.listings.map(enrichListingIdentity).filter((entry) => {
	if (!isModelSpecific(entry)) {
		rejected.push({ url: entry.url, title: entry.title, reason: 'not-model-specific' });
		return false;
	}
	const evidence = familyEvidence(entry) || existingCatalogEvidence(entry, corpus);
	if (!evidence) {
		rejected.push({ url: entry.url, title: entry.title, reason: 'no-india-evidence' });
		return false;
	}
	entry.indiaEvidence = evidence;
	return true;
});

candidates = await fetchDetails(candidates);
candidates = candidates.map((entry) => {
	const models = sanitizeModelAliases(entry.models ?? [], entry.partNumbers ?? []);
	return {
		...entry,
		models,
		partNumbers: sanitizePartAliases(entry.partNumbers ?? [], models)
	};
});
candidates = candidates.filter((entry) => {
	if (!entry.partNumbers.some((part) => partNumberScore(part) >= 6)) {
		rejected.push({
			url: entry.url,
			title: entry.title,
			reason: 'no-strong-part-number-after-detail'
		});
		return false;
	}
	if (!entry.models.length) {
		rejected.push({ url: entry.url, title: entry.title, reason: 'no-clean-model-after-detail' });
		return false;
	}
	return true;
});
const mergedCandidates = groupCandidates(candidates).map(mergeGroup);
const indexes = existingPartIndex(displayRows);
const displayById = new Map(displayRows.map((row) => [row.id, row]));
const conflicts = [];
const newRows = [];
const enrichments = [];
const desiredManagedSkus = new Set();
const isManagedBlissRow = (row) => /^BLISS-DISPLAY-/i.test(row?.sku ?? '');

for (const candidate of mergedCandidates) {
	const existingIds = matchExistingIds(candidate, indexes);
	const matchedRows = existingIds.map((id) => displayById.get(id)).filter(Boolean);
	const managedMatches = matchedRows.filter(isManagedBlissRow);
	const existingOwnerMatches = matchedRows.filter((row) => !isManagedBlissRow(row));
	if (managedMatches.length === 1 && existingOwnerMatches.length === 1) {
		const owner = existingOwnerMatches[0];
		enrichments.push({
			id: owner.id,
			title: owner.title,
			patch: buildEnrichment(owner, candidate),
			candidate
		});
		continue;
	}
	if (existingIds.length > 1) {
		conflicts.push({
			partNumbers: candidate.partNumbers,
			models: candidate.models,
			existingIds,
			sourceListings: candidate.sourceListings,
			reason: 'multiple-existing-display-matches'
		});
		continue;
	}
	if (existingIds.length === 1) {
		const row = displayById.get(existingIds[0]);
		if (isManagedBlissRow(row)) desiredManagedSkus.add(row.sku);
		enrichments.push({
			id: row.id,
			title: row.title,
			patch: buildEnrichment(row, candidate),
			candidate
		});
		continue;
	}
	const newRow = buildNewRow(candidate);
	desiredManagedSkus.add(newRow.sku);
	newRows.push(newRow);
}

const staleManagedRows = displayRows.filter(
	(row) => isManagedBlissRow(row) && !desiredManagedSkus.has(row.sku)
);
const applyResult = apply
	? await applyChanges(supabase, newRows, enrichments, staleManagedRows)
	: { inserted: 0, enriched: 0, deleted: 0, errors: [] };
const audit = {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	source: CATEGORY_URL,
	indiaFamilyRules: INDIA_FAMILY_RULES,
	crawl: {
		reportedTotal: listingResult.total,
		pages: listingResult.pages,
		parsedListings: listingResult.listings.length,
		errors: listingResult.errors
	},
	counts: {
		existingDisplays: displayRows.length,
		nonDisplayEvidenceRows: nonDisplayRows.length,
		eligibleListings: candidates.length,
		canonicalGroups: mergedCandidates.length,
		newProducts: newRows.length,
		existingProductsToEnrich: enrichments.length,
		conflicts: conflicts.length,
		rejected: rejected.length,
		staleManagedProducts: staleManagedRows.length,
		inserted: applyResult.inserted,
		enriched: applyResult.enriched,
		deleted: applyResult.deleted
	},
	applyErrors: applyResult.errors,
	conflicts,
	rejectedSamples: rejected.slice(0, 100),
	plannedNewProducts: newRows.map((row) => ({
		title: row.title,
		sku: row.sku,
		brand: row.brand,
		price: row.price,
		stock: row.stock,
		compatibility: row.compatibility,
		specifications: row.specifications,
		search_keywords: row.search_keywords,
		source_url: row.source_url
	})),
	plannedEnrichments: enrichments.map((item) => ({
		id: item.id,
		title: item.title,
		partNumbers: item.candidate.partNumbers,
		models: item.candidate.models,
		source: item.candidate.url,
		patch: item.patch
	})),
	staleManagedProducts: staleManagedRows.map((row) => ({
		id: row.id,
		sku: row.sku,
		title: row.title,
		source_url: row.source_url
	})),
	newProductSamples: newRows.slice(0, 30).map((row) => ({
		title: row.title,
		sku: row.sku,
		price: row.price,
		compatibility: row.compatibility,
		source_url: row.source_url
	})),
	enrichmentSamples: enrichments.slice(0, 30).map((item) => ({
		id: item.id,
		title: item.title,
		partNumbers: item.candidate.partNumbers,
		models: item.candidate.models,
		source: item.candidate.url
	}))
};
saveJson(auditFile, audit);

console.log(
	JSON.stringify(
		{ ...audit.counts, mode: audit.mode, auditFile, applyErrors: applyResult.errors.length },
		null,
		2
	)
);
