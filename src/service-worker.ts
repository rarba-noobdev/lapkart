/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Versioned cache of the immutable build output + static files. Bumping
// `version` (every deploy) creates a fresh cache and evicts the old one, so
// stale hashed assets can never be served against a newer HTML shell.
const ASSET_CACHE = `assets-${version}`;
// Runtime cache for navigations (SSR-rendered HTML pages). Kept separate so a
// deploy doesn't wipe pages the user already viewed offline.
const PAGE_CACHE = `pages-${version}`;
// Public JSON/data endpoints that are safe to replay instantly and refresh in
// the background. Do not add account, cart, order, checkout, or admin APIs.
const DATA_CACHE = `public-data-${version}`;
const IMAGE_CACHE = 'product-images-v1';

const PRECACHE = [...build, ...files];
const PUBLIC_DATA_PATHS = new Set([
	'/api/search/products',
	'/api/catalog/home',
	'/api/catalog/category-counts'
]);
const MAX_DATA_CACHE_ENTRIES = 180;
const MAX_IMAGE_CACHE_ENTRIES = 160;
const PAGE_NETWORK_TIMEOUT_MS = 300;
const CACHEABLE_IMAGE_HOSTS = new Set([
	'images.weserv.nl',
	'www.power-x.in',
	'cdn.shopify.com',
	'techiestore.in',
	'cdnassets.parts-people.com',
	'mdcomputers.in',
	'images.unsplash.com'
]);

// Only public, non-personalized pages may be stored in PAGE_CACHE. Caching an
// authenticated route (orders/profile/order/cart/checkout) would persist one
// user's private HTML on the device, where it could be served offline to a
// different user or after sign-out. Those routes stay network-only - no cached
// copy is ever written, so there is nothing to leak.
const PRIVATE_PREFIXES = [
	'/orders',
	'/order/',
	'/profile',
	'/cart',
	'/checkout',
	'/login',
	'/admin',
	'/auth/'
];

function isCacheablePage(pathname: string): boolean {
	return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isPublicDataPath(pathname: string): boolean {
	return PUBLIC_DATA_PATHS.has(pathname) || pathname.startsWith('/api/products/');
}

function pagePathFromSvelteData(pathname: string): string | null {
	if (!pathname.endsWith('/__data.json')) return null;
	const pagePath = pathname.slice(0, -'/__data.json'.length);
	return pagePath || '/';
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(ASSET_CACHE);
			await cache.addAll(PRECACHE);
			// Warm the home page shell so a cold offline launch has something
			// to render even before the user navigates anywhere.
			await caches.open(PAGE_CACHE).then((c) =>
				c.add('/').catch(() => {
					/* offline at install time; runtime cache fills it later */
				})
			);
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keep = new Set([ASSET_CACHE, PAGE_CACHE, DATA_CACHE, IMAGE_CACHE]);
			for (const key of await caches.keys()) {
				if (!keep.has(key)) await caches.delete(key);
			}
			await sw.registration.navigationPreload?.enable();
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	if (request.destination === 'image' && CACHEABLE_IMAGE_HOSTS.has(url.hostname)) {
		event.respondWith(cacheRuntimeImage(request));
		return;
	}

	if (url.origin === sw.location.origin && isPublicDataPath(url.pathname)) {
		event.respondWith(staleWhileRevalidate(request, DATA_CACHE, MAX_DATA_CACHE_ENTRIES));
		return;
	}

	const dataPagePath = pagePathFromSvelteData(url.pathname);
	if (url.origin === sw.location.origin && dataPagePath && isCacheablePage(dataPagePath)) {
		event.respondWith(staleWhileRevalidate(request, DATA_CACHE, MAX_DATA_CACHE_ENTRIES));
		return;
	}

	// Only handle the rest of same-origin requests. Supabase, Razorpay, Ola Maps
	// etc. stay network-only - caching auth/data/payment calls would serve stale
	// or wrong state offline.
	if (url.origin !== sw.location.origin) return;

	// Immutable build assets + static files: cache-first (they're content-hashed
	// or stable, and were precached on install).
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, ASSET_CACHE));
		return;
	}

	// Public page navigations: give the network a short chance, then show the
	// cached copy while the request keeps refreshing the cache in the background.
	// Authenticated routes are never cached and fall through to the network.
	if (request.mode === 'navigate' && isCacheablePage(url.pathname)) {
		event.respondWith(
			fastNetworkFirst(request, PAGE_CACHE, PAGE_NETWORK_TIMEOUT_MS, event.preloadResponse)
		);
		return;
	}
});

// Allow the app to purge cached pages on sign-out as defense-in-depth, even
// though private routes are never cached in the first place.
sw.addEventListener('message', (event) => {
	if (event.data?.type === 'clear-pages') {
		event.waitUntil(caches.delete(PAGE_CACHE));
	}
});

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) cache.put(request, response.clone());
	return response;
}

async function fastNetworkFirst(
	request: Request,
	cacheName: string,
	timeoutMs: number,
	preloadedResponse?: Promise<Response | undefined>
): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = Promise.resolve(preloadedResponse)
		.then((preloaded) => preloaded ?? fetch(request))
		.then(async (response) => {
			if (response.ok) await cache.put(request, response.clone());
			return response;
		});

	if (!cached) {
		try {
			return await network;
		} catch (err) {
			// Only use the home shell as an offline fallback after the requested
			// page genuinely fails. Returning it on a short timeout shows the
			// wrong page under deep URLs and breaks relative asset hydration.
			const fallback = await cache.match('/');
			if (fallback) return fallback;
			throw err;
		}
	}

	void network.catch(() => null);

	return Promise.race([
		network,
		new Promise<Response>((resolve) => {
			setTimeout(() => resolve(cached), timeoutMs);
		})
	]).catch(() => cached);
}

async function staleWhileRevalidate(
	request: Request,
	cacheName: string,
	maxEntries: number
): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const refresh = fetch(request)
		.then(async (response) => {
			if (response.ok) {
				await cache.put(request, response.clone());
				await trimCache(cache, maxEntries);
			}
			return response;
		})
		.catch(() => null);

	if (cached) {
		void refresh;
		return cached;
	}

	const response = await refresh;
	if (response) return response;
	throw new TypeError('Public data request failed and no cache entry exists');
}

async function cacheRuntimeImage(request: Request): Promise<Response> {
	const cache = await caches.open(IMAGE_CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;

	const response = await fetch(request);
	if (response.ok || response.type === 'opaque') {
		await cache.put(request, response.clone());
		await trimCache(cache, MAX_IMAGE_CACHE_ENTRIES);
	}
	return response;
}

async function trimCache(cache: Cache, maxEntries: number) {
	const keys = await cache.keys();
	if (keys.length <= maxEntries) return;

	await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}
