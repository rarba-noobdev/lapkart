import type { CapacitorConfig } from '@capacitor/cli';

const PRODUCTION_URL = 'https://lapkart-five.vercel.app';
const serverUrl = process.env.CAP_SERVER_URL?.trim() || PRODUCTION_URL;
const debugWebView = process.env.CAP_DEBUG_WEBVIEW === 'true' || serverUrl !== PRODUCTION_URL;

const config: CapacitorConfig = {
	appId: 'com.lapkart.store',
	appName: 'LapKart',
	webDir: 'www',
	server: {
		url: serverUrl,
		cleartext: serverUrl.startsWith('http://')
	},
	android: {
		allowMixedContent: false,
		captureInput: true,
		backgroundColor: '#FFFFFF',
		webContentsDebuggingEnabled: debugWebView,
		loggingBehavior: debugWebView ? 'debug' : 'none'
	},
	plugins: {
		SplashScreen: {
			launchShowDuration: 2000,
			launchAutoHide: true,
			launchFadeOutDuration: 300,
			backgroundColor: '#FFFFFF',
			showSpinner: false,
			androidScaleType: 'CENTER_CROP',
			splashFullScreen: true,
			splashImmersive: true
		}
	}
};

export default config;
