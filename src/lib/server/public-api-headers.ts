const PUBLIC_API_CACHE = 'public, max-age=45, s-maxage=300, stale-while-revalidate=900';

const PUBLIC_API_CORS_HEADERS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, OPTIONS',
	'access-control-allow-headers': 'content-type'
};

export function publicApiHeaders(extra: Record<string, string> = {}) {
	return {
		...PUBLIC_API_CORS_HEADERS,
		'cache-control': PUBLIC_API_CACHE,
		...extra
	};
}

export function publicApiErrorHeaders(extra: Record<string, string> = {}) {
	return {
		...PUBLIC_API_CORS_HEADERS,
		'cache-control': 'no-store',
		...extra
	};
}

export function publicApiOptionsResponse() {
	return new Response(null, {
		status: 204,
		headers: PUBLIC_API_CORS_HEADERS
	});
}
