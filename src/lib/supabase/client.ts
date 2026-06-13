import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient() {
	if (!client) {
		client = createBrowserClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
			realtime: {
				// Keep the socket warm so it drops/reconnects less often. The
				// browser still logs a benign "closed before connection established"
				// warning whenever a channel is torn down mid-handshake (fast nav,
				// token refresh) — realtime-js reconnects with backoff and this
				// cannot be suppressed from JS. Tuning only reduces how often it fires.
				heartbeatIntervalMs: 20000,
				timeout: 20000,
				params: { eventsPerSecond: 5 }
			}
		});
	}

	return client;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
	get(_, prop, receiver) {
		return Reflect.get(getSupabaseClient(), prop, receiver);
	}
});
