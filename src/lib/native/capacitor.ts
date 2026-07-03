import { runWhenIdle } from '$lib/performance';

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

	const [{ App }, { SplashScreen }] = await Promise.all([
		import('@capacitor/app'),
		import('@capacitor/splash-screen')
	]);

	document.documentElement.dataset.lapkartNative = Capacitor.getPlatform();
	void SplashScreen.hide().catch(() => {});
	const cancelWarmup = runWhenIdle(
		() => {
			void import('@capacitor/device')
				.then(({ Device }) => Device.getInfo())
				.then((info) => {
					document.documentElement.dataset.lapkartDevice = info.platform;
				})
				.catch(() => {});
			void registerPushNotifications({ prompt: false });
		},
		{ timeout: 3500 }
	);

	const listeners: PluginListenerHandle[] = [];

	listeners.push(
		await App.addListener('backButton', async ({ canGoBack }) => {
			if (document.documentElement.dataset.lapkartOnboarding === 'open') {
				window.dispatchEvent(new CustomEvent('lapkart:onboarding-back'));
				return;
			}
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
		cancelWarmup();
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

// Opens an order invoice. On native we persist the HTML to the app cache and
// hand it to the OS share sheet so the customer can save it to Files/Drive or
// open it in a browser to print as PDF. On the web we open/download the blob.
export async function openInvoiceDocument(input: {
	html: string;
	fileName: string;
	title: string;
}) {
	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
		const written = await Filesystem.writeFile({
			path: input.fileName,
			data: input.html,
			directory: Directory.Cache,
			encoding: Encoding.UTF8
		});
		const { Share } = await import('@capacitor/share');
		await Share.share({
			title: input.title,
			url: written.uri,
			dialogTitle: 'Save or share invoice'
		});
		return;
	}

	const blob = new Blob([input.html], { type: 'text/html' });
	const url = URL.createObjectURL(blob);
	const opened = window.open(url, '_blank', 'noopener,noreferrer');
	if (!opened) {
		const link = document.createElement('a');
		link.href = url;
		link.download = input.fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
	}
	window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

// Triggers the OS/browser location permission prompt. Resolves true if the
// user grants access (works in the browser and the Capacitor Android webview).
export async function requestLocationPermission(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			() => resolve(true),
			() => resolve(false),
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
		);
	});
}

export async function registerPushNotifications(options: { prompt: boolean }) {
	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return null;

	try {
		const { PushNotifications } = await import('@capacitor/push-notifications');
		let permission = await PushNotifications.checkPermissions();
		if (permission.receive === 'prompt' && options.prompt) {
			permission = await PushNotifications.requestPermissions();
		}
		if (permission.receive !== 'granted') return null;

		return await new Promise<string | null>((resolve) => {
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
	} catch {
		return null;
	}
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
