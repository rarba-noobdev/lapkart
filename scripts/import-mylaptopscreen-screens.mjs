// Additive MyLaptopScreen screen importer.
// Fetches WooCommerce Store API products, excludes Apple/Mac items and non-screen
// accessories, then writes DB-ready rows. This script does not delete products.
//
//   node scripts/import-mylaptopscreen-screens.mjs
//
// Output:
//   .firecrawl/mylaptopscreen-screens.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, '.firecrawl');
const outFile = join(outDir, 'mylaptopscreen-screens.json');
const sqlDir = join(outDir, 'mylaptopscreen-screens-sql');

const STORE_API = 'https://mylaptopscreen.com/wp-json/wc/store/v1/products';
const WARRANTY = '6 months replacement warranty';
const DEFAULT_STOCK = 10;
const DEFAULT_WEIGHT_KG = 1;
const DEFAULT_LENGTH_CM = 45;
const DEFAULT_BREADTH_CM = 25;
const DEFAULT_HEIGHT_CM = 10;
const sourceBrandPattern = /\b(my\s*laptop\s*screen|mylaptopscreen)\b/gi;

const applePattern = /\b(apple|macbook|imac|ipad|macbook\s+pro|macbook\s+air)\b/i;
const screenPattern =
	/\b(screen|display|lcd|led|panel|edp|ips|fhd|qhd|uhd|touch\s*screen|touchscreen)\b/i;
const accessoryPattern =
	/\b(cover|bezel|hinge|hinges|cable|case|trim|lid|back\s*cover|front\s*bezel)\b/i;

const brandRules = [
	[/\b(au\s+optronics|auo)\b/i, 'AU Optronics'],
	[/\b(boe)\b/i, 'BOE'],
	[/\b(innolux)\b/i, 'Innolux'],
	[/\b(lg\s+display)\b/i, 'LG Display'],
	[/\b(samsung)\b/i, 'Samsung'],
	[/\b(dell|inspiron|latitude|vostro|xps|precision|alienware)\b/i, 'Dell'],
	[/\b(hp|omen|pavilion|elitebook|probook|compaq)\b/i, 'HP'],
	[/\b(lenovo|thinkpad|ideapad|legion|yoga)\b/i, 'Lenovo'],
	[/\b(asus|rog|tuf|zenbook|vivobook)\b/i, 'Asus'],
	[/\b(acer|aspire|nitro|predator|travelmate)\b/i, 'Acer'],
	[/\b(msi|leopard|katana|stealth|raider|modern)\b/i, 'MSI'],
	[/\b(razer)\b/i, 'Razer'],
	[/\b(microsoft|surface)\b/i, 'Microsoft'],
	[/\b(toshiba|dynabook)\b/i, 'Toshiba'],
	[/\b(fujitsu)\b/i, 'Fujitsu'],
	[/\b(gigabyte|aorus)\b/i, 'Gigabyte'],
	[/\b(sony|vaio)\b/i, 'Sony']
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
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return decodeHtml(value)
		.replace(sourceBrandPattern, '')
		.replace(/\breplcaement\b/gi, 'replacement')
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
}

