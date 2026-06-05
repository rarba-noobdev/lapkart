import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient() {
	if (!client) {
		client = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
	}

	return client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
	get(_, prop, receiver) {
		return Reflect.get(getSupabaseClient(), prop, receiver);
	}
});
