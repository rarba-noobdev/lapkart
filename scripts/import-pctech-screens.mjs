// Additive PCTech screen importer.
// Fetches OpenCart category pages, excludes Apple/Mac items and non-screen
// accessories, then writes DB-ready rows. This script does not delete products.
//
//   node scripts/import-pctech-screens.mjs
//
// Output:
//   .firecrawl/pctech-screens.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, '.firecrawl');
const outFile = join(outDir, 'pctech-screens.json');
const sqlDir = join(outDir, 'pctech-screens-sql');

const CATEGORY_URL = 'https://pctech.co.in/laptop-screens/';
const WARRANTY = '6 months replacement warranty';
const DEFAULT_STOCK = 10;
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 25;
const DEFAULT_HEIGHT_CM = 10;

const supplierBrandPattern = /\b(pc\s*tech|pctech|branded)\b/gi;
const applePattern = /\b(apple|macbook|imac|ipad|macbook\s+pro|macbook\s+air)\b/i;
const screenPattern =
	/\b(screen|display|lcd|led|panel|edp|ips|fhd|qhd|uhd|touch\s*screen|touchscreen)\b/i;
const accessoryPattern =
	/\b(adhesive|strip|strips|tape|cable|bezel|hinge|hinges|cover|case|lid|trim|protector|guard)\b/i;

const specLabels = [
	'Video Signal Connector',
	'Backlight Type',
	'Optical Technology',
	'Refresh Rate',
	'Screen Size',
	'Surface Type',
	'Condition',
	'Resolution',
	'Mountings',
	'Warranty',
	'Brand',
	'Size',
	'Type',
	'Hertz',
	'Model',
	'MPN'
];

const brandRules = [
	[/\b(dell|inspiron|latitude|vostro|xps|precision|alienware)\b/i, 'Dell'],
	[/\b(hp|omen|pavilion|elitebook|probook|compaq)\b/i, 'HP'],
	[/\b(lenovo|thinkpad|ideapad|legion|yoga)\b/i, 'Lenovo'],
	[/\b(asus|rog|tuf|zenbook|vivobook)\b/i, 'Asus'],
	[/\b(acer|aspire|nitro|predator|travelmate)\b/i, 'Acer'],
	[/\b(msi|leopard|katana|stealth|raider|modern)\b/i, 'MSI'],
	[/\b(samsung)\b/i, 'Samsung'],
	[/\b(razer)\b/i, 'Razer'],
	[/\b(microsoft|surface)\b/i, 'Microsoft'],
	[/\b(toshiba|dynabook)\b/i, 'Toshiba'],
	[/\b(fujitsu)\b/i, 'Fujitsu'],
	[/\b(gigabyte|aorus)\b/i, 'Gigabyte'],
	[/\b(sony|vaio)\b/i, 'Sony'],
	[/\b(honor)\b/i, 'Honor']
];

function decodeHtml(value) {
	return String(value ?? '')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ');
}

function stripHtml(value) {
	return decodeHtml(value)
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n\s+/g, '\n')
		.replace(/\s+\n/g, '\n')
		.trim();
}

function cleanText(value) {
	return decodeHtml(value)
		.replace(supplierBrandPattern, '')
		.replace(/\s*,\s*/g, ', ')
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
}

function truncate(value, max) {
	const text = cleanText(value);
	return text.length <= max ? text : text.slice(0, max - 1).trimEnd();
}

function unique(values, max = 24) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = cleanText(value);
		const key = text.toLowerCase();
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function absoluteSourceUrl(value) {
	const text = decodeHtml(value).trim();
	if (!text) return '';
	try {
		return new URL(text, 'https://pctech.co.in/').toString();
	} catch {
		return '';
	}
}