function cleanAttributeText(value) {
	return decodeHtml(value)
		.replace(/\breplcaement\b/gi, 'replacement')
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

function truncateAttribute(value, max) {
	const text = cleanAttributeText(value);
	return text.length <= max ? text : text.slice(0, max - 1).trimEnd();
}

function moneyFromStoreApi(prices, key) {
	const minor = Number(prices?.currency_minor_unit ?? 2);
	const divisor = Math.pow(10, Number.isFinite(minor) ? minor : 2);
	const raw = Number(prices?.[key] ?? 0);
	return Number.isFinite(raw) ? Math.round(raw / divisor) : 0;
}

function productText(product) {
	return [
		product.name,
		product.slug,
		product.sku,
		...(product.categories ?? []).flatMap((category) => [category.name, category.slug])
	]
		.filter(Boolean)
		.join(' ');
}

function isApple(product) {
	return applePattern.test(productText(product));
}

function isScreen(product) {
	const text = productText(product);
	return screenPattern.test(text) && !accessoryPattern.test(text);
}

function resolveBrand(product) {
	const title = cleanText(product.name);
	for (const [pattern, brand] of brandRules) {
		if (pattern.test(title)) return brand;
	}
	const text = productText(product);
	for (const [pattern, brand] of brandRules) {
		if (pattern.test(text)) return brand;
	}
	const categoryBrand = (product.categories ?? [])
		.map((category) => cleanText(category.name).replace(/\s+laptop\s+screen.*/i, ''))
		.find((name) => /^[a-z0-9 ]{2,40}$/i.test(name));
	return categoryBrand || 'Compatible';
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

function uniqueAttributes(values, max = 24) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = cleanAttributeText(value);
		const key = text.toLowerCase();
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function uniqueUrls(values, max = 8) {
	const seen = new Set();
	const out = [];
	for (const value of values) {
		const text = decodeHtml(value).trim();
		if (!/^https?:\/\//i.test(text)) continue;
		const key = text.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function canonicalAttributeName(name) {
	const key = cleanAttributeText(name)
		.toLowerCase()
		.replace(/[:()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (key === 'brand') return 'Brand';
	if (key === 'compatibility') return 'Compatibility';
	if (key === 'condition') return 'Condition';
	if (key === 'mountings' || key === 'mounting') return 'Mountings';
	if (key.includes('manufacturer part number') || key === 'mpn') {
		return 'MPN (Manufacturer Part Number)';
	}
	if (key === 'optical technology') return 'Optical Technology';
	if (key === 'refresh rate') return 'Refresh Rate';
	if (key === 'resolution') return 'Resolution';
	if (key === 'screen size') return 'Screen Size';
	if (key === 'surface type') return 'Surface Type';
	if (key === 'video connector' || key === 'video connector ') return 'Video Connector';
	if (key === 'warranty') return 'Warranty';
	return cleanAttributeText(name).replace(/:$/, '');
}

function collectAttributes(product) {
	const map = new Map();
	for (const attribute of product.attributes ?? []) {
		const label = canonicalAttributeName(attribute.name);
		const values = uniqueAttributes((attribute.terms ?? []).map((term) => term.name), 8);
		if (!label || !values.length) continue;
		map.set(label, values.join(', '));
	}
	return map;
}

function getAttribute(attrs, label) {
	return attrs.get(label) ?? '';
}

function extractSpecs(title) {
	const specs = [];
	const patterns = [
		/\b\d{2}(?:\.\d)?\s*-?\s*(?:inch|inches|")/gi,
		/\b\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}\b/gi,
		/\b(?:30|40)\s*pin\b/gi,
		/\b\d{2,3}\s*hz\b/gi,
		/\b(?:hd|fhd|qhd|uhd|ips|oled|edp|lcd|led)\b/gi
	];
	for (const pattern of patterns) {
		for (const match of title.matchAll(pattern)) specs.push(match[0]);
	}
	return unique(specs, 10);
}

function extractPartNumbers(product, title, attrs = new Map()) {
	const values = [
		product.sku,
		product.slug,
		getAttribute(attrs, 'MPN (Manufacturer Part Number)'),
		getAttribute(attrs, 'Compatibility')
	];
	const partPatterns = [
		/\b[A-Z]{1,5}\d{2,}[A-Z0-9.-]{2,}\b/g,
		/\b[A-Z0-9]{2,}-[A-Z0-9.-]{2,}\b/g,
		/\b(?:LP|LTN|B|N|NV|NT|M|HB|LQ|LM|P)\d{3}[A-Z0-9.-]{3,}\b/gi,
		/\b\d{2}(?:\.\d)?\s*inch\s*(?:30|40)\s*pin\s*\d{2,3}\s*hz\b/gi
	];
	for (const pattern of partPatterns) {
		for (const match of title.matchAll(pattern)) values.push(match[0]);
	}
	return unique(values, 14).map((value) => value.slice(0, 80));
}

function compatibilityFromTitle(title, brand) {
	return truncate(
		title
			.replace(/\b(laptop|screen|display|lcd|led|replacement|full hd|fhd|ips|edp|panel)\b/gi, ' ')
			.replace(/\b\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}\b/gi, ' ')
			.replace(/\b(?:30|40)\s*pin\b/gi, ' ')
			.replace(/\s+/g, ' ')
			.trim() || `${brand} laptop screen`,
		500
	);
}

function displaySpecEntries(attrs, compatibility, specs) {
	const entries = [
		['Compatibility', compatibility],
		['Condition', getAttribute(attrs, 'Condition') || 'Brand New A+ Grade Screen'],
		['Mountings', getAttribute(attrs, 'Mountings')],
		['MPN (Manufacturer Part Number)', getAttribute(attrs, 'MPN (Manufacturer Part Number)')],
		['Optical Technology', getAttribute(attrs, 'Optical Technology')],
		['Refresh Rate', getAttribute(attrs, 'Refresh Rate')],
		[
			'Resolution',
			getAttribute(attrs, 'Resolution') ||
				specs.find((value) => /\d{3,4}\s*(?:x|\u00d7)\s*\d{3,4}/i.test(value))
		],
		[
			'Screen Size',
			getAttribute(attrs, 'Screen Size') ||
			specs.find((value) => /\d{2}(?:\.\d)?\s*-?\s*(?:inch|inches|")/i.test(value))
		],
		['Surface Type', getAttribute(attrs, 'Surface Type')],
		[
			'Video Connector',
			getAttribute(attrs, 'Video Connector') ||
				specs.find((value) => /\b(?:30|40)\s*pin\b/i.test(value))
		]
	];

	return entries
		.map(([label, value]) => [label, truncateAttribute(value ?? '', 140)])
		.filter(([, value]) => value);
}

function buildSpecifications(entries) {
	return Object.fromEntries(entries);
}

function buildHighlights(attrs) {
	return uniqueAttributes(
		[
			'Laptop screen replacement',
			getAttribute(attrs, 'Condition') || 'Brand New A+ Grade Screen',
			'Compatibility checked before dispatch',
			WARRANTY,
			'Manual Tamil Nadu delivery'
		],
		8
	);
}

function normalizeProduct(product) {
	const title = truncate(product.name, 190);
	const price = moneyFromStoreApi(product.prices, 'price');
	const regular = moneyFromStoreApi(product.prices, 'regular_price');
	if (!title || price <= 0) return null;

	const images = uniqueUrls((product.images ?? []).map((image) => image.src).filter(Boolean), 1);
	if (!images.length) return null;

	const attrs = collectAttributes(product);
	const brand = resolveBrand(product);
	const specs = extractSpecs(title);
	const compatibility = truncateAttribute(
		getAttribute(attrs, 'Compatibility') || compatibilityFromTitle(title, brand),
		500
	);
	const parts = extractPartNumbers(product, title, attrs);
	const displaySpecs = displaySpecEntries(attrs, compatibility, specs);
	const categories = unique((product.categories ?? []).map((category) => category.name), 6);
	const descriptionSource = stripHtml(product.short_description || product.description);
	const sku = truncate(product.sku || `MLS-${product.id}`, 120);
	const mrp = regular > price ? regular : Math.round(price * 1.18);
	const keywords = unique(
		[
			sku,
			...parts,
			...specs,
			...displaySpecs.flatMap(([label, value]) => [label, value]),
			brand,
			...categories,
			compatibility,
			title.replace(/[^\w. -]+/g, ' ')
		]
			.join(' ')
			.split(/[\s,;/|]+/)
			.filter((token) => token.length >= 2)
			.map((token) => token.slice(0, 80)),
		24
	);

	return {
		title,
		brand,
		category: 'displays',
		image: images[0],
		images,
		source_url: product.permalink || `https://mylaptopscreen.com/product/${product.slug}/`,
		description: truncateAttribute(
			[
				title,
				...displaySpecs.map(([label, value]) => `${label}: ${value}`),
				`Warranty: ${WARRANTY}`,
				`Weight: ${DEFAULT_WEIGHT_KG} kg`,
				`Dimensions: ${DEFAULT_LENGTH_CM} x ${DEFAULT_BREADTH_CM} x ${DEFAULT_HEIGHT_CM} cm`,
				descriptionSource || 'Compatible laptop screen replacement.'
			].join('. '),
			900
		),
		sku,
		specifications: buildSpecifications(displaySpecs),
		search_keywords: keywords,
		price,
		selling_price: price,
		mrp,
		rating: Number(product.average_rating || 4.5) || 4.5,
		reviews: Number(product.review_count || 0) || 0,
		stock: product.is_in_stock === false ? 0 : DEFAULT_STOCK,
		weight_kg: DEFAULT_WEIGHT_KG,
		length_cm: DEFAULT_LENGTH_CM,
		breadth_cm: DEFAULT_BREADTH_CM,
		height_cm: DEFAULT_HEIGHT_CM,
		compatibility,
		warranty: WARRANTY,
		highlights: buildHighlights(attrs),
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
		source_product_id: product.id
	};
}

function sqlJsonLiteral(value) {
	return `$lapkart_json$${JSON.stringify(value).replaceAll('$lapkart_json$', '')}$lapkart_json$`;
}

function buildUpsertSql(products, batchNo, batchTotal) {
	return `-- Generated by scripts/import-mylaptopscreen-screens.mjs
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

async function fetchPage(page) {
	const url = `${STORE_API}?per_page=100&page=${page}`;
	const response = await fetch(url, {
		headers: {
			accept: 'application/json',
			'user-agent': 'LapKart catalog importer'
		}
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
	const totalPages = Number(response.headers.get('x-wp-totalpages') || '1');
	const total = Number(response.headers.get('x-wp-total') || '0');
	const products = await response.json();
	return { products, total, totalPages };
}

const all = [];
let total = 0;
let totalPages = 1;
for (let page = 1; page <= totalPages; page += 1) {
	const result = await fetchPage(page);
	total = result.total || total;
	totalPages = result.totalPages || totalPages;
	all.push(...result.products);
	process.stdout.write(`fetched ${page}/${totalPages}\r`);
}
process.stdout.write('\n');

const excludedApple = [];
const excludedAccessory = [];
const normalized = [];
for (const product of all) {
	if (isApple(product)) {
		excludedApple.push({ id: product.id, name: cleanText(product.name), sku: product.sku });
		continue;
	}
	if (!isScreen(product)) {
		excludedAccessory.push({ id: product.id, name: cleanText(product.name), sku: product.sku });
		continue;
	}
	const row = normalizeProduct(product);
	if (row) normalized.push(row);
}

const seenSku = new Map();
let dedupedSkuCount = 0;
for (const row of normalized) {
	const baseSku = row.sku;
	const count = seenSku.get(baseSku) ?? 0;
	seenSku.set(baseSku, count + 1);
	if (count > 0) {
		row.search_keywords = unique([baseSku, ...row.search_keywords], 24);
		row.sku = truncate(`${baseSku}-${count + 1}`, 120);
		dedupedSkuCount += 1;
	}
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
	outFile,
	JSON.stringify(
		{
			source: STORE_API,
			generatedAt: new Date().toISOString(),
			sourceTotal: total || all.length,
			fetched: all.length,
			importable: normalized.length,
			excludedApple,
			excludedAccessory,
			dedupedSkuCount,
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
			sourceTotal: total || all.length,
			fetched: all.length,
			importable: normalized.length,
			excludedApple: excludedApple.length,
			excludedAccessory: excludedAccessory.length,
			dedupedSkuCount,
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
				keywords: row.search_keywords.slice(0, 8)
			}))
		},
		null,
		2
	)
);
