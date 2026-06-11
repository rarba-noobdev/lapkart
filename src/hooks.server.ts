import { dev } from '$app/environment';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { isStaffRole, normalizeAppRole, type AppRole } from '$lib/roles';

export const handle: Handle = async ({ event, resolve }) => {
	const clearSupabaseAuthCookies = () => {
		for (const cookie of event.cookies.getAll()) {
			if (cookie.name.startsWith('sb-') && cookie.name.includes('auth-token')) {
				event.cookies.delete(cookie.name, { path: '/' });
			}
		}
	};

	const hasSupabaseAuthCookie = () =>
		event.cookies
			.getAll()
			.some(
				(cookie) =>
					cookie.name.startsWith('sb-') &&
					cookie.name.includes('auth-token') &&
					Boolean(cookie.value)
			);

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
				if (headers && Object.keys(headers).length > 0) event.setHeaders(headers);
			}
		},
		global: {
			fetch: event.fetch
		}
	});

	let cachedSession: Awaited<ReturnType<typeof event.locals.safeGetSession>> | undefined;
	let cachedRole: AppRole | null | undefined;

	event.locals.safeGetSession = async () => {
		if (cachedSession) return cachedSession;

		if (!hasSupabaseAuthCookie()) {
			cachedSession = { session: null, user: null };
			return cachedSession;
		}

		const result = await event.locals.supabase.auth.getUser().catch((error: unknown) => ({
			data: { user: null },
			error
		}));

		if (result.error || !result.data.user) {
			clearSupabaseAuthCookies();
			cachedSession = { session: null, user: null };
			return cachedSession;
		}

		cachedSession = { session: null, user: result.data.user };
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

		cachedRole = normalizeAppRole(data?.role);
		return cachedRole;
	};

	const pathname = event.url.pathname;
	const legacyAdminSections: Record<string, string> = {
		'/admin/catalog': 'catalog',
		'/admin/products': 'catalog',
		'/admin/orders': 'orders',
		'/admin/fulfillment': 'fulfillment',
		'/admin/users': 'users',
		'/admin/promos': 'promos',
		'/admin/support': 'support'
	};
	const legacyAdminSection = legacyAdminSections[pathname];
	if (legacyAdminSection) {
		redirect(307, `/admin?section=${legacyAdminSection}`);
	}

	const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
	const isCustomerRoute =
		pathname === '/checkout' ||
		pathname === '/profile' ||
		pathname === '/orders' ||
		pathname.startsWith('/order/');

	if (isAdminRoute || isCustomerRoute) {
		const { user } = await event.locals.safeGetSession();

		if (!user) {
			redirect(307, `/login?redirect=${encodeURIComponent(pathname)}`);
		}

		const role = await event.locals.getRole();

		if (isAdminRoute && !isStaffRole(role)) {
			redirect(307, '/profile');
		}

		if (isCustomerRoute && isStaffRole(role)) {
			redirect(307, '/admin');
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
	if (!dev) {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};
