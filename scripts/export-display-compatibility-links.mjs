// Export display source links grouped by compatibility classification.
//
// This classifier distinguishes:
// - cross-brand: compatible-model fields mention more than one laptop brand
// - self-only: compatible-model fields mention exactly one brand, or no model list exists
//   but the source/manufacturer/title clearly identifies one laptop brand
// - no-detectable-brand: no reliable compatibility or source brand can be detected

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDirArg = process.argv.find((arg) => arg.startsWith('--out-dir='))?.slice('--out-dir='.length);
const outDir = outDirArg ? join(root, outDirArg) : join(root, 'outputs', 'display-link-exports');

function parseEnv() {
	const envText = readFileSync(join(root, '.env'), 'utf8');
	const env = {};
	for (const line of envText.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const index = trimmed.indexOf('=');
		if (index < 0) continue;
		let value = trimmed.slice(index + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		env[trimmed.slice(0, index).trim()] = value;
	}
	return env;
}

const BRAND_PATTERNS = [
	['Acer', /(^|[^a-z0-9])acer([^a-z0-9]|$)/i],
	['Asus', /(^|[^a-z0-9])asus([^a-z0-9]|$)/i],
	['Dell', /(^|[^a-z0-9])dell([^a-z0-9]|$)/i],
	['HP', /(^|[^a-z0-9])(hp|hewlett[ -]?packard)([^a-z0-9]|$)/i],
	['Lenovo', /(^|[^a-z0-9])lenovo([^a-z0-9]|$)/i],
	['Medion', /(^|[^a-z0-9])medion([^a-z0-9]|$)/i],
	['MSI', /(^|[^a-z0-9])msi([^a-z0-9]|$)/i],
	['Toshiba', /(^|[^a-z0-9])toshiba([^a-z0-9]|$)/i],
	['Fujitsu', /(^|[^a-z0-9])fujitsu([^a-z0-9]|$)/i],
	['Sony', /(^|[^a-z0-9])sony([^a-z0-9]|$)/i],
	['Packard Bell', /(^|[^a-z0-9])packard[ -]?bell([^a-z0-9]|$)/i],
	['Clevo', /(^|[^a-z0-9])clevo([^a-z0-9]|$)/i],
	['Schenker', /(^|[^a-z0-9])schenker([^a-z0-9]|$)/i],
	['Samsung', /(^|[^a-z0-9])samsung([^a-z0-9]|$)/i],
	['Apple', /(^|[^a-z0-9])apple([^a-z0-9]|$)/i],
	['Gateway', /(^|[^a-z0-9])gateway([^a-z0-9]|$)/i],
	['Compaq', /(^|[^a-z0-9])compaq([^a-z0-9]|$)/i],
	['Alienware', /(^|[^a-z0-9])alienware([^a-z0-9]|$)/i],
	['Huawei', /(^|[^a-z0-9])huawei([^a-z0-9]|$)/i],
	['LG', /(^|[^a-z0-9])lg([^a-z0-9]|$)/i],
	['Microsoft', /(^|[^a-z0-9])(microsoft|surface laptop|surface book)([^a-z0-9]|$)/i]
];

function unique(values) {
	return [...new Set(values.filter(Boolean))].sort();
}

function detectedBrands(text) {
	return unique(BRAND_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([brand]) => brand));
}

function structuredModelBrands(value) {
	if (!Array.isArray(value)) return [];
	return unique(
		value.flatMap((row) => {
			if (!row || typeof row !== 'object') return [];
			return detectedBrands([row.brand, row.model].filter(Boolean).join(' '));
		})
	);
}

function csvCell(value) {
	const text = value == null ? '' : String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(records, columns) {
	return [columns.join(','), ...records.map((record) => columns.map((column) => csvCell(record[column])).join(','))].join(
		'\n'
	);
}

async function fetchDisplays(supabase) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from('products')
			.select('id,title,brand,source_url,description,compatibility,search_keywords,specifications')
			.eq('category', 'displays')
			.order('title', { ascending: true })
			.range(from, from + 999);
		if (error) throw new Error(`Failed to read display rows: ${error.message}`);
		rows.push(...(data ?? []));
		if (!data || data.length < 1000) break;
	}
	return rows;
}