function numberFromPrice(value) {
	const parsed = Number(String(value ?? '').replace(/[^\d.]/g, ''));
	return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function extractFirst(pattern, text) {
	const match = text.match(pattern);
	return match ? decodeHtml(match[1]).trim() : '';
}

function extractProductBlocks(html) {
	const start = html.lastIndexOf('<div class="main-products');
	if (start < 0) return [];
	const end = html.indexOf('<div class="row pagination-results"', start);
	const listHtml = html.slice(start, end > start ? end : undefined);
	return listHtml.split(/<div class="product-layout[^>]*>/).slice(1);
}

function extractSpecPairs(description) {
	const text = stripHtml(description).replace(/^Specifications\s+/i, '');
	const escaped = specLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const labelPattern = escaped.join('|');
	const specs = {};

	for (const label of specLabels) {
		const pattern = new RegExp(
			`(?:^|\\s)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([\\s\\S]*?)(?=\\s+(?:${labelPattern})\\s+|$)`,
			'i'
		);
		const match = text.match(pattern);
		if (!match) continue;
		const value = truncate(match[1], 140);
		if (!value) continue;
		specs[label] = value;
	}

	return specs;
}

function specFromTitle(title, pattern) {
	const match = title.match(pattern);
	return match ? cleanText(match[0]) : '';
}

function specFromText(text, pattern) {
	const match = String(text ?? '').match(pattern);
	return match ? cleanText(match[0]) : '';
}

function conciseSpec(value, fallback, pattern) {
	const text = truncate(value, 140);
	if (!text) return fallback;
	if (pattern && !pattern.test(text)) return fallback;
	if (text.length > 80 && fallback) return fallback;
	return text;
}

function conditionSpec(value) {
	if (/\bbrand\s+new\b/i.test(value)) return 'Brand New';
	if (/\bnew\b/i.test(value)) return 'Brand New';
	return conciseSpec(value, 'Brand New');
}

function surfaceSpec(value, title) {
	const source = `${value} ${title}`;
	if (/\bmatte\b/i.test(source)) return 'Matte';
	if (/\bglossy\b/i.test(source)) return 'Glossy';
	if (/\banti[-\s]?glare\b/i.test(source)) return 'Anti-glare';
	return '';
}

function normalizeSpecEntries(rawSpecs, title, model) {
	const resolution =
		specFromText(rawSpecs.Resolution, /\b(?:hd|fhd|qhd|uhd|wxga|full\s+hd)?\s*\(?\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}\)?/i) ||
		specFromTitle(title, /\b\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}\b/i);
	const refreshRate =
		specFromText(`${rawSpecs['Refresh Rate']} ${rawSpecs.Hertz}`, /\b\d{2,3}\s*hz\b/i) ||
		specFromTitle(title, /\b\d{2,3}\s*hz\b/i);
	const screenSize = conciseSpec(
		rawSpecs['Screen Size'] || rawSpecs.Size,
		specFromTitle(title, /\b\d{2}(?:\.\d)?\s*-?\s*(?:inch|inches|")/i),
		/\b\d{2}(?:\.\d)?\s*-?\s*(?:inch|inches|")/i
	);
	const connector =
		specFromText(rawSpecs['Video Signal Connector'] || rawSpecs['Video Connector'], /\b(?:30|40)\s*(?:pin|pins)\b/i) ||
		specFromTitle(title, /\b(?:30|40)\s*pin\b/i);
	const backlight = /\bled\b/i.test(rawSpecs['Backlight Type'] ?? '') ? 'LED' : '';
	const opticalTechnology =
		conciseSpec(rawSpecs['Optical Technology'], '', /\b(?:ips|tn|oled|non\s*ips)\b/i) ||
		(/\bips\b/i.test(title) ? 'IPS Technology' : '');
	const entries = [
		['Compatibility', model || compatibilityFromTitle(title)],
		['Model', model],
		['Condition', conditionSpec(rawSpecs.Condition)],
		['Mountings', rawSpecs.Mountings],
		['MPN (Manufacturer Part Number)', rawSpecs.MPN],
		['Optical Technology', opticalTechnology],
		['Refresh Rate', refreshRate],
		['Resolution', resolution],
		['Screen Size', screenSize],
		['Surface Type', surfaceSpec(rawSpecs['Surface Type'] || rawSpecs.Type, title)],
		['Backlight Type', backlight],
		['Video Connector', connector]
	];

	return entries
		.map(([label, value]) => [label, truncate(value ?? '', 140)])
		.filter(([, value]) => value);
}

function buildSpecifications(entries) {
	return Object.fromEntries(entries);
}

function compatibilityFromTitle(title) {
	return truncate(
		title
			.replace(/\b(laptop|screen|display|lcd|led|replacement|full hd|fhd|ips|edp|panel)\b/gi, ' ')
			.replace(/\b\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}\b/gi, ' ')
			.replace(/\b(?:30|40)\s*pin\b/gi, ' ')
			.replace(/\s+/g, ' '),
		500
	);
}

function resolveBrand(title, model) {
	const text = `${title} ${model}`;
	for (const [pattern, brand] of brandRules) {
		if (pattern.test(text)) return brand;
	}
	return 'Compatible';
}

function extractPartNumbers(card, title, model) {
	const values = [card.productId, model];
	const patterns = [
		/\b[A-Z]{1,5}\d{2,}[A-Z0-9.-]{2,}\b/g,
		/\b[A-Z0-9]{2,}-[A-Z0-9.-]{2,}\b/g,
		/\b(?:LP|LTN|B|N|NV|NT|M|HB|LQ|LM|P)\d{3}[A-Z0-9.-]{3,}\b/gi
	];
	for (const pattern of patterns) {
		for (const match of `${title} ${model}`.matchAll(pattern)) values.push(match[0]);
	}
	return unique(values, 16).map((value) => value.slice(0, 80));
}

function productText(card) {
	return [card.title, card.model, card.description, card.url].filter(Boolean).join(' ');
}

function isApple(card) {
	return applePattern.test(productText(card));
}

function isScreen(card) {
	const text = productText(card);
	return screenPattern.test(text) && !accessoryPattern.test(text);
}

function parseCard(block) {
	const url = absoluteSourceUrl(extractFirst(/<div class="name">[\s\S]*?<a\s+href="([^"]+)"/i, block));
	const title = truncate(
		stripHtml(extractFirst(/<div class="name">[\s\S]*?<a\s+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/i, block)),
		190
	);
	const image = absoluteSourceUrl(extractFirst(/<img\s+src="([^"]+)"/i, block));
	const model = truncate(
		stripHtml(
			extractFirst(
				/<span class="stat-2">[\s\S]*?<span class="stats-label">Model:<\/span>\s*<span>([\s\S]*?)<\/span>/i,
				block
			)
		),
		120
	);
	const description = stripHtml(extractFirst(/<div class="description">([\s\S]*?)<\/div>/i, block));
	const price = numberFromPrice(extractFirst(/<span class="price-normal">([\s\S]*?)<\/span>/i, block));
	const productId =
		extractFirst(/name="product_id"\s+value="(\d+)"/i, block) ||
		extractFirst(/quickview\('(\d+)'\)/i, block);

	if (!productId || !url || !title || !image || price <= 0 || /placeholder/i.test(image)) {
		return null;
	}

	return { productId, url, title, image, model, description, price };
}

function normalizeProduct(card) {
	if (!isScreen(card)) return null;

	const rawSpecs = extractSpecPairs(card.description);
	const displaySpecs = normalizeSpecEntries(rawSpecs, card.title, card.model);
	const specifications = buildSpecifications(displaySpecs);
	const brand = resolveBrand(card.title, card.model);
	const compatibility = specifications.Compatibility || compatibilityFromTitle(card.title);
	const sku = `PCTECH-${card.productId}`;
	const mrp = Math.round(card.price * 1.18);
	const parts = extractPartNumbers(card, card.title, card.model);
	const keywords = unique(
		[
			sku,
			card.productId,
			...parts,
			card.model,
			...displaySpecs.flatMap(([label, value]) => [label, value]),
			brand,
			compatibility,
			card.title.replace(/[^\w. -]+/g, ' ')
		]
			.join(' ')
			.split(/[\s,;/|]+/)
			.filter((token) => token.length >= 2)
			.map((token) => token.slice(0, 80)),
		24
	);

	return {
		title: card.title,
		brand,
		category: 'displays',
		image: card.image,
		images: [card.image],
		source_url: card.url,
		description: truncate(
			[
				card.title,
				...displaySpecs.map(([label, value]) => `${label}: ${value}`),
				`Warranty: ${WARRANTY}`,
				`Weight: ${DEFAULT_WEIGHT_KG} kg`,
				`Dimensions: ${DEFAULT_LENGTH_CM} x ${DEFAULT_BREADTH_CM} x ${DEFAULT_HEIGHT_CM} cm`,
				card.description
			].join('. '),
			900
		),
		sku,
		specifications,
		search_keywords: keywords,
		price: card.price,
		selling_price: card.price,
		mrp,
		rating: 4.5,
		reviews: 0,
		stock: DEFAULT_STOCK,
		weight_kg: DEFAULT_WEIGHT_KG,
		length_cm: DEFAULT_LENGTH_CM,
		breadth_cm: DEFAULT_BREADTH_CM,
		height_cm: DEFAULT_HEIGHT_CM,
		compatibility,
		warranty: WARRANTY,
		highlights: unique(
			[
				'Laptop screen replacement',
				specifications.Condition || 'Brand New screen',
				'Compatibility checked before dispatch',
				WARRANTY,
				'Manual Tamil Nadu delivery'
			],
			8
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
		source_product_id: card.productId
	};
}

function sqlJsonLiteral(value) {
	return `$lapkart_json$${JSON.stringify(value).replaceAll('$lapkart_json$', '')}$lapkart_json$`;
}

function buildUpsertSql(products, batchNo, batchTotal) {
	return `-- Generated by scripts/import-pctech-screens.mjs
-- Batch ${batchNo}/${batchTotal}; additive upsert by products.sku.

with raw as (
  select jsonb_array_elements(${sqlJsonLiteral(products)}::jsonb) as item
),
incoming as (
  select
    item->>'title' as title,
    item->>'brand' as brand,
    item->>'category' as category,
    item->>'image' as image,
    array(select jsonb_array_elements_text(coalesce(item->'images', '[]'::jsonb))) as images,
    item->>'source_url' as source_url,
    nullif(item->>'description', '') as description,
    item->>'sku' as sku,
    coalesce(item->'specifications', '{}'::jsonb) as specifications,
    array(select jsonb_array_elements_text(coalesce(item->'search_keywords', '[]'::jsonb))) as search_keywords,
    (item->>'price')::numeric as price,
    (item->>'selling_price')::numeric as selling_price,
    (item->>'mrp')::numeric as mrp,
    (item->>'rating')::numeric as rating,
    (item->>'reviews')::integer as reviews,
    (item->>'stock')::integer as stock,
    (item->>'weight_kg')::numeric as weight_kg,
    (item->>'length_cm')::numeric as length_cm,
    (item->>'breadth_cm')::numeric as breadth_cm,
    (item->>'height_cm')::numeric as height_cm,
    item->>'compatibility' as compatibility,
    item->>'warranty' as warranty,
    array(select jsonb_array_elements_text(coalesce(item->'highlights', '[]'::jsonb))) as highlights,
    item->>'status' as status,
    item->>'authenticity_grade' as authenticity_grade,
    item->>'condition_grade' as condition_grade,
    nullif(item->>'hsn_code', '') as hsn_code,
    (item->>'gst_rate')::numeric as gst_rate,
    (item->>'doa_policy_days')::integer as doa_policy_days,
    (item->>'local_delivery_eligible')::boolean as local_delivery_eligible,
    (item->>'cod_eligible')::boolean as cod_eligible,
    (item->>'cod_allowed')::boolean as cod_allowed,
    (item->>'returnable')::boolean as returnable,
    (item->>'is_universal')::boolean as is_universal
  from raw
)
insert into public.products (
  title,
  brand,
  category,
  image,
  images,
  source_url,
  description,
  sku,
  specifications,
  search_keywords,
  price,
  selling_price,
  cost_price,
  mrp,
  rating,
  reviews,
  stock,
  weight_kg,
  length_cm,
  breadth_cm,
  height_cm,
  compatibility,
  warranty,
  highlights,
  status,
  authenticity_grade,
  condition_grade,
  hsn_code,
  gst_rate,
  doa_policy_days,
  local_delivery_eligible,
  cod_eligible,
  cod_allowed,
  returnable,
  is_universal,
  updated_at
)
select
  title,
  brand,
  category,
  image,
  nullif(images, array[]::text[]),
  source_url,
  description,
  sku,
  specifications,
  nullif(search_keywords, array[]::text[]),
  price,
  selling_price,
  0,
  mrp,
  rating,
  reviews,
  stock,
  weight_kg,
  length_cm,
  breadth_cm,
  height_cm,
  compatibility,
  warranty,
  nullif(highlights, array[]::text[]),
  status,
  authenticity_grade,
  condition_grade,
  hsn_code,
  gst_rate,
  doa_policy_days,
  local_delivery_eligible,
  cod_eligible,
  cod_allowed,
  returnable,
  is_universal,
  now()
from incoming
where sku is not null and btrim(sku) <> ''
on conflict (sku) do update set
  title = excluded.title,
  brand = excluded.brand,
  category = excluded.category,
  image = excluded.image,
  images = excluded.images,
  source_url = excluded.source_url,
  description = excluded.description,
  specifications = excluded.specifications,
  search_keywords = excluded.search_keywords,
  price = excluded.price,
  selling_price = excluded.selling_price,
  mrp = excluded.mrp,
  rating = excluded.rating,
  reviews = excluded.reviews,
  stock = excluded.stock,
  weight_kg = excluded.weight_kg,
  length_cm = excluded.length_cm,
  breadth_cm = excluded.breadth_cm,
  height_cm = excluded.height_cm,
  compatibility = excluded.compatibility,
  warranty = excluded.warranty,
  highlights = excluded.highlights,
  status = excluded.status,
  authenticity_grade = excluded.authenticity_grade,
  condition_grade = excluded.condition_grade,
  hsn_code = excluded.hsn_code,
  gst_rate = excluded.gst_rate,
  doa_policy_days = excluded.doa_policy_days,
  local_delivery_eligible = excluded.local_delivery_eligible,
  cod_eligible = excluded.cod_eligible,
  cod_allowed = excluded.cod_allowed,
  returnable = excluded.returnable,
  is_universal = excluded.is_universal,
  updated_at = now();
`;
}

function writeSqlBatches(products) {
	const batchSize = 100;
	mkdirSync(sqlDir, { recursive: true });
	const files = [];
	const batchTotal = Math.ceil(products.length / batchSize);
	for (let i = 0; i < products.length; i += batchSize) {
		const batchNo = Math.floor(i / batchSize) + 1;
		const batch = products.slice(i, i + batchSize);
		const file = join(sqlDir, `upsert-${String(batchNo).padStart(3, '0')}.sql`);
		writeFileSync(file, buildUpsertSql(batch, batchNo, batchTotal));
		files.push(file);
	}
	return files;
}

async function fetchHtml(url) {
	const response = await fetch(url, {
		headers: {
			accept: 'text/html,*/*',
			'user-agent': 'LapKart catalog importer'
		}
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return response.text();
}

function categoryPageUrl(page) {
	return page <= 1 ? CATEGORY_URL : `${CATEGORY_URL}page/${page}/`;
}

function parseTotalPages(html) {
	const match = html.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+\d+\s+\((\d+)\s+Pages?\)/i);
	return match ? Number(match[1]) : 1;
}

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workers = Array.from({ length: limit }, async () => {
		while (index < values.length) {
			const current = index++;
			results[current] = await mapper(values[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

const firstHtml = await fetchHtml(CATEGORY_URL);
const totalPages = parseTotalPages(firstHtml);
const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
const htmlPages = [firstHtml];

if (totalPages > 1) {
	const rest = await mapLimit(pages.slice(1), 8, async (page) => {
		process.stdout.write(`fetched page ${page}/${totalPages}\r`);
		return fetchHtml(categoryPageUrl(page));
	});
	htmlPages.push(...rest);
}
process.stdout.write('\n');

const cards = [];
for (const html of htmlPages) {
	for (const block of extractProductBlocks(html)) {
		const card = parseCard(block);
		if (card) cards.push(card);
	}
}

const excludedApple = [];
const excludedAccessory = [];
const normalized = [];
for (const card of cards) {
	if (isApple(card)) {
		excludedApple.push({ id: card.productId, name: card.title, url: card.url });
		continue;
	}
	if (!isScreen(card)) {
		excludedAccessory.push({ id: card.productId, name: card.title, url: card.url });
		continue;
	}
	const row = normalizeProduct(card);
	if (row) normalized.push(row);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
	outFile,
	JSON.stringify(
		{
			source: CATEGORY_URL,
			generatedAt: new Date().toISOString(),
			sourceTotal: cards.length,
			pages: totalPages,
			importable: normalized.length,
			excludedApple,
			excludedAccessory,
			products: normalized
		},
		null,
		2
	)
);
const sqlFiles = writeSqlBatches(normalized);

const byBrand = normalized.reduce((acc, row) => {
	acc[row.brand] = (acc[row.brand] ?? 0) + 1;
	return acc;
}, {});
console.log(
	JSON.stringify(
		{
			pages: totalPages,
			sourceTotal: cards.length,
			importable: normalized.length,
			excludedApple: excludedApple.length,
			excludedAccessory: excludedAccessory.length,
			byBrand,
			output: outFile,
			sqlDir,
			sqlFiles: sqlFiles.length,
			sample: normalized.slice(0, 5).map((row) => ({
				title: row.title,
				brand: row.brand,
				sku: row.sku,
				price: row.price,
				warranty: row.warranty,
				specifications: row.specifications,
				highlights: row.highlights,
				image: row.image
			}))
		},
		null,
		2
	)
);
