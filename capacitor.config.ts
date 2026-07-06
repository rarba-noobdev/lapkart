import type { CapacitorConfig } from '@capacitor/cli';

const PROD_URL = 'https://www.lapkart.store/';
const serverUrl = process.env.CAP_SERVER_URL?.trim() || PROD_URL;
const debugWebView = process.env.CAP_DEBUG_WEBVIEW === 'true' || serverUrl !== PROD_URL;

const config: CapacitorConfig = {
	appId: 'com.lapkart.store',
	appName: 'LapKart',
	webDir: 'www',
	server: {
		url: serverUrl,
		errorPath: 'offline.html',
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
			launchShowDuration: 0,
			launchAutoHide: false,
			launchFadeOutDuration: 120,
			backgroundColor: '#FFFFFF',
			showSpinner: false,
			androidScaleType: 'CENTER_CROP',
			splashFullScreen: true,
			splashImmersive: true
		}
	}
};

export default config;
