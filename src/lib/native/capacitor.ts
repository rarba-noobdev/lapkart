const APP_HOSTS = new Set(['www.lapkart.store', 'lapkart.store']);

type PluginListenerHandle = {
	remove: () => Promise<void>;
};

type NativeSetupOptions = {
	getPathname: () => string;
	navigate: (path: string) => void | Promise<void>;
	onResume?: () => void | Promise<void>;
};

export async function isNativeApp() {
	const { Capacitor } = await import('@capacitor/core');
	return Capacitor.isNativePlatform();
}

export async function setupNativeAppShell(options: NativeSetupOptions) {
	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return () => {};

	const [{ App }, { SplashScreen }, { Device }] = await Promise.all([
		import('@capacitor/app'),
		import('@capacitor/splash-screen'),
		import('@capacitor/device')
	]);

	document.documentElement.dataset.lapkartNative = Capacitor.getPlatform();
	void SplashScreen.hide().catch(() => {});
	void Device.getInfo()
		.then((info) => {
			document.documentElement.dataset.lapkartDevice = info.platform;
		})
		.catch(() => {});
	void registerPushNotifications({ prompt: false });

	const listeners: PluginListenerHandle[] = [];

	listeners.push(
		await App.addListener('backButton', async ({ canGoBack }) => {
			const path = options.getPathname();
			if (canGoBack) {
				window.history.back();
				return;
			}
			if (path !== '/') {
				await options.navigate('/');
				return;
			}
			await App.minimizeApp();
		})
	);

	listeners.push(
		await App.addListener('appUrlOpen', ({ url }) => {
			const path = pathFromOwnedUrl(url);
			if (path) void options.navigate(path);
		})
	);

	listeners.push(
		await App.addListener('resume', () => {
			void options.onResume?.();
		})
	);

	return () => {
		for (const listener of listeners) void listener.remove();
	};
}

export async function nativeImpact() {
	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return;

	const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
	await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export async function shareUrl(input: { title: string; text?: string; url: string }) {
	const { Capacitor } = await import('@capacitor/core');
	if (Capacitor.isNativePlatform()) {
		const { Share } = await import('@capacitor/share');
		await Share.share(input);
		return;
	}

	if (navigator.share) {
		await navigator.share(input);
		return;
	}

	await navigator.clipboard?.writeText(input.url);
}

export async function pickImageFile(options: { title?: string; fileNamePrefix?: string } = {}) {
	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
		const photo = await Camera.getPhoto({
			allowEditing: false,
			quality: 82,
			resultType: CameraResultType.DataUrl,
			source: CameraSource.Prompt,
			promptLabelHeader: options.title ?? 'Select image',
			promptLabelPicture: 'Camera',
			promptLabelPhoto: 'Gallery'
		});

		if (!photo.dataUrl) return null;
		return fileFromDataUrl(
			photo.dataUrl,
			`${options.fileNamePrefix ?? 'lapkart-image'}-${Date.now()}.${photo.format ?? 'jpg'}`
		);
	}

	return pickBrowserImageFile();
}

export async function registerPushNotifications(options: { prompt: boolean }) {
	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return null;

	const { PushNotifications } = await import('@capacitor/push-notifications');
	let permission = await PushNotifications.checkPermissions();
	if (permission.receive === 'prompt' && options.prompt) {
		permission = await PushNotifications.requestPermissions();
	}
	if (permission.receive !== 'granted') return null;

	const token = await new Promise<string | null>((resolve) => {
		let settled = false;
		const finish = (value: string | null) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		void PushNotifications.addListener('registration', (result) => {
			localStorage.setItem('lapkart_push_token', result.value);
			window.dispatchEvent(new CustomEvent('lapkart:push-token', { detail: result.value }));
			finish(result.value);
		});
		void PushNotifications.addListener('registrationError', () => finish(null));
		void PushNotifications.register().catch(() => finish(null));
		window.setTimeout(() => finish(null), 5000);
	});

	return token;
}

function pathFromOwnedUrl(value: string) {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || !APP_HOSTS.has(url.host.toLowerCase())) return null;
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return null;
	}
}

async function pickBrowserImageFile() {
	return new Promise<File | null>((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/jpeg,image/png,image/webp,image/avif';
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}

async function fileFromDataUrl(dataUrl: string, fileName: string) {
	const response = await fetch(dataUrl);
	const blob = await response.blob();
	return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
}
