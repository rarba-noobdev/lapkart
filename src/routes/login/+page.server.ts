import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeRedirect(value: string | null) {
	if (!value) return '/profile';
	return value.startsWith('/') && !value.startsWith('//') ? value : '/profile';
}

async function getRoleForUser(locals: App.Locals, userId: string) {
	const { data } = await locals.supabase
		.from('user_roles')
		.select('role')
		.eq('user_id', userId)
		.maybeSingle();
	return data?.role === 'admin' ? 'admin' : 'user';
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { user, role } = await parent();
	const redirectTarget = sanitizeRedirect(url.searchParams.get('redirect'));

	if (user) {
		redirect(307, role === 'admin' ? '/admin' : redirectTarget);
	}

	return { redirectTarget };
};

export const actions: Actions = {
	signin: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');
		const redirectTarget = sanitizeRedirect(String(formData.get('redirectTo') ?? ''));

		if (!emailPattern.test(email)) {
			return fail(400, {
				mode: 'signin' as const,
				email,
				redirectTarget,
				message: 'Enter a valid email address.'
			});
		}

		if (password.length < 8) {
			return fail(400, {
				mode: 'signin' as const,
				email,
				redirectTarget,
				message: 'Enter your password.'
			});
		}

		const { data, error } = await locals.supabase.auth.signInWithPassword({ email, password });

		if (error || !data.user) {
			return fail(400, {
				mode: 'signin' as const,
				email,
				redirectTarget,
				message: error?.message ?? 'Could not sign in right now.'
			});
		}

		const role = await getRoleForUser(locals, data.user.id);
		redirect(303, role === 'admin' ? '/admin' : redirectTarget);
	},
	signup: async ({ request, locals }) => {
		const formData = await request.formData();
		const fullName = String(formData.get('fullName') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(formData.get('password') ?? '');
		const redirectTarget = sanitizeRedirect(String(formData.get('redirectTo') ?? ''));

		if (fullName.length < 2) {
			return fail(400, {
				mode: 'signup' as const,
				fullName,
				email,
				redirectTarget,
				message: 'Enter your full name.'
			});
		}

		if (!emailPattern.test(email)) {
			return fail(400, {
				mode: 'signup' as const,
				fullName,
				email,
				redirectTarget,
				message: 'Enter a valid email address.'
			});
		}

		if (password.length < 8) {
			return fail(400, {
				mode: 'signup' as const,
				fullName,
				email,
				redirectTarget,
				message: 'Use at least 8 characters for your password.'
			});
		}

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					full_name: fullName
				}
			}
		});

		if (error) {
			return fail(400, {
				mode: 'signup' as const,
				fullName,
				email,
				redirectTarget,
				message: error.message
			});
		}

		if (data.user && data.session) {
			const role = await getRoleForUser(locals, data.user.id);
			redirect(303, role === 'admin' ? '/admin' : redirectTarget);
		}

		return {
			success: true,
			mode: 'signup' as const,
			email,
			fullName,
			redirectTarget,
			message: 'Account created. Check your email if confirmation is enabled before signing in.'
		};
	}
};
