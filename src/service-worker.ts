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

const PRECACHE = [...build, ...files];

// Only public, non-personalized pages may be stored in PAGE_CACHE. Caching an
// authenticated route (orders/profile/order/cart/checkout) would persist one
// user's private HTML on the device, where it could be served offline to a
// different user or after sign-out. Those routes stay network-only — no cached
// copy is ever written, so there is nothing to leak.
const PRIVATE_PREFIXES = ['/orders', '/order/', '/profile', '/cart', '/checkout', '/login', '/admin', '/auth/'];

function isCacheablePage(pathname: string): boolean {
	return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
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
			const keep = new Set([ASSET_CACHE, PAGE_CACHE]);
			for (const key of await caches.keys()) {
				if (!keep.has(key)) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Only handle same-origin requests. Supabase, Razorpay, Typesense, Ola Maps
	// etc. stay network-only — caching auth/data/payment calls would serve stale
	// or wrong state offline.
	if (url.origin !== sw.location.origin) return;

	// Immutable build assets + static files: cache-first (they're content-hashed
	// or stable, and were precached on install).
	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(cacheFirst(request, ASSET_CACHE));
		return;
	}

	// Public page navigations: network-first so online users always get fresh
	// SSR data, with the last cached copy as the offline fallback. Authenticated
	// routes are never cached (see PRIVATE_PREFIXES) and fall through to the
	// network untouched.
	if (request.mode === 'navigate' && isCacheablePage(url.pathname)) {
		event.respondWith(networkFirst(request, PAGE_CACHE));
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

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(request, response.clone());
		return response;
	} catch (err) {
		const cached = (await cache.match(request)) || (await cache.match('/'));
		if (cached) return cached;
		throw err;
	}
}
