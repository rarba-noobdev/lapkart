import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createServerClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';
import { getSupabaseClient } from '$lib/supabase/client';
import type { Database } from '$lib/supabase/types';

const capacitorBuild = import.meta.env.VITE_CAPACITOR_BUILD === 'true';

export const ssr = !capacitorBuild;

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');
	depends('app:profile');

	const supabase = isBrowser()
		? getSupabaseClient()
		: createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
				global: { fetch },
				cookies: {
					getAll() {
						return data.cookies ?? [];
					}
				}
			});

	return {
		...data,
		supabase
	};
};
