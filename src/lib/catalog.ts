export type Category = {
	slug: string;
	name: string;
	image?: string;
};

export type ProductSpecificationValue =
	| string
	| number
	| boolean
	| null
	| string[]
	| Record<string, unknown>
	| Array<Record<string, unknown>>;

const hiddenCategorySlugs = new Set(['ics']);

export const allCategories: Category[] = [
	{ slug: 'ram', name: 'RAM' },
	{ slug: 'ssd', name: 'SSD' },
	{ slug: 'motherboards', name: 'Motherboards' },
	{ slug: 'batteries', name: 'Batteries' },
	{ slug: 'displays', name: 'Displays' },
	{ slug: 'keyboards', name: 'Keyboards' },
	{ slug: 'processors', name: 'Processors' },
	{ slug: 'cooling', name: 'Cooling Fans' },
	{ slug: 'chargers', name: 'Chargers' },
	{ slug: 'wifi_cards', name: 'WiFi Cards' },
	{ slug: 'dc_jacks', name: 'DC Power Jacks' },
	{ slug: 'bottom_cases', name: 'Bottom Cases' },
	{ slug: 'palmrests', name: 'Palmrests' },
	{ slug: 'hinges', name: 'Hinges' },
	{ slug: 'speakers', name: 'Speakers' },
	{ slug: 'hdd_boards', name: 'HDD Boards' },
	{ slug: 'ics', name: 'ICs & Chips' },
	{ slug: 'power_buttons', name: 'Power Buttons' },
	{ slug: 'flex_cables', name: 'Flex Cables' }
];

export const categories: Category[] = allCategories.filter(
	(category) => !hiddenCategorySlugs.has(category.slug)
);

export const hiddenCategories = Array.from(hiddenCategorySlugs);

export type Product = {
	id: string;
	title: string;
	brand: string;
	category: string;
	image: string;
	images?: string[];
	source_url?: string;
	description?: string;
	sku?: string;
	search_keywords?: string[];
	updated_at?: string;
	price: number;
	mrp: number;
	rating: number;
	reviews: number;
	stock: number;
	weight_kg?: number;
	length_cm?: number;
	breadth_cm?: number;
	height_cm?: number;
	compatibility: string;
	warranty: string;
	highlights: string[];
	specifications?: Record<string, ProductSpecificationValue>;
	authenticity_grade?: 'oem' | 'compatible' | 'refurbished' | 'open_box';
	condition_grade?: 'new' | 'open_box' | 'refurbished' | 'used';
	hsn_code?: string;
	gst_rate?: number;
	doa_policy_days?: number;
	local_delivery_eligible?: boolean;
	cod_eligible?: boolean;
};

export function discountPct(p: Pick<Product, 'price' | 'mrp'>) {
	if (!p.mrp || p.mrp <= p.price) return 0;
	return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

export function formatINR(n: number) {
	return '\u20B9' + Math.round(n).toLocaleString('en-IN');
}
