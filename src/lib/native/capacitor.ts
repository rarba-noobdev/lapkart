import { env } from '$env/dynamic/public';
import { runWhenIdle } from '$lib/performance';

const APP_HOSTS = new Set(['www.lapkart.store', 'lapkart.store']);
export const nativePushEnabled = env.PUBLIC_NATIVE_PUSH_ENABLED === 'true';

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
	const cancelKeyboardTracking = trackSoftKeyboardState();
	const cancelWarmup = runWhenIdle(
		() => {
			void import('@capacitor/device')
				.then(({ Device }) => Device.getInfo())
				.then((info) => {
					document.documentElement.dataset.lapkartDevice = info.platform;
				})
				.catch(() => {});
			if (nativePushEnabled) void registerPushNotifications({ prompt: false });
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
		cancelKeyboardTracking();
		for (const listener of listeners) void listener.remove();
	};
}

function trackSoftKeyboardState() {
	const root = document.documentElement;
	const visualViewport = window.visualViewport;
	let frame = 0;
	let baselineHeight = Math.max(window.innerHeight, visualViewport?.height ?? 0);
	let clearFocusTimer = 0;

	function hasEditableFocus() {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) return false;
		return (
			active.tagName === 'INPUT' ||
			active.tagName === 'TEXTAREA' ||
			active.tagName === 'SELECT' ||
			active.isContentEditable ||
			active.getAttribute('role') === 'textbox'
		);
	}

	function setKeyboardOpen(open: boolean) {
		if (open) root.dataset.lapkartKeyboard = 'open';
		else delete root.dataset.lapkartKeyboard;
	}

	function setEditableFocus(focused: boolean) {
		if (clearFocusTimer) {
			window.clearTimeout(clearFocusTimer);
			clearFocusTimer = 0;
		}
		if (focused) root.dataset.lapkartEditing = 'true';
		else delete root.dataset.lapkartEditing;
	}

	function measure() {
		frame = 0;
		const viewport = window.visualViewport;
		const viewportHeight = viewport?.height ?? window.innerHeight;
		const viewportBottom = viewportHeight + (viewport?.offsetTop ?? 0);

		if (!hasEditableFocus()) {
			baselineHeight = Math.max(baselineHeight, window.innerHeight, viewportBottom);
			setEditableFocus(false);
			setKeyboardOpen(false);
			return;
		}

		const windowOverlap = Math.max(0, window.innerHeight - viewportBottom);
		const baselineOverlap = Math.max(0, baselineHeight - viewportHeight);
		setEditableFocus(true);
		setKeyboardOpen(true);
		if (windowOverlap > 120 || baselineOverlap > 160) return;
	}

	function scheduleMeasure() {
		if (frame) window.cancelAnimationFrame(frame);
		frame = window.requestAnimationFrame(measure);
	}

	function handleOrientationChange() {
		baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);
		window.setTimeout(scheduleMeasure, 250);
	}

	function handleFocusOut() {
		clearFocusTimer = window.setTimeout(scheduleMeasure, 180);
	}

	window.addEventListener('resize', scheduleMeasure);
	window.addEventListener('orientationchange', handleOrientationChange);
	document.addEventListener('focusin', scheduleMeasure, true);
	document.addEventListener('focusout', handleFocusOut, true);
	visualViewport?.addEventListener('resize', scheduleMeasure);
	visualViewport?.addEventListener('scroll', scheduleMeasure);
	scheduleMeasure();

	return () => {
		if (frame) window.cancelAnimationFrame(frame);
		if (clearFocusTimer) window.clearTimeout(clearFocusTimer);
		window.removeEventListener('resize', scheduleMeasure);
		window.removeEventListener('orientationchange', handleOrientationChange);
		document.removeEventListener('focusin', scheduleMeasure, true);
		document.removeEventListener('focusout', handleFocusOut, true);
		visualViewport?.removeEventListener('resize', scheduleMeasure);
		visualViewport?.removeEventListener('scroll', scheduleMeasure);
		setEditableFocus(false);
		setKeyboardOpen(false);
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

// Opens an order invoice document (a real PDF). On native we persist the bytes
// to the app cache and hand the file to the OS share sheet so the customer can
// save it to Files/Drive or open it in a PDF viewer. On the web we open it in a
// new tab (browser PDF viewer) and fall back to a download.
export async function openInvoiceDocument(input: { blob: Blob; fileName: string; title: string }) {
	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const base64 = await blobToBase64(input.blob);
		const { Filesystem, Directory } = await import('@capacitor/filesystem');
		const written = await Filesystem.writeFile({
			path: input.fileName,
			data: base64,
			directory: Directory.Cache
		});
		const { Share } = await import('@capacitor/share');
		await Share.share({
			title: input.title,
			url: written.uri,
			dialogTitle: 'Save or share invoice'
		});
		return;
	}

	const url = URL.createObjectURL(input.blob);
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

function blobToBase64(blob: Blob) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = String(reader.result ?? '');
			// Strip the "data:<mime>;base64," prefix — Filesystem wants raw base64.
			resolve(result.slice(result.indexOf(',') + 1));
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
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
	if (!nativePushEnabled) return null;

	const { Capacitor } = await import('@capacitor/core');
	if (!Capacitor.isNativePlatform()) return null;

	try {
		const pushPluginPackage = '@capacitor/push-notifications';
		const { PushNotifications } = (await import(pushPluginPackage)) as {
			PushNotifications: {
				checkPermissions: () => Promise<{ receive: string }>;
				requestPermissions: () => Promise<{ receive: string }>;
				addListener: (
					eventName: 'registration' | 'registrationError',
					listenerFunc: (result: { value: string }) => void
				) => Promise<PluginListenerHandle>;
				register: () => Promise<void>;
			};
		};
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
