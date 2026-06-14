// Updates display compatibility metadata using IPC Computer as the primary source.
//
// Dry run:
//   node scripts/update-display-compatibility-from-ipc.mjs
//
// Apply live Supabase updates:
//   node scripts/update-display-compatibility-from-ipc.mjs --apply

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const cacheDir = join(root, '.firecrawl', 'ipc-display-compatibility');
const searchCacheFile = join(cacheDir, 'search-cache.json');
const pageCacheFile = join(cacheDir, 'page-cache.json');
const auditFile = join(cacheDir, 'audit.json');

const IPC_SEARCH_URL = 'https://www.ipc-computer.eu/advanced_search_result.php';
const USER_AGENT = 'LapKart display compatibility updater';
const MAX_COMPATIBILITY_LENGTH = 500;
const MAX_SPEC_VALUE_LENGTH = 900;
const DEFAULT_SEARCH_CONCURRENCY = 5;
const DEFAULT_PAGE_CONCURRENCY = 8;
const DEFAULT_UPDATE_CONCURRENCY = 8;

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const refresh = args.has('--refresh');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const rowLimit = limitArg ? Number(limitArg.split('=')[1]) : 0;

const panelMakersPattern =
	/\b(?:au\s*optronics|auo|boe|innolux|lg\s*display|sharp|tianma|hkc|csot|ivo|chimei|chi\s*mei)\b/i;
const samsungPanelPattern = /\bSamsung\s+(?:ATNA|LTN|AMS|LT|LSN)\b/i;
const lgPanelPattern = /\bLG\s+(?:Display\s+)?(?:LP|LM)\d/i;
const deviceBrandPattern =
	/\b(?:acer|alienware|asus|dell|fujitsu|gigabyte|honor|hp|lenovo|msi|razer|samsung|sony|toshiba|dynabook|microsoft|surface|xiaomi|realme|infinix|avita)\b/i;
const badPartKeyPattern =
	/^(?:ACER|ASUS|DELL|HP|LENOVO|MSI|RAZER|SAMSUNG|PREDATOR|GAMING|PAVILION|PRECISION|GALAXY|RAIDER|VIVOBOOK|ZENBOOK|IDEAPAD|THINKPAD|LATITUDE|INSPIRON|OMEN|LEGION|REPLACEMENT|DISPLAY|SCREEN|LAPTOP|MODEL|BRAND|NEW|COMPATIBILITY|CONDITION|FHD|QHD|UHD|HD|IPS|LED|LCD|EDP|PIN|TOUCH|NONTOUCH|MATTE|GLOSSY)$/;
const panelPartPatterns = [
	/\b(?:NV|NT|NE|N)\d{3}[A-Z]{2,4}[-.]?[A-Z0-9]{2,}(?:[-.][A-Z0-9]+)*(?:\s+V\d+(?:\.\d+)?)?\b/gi,
	/\bB\d{3}[A-Z]{2,4}\d{2,3}(?:[.-][A-Z0-9]+)?(?:\s+[A-Z0-9]{1,5})?\b/gi,
	/\b(?:LP|LTN|LQ|LM|TL|MB|HB|KD|VVX|ATNA|ATK|M)\d{2,4}[A-Z0-9.-]{3,}(?:\s+V\d+(?:\.\d+)?)?\b/gi,
	/\b[A-Z]{2,4}\.\d{4}[A-Z]?\.\d{3}\b/gi
];

function parseEnv() {
	const envText = readFileSync(join(root, '.env'), 'utf8');
	const env = {};
	for (const line of envText.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const separator = trimmed.indexOf('=');
		if (separator < 0) continue;
		env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
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
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanText(value) {
	return decodeHtml(value)
		.replace(/[“”]/g, '"')
		.replace(/[‘’]/g, "'")
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.)])/g, '$1')
		.replace(/[(]\s+/g, '(')
		.trim();
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
		const key = text.toLowerCase();
		if (!text || seen.has(key)) continue;
		seen.add(key);
		out.push(text);
		if (out.length >= max) break;
	}
	return out;
}

function normalizePart(value) {
	return cleanText(value)
		.toUpperCase()
		.replace(/\bREV(?:ISION)?\.?\s*/g, 'REV')
		.replace(/\s+V(\d)/g, '-V$1')
		.replace(/[^A-Z0-9]+/g, '');
}

