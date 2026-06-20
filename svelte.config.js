import adapterAuto from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';

const isVercelBuild = Boolean(process.env.VERCEL);
const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: isCapacitorBuild
			? adapterStatic({
					pages: 'www',
					assets: 'www',
					fallback: '200.html',
					strict: false
				})
			: isVercelBuild
				? adapterVercel()
				: adapterAuto(),
		output: {
			bundleStrategy: isCapacitorBuild ? 'single' : 'split'
		},
		version: {
			pollInterval: 60000
		},
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': [
					'self',
					'https://checkout.razorpay.com',
					'https://*.razorpay.com',
					'https://www.googletagmanager.com'
				],
				'connect-src': [
					'self',
					'https://*.supabase.co',
					'wss://*.supabase.co',
					'https://*.razorpay.com',
					'https://lumberjack.razorpay.com',
					'https://www.googletagmanager.com',
					'https://*.google-analytics.com',
					'https://*.analytics.google.com',
					'https://api.olamaps.io'
				],
				'frame-src': ['self', 'https://*.razorpay.com', 'https://api.razorpay.com'],
				'img-src': ['self', 'data:', 'blob:', 'https:'],
				'style-src': ['self', 'unsafe-inline'],
				'font-src': ['self', 'data:'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'frame-ancestors': ['self']
			}
		}
	}
};

export default config;
