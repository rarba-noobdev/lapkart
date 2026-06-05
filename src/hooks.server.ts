import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		},
		global: {
			fetch: event.fetch
		}
	});

	let cachedSession: Awaited<ReturnType<typeof event.locals.safeGetSession>> | undefined;
	let cachedRole: 'admin' | 'user' | null | undefined;

	event.locals.safeGetSession = async () => {
		if (cachedSession) return cachedSession;

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error || !user) {
			cachedSession = { session: null, user: null };
			return cachedSession;
		}

		cachedSession = { session: null, user };
		return cachedSession;
	};

	event.locals.getRole = async () => {
		if (cachedRole !== undefined) return cachedRole;

		const { user } = await event.locals.safeGetSession();

		if (!user) {
			cachedRole = null;
			return cachedRole;
		}

		const { data } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('user_id', user.id)
			.maybeSingle();

		cachedRole = data?.role === 'admin' ? 'admin' : 'user';
		return cachedRole;
	};

	const pathname = event.url.pathname;
	const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
	const isCustomerRoute =
		pathname === '/checkout' ||
		pathname === '/dashboard' ||
		pathname === '/orders' ||
		pathname.startsWith('/order/');

	if (isAdminRoute || isCustomerRoute) {
		const { user } = await event.locals.safeGetSession();

		if (!user) {
			redirect(307, `/login?redirect=${encodeURIComponent(pathname)}`);
		}

		const role = await event.locals.getRole();

		if (isAdminRoute && role !== 'admin') {
			redirect(307, '/dashboard');
		}

		if (isCustomerRoute && role === 'admin') {
			redirect(307, '/admin');
		}
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
