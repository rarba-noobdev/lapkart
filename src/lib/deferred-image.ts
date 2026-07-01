import type { Action } from 'svelte/action';

export const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

type DeferredImageOptions = {
	src: string;
	rootMargin?: string;
};

export const deferredImage: Action<HTMLElement, DeferredImageOptions> = (node, options) => {
	let current = options;
	let loaded = false;
	let observer: IntersectionObserver | null = null;
	let image: HTMLImageElement | null = null;

	const load = () => {
		image ??= node.querySelector<HTMLImageElement>('img[data-deferred-image]');
		if (loaded || !current.src || !image) return;
		loaded = true;
		image.src = current.src;
		observer?.disconnect();
		observer = null;
	};

	if (typeof IntersectionObserver === 'undefined') {
		load();
	} else {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) load();
			},
			{ rootMargin: current.rootMargin ?? '320px 0px' }
		);
		observer.observe(node);
	}

	return {
		update(next) {
			current = next;
			image ??= node.querySelector<HTMLImageElement>('img[data-deferred-image]');
			if (loaded && image) image.src = current.src;
		},
		destroy() {
			observer?.disconnect();
		}
	};
};
