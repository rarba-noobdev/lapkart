// Lightweight image CDN wrapper. Product images come from many third-party
// hosts at full resolution; on mobile that is the heaviest payload on the
// catalog and product pages. We proxy them through images.weserv.nl, which
// resizes, re-encodes to WebP/AVIF, and serves from a global edge cache — no
// account, no build step, and it works in dev and prod alike.
//
// Data/blob URLs and already-proxied URLs are passed through untouched.

type CdnOptions = {
	quality?: number;
	/** 'contain' keeps the whole product visible (default); 'cover' crops. */
	fit?: 'contain' | 'cover';
};

const WESERV = 'https://images.weserv.nl/';

export function cdnImage(src: string | undefined | null, width: number, opts: CdnOptions = {}) {
	if (!src) return src ?? '';
	if (
		src.startsWith('/') ||
		src.startsWith('data:') ||
		src.startsWith('blob:') ||
		src.includes('images.weserv.nl')
	) {
		return src;
	}

	try {
		const url = new URL(src, 'https://www.lapkart.store');
		// weserv wants the source without a scheme; "ssl:" marks an https origin.
		const hostPath = `${url.host}${url.pathname}${url.search}`;
		const source = url.protocol === 'https:' ? `ssl:${hostPath}` : hostPath;

		const params = new URLSearchParams({
			url: source,
			w: String(Math.round(width)),
			q: String(opts.quality ?? 72),
			output: 'webp',
			fit: opts.fit ?? 'contain'
		});
		// Never upscale beyond the source resolution.
		params.set('we', '');
		return `${WESERV}?${params.toString()}`;
	} catch {
		return src;
	}
}

/** Builds a width-descriptor srcset (1x + 2x) for a base display width. */
export function cdnSrcset(
	src: string | undefined | null,
	width: number,
	opts: CdnOptions = {}
): string | undefined {
	if (!src || src.startsWith('data:') || src.startsWith('blob:')) return undefined;
	return `${cdnImage(src, width, opts)} 1x, ${cdnImage(src, width * 2, opts)} 2x`;
}
