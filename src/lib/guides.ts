export type GuideLink = {
	title: string;
	href: `/guides/${string}`;
	description: string;
};

export type GuideSection = {
	title: string;
	body: string[];
	checklist?: string[];
};

export type GuideFaq = {
	question: string;
	answer: string;
};

export type ScreenGuide = {
	slug: string;
	title: string;
	shortTitle: string;
	description: string;
	eyebrow: string;
	updatedAt: string;
	readTime: string;
	primaryKeyword: string;
	keywords: string[];
	productQuery: string;
	summary: string[];
	sections: GuideSection[];
	faqs: GuideFaq[];
	relatedGuideSlugs: string[];
};

const UPDATED_AT = '2026-06-13';

export const screenGuides: ScreenGuide[] = [
	{
		slug: 'how-to-find-laptop-screen-part-number',
		title: 'How to find your laptop screen part number',
		shortTitle: 'Find screen part number',
		description:
			'Find the exact laptop screen part number, model code, connector, size, and resolution before ordering a replacement display.',
		eyebrow: 'Screen identification',
		updatedAt: UPDATED_AT,
		readTime: '5 min read',
		primaryKeyword: 'laptop screen part number',
		keywords: [
			'laptop screen part number',
			'laptop display model number',
			'screen model code',
			'replacement laptop screen',
			'laptop LCD panel code',
			'30 pin laptop screen',
			'40 pin laptop screen'
		],
		productQuery: 'screen part number display panel',
		summary: [
			'The laptop model name is useful, but the screen part number is the safest way to match a replacement panel.',
			'Look for the code on the rear sticker of the removed panel, then confirm size, resolution, connector pin count, connector position, and mounting type.',
			'If the screen is still inside the laptop, share the laptop model plus photos of the old panel before ordering.'
		],
		sections: [
			{
				title: 'Start with the panel sticker',
				body: [
					'Most laptop screens have a manufacturer label on the back of the panel. This label can include the screen model number, panel code, part number, revision, and barcodes.',
					'Common panel codes start with patterns like B156, N156, NV156, LP156, LTN156, or NT156. The exact code matters because two laptops with the same outer model can ship with different panels.'
				],
				checklist: [
					'Remove the bezel carefully and photograph the full rear sticker.',
					'Capture the connector area so the pin count and connector side are visible.',
					'Note screen size, resolution, refresh rate, and whether brackets are attached.',
					'Keep the laptop model number ready as a backup compatibility clue.'
				]
			},
			{
				title: 'Do not rely only on laptop model names',
				body: [
					'A laptop model such as Dell G5 15, Lenovo Legion, or HP Pavilion can have multiple display options. One variant may use HD, another Full HD IPS, another high refresh, and another touch panel.',
					'Use the laptop model to narrow the search, then verify the actual panel code and connector before payment. This avoids buying a screen that fits the lid but not the cable or motherboard.'
				]
			},
			{
				title: 'What to send before ordering',
				body: [
					'For a reliable match, send the screen part number, laptop model, old screen photos, and the preferred screen type. If the old display is cracked but readable, also note the current resolution shown in Windows display settings.',
					'LapKart display products include compatibility notes, specifications, and a 6-month replacement warranty, but the best result still depends on matching the old panel correctly.'
				],
				checklist: [
					'Panel sticker photo',
					'Connector close-up',
					'Laptop model and serial/model family',
					'Current resolution and refresh rate',
					'Bracket or no-bracket requirement'
				]
			}
		],
		faqs: [
			{
				question: 'Where is the laptop screen part number printed?',
				answer:
					'It is usually printed on a sticker on the back of the LCD/LED panel. You normally need to remove the front bezel and loosen the panel to see it.'
			},
			{
				question: 'Can I order using only my laptop model?',
				answer:
					'Sometimes, but it is less reliable. Many laptop models ship with multiple screen options, so the panel code and connector details are safer.'
			},
			{
				question: 'What photos should I send to check compatibility?',
				answer:
					'Send the rear sticker, connector area, full old panel, laptop model label, and any bracket/mounting points.'
			}
		],
		relatedGuideSlugs: [
			'30-pin-vs-40-pin-laptop-screen',
			'laptop-screen-resolution-guide',
			'laptop-screen-replacement-tamil-nadu'
		]
	},
	{
		slug: '30-pin-vs-40-pin-laptop-screen',
		title: '30-pin vs 40-pin laptop screen: what to check before buying',
		shortTitle: '30-pin vs 40-pin',
		description:
			'Understand 30-pin and 40-pin eDP laptop screen connectors, touch panels, high-resolution displays, and compatibility checks.',
		eyebrow: 'Connector guide',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: '30 pin vs 40 pin laptop screen',
		keywords: [
			'30 pin laptop screen',
			'40 pin laptop screen',
			'eDP connector laptop screen',
			'laptop display connector',
			'touch laptop screen connector',
			'Full HD 30 pin screen',
			'QHD 40 pin laptop screen'
		],
		productQuery: '30 pin 40 pin eDP display',
		summary: [
			'The connector pin count is one of the most important laptop screen compatibility checks.',
			'30-pin eDP is commonly used for many non-touch HD and Full HD panels, while 40-pin can appear on touch, higher-resolution, or high-refresh configurations.',
			'Pin count alone is not enough. Confirm connector type, connector side, cable support, mounting, resolution, and panel size.'
		],
		sections: [
			{
				title: 'What the pin count means',
				body: [
					'The pin count describes the display connector on the panel and cable. A 30-pin screen and a 40-pin screen are not interchangeable just because the size is the same.',
					'Many modern laptop panels use eDP connectors. Older systems or special panels may use other connector standards, so always match the old panel and cable.'
				]
			},
			{
				title: 'Typical 30-pin screen use cases',
				body: [
					'30-pin eDP panels are common on non-touch laptop screens, especially HD and Full HD replacements. They are often used in 14-inch and 15.6-inch display assemblies.',
					'Still, do not assume every Full HD panel is 30-pin. Check the old screen label and connector photo before ordering.'
				],
				checklist: [
					'Non-touch panel',
					'HD or Full HD resolution',
					'eDP connector visible on rear panel',
					'Matching connector position and bracket type'
				]
			},
			{
				title: 'Typical 40-pin screen use cases',
				body: [
					'40-pin connectors are common on many touch displays, higher-resolution panels, and some high-refresh laptop screens. A 40-pin touch connector may not be the same as a 40-pin high-resolution non-touch connector.',
					'This is why the exact panel code and cable support matter. Buying only by pin count can still lead to a mismatch.'
				],
				checklist: [
					'Touch or high-resolution display',
					'High-refresh gaming panel',
					'QHD, UHD, or special panel configuration',
					'Correct cable and motherboard support'
				]
			},
			{
				title: 'Avoid adapter guesses',
				body: [
					'Adapter cables are not a reliable fix for normal laptop screen replacement. Even when a cable physically connects, brightness control, backlight, touch, refresh rate, or signal lanes may not work correctly.',
					'The safer route is to match the original connector and panel family unless you are doing a known, tested upgrade for that exact laptop model.'
				]
			}
		],
		faqs: [
			{
				question: 'Can I replace a 30-pin laptop screen with a 40-pin screen?',
				answer:
					'Usually no. The panel, cable, and motherboard support must match. A different pin count normally means the cable and signal requirements are different.'
			},
			{
				question: 'Are all 40-pin laptop screens the same?',
				answer:
					'No. A 40-pin touch connector and a 40-pin high-resolution non-touch connector can be different. Match the exact panel type and cable support.'
			},
			{
				question: 'How do I check whether my screen is 30-pin or 40-pin?',
				answer:
					'Inspect the old panel connector and rear sticker, or send a connector close-up before ordering.'
			}
		],
		relatedGuideSlugs: [
			'how-to-find-laptop-screen-part-number',
			'laptop-screen-resolution-guide',
			'laptop-screen-replacement-tamil-nadu'
		]
	},
	{
		slug: 'laptop-screen-resolution-guide',
		title: 'Laptop screen resolution guide for replacement displays',
		shortTitle: 'Screen resolution guide',
		description:
			'Compare HD, Full HD, QHD, UHD, IPS, TN, matte, glossy, and refresh-rate requirements before choosing a laptop screen.',
		eyebrow: 'Display specification guide',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: 'laptop screen resolution guide',
		keywords: [
			'laptop screen resolution guide',
			'HD laptop screen',
			'Full HD laptop screen',
			'1920x1080 laptop screen',
			'IPS laptop display',
			'TN laptop display',
			'144Hz laptop screen replacement'
		],
		productQuery: 'Full HD IPS 1920 1080 screen',
		summary: [
			'Screen size is not enough for compatibility. Resolution, connector, panel technology, refresh rate, and mounting all matter.',
			'Full HD 1920x1080 is the common upgrade target, but the laptop cable and motherboard must support the panel.',
			'IPS, TN, matte, glossy, and high refresh panels can change compatibility even when the size looks identical.'
		],
		sections: [
			{
				title: 'Common laptop screen resolutions',
				body: [
					'HD screens are often 1366x768. Full HD screens are 1920x1080. Higher-end laptops may use QHD, QHD+, UHD, or 4K panels.',
					'If your old laptop shipped with HD, a Full HD upgrade may be possible only when the cable, connector, and graphics output support it. Confirm the exact model before upgrading.'
				],
				checklist: [
					'HD: 1366x768',
					'Full HD: 1920x1080',
					'QHD/QHD+: higher pixel density, often stricter cable requirements',
					'UHD/4K: high bandwidth and exact cable support required'
				]
			},
			{
				title: 'IPS vs TN panels',
				body: [
					'IPS panels usually provide better viewing angles and color consistency. TN panels are often cheaper and may be found in older or budget laptops.',
					'Do not assume an IPS upgrade is always plug-and-play. Some laptop models use different connector or cable options across TN and IPS configurations.'
				]
			},
			{
				title: 'Refresh rate and gaming panels',
				body: [
					'60Hz is common for standard replacement screens. Gaming laptops may use 120Hz, 144Hz, 165Hz, or higher refresh panels.',
					'High-refresh screens can require different lanes, connector types, and cable support. Match the old panel code or verify the upgrade path before buying.'
				]
			},
			{
				title: 'Surface finish and mounting',
				body: [
					'Matte screens reduce reflections and are usually better for work. Glossy screens can look more vivid but reflect more light.',
					'Mounting also matters. Some panels have side brackets, some are bracketless slim panels, and some require adhesive mounting inside the lid.'
				],
				checklist: [
					'Matte or glossy finish',
					'With bracket or without bracket',
					'Connector side and cable length',
					'Touch or non-touch assembly'
				]
			}
		],
		faqs: [
			{
				question: 'Can I upgrade from HD to Full HD?',
				answer:
					'Sometimes, but only if your laptop cable, connector, and motherboard support the Full HD panel. Confirm the old panel and laptop variant first.'
			},
			{
				question: 'Is IPS always better than TN?',
				answer:
					'IPS is usually better for viewing angles and color, but compatibility matters more. A wrong IPS panel will not be useful if the connector or cable does not match.'
			},
			{
				question: 'Does refresh rate affect laptop screen compatibility?',
				answer:
					'Yes. High-refresh panels may need different signal support, so 144Hz or higher panels should be matched carefully.'
			}
		],
		relatedGuideSlugs: [
			'how-to-find-laptop-screen-part-number',
			'30-pin-vs-40-pin-laptop-screen',
			'laptop-screen-replacement-tamil-nadu'
		]
	},
	{
		slug: 'laptop-screen-replacement-tamil-nadu',
		title: 'Laptop screen replacement in Tamil Nadu: buying the right display',
		shortTitle: 'Tamil Nadu screen replacement',
		description:
			'Buy compatible laptop screens for Tamil Nadu delivery with part-number matching, 6-month replacement warranty, and courier dispatch guidance.',
		eyebrow: 'Tamil Nadu display replacement',
		updatedAt: UPDATED_AT,
		readTime: '5 min read',
		primaryKeyword: 'laptop screen replacement Tamil Nadu',
		keywords: [
			'laptop screen replacement Tamil Nadu',
			'laptop display replacement Tamil Nadu',
			'laptop screen Chennai',
			'laptop display Chennai',
			'laptop screen online Tamil Nadu',
			'6 month laptop screen warranty',
			'laptop screen courier delivery'
		],
		productQuery: 'laptop screen display Tamil Nadu',
		summary: [
			'LapKart focuses on product-led laptop screen replacement: match the correct panel, order online, and get courier delivery inside Tamil Nadu.',
			'Orders above Rs 2,000 get free delivery. Paid orders before 5 PM are targeted for the next pickup cycle and next-day Tamil Nadu delivery where the courier route supports it.',
			'Every display product should be checked against the old panel part number, connector, size, resolution, and mounting before ordering.'
		],
		sections: [
			{
				title: 'Who this guide is for',
				body: [
					'This page is for customers, technicians, and small repair shops in Tamil Nadu who already know the laptop needs a screen replacement and want the correct display part.',
					'If you need diagnosis or full service repair, speak to a local technician first. If you need the replacement display, LapKart helps with compatibility details and delivery.'
				]
			},
			{
				title: 'How to avoid wrong screen orders',
				body: [
					'Do not buy only by laptop size. A 15.6-inch display can still differ by resolution, connector, bracket, surface finish, and refresh rate.',
					'For Tamil Nadu orders, the fastest path is to confirm the part number and connector before dispatch. That prevents courier delays caused by avoidable returns.'
				],
				checklist: [
					'Match screen part number or compatible panel family',
					'Confirm 30-pin or 40-pin connector',
					'Confirm HD, Full HD, QHD, or UHD resolution',
					'Confirm bracket or bracketless mounting',
					'Confirm touch or non-touch panel'
				]
			},
			{
				title: 'Delivery and warranty',
				body: [
					'LapKart currently serves Tamil Nadu delivery. Shipping is weight-based with a minimum charge, and orders above Rs 2,000 qualify for free delivery.',
					'Display products carry a 6-month replacement warranty. Before dispatch, LapKart records photo and video proof of the item and packing condition. For returns, customers should also record photos and video before sending the item back.'
				]
			},
			{
				title: 'Best searches to use on LapKart',
				body: [
					'Search by laptop model when you are starting broad. Search by part number or panel code when you want the most accurate match.',
					'Useful searches include the panel code, laptop family, connector pin count, resolution, and screen size.'
				],
				checklist: [
					'B156HAN Full HD 30 pin',
					'15.6 IPS 1920x1080 eDP',
					'Lenovo Legion screen 144Hz',
					'Dell G5 15 display 40 pin',
					'HP Pavilion laptop screen 30 pin'
				]
			}
		],
		faqs: [
			{
				question: 'Does LapKart deliver laptop screens across Tamil Nadu?',
				answer:
					'Yes, LapKart currently supports Tamil Nadu delivery for eligible orders. Availability and delivery timing depend on courier pickup and route coverage.'
			},
			{
				question: 'Is laptop screen replacement service included?',
				answer:
					'LapKart sells the replacement display part. Installation should be done by a trained technician if you are not comfortable opening the laptop.'
			},
			{
				question: 'Do display products have warranty?',
				answer:
					'Display products are listed with a 6-month replacement warranty, subject to the product condition and return proof process.'
			}
		],
		relatedGuideSlugs: [
			'how-to-find-laptop-screen-part-number',
			'30-pin-vs-40-pin-laptop-screen',
			'laptop-screen-resolution-guide'
		]
	}
];

export const guideRoutes = screenGuides.map((guide) => `/guides/${guide.slug}`);

export function getGuideBySlug(slug: string) {
	return screenGuides.find((guide) => guide.slug === slug);
}

export function guideToLink(guide: ScreenGuide): GuideLink {
	return {
		title: guide.shortTitle,
		href: `/guides/${guide.slug}`,
		description: guide.description
	};
}

export function getRelatedGuideLinks(guide: ScreenGuide) {
	return guide.relatedGuideSlugs
		.map((slug) => screenGuides.find((item) => item.slug === slug))
		.filter((item): item is ScreenGuide => Boolean(item))
		.map(guideToLink);
}
