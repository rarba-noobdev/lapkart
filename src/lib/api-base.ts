function trimTrailingSlash(value: string) {
	return value.replace(/\/+$/, '');
}

function isLoopbackUrl(value: string) {
	return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(value);
}

function deriveApiBase() {
	const explicit = import.meta.env.VITE_API_BASE_URL?.trim();
	const supabaseUrl =
		import.meta.env.PUBLIC_SUPABASE_URL?.trim() || import.meta.env.VITE_SUPABASE_URL?.trim();

	if (explicit && !(import.meta.env.PROD && isLoopbackUrl(explicit) && supabaseUrl)) {
		return trimTrailingSlash(explicit);
	}

	if (supabaseUrl) return `${trimTrailingSlash(supabaseUrl)}/functions/v1/api`;

	throw new Error(
		'Missing API base configuration. Set VITE_API_BASE_URL or PUBLIC_SUPABASE_URL/VITE_SUPABASE_URL for the edge function path.'
	);
}

export const apiBase = deriveApiBase();
