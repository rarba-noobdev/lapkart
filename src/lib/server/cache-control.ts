export const PUBLIC_CATALOG_CACHE =
	'public, max-age=60, s-maxage=300, stale-while-revalidate=600';
export const PUBLIC_SEARCH_CACHE =
	'public, max-age=20, s-maxage=120, stale-while-revalidate=300';
export const PRIVATE_USER_CACHE = 'private, max-age=30';

export function publicCatalogCacheControl(user: unknown) {
	return user ? PRIVATE_USER_CACHE : PUBLIC_CATALOG_CACHE;
}
