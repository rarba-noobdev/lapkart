export const PUBLIC_CATALOG_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=900';
export const PUBLIC_SEARCH_CACHE = 'public, max-age=45, s-maxage=300, stale-while-revalidate=900';
export const PRIVATE_USER_CACHE = 'private, max-age=60, stale-while-revalidate=120';

export function publicCatalogCacheControl(user: unknown) {
	return user ? PRIVATE_USER_CACHE : PUBLIC_CATALOG_CACHE;
}
