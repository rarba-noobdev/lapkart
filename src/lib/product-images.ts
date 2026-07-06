const BLOCKED_PRODUCT_IMAGE_FILENAMES = [
	'fits-perfectly_1.png',
	'giving-new-life-to-your-laptop_1.jpg',
	'advanced-safety-for-laptop-battery.png',
	'battery-box.png'
];
const BLOCKED_PRODUCT_IMAGE_PATTERNS = [
	/fits[-_ ]?perfectly(?:[-_]\d+)?\.(?:jpe?g|png|webp|gif)\b/i,
	/giving[-_ ]?new[-_ ]?life[-_ ]?to[-_ ]?your[-_ ]?laptop(?:[-_]\d+)?\.(?:jpe?g|png|webp|gif)\b/i,
	/advanced[-_ ]?safety[-_ ]?for[-_ ]?laptop[-_ ]?battery(?:[-_]\d+)?\.(?:jpe?g|png|webp|gif)\b/i,
	/(?:^|[-_/])battery[-_ ]?box\.(?:jpe?g|png|webp|gif)\b/i,
	/[-_/]with[-_ ]?box\.(?:jpe?g|png|webp|gif)\b/i
];

function decodedImageReference(value: string) {
	let text = value.toLowerCase();

	for (let index = 0; index < 3; index += 1) {
		try {
			const decoded = decodeURIComponent(text);
			if (decoded === text) break;
			text = decoded;
		} catch {
			break;
		}
	}

	return text;
}

export function isBlockedProductImage(value: string | null | undefined) {
	const src = value?.trim();
	if (!src) return false;

	const decoded = decodedImageReference(src);
	return (
		BLOCKED_PRODUCT_IMAGE_FILENAMES.some((filename) => decoded.includes(filename)) ||
		BLOCKED_PRODUCT_IMAGE_PATTERNS.some((pattern) => pattern.test(decoded))
	);
}

function fallbackProductImage(category: string) {
	return category === 'displays'
		? '/product-placeholders/display.svg'
		: '/product-placeholders/part.svg';
}

export function sanitizeProductImageSet(
	image: string | null | undefined,
	images: string[] | null | undefined,
	category: string
) {
	const candidates = [image, ...(images ?? [])]
		.map((candidate) => candidate?.trim())
		.filter((candidate): candidate is string => Boolean(candidate));
	const safeImages = Array.from(
		new Set(candidates.filter((candidate) => !isBlockedProductImage(candidate)))
	);
	const safePrimary = safeImages[0] ?? fallbackProductImage(category);

	return {
		image: safePrimary,
		images: safeImages.length > 0 ? safeImages : [safePrimary]
	};
}