function partWithoutRevision(value) {
	return cleanText(value)
		.replace(/\s+(?:HW|REV(?:ISION)?\.?|VER(?:SION)?\.?)\s*[A-Z0-9. -]+$/i, '')
		.replace(/\s+V\d+(?:\.\d+)?$/i, '')
		.trim();
}

function normalizeModel(value) {
	return cleanText(value)
		.replace(/^Replacement Display for\s+/i, '')
		.replace(/\s+(?:laptop\s*)?(?:screen|display|lcd|led|panel).*/i, '')
		.replace(/\s+replacement$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function subjectFromTitle(title) {
	const subject = cleanText(title).replace(/^Replacement Display for\s+/i, '');
	const beforeSize = subject
		.split(/\b\d{2}(?:\.\d)?\s*(?:-|)?\s*(?:inch|inches|"|″)/i)[0]
		.replace(/\s+(?:laptop\s*)?(?:screen|display|lcd|led|panel).*$/i, '')
		.trim();
	return beforeSize || subject;
}

function rejectPart(value) {
	const key = normalizePart(value);
	if (key.length < 6 || key.length > 40) return true;
	if (badPartKeyPattern.test(key)) return true;
	if (/^(?:REPLACEMENT|DISPLAY|SCREEN|LAPTOP)/.test(key)) return true;
	if (/^\d+$/.test(key)) return true;
	return false;
}

function extractPanelPartsFromText(text) {
	const parts = [];
	for (const pattern of panelPartPatterns) {
		pattern.lastIndex = 0;
		for (const match of String(text ?? '').matchAll(pattern)) {
			const raw = cleanText(match[0])
				.replace(/\s+(?:FHD|QHD|UHD|HD|IPS|LCD|LED|WUXGA|WQHD).*$/i, '')
				.replace(/[-\s]+$/g, '');
			if (!rejectPart(raw)) parts.push(raw);
		}
	}
	return unique(parts, 8);
}

function isPanelMakerSubject(subject) {
	return panelMakersPattern.test(subject) || samsungPanelPattern.test(subject) || lgPanelPattern.test(subject);
}

function fallbackPanelPartFromPanelSubject(subject) {
	if (!isPanelMakerSubject(subject)) return '';
	const value = cleanText(subject)
		.replace(
			/^(?:au\s*optronics|auo|boe|innolux|lg\s*display|lg|samsung|sharp|tianma|hkc|csot|ivo|chimei|chi\s*mei)\s+/i,
			''
		)
		.replace(/\b\d{2}(?:\.\d)?\s*(?:-|)?\s*(?:inch|inches|"|″).*$/i, '')
		.trim();
	const match = value.match(/^[A-Z0-9][A-Z0-9.-]{5,}(?:\s+(?:V|R|REV|HW)?\.?\s*[A-Z0-9.-]+)?/i);
	const panelPart = match ? cleanText(match[0]).replace(/\s+\+$/, '') : '';
	return panelPart && !rejectPart(panelPart) ? panelPart : '';
}

function extractPanelPart(row) {
	const subject = subjectFromTitle(row.title);
	const subjectParts = extractPanelPartsFromText(subject);
	if (
		subjectParts.length > 0 &&
		(isPanelMakerSubject(subject) || normalizePart(subject).startsWith(normalizePart(subjectParts[0])))
	) {
		return subjectParts[0];
	}

	const fallbackSubjectPart = fallbackPanelPartFromPanelSubject(subject);
	if (fallbackSubjectPart) return fallbackSubjectPart;

	const host = sourceHost(row.source_url);
	if (host.includes('pctech.co.in')) {
		const specParts = extractPanelPartsFromText(
			[
				row.specifications?.['MPN (Manufacturer Part Number)'],
				row.specifications?.Model,
				row.specifications?.['Panel Part Number']
			].join(' ')
		);
		if (specParts.length > 0) return specParts[0];
	}

	return '';
}

function deriveDeviceModel(row) {
	const subject = normalizeModel(subjectFromTitle(row.title));
	if (!subject || isPanelMakerSubject(subject)) return '';
	if (!deviceBrandPattern.test(subject) && !/\b[A-Z0-9]{2,}[- ]?[A-Z0-9]{2,}\b/i.test(subject)) {
		return '';
	}
	const brand = cleanText(row.brand);
	if (
		brand &&
		!/^(?:compatible|au\s*optronics|auo|boe|innolux|lg|lg\s*display|samsung|sharp|tianma|hkc|csot|ivo)$/i.test(
			brand
		) &&
		!new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(subject)
	) {
		return truncate(`${brand} ${subject}`, 220);
	}
	return truncate(subject, 220);
}

function isLikelyPanelSubject(row, panelPart) {
	if (!panelPart) return false;
	const subject = subjectFromTitle(row.title);
	if (isPanelMakerSubject(subject)) return true;
	if (normalizePart(subject).startsWith(normalizePart(panelPart))) return true;
	return !deviceBrandPattern.test(subject);
}

function sourceHost(url) {
	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		return '';
	}
}

function specsFromProduct(row) {
	const text = [row.title, row.compatibility, ...(row.highlights ?? [])].join(' ');
	const specs = {};
	const size = text.match(/\b\d{2}(?:\.\d)?\s*(?:-|)?\s*(?:inch|inches|")/i)?.[0];
	const resolution = text.match(/\b\d{3,4}\s*(?:x|×)\s*\d{3,4}\b/i)?.[0];
	const pins = text.match(/\b(?:30|40)\s*[- ]?\s*pin(?:s)?\b/i)?.[0];
	const refresh = text.match(/\b\d{2,3}\s*hz\b/i)?.[0];
	if (size) specs['Screen Size'] = size.replace('"', 'inch');
	if (resolution) specs.Resolution = resolution.replace('×', 'x');
	if (pins) specs['Video Connector'] = pins.replace(/\s+/g, ' ');
	if (refresh) specs['Refresh Rate'] = refresh.replace(/\s+/g, '');
	return specs;
}

function queryVariantsForPart(part) {
	const base = partWithoutRevision(part);
	const variants = unique([
		base,
		part,
		base.replace(/[.\s]+/g, '-'),
		base.replace(/-/g, ' '),
		base.replace(/[.\s-]+/g, '')
	]);
	return variants.filter((value) => value.length >= 5).slice(0, 4);
}

function ipcPartKeyFromUrl(url) {
	const match = String(url).match(/\/display-([^/?#]+?)-\d+(?:[/?#]|$)/i);
	if (!match) return '';
	return normalizePart(match[1]);
}

function ipcPartLabelFromUrl(url) {
	const match = String(url).match(/\/display-([^/?#]+?)-\d+(?:[/?#]|$)/i);
	if (!match) return '';
	return match[1].replace(/-/g, ' ').toUpperCase();
}

function scoreIpcUrl(url, part) {
	const urlKey = ipcPartKeyFromUrl(url);
	const fullKey = normalizePart(part);
	const baseKey = normalizePart(partWithoutRevision(part));
	if (!urlKey || !baseKey) return 0;
	if (urlKey === fullKey) return 100;
	if (urlKey === baseKey) return 90;
	if (urlKey.startsWith(fullKey) || fullKey.startsWith(urlKey)) return 75;
	if (urlKey.startsWith(baseKey) || baseKey.startsWith(urlKey)) return 60;
	if (urlKey.includes(baseKey) || baseKey.includes(urlKey)) return 40;
	return 0;
}

function parseDisplayLinks(html, part) {
	const links = [];
	for (const match of html.matchAll(/href="([^"]*\/laptop-spare-parts\/displays\/display-[^"]+)"/gi)) {
		const url = new URL(decodeHtml(match[1]), 'https://www.ipc-computer.eu/').toString();
		const score = scoreIpcUrl(url, part);
		if (score > 0) links.push({ url, score });
	}
	return unique(
		links
			.sort((a, b) => b.score - a.score)
			.map((item) => item.url),
		8
	);
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			accept: 'text/html,*/*',
			'user-agent': USER_AGENT
		}
	});
	if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
	return response.text();
}

async function searchIpcPart(part, searchCache) {
	const cacheKey = normalizePart(partWithoutRevision(part));
	if (!refresh && searchCache[cacheKey]) return searchCache[cacheKey];

	const urls = [];
	for (const query of queryVariantsForPart(part)) {
		const url = `${IPC_SEARCH_URL}?keywords=${encodeURIComponent(query)}`;
		const html = await fetchText(url);
		urls.push(...parseDisplayLinks(html, part));
		if (urls.length > 0) break;
	}

	const result = unique(urls, 8);
	searchCache[cacheKey] = result;
	return result;
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

function parseIpcPage(url, html) {
	const pairs = parseDtDdPairs(html);
	const specs = {};
	let itemNumber = '';
	let primaryPartNumber = '';
	let suitableModels = [];
	let excerptLabel = '';

	for (const pair of pairs) {
		if (/^Item Number$/i.test(pair.label)) {
			const text = pair.value;
			itemNumber = text.split(/\s+Primary Partnummer/i)[0].trim();
			const primaryMatch = text.match(/Primary Partnummer\s+([A-Z0-9.-]+)/i);
			if (primaryMatch) primaryPartNumber = primaryMatch[1].trim();
			continue;
		}

		if (/^Excerpt of suitable models/i.test(pair.label)) {
			excerptLabel = pair.label;
			suitableModels = unique(
				[...pair.valueHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) =>
					stripHtml(match[1])
				),
				18
			);
			continue;
		}

		if (
			/^(Size|Resolution|Panel|Surface|Frame rate|Backlight|Length \/ Width|Thickness|Brackets|Position of display connector|Width of display connector|Number of pins|Displayansteuerung|Condition|Manufacturer|Category|Usage)$/i.test(
				pair.label
			)
		) {
			specs[pair.label] = truncate(pair.value, 160);
		}
	}

	return {
		url,
		itemNumber: itemNumber || ipcPartLabelFromUrl(url),
		primaryPartNumber,
		suitableModels,
		excerptLabel,
		specs
	};
}

async function fetchIpcPage(url, pageCache) {
	if (!refresh && pageCache[url]) return pageCache[url];
	const html = await fetchText(url);
	const parsed = parseIpcPage(url, html);
	pageCache[url] = parsed;
	return parsed;
}

function mergeSpecifications(row, update) {
	const specs = { ...(row.specifications ?? {}) };
	for (const [label, value] of Object.entries(update)) {
		if (!value) continue;
		specs[label] = truncate(value, MAX_SPEC_VALUE_LENGTH);
	}
	return specs;
}

function modelCompatibilityText(models, panelPart) {
	const prefix = panelPart ? `Compatible device models for panel P/N ${panelPart}: ` : 'Compatible with: ';
	const text = `${prefix}${models.join(', ')}`;
	return truncate(text, MAX_COMPATIBILITY_LENGTH);
}

function titleCompatibilityText(model) {
	return truncate(`Compatible with ${model}`, MAX_COMPATIBILITY_LENGTH);
}

function fallbackCompatibilityText(panelPart, specs) {
	const details = unique(
		[
			specs['Screen Size'],
			specs.Resolution,
			specs['Video Connector'],
			specs['Refresh Rate']
		].filter(Boolean),
		4
	).join(', ');
	const suffix = details ? ` (${details})` : '';
	return truncate(
		`Match by display panel part number ${panelPart}${suffix}. Confirm connector, resolution and mounting before ordering.`,
		MAX_COMPATIBILITY_LENGTH
	);
}

function buildKeywords(row, additions) {
	return unique(
		[
			...(row.search_keywords ?? []),
			...additions,
			...additions.flatMap((value) => cleanText(value).split(/[\s,;/|()]+/))
		]
			.map((value) => truncate(value, 80))
			.filter((value) => value.length >= 2),
		80
	);
}

function buildHighlights(row, sourceLabel, panelPart) {
	const current = row.highlights ?? [];
	const additions = [
		sourceLabel === 'ipc' ? 'Compatibility checked against IPC Computer reference' : '',
		panelPart ? `Panel Part Number: ${panelPart}` : '',
		'Confirm connector, resolution and mounting before ordering'
	];
	return unique([...current, ...additions], 12).map((value) => truncate(value, 160));
}

async function mapLimit(values, limit, mapper) {
	const results = new Array(values.length);
	let index = 0;
	const workers = Array.from({ length: Math.min(limit, values.length || 1) }, async () => {
		while (index < values.length) {
			const current = index++;
			results[current] = await mapper(values[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

async function fetchAllDisplayProducts(supabase) {
	const rows = [];
	for (let from = 0; ; from += 1000) {
		const { data, error } = await supabase
			.from('products')
			.select(
				'id,title,brand,sku,source_url,compatibility,specifications,search_keywords,highlights,status,updated_at'
			)
			.eq('category', 'displays')
			.range(from, from + 999);
		if (error) throw error;
		rows.push(...(data ?? []));
		if (!data || data.length < 1000) break;
	}
	return rowLimit > 0 ? rows.slice(0, rowLimit) : rows;
}

async function resolvePanelMatches(parts, searchCache, pageCache) {
	const entries = [...parts.values()];
	const matchMap = new Map();
	let searched = 0;
	let pagesRead = 0;

	await mapLimit(entries, DEFAULT_SEARCH_CONCURRENCY, async (entry) => {
		searched += 1;
		if (searched % 25 === 0 || searched === entries.length) {
			process.stdout.write(`IPC searches ${searched}/${entries.length}\r`);
		}

		const candidateUrls = await searchIpcPart(entry.panelPart, searchCache);
		const pages = [];
		for (const url of candidateUrls) {
			try {
				const page = await fetchIpcPage(url, pageCache);
				pagesRead += 1;
				pages.push(page);
			} catch (error) {
				entry.errors.push(error instanceof Error ? error.message : String(error));
			}
		}
		if (pages.length > 0) matchMap.set(entry.key, pages);
	});
	process.stdout.write('\n');

	return { matchMap, searched, pagesRead };
}

function parseResolution(value) {
	const match = String(value ?? '').match(/\b(\d{3,4})\s*(?:x|×)\s*(\d{3,4})\b/i);
	if (!match) return '';
	return `${match[1]}x${match[2]}`;
}

function parseRefresh(value) {
	const match = String(value ?? '').match(/\b(\d{2,3})\s*hz\b/i);
	return match ? Number(match[1]) : 0;
}

function parsePin(value) {
	const match = String(value ?? '').match(/\b(30|40)\s*(?:pin|pins)?\b/i);
	return match ? Number(match[1]) : 0;
}

function parseSize(value) {
	const match = String(value ?? '').match(/\b(\d{2}(?:\.\d)?)\b/);
	return match ? Number(match[1]) : 0;
}

function ipcSpecsCompatible(localSpecs, ipcSpecs) {
	const localResolution = parseResolution(localSpecs.Resolution);
	const ipcResolution = parseResolution(ipcSpecs.Resolution);
	if (localResolution && ipcResolution && localResolution !== ipcResolution) return false;

	const localRefresh = parseRefresh(localSpecs['Refresh Rate']);
	const ipcRefresh = parseRefresh(ipcSpecs['Frame rate']);
	if (localRefresh && ipcRefresh && localRefresh !== ipcRefresh) return false;

	const localPin = parsePin(localSpecs['Video Connector']);
	const ipcPin = parsePin(ipcSpecs['Number of pins']);
	if (localPin && ipcPin && localPin !== ipcPin) return false;

	const localSize = parseSize(localSpecs['Screen Size']);
	const ipcSize = parseSize(ipcSpecs.Size);
	if (localSize && ipcSize && Math.abs(localSize - ipcSize) > 0.15) return false;

	return true;
}

function chooseIpcPage(pages, localSpecs) {
	return (
		pages.find(
			(page) => page.suitableModels.length > 0 && ipcSpecsCompatible(localSpecs, page.specs)
		) ?? null
	);
}

function planRowUpdate(row, ipcPageByPanelKey) {
	const subject = subjectFromTitle(row.title);
	const panelPart = extractPanelPart(row);
	const panelKey = panelPart ? normalizePart(partWithoutRevision(panelPart)) : '';
	const titleModel = deriveDeviceModel(row);
	const baseSpecs = specsFromProduct(row);
	const ipcPages = panelKey ? (ipcPageByPanelKey.get(panelKey) ?? []) : [];
	const ipcPage = chooseIpcPage(ipcPages, baseSpecs);

	if (ipcPage?.suitableModels?.length) {
		const models = ipcPage.suitableModels;
		const specs = mergeSpecifications(row, {
			'Panel Part Number': ipcPage.itemNumber || panelPart,
			'Primary Part Number': ipcPage.primaryPartNumber,
			'Compatible Device Models': models.join(', '),
			'Compatibility Source': `IPC Computer (${ipcPage.itemNumber || panelPart})`,
			'Screen Size': ipcPage.specs.Size || baseSpecs['Screen Size'],
			Resolution: ipcPage.specs.Resolution || baseSpecs.Resolution,
			'Panel Type': ipcPage.specs.Panel,
			'Surface Type': ipcPage.specs.Surface,
			'Refresh Rate': ipcPage.specs['Frame rate'] || baseSpecs['Refresh Rate'],
			'Video Connector': [
				ipcPage.specs['Number of pins'] ? `${ipcPage.specs['Number of pins']} pin` : '',
				ipcPage.specs.Displayansteuerung
			]
				.filter(Boolean)
				.join(' ')
		});
		const compatibility = modelCompatibilityText(models, ipcPage.itemNumber || panelPart);
		const keywords = buildKeywords(row, [
			panelPart,
			ipcPage.itemNumber,
			ipcPage.primaryPartNumber,
			...models,
			ipcPage.url
		]);
		const highlights = buildHighlights(row, 'ipc', ipcPage.itemNumber || panelPart);
		return {
			id: row.id,
			title: row.title,
			panelPart: ipcPage.itemNumber || panelPart,
			compatibility,
			specifications: specs,
			search_keywords: keywords,
			highlights,
			source: 'ipc',
			sourceUrl: ipcPage.url,
			modelCount: models.length,
			subject
		};
	}

	if (panelPart && isLikelyPanelSubject(row, panelPart)) {
		const specs = mergeSpecifications(row, {
			'Panel Part Number': panelPart,
			'Compatibility Source': 'Panel part number/spec match',
			...baseSpecs
		});
		const compatibility = fallbackCompatibilityText(panelPart, baseSpecs);
		const keywords = buildKeywords(row, [panelPart, ...Object.values(baseSpecs)]);
		const highlights = buildHighlights(row, 'fallback', panelPart);
		return {
			id: row.id,
			title: row.title,
			panelPart,
			compatibility,
			specifications: specs,
			search_keywords: keywords,
			highlights,
			source: 'panel_fallback',
			sourceUrl: row.source_url,
			modelCount: 0,
			subject
		};
	}

	if (titleModel) {
		const specs = mergeSpecifications(row, {
			'Compatible Device Models': titleModel,
			'Compatibility Source': 'Product title model match',
			...baseSpecs
		});
		const compatibility = titleCompatibilityText(titleModel);
		const keywords = buildKeywords(row, [titleModel, ...Object.values(baseSpecs)]);
		const highlights = buildHighlights(row, 'title', panelPart);
		return {
			id: row.id,
			title: row.title,
			panelPart,
			compatibility,
			specifications: specs,
			search_keywords: keywords,
			highlights,
			source: 'title',
			sourceUrl: row.source_url,
			modelCount: 1,
			subject
		};
	}

	if (panelPart) {
		const specs = mergeSpecifications(row, {
			'Panel Part Number': panelPart,
			'Compatibility Source': 'Panel part number/spec match',
			...baseSpecs
		});
		const compatibility = fallbackCompatibilityText(panelPart, baseSpecs);
		const keywords = buildKeywords(row, [panelPart, ...Object.values(baseSpecs)]);
		const highlights = buildHighlights(row, 'fallback', panelPart);
		return {
			id: row.id,
			title: row.title,
			panelPart,
			compatibility,
			specifications: specs,
			search_keywords: keywords,
			highlights,
			source: 'panel_fallback',
			sourceUrl: row.source_url,
			modelCount: 0,
			subject
		};
	}

	return {
		id: row.id,
		title: row.title,
		panelPart: '',
		compatibility: truncate(
			row.compatibility || 'Compatibility guidance is available before dispatch.',
			MAX_COMPATIBILITY_LENGTH
		),
		specifications: mergeSpecifications(row, {
			'Compatibility Source': 'Needs manual verification',
			...baseSpecs
		}),
		search_keywords: buildKeywords(row, Object.values(baseSpecs)),
		highlights: buildHighlights(row, 'fallback', ''),
		source: 'unresolved',
		sourceUrl: row.source_url,
		modelCount: 0,
		subject
	};
}

function hasMeaningfulChange(row, plan) {
	return (
		cleanText(row.compatibility) !== cleanText(plan.compatibility) ||
		JSON.stringify(row.specifications ?? {}) !== JSON.stringify(plan.specifications ?? {}) ||
		JSON.stringify(row.search_keywords ?? []) !== JSON.stringify(plan.search_keywords ?? []) ||
		JSON.stringify(row.highlights ?? []) !== JSON.stringify(plan.highlights ?? [])
	);
}

async function applyUpdates(supabase, updates) {
	let updated = 0;
	const errors = [];
	await mapLimit(updates, DEFAULT_UPDATE_CONCURRENCY, async (plan) => {
		const { error } = await supabase
			.from('products')
			.update({
				compatibility: plan.compatibility,
				specifications: plan.specifications,
				search_keywords: plan.search_keywords,
				highlights: plan.highlights,
				updated_at: new Date().toISOString()
			})
			.eq('id', plan.id);

		if (error) {
			errors.push({ id: plan.id, title: plan.title, error: error.message });
			return;
		}

		updated += 1;
		if (updated % 100 === 0 || updated === updates.length) {
			process.stdout.write(`Supabase updates ${updated}/${updates.length}\r`);
		}
	});
	process.stdout.write('\n');
	return { updated, errors };
}

const env = parseEnv();
const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
	throw new Error('Missing SUPABASE_URL/PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
}

mkdirSync(cacheDir, { recursive: true });
const searchCache = loadJson(searchCacheFile, {});
const pageCache = loadJson(pageCacheFile, {});
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const rows = await fetchAllDisplayProducts(supabase);
const panelParts = new Map();
for (const row of rows) {
	const panelPart = extractPanelPart(row);
	if (!panelPart) continue;
	const key = normalizePart(partWithoutRevision(panelPart));
	if (!panelParts.has(key)) {
		panelParts.set(key, { key, panelPart: partWithoutRevision(panelPart), count: 0, errors: [] });
	}
	panelParts.get(key).count += 1;
}

console.log(
	JSON.stringify(
		{
			mode: apply ? 'apply' : 'dry-run',
			displayRows: rows.length,
			distinctPanelParts: panelParts.size,
			cacheDir
		},
		null,
		2
	)
);

const { matchMap, searched, pagesRead } = await resolvePanelMatches(
	panelParts,
	searchCache,
	pageCache
);

const plans = rows.map((row) => planRowUpdate(row, matchMap));
const changed = plans.filter((plan, index) => hasMeaningfulChange(rows[index], plan));
const sourceCounts = plans.reduce((acc, plan) => {
	acc[plan.source] = (acc[plan.source] ?? 0) + 1;
	return acc;
}, {});
const changedSourceCounts = changed.reduce((acc, plan) => {
	acc[plan.source] = (acc[plan.source] ?? 0) + 1;
	return acc;
}, {});

let applyResult = { updated: 0, errors: [] };
if (apply && changed.length > 0) {
	applyResult = await applyUpdates(supabase, changed);
}

saveJson(searchCacheFile, searchCache);
saveJson(pageCacheFile, pageCache);
saveJson(auditFile, {
	generatedAt: new Date().toISOString(),
	mode: apply ? 'apply' : 'dry-run',
	displayRows: rows.length,
	distinctPanelParts: panelParts.size,
	ipcSearched: searched,
	ipcPagesRead: pagesRead,
	ipcMatches: matchMap.size,
	sourceCounts,
	changedRows: changed.length,
	changedSourceCounts,
	updatedRows: applyResult.updated,
	updateErrors: applyResult.errors,
	samples: plans.slice(0, 30).map((plan) => ({
		title: plan.title,
		source: plan.source,
		panelPart: plan.panelPart,
		modelCount: plan.modelCount,
		compatibility: plan.compatibility,
		sourceUrl: plan.sourceUrl
	})),
	unresolvedSamples: plans
		.filter((plan) => plan.source === 'unresolved')
		.slice(0, 50)
		.map((plan) => ({
			title: plan.title,
			subject: plan.subject,
			compatibility: plan.compatibility,
			sourceUrl: plan.sourceUrl
		})),
	panelFallbackSamples: plans
		.filter((plan) => plan.source === 'panel_fallback')
		.slice(0, 50)
		.map((plan) => ({
			title: plan.title,
			panelPart: plan.panelPart,
			compatibility: plan.compatibility,
			sourceUrl: plan.sourceUrl
		}))
});

console.log(
	JSON.stringify(
		{
			mode: apply ? 'apply' : 'dry-run',
			displayRows: rows.length,
			distinctPanelParts: panelParts.size,
			ipcMatches: matchMap.size,
			sourceCounts,
			changedRows: changed.length,
			changedSourceCounts,
			updatedRows: applyResult.updated,
			updateErrors: applyResult.errors.length,
			auditFile,
			sample: plans.slice(0, 8).map((plan) => ({
				source: plan.source,
				panelPart: plan.panelPart,
				modelCount: plan.modelCount,
				compatibility: plan.compatibility,
				title: plan.title
			}))
		},
		null,
		2
	)
);
