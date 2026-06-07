import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL ?? 'https://lapkart-five.vercel.app';

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
		webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production'
	}
};

export default config;