function classify(row) {
	const specs = row.specifications ?? {};
	const storedClassification =
		typeof specs['Compatibility Classification'] === 'string' ? specs['Compatibility Classification'] : '';
	const storedBrands = Array.isArray(specs['Compatibility Brands'])
		? unique(specs['Compatibility Brands'].map((brand) => String(brand ?? '').trim()).filter(Boolean))
		: [];
	if (
		['self-only', 'cross-brand', 'no-detectable-brand'].includes(storedClassification) &&
		(storedBrands.length > 0 || storedClassification === 'no-detectable-brand')
	) {
		return {
			compatibility_category: storedClassification,
			classification_basis: 'structured-db',
			self_brand: storedClassification === 'self-only' ? storedBrands[0] : '',
			detected_brands: storedBrands.join(' | '),
			compatibility_brands: storedBrands.join(' | '),
			source_brands: '',
			title: row.title,
			product_brand: row.brand,
			source_url: row.source_url ?? '',
			compatibility: row.compatibility ?? ''
		};
	}
	const tableBrands = structuredModelBrands(specs['Compatible Device Model Table']);
	const compatibilityText = [
		row.compatibility,
		specs['Compatible Device Models'],
		specs['Compatibility Notes']
	].join(' ');
	const compatibilityBrands = tableBrands.length ? tableBrands : detectedBrands(compatibilityText);
	const sourceText = [
		specs.Manufacturer,
		row.brand,
		row.title,
		row.description,
		...(row.search_keywords ?? [])
	].join(' ');
	const sourceBrands = detectedBrands(sourceText);
	const inferredBrands = compatibilityBrands.length ? compatibilityBrands : sourceBrands;
	const category =
		inferredBrands.length === 0
			? 'no-detectable-brand'
			: inferredBrands.length === 1
				? 'self-only'
				: 'cross-brand';
	const basis = compatibilityBrands.length ? 'compatible-models' : sourceBrands.length ? 'source-brand' : 'none';

	return {
		compatibility_category: category,
		classification_basis: basis,
		self_brand: category === 'self-only' ? inferredBrands[0] : '',
		detected_brands: inferredBrands.join(' | '),
		compatibility_brands: compatibilityBrands.join(' | '),
		source_brands: sourceBrands.join(' | '),
		title: row.title,
		product_brand: row.brand,
		source_url: row.source_url ?? '',
		compatibility: row.compatibility ?? ''
	};
}

function writeExports(classified) {
	mkdirSync(outDir, { recursive: true });
	const byBrandDir = join(outDir, 'self-only-by-brand');
	mkdirSync(byBrandDir, { recursive: true });

	const baseColumns = [
		'compatibility_category',
		'classification_basis',
		'detected_brands',
		'compatibility_brands',
		'source_brands',
		'title',
		'product_brand',
		'source_url',
		'compatibility'
	];
	const selfColumns = ['self_brand', ...baseColumns];
	const selfOnly = classified.filter((row) => row.compatibility_category === 'self-only');
	const crossBrand = classified.filter((row) => row.compatibility_category === 'cross-brand');
	const noDetectable = classified.filter((row) => row.compatibility_category === 'no-detectable-brand');

	writeFileSync(join(outDir, 'display_links_self_only.csv'), `${toCsv(selfOnly, selfColumns)}\n`);
	writeFileSync(join(outDir, 'display_links_cross_brand.csv'), `${toCsv(crossBrand, baseColumns)}\n`);
	writeFileSync(join(outDir, 'display_links_no_detectable_brand.csv'), `${toCsv(noDetectable, baseColumns)}\n`);
	writeFileSync(
		join(outDir, 'display_links_self_only_by_brand.csv'),
		`${toCsv(
			[...selfOnly].sort((a, b) => a.self_brand.localeCompare(b.self_brand) || a.title.localeCompare(b.title)),
			selfColumns
		)}\n`
	);

	const selfBrands = unique(selfOnly.map((row) => row.self_brand));
	for (const brand of selfBrands) {
		const safe = brand
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		writeFileSync(
			join(byBrandDir, `${safe}.csv`),
			`${toCsv(
				selfOnly.filter((row) => row.self_brand === brand),
				selfColumns
			)}\n`
		);
	}

	const summary = {
		display_total: classified.length,
		self_only: selfOnly.length,
		cross_brand: crossBrand.length,
		no_detectable_brand: noDetectable.length,
		self_only_by_brand: Object.fromEntries(
			selfBrands.map((brand) => [brand, selfOnly.filter((row) => row.self_brand === brand).length])
		),
		classification_basis: {
			structured_db: classified.filter((row) => row.classification_basis === 'structured-db').length,
			compatible_models: classified.filter((row) => row.classification_basis === 'compatible-models').length,
			source_brand: classified.filter((row) => row.classification_basis === 'source-brand').length,
			none: classified.filter((row) => row.classification_basis === 'none').length
		}
	};
	writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
	return summary;
}

const env = parseEnv();
const supabaseUrl = env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const supabaseKey =
	env.SUPABASE_SERVICE_ROLE_KEY ??
	env.SUPABASE_PUBLISHABLE_KEY ??
	env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
	env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Missing Supabase URL/key in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: { persistSession: false, autoRefreshToken: false }
});
const displays = await fetchDisplays(supabase);
const summary = writeExports(displays.map(classify));
console.log(JSON.stringify({ outDir, ...summary }, null, 2));
