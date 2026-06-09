import type { CapacitorConfig } from '@capacitor/cli';

// The Android app ships the bundled mobile shell from `www/` (built via
// `npm run build:mobile`). Set CAP_SERVER_URL to point the WebView at a live
// dev server (e.g. http://192.168.x.x:5173) for live-reload during development.
const serverUrl = process.env.CAP_SERVER_URL?.trim();
const debugWebView = process.env.CAP_DEBUG_WEBVIEW === 'true' || Boolean(serverUrl);

const config: CapacitorConfig = {
	appId: 'com.lapkart.store',
	appName: 'LapKart',
	webDir: 'www',
	...(serverUrl
		? { server: { url: serverUrl, cleartext: serverUrl.startsWith('http://') } }
		: {}),
	android: {
		allowMixedContent: false,
		captureInput: true,
		backgroundColor: '#FFFFFF',
		webContentsDebuggingEnabled: debugWebView,
		loggingBehavior: debugWebView ? 'debug' : 'none'
	},
	plugins: {
		SplashScreen: {
			// Keep the native splash up until the web layer signals it is mounted
			// (SplashScreen.hide() in main.ts) so the first frame is never blank.
			launchShowDuration: 3000,
			launchAutoHide: false,
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
