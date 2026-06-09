import type { CapacitorConfig } from '@capacitor/cli';

// The Android app loads the live SvelteKit storefront so it reuses the web
// app's responsive styling directly. CAP_SERVER_URL overrides the target (e.g.
// http://192.168.x.x:5173) for live-reload during development; otherwise it
// points at the production deployment.
const PROD_URL = 'https://lapkart-five.vercel.app';
const serverUrl = process.env.CAP_SERVER_URL?.trim() || PROD_URL;
const debugWebView = process.env.CAP_DEBUG_WEBVIEW === 'true' || serverUrl !== PROD_URL;

const config: CapacitorConfig = {
	appId: 'com.lapkart.store',
	appName: 'LapKart',
	webDir: 'www',
	server: { url: serverUrl, cleartext: serverUrl.startsWith('http://') },
	android: {
		allowMixedContent: false,
		captureInput: true,
		backgroundColor: '#FFFFFF',
		webContentsDebuggingEnabled: debugWebView,
		loggingBehavior: debugWebView ? 'debug' : 'none'
	},
	plugins: {
		SplashScreen: {
			// Auto-hide on a short timer so the native splash can never get stuck
			// (a non-auto-hiding splash strands users on the gray system splash if
			// the JS hide() is delayed). main.ts also calls hide() on mount for an
			// earlier handoff; the white in-app boot loader covers the rest.
			launchShowDuration: 700,
			launchAutoHide: true,
			launchFadeOutDuration: 250,
			backgroundColor: '#FFFFFF',
			showSpinner: true,
			spinnerColor: '#fa5d19',
			androidScaleType: 'CENTER_CROP',
			splashFullScreen: true,
			splashImmersive: true
		}
	}
};

export default config;
