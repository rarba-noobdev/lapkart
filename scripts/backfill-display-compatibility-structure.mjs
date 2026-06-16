// Backfill structured compatibility data for display products.
//
// Adds these JSON fields inside products.specifications:
// - Panel Part Number Table: [{ type, value }]
// - Compatible Device Model Table: [{ brand, model }]
// - Compatibility Brands: string[]
// - Compatibility Classification: self-only | cross-brand | no-detectable-brand

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const MISSING_ONLY = process.argv.includes('--missing-only');
const CONCURRENCY = Number(process.argv.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1] ?? 16);

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

function cleanText(value) {
	return String(value ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

function uniqueBy(values, keyFn, max = Infinity) {
	const out = [];
	const seen = new Set();
	for (const value of values) {
		const key = keyFn(value);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(value);
		if (out.length >= max) break;
	}
	return out;
}

function splitCsvText(value) {
	return cleanText(value)
		.split(/\s*,\s*/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function textBetween(value, startPattern, endPattern) {
	const text = cleanText(value);
	const start = text.match(startPattern);
	if (!start || start.index === undefined) return '';
	const from = start.index + start[0].length;
	const rest = text.slice(from);
	const end = rest.match(endPattern);
	return cleanText(end && end.index !== undefined ? rest.slice(0, end.index) : rest);
}

function detectBrand(value) {
	const text = cleanText(value);
	for (const [brand, pattern] of BRAND_PATTERNS) {
		if (pattern.test(text)) return brand;
	}
	return '';
}

function detectAllBrands(values) {
	return uniqueBy(
		values.flatMap((value) => {
			const text = cleanText(value);
			return BRAND_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([brand]) => brand);
		}),
		(value) => value.toLowerCase()
	).sort();
}

function stripModelBrand(model, brand) {
	if (!brand) return model;
	const patterns = {
		HP: /^(?:HP|Hewlett[ -]?Packard)\s+/i,
		'Packard Bell': /^Packard[ -]?Bell\s+/i,
		Microsoft: /^(?:Microsoft\s+)?/i
	};
	const pattern = patterns[brand] ?? new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
	return cleanText(model.replace(pattern, ''));
}

function inferSourceBrand(row, specs) {
	return detectBrand([specs.Manufacturer, row.brand, row.title, row.description, ...(row.search_keywords ?? [])].join(' '));
}

function parseModelRows(row, specs) {
	const rawModelText =
		cleanText(specs['Compatible Device Models']) ||
		cleanText(specs['Compatible Dell Models']) ||
		textBetween(row.compatibility, /Compatible laptop models?:/i, /(?:\. Match| Match screen|$)/i) ||
		textBetween(row.compatibility, /Compatible device model:/i, /(?:\. Result| Result type|\. Match| Match laptop|$)/i);
	const sourceBrand = inferSourceBrand(row, specs);
	const defaultBrand = cleanText(specs['Compatible Dell Models']) ? 'Dell' : sourceBrand;

	const rows = splitCsvText(rawModelText)
		.filter((model) => !/\b(part number|manufacturer|dp\/n|lcd dp\/n|kit part|source price)\b/i.test(model))
		.map((model) => {
			const detected = detectBrand(model);
			const brand = detected || defaultBrand || '';
			return {
				brand,
				model: stripModelBrand(model, brand) || model
			};
		})
		.filter((row) => row.model);

	return uniqueBy(rows, (row) => `${row.brand.toLowerCase()}|${row.model.toLowerCase()}`, 120);
}

function parsePartRows(row, specs) {
	const rows = [];
	const primary = cleanText(specs['Primary Part Number'] || specs['Panel Part Number'] || specs['Part Number']);
	const panel = cleanText(specs['Panel Part Number']);
	const subParts = splitCsvText(specs['Sub-Partnumbers']);
	const dellParts = splitCsvText(specs['Dell Part Numbers']);
	const manufacturerParts = splitCsvText(specs['Manufacturer Part Numbers']);
	const compatibilityParts = splitCsvText(textBetween(row.compatibility, /Panel part numbers?:/i, /(?:\. Compatible|\. Match| Match screen|$)/i));

	if (primary) rows.push({ type: 'Primary', value: primary });
	if (panel && panel.toLowerCase() !== primary.toLowerCase()) rows.push({ type: 'Panel', value: panel });
	for (const value of subParts) rows.push({ type: 'Sub-part', value });
	for (const value of dellParts) rows.push({ type: 'Dell part', value });
	for (const value of manufacturerParts) rows.push({ type: 'Manufacturer part', value });
	for (const value of compatibilityParts) rows.push({ type: 'Panel', value });

	return uniqueBy(rows, (row) => row.value.toLowerCase(), 80);
}

function classify(row, specs, modelRows) {
	const modelBrands = detectAllBrands(modelRows.map((model) => `${model.brand} ${model.model}`));
	const sourceBrand = inferSourceBrand(row, specs);
	const brands = modelBrands.length ? modelBrands : sourceBrand ? [sourceBrand] : [];
	const classification =
		brands.length === 0 ? 'no-detectable-brand' : brands.length === 1 ? 'self-only' : 'cross-brand';
	return { brands, classification };
}

function structuredSpecs(row) {
	const specs = row.specifications && typeof row.specifications === 'object' ? row.specifications : {};
	const partRows = parsePartRows(row, specs);
	const modelRows = parseModelRows(row, specs);
	const { brands, classification } = classify(row, specs, modelRows);
	return {
		...specs,
		'Panel Part Number Table': partRows,
		'Compatible Device Model Table': modelRows,
		'Compatibility Brands': brands,
		'Compatibility Classification': classification
	};
}

async function fetchDisplays(supabase) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from('products')
			.select('id,title,brand,description,compatibility,search_keywords,specifications')
			.eq('category', 'displays')
			.range(from, from + 999);
		if (error) throw new Error(`Failed to read displays: ${error.message}`);
		rows.push(...(data ?? []));
		if (!data || data.length < 1000) break;
	}
	return rows;
}

async function updateRows(supabase, rows) {
	const targetRows = MISSING_ONLY
		? rows.filter((row) => !(row.specifications && row.specifications['Compatibility Classification']))
		: rows;
	const summary = {
		total: rows.length,
		targeted: targetRows.length,
		updated: 0,
		selfOnly: 0,
		crossBrand: 0,
		noDetectableBrand: 0,
		withModels: 0,
		withPartNumbers: 0
	};

	let index = 0;
	async function worker() {
		while (index < targetRows.length) {
			const current = index;
			index += 1;
			await updateRow(targetRows[current]);
		}
	}

	async function updateRow(row) {
		const specs = structuredSpecs(row);
		const classification = specs['Compatibility Classification'];
		if (classification === 'self-only') summary.selfOnly += 1;
		if (classification === 'cross-brand') summary.crossBrand += 1;
		if (classification === 'no-detectable-brand') summary.noDetectableBrand += 1;
		if (specs['Compatible Device Model Table'].length > 0) summary.withModels += 1;
		if (specs['Panel Part Number Table'].length > 0) summary.withPartNumbers += 1;

		if (!DRY_RUN) {
			const { error } = await supabase
				.from('products')
				.update({ specifications: specs })
				.eq('id', row.id);
			if (error) throw new Error(`Failed to update ${row.id}: ${error.message}`);
		}
		summary.updated += 1;
	}

	await Promise.all(
		Array.from({ length: Math.max(1, Math.min(CONCURRENCY, targetRows.length || 1)) }, worker)
	);

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

const rows = await fetchDisplays(supabase);
const summary = await updateRows(supabase, rows);
console.log(JSON.stringify({ dryRun: DRY_RUN, ...summary }, null, 2));
