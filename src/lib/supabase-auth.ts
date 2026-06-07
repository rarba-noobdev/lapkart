import { supabase } from '$lib/supabase/client';

function isStaleSessionError(error: unknown) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: string }).code === 'refresh_token_not_found'
	);
}

async function clearLocalSession() {
	try {
		await supabase.auth.signOut({ scope: 'local' });
	} catch {
		// The session is already invalid locally; callers can continue unauthenticated.
	}
}

export async function getAccessToken() {
	const { data, error } = await supabase.auth.getSession();
	if (error) {
		if (isStaleSessionError(error)) {
			await clearLocalSession();
			return null;
		}
		throw error;
	}

	return data.session?.access_token ?? null;
}

export async function getAuthorizationHeaders() {
	const token = await getAccessToken();
	return token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {};
}
