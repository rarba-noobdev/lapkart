type IdleHandle = number | ReturnType<typeof setTimeout>;

type IdleOptions = {
	timeout?: number;
};

export function runWhenIdle(callback: () => void, options: IdleOptions = {}) {
	if (typeof window === 'undefined') return () => {};

	const timeout = options.timeout ?? 2000;
	if ('requestIdleCallback' in window) {
		const handle = window.requestIdleCallback(callback, { timeout });
		return () => window.cancelIdleCallback(handle);
	}

	const handle: IdleHandle = setTimeout(callback, Math.min(timeout, 2000));
	return () => clearTimeout(handle);
}
