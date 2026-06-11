export const SITEMAP_PRODUCT_LIMIT = 5000;

export type SitemapImage = {
	loc: string;
	caption?: string;
};

export type SitemapUrl = {
	loc: string;
	lastmod?: string | null;
	changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
	priority?: string;
	images?: SitemapImage[];
};

export type SitemapEntry = {
	loc: string;
	lastmod?: string | null;
};

export function xmlEscape(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function xmlDate(value?: string | null) {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function sitemapXml(urls: SitemapUrl[]) {
	const hasImages = urls.some((url) => url.images?.length);
	const imageNamespace = hasImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}>\n${urls
		.map(
			(url) => `  <url>
    <loc>${xmlEscape(url.loc)}</loc>${url.lastmod ? `\n    <lastmod>${xmlEscape(url.lastmod)}</lastmod>` : ''}${url.changefreq ? `\n    <changefreq>${url.changefreq}</changefreq>` : ''}${url.priority ? `\n    <priority>${url.priority}</priority>` : ''}${(url.images ?? [])
				.map(
					(image) => `
    <image:image>
      <image:loc>${xmlEscape(image.loc)}</image:loc>${image.caption ? `\n      <image:caption>${xmlEscape(image.caption)}</image:caption>` : ''}
    </image:image>`
				)
				.join('')}
  </url>`
		)
		.join('\n')}\n</urlset>`;
}

export function sitemapIndexXml(entries: SitemapEntry[]) {
	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
		.map(
			(entry) => `  <sitemap>
    <loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ''}
  </sitemap>`
		)
		.join('\n')}\n</sitemapindex>`;
}

export const XML_HEADERS = {
	'content-type': 'application/xml; charset=utf-8',
	'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600'
};
