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
	// Catalog category for the related-products block + CTA links.
	// Omit to default to 'displays' (legacy screen guides); use '' for an all-catalog CTA.
	productCategory?: string;
	productCtaLabel?: string;
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
	},
	{
		slug: 'laptop-battery-price-india',
		title: 'Laptop Battery Price in India: Original vs Compatible, Warranty & Model Matching',
		shortTitle: 'Laptop battery price guide',
		description:
			'What decides laptop battery price in India, the real difference between original and compatible batteries, and how to match the exact battery for your HP, Dell or Lenovo laptop.',
		eyebrow: 'Battery buying guide',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: 'laptop battery price',
		keywords: [
			'laptop battery price',
			'hp laptop battery price',
			'dell laptop battery price',
			'lenovo laptop battery price',
			'original vs compatible laptop battery',
			'laptop battery replacement cost'
		],
		productQuery: 'battery',
		productCategory: 'batteries',
		productCtaLabel: 'Browse batteries',
		summary: [
			'Laptop battery price depends on capacity (Wh), cell quality, brand, and whether it is original or compatible, not just the laptop brand.',
			'A compatible battery with the correct voltage and part number is a safe, lower-cost alternative to an original.',
			'Match the part number and voltage from your old battery before buying, regardless of price.'
		],
		sections: [
			{
				title: 'What actually decides laptop battery price',
				body: [
					'Two batteries for the same laptop can have very different prices because of capacity and cell quality. Higher watt-hour (Wh) ratings store more charge and cost more. Original (OEM) batteries carry the manufacturer brand and usually cost the most; compatible batteries built to the same specification cost less.',
					'In India, you will typically see a wide range for the same model because sellers mix original, compatible, and refurbished stock. The cheapest listing is not always comparable: check the Wh rating and whether it is new, not the price alone.'
				],
				checklist: [
					'Capacity in Wh (higher = longer runtime)',
					'Original vs compatible vs refurbished',
					'New cell condition, not old stock',
					'Warranty length and return support'
				]
			},
			{
				title: 'Original vs compatible: which should you buy?',
				body: [
					'An original battery is made or branded by the laptop manufacturer. A compatible battery is a third-party battery built to the same voltage, capacity, connector and shape. For most everyday users, a good compatible battery with the correct voltage and a warranty is the better value.',
					'What matters far more than the original-vs-compatible label is the match: the voltage must be identical to your old battery, and the part number should correspond to your laptop. A “cheap” battery with the wrong voltage is the most expensive mistake because it will not work or can be unsafe.'
				]
			},
			{
				title: 'How to match the exact battery before paying',
				body: [
					'Remove the old battery (or check the bottom panel for the part number on internal batteries) and read the part number and the voltage/capacity printed on the label. Match the part number first, then confirm the voltage is the same and the capacity is equal or higher.',
					'If you only have the laptop model number from the bottom sticker, that helps narrow it down, but the battery part number is the safest identifier because one laptop model can ship with more than one battery variant.'
				]
			}
		],
		faqs: [
			{
				question: 'Why is the same laptop battery priced so differently?',
				answer:
					'Because listings mix original, compatible and refurbished batteries with different Wh capacities and cell quality. Compare the watt-hour rating and condition, not just the price.'
			},
			{
				question: 'Is a compatible laptop battery worth it?',
				answer:
					'Yes, for most users. A compatible battery with the correct voltage, a matching part number and a warranty performs like the original at a lower price.'
			},
			{
				question: 'Does a higher mAh battery cost more and last longer?',
				answer:
					'A higher capacity (mAh/Wh) at the same voltage lasts longer per charge and usually costs a little more. Never change the voltage to get more capacity.'
			},
			{
				question: 'How much does laptop battery replacement cost in India?',
				answer:
					'It varies by model and capacity. Compatible batteries are typically the most affordable; original batteries cost more. Check the live price on the battery page for your model.'
			}
		],
		relatedGuideSlugs: [
			'how-to-find-laptop-model-number',
			'laptop-not-turning-on',
			'laptop-charger-buying-guide'
		]
	},
	{
		slug: 'laptop-charger-buying-guide',
		title: 'How to Choose the Correct Laptop Charger: Wattage, Pin Size & Type-C',
		shortTitle: 'Laptop charger buying guide',
		description:
			'Pick the right replacement laptop charger by matching wattage, output voltage, pin/connector type and Type-C Power Delivery, with safety warnings for wrong adapters.',
		eyebrow: 'Charger buying guide',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: 'laptop charger',
		keywords: [
			'laptop charger',
			'laptop charger price',
			'how to choose laptop charger',
			'65w laptop charger',
			'type c laptop charger',
			'laptop adapter wattage'
		],
		productQuery: 'charger adapter',
		productCategory: 'chargers',
		productCtaLabel: 'Browse chargers',
		summary: [
			'A replacement charger must match wattage (equal or higher), output voltage (exact), and the pin/connector type.',
			'Barrel-pin and USB-C Power Delivery chargers are not interchangeable.',
			'A lower-wattage or wrong-voltage charger can slow charging or harm the laptop.'
		],
		sections: [
			{
				title: 'Read the original adapter label first',
				body: [
					'Every laptop charger prints its output on the label, for example “19.5V 3.34A”. Multiply volts by amps to get wattage (19.5 × 3.34 ≈ 65W). The replacement must use the same output voltage, the same or higher wattage, and the same connector.',
					'Buying a higher-wattage charger of the same voltage and connector is safe — the laptop only draws what it needs. Going below the original wattage is the common mistake that causes “plugged in, not charging” or charging only when the laptop is off.'
				],
				checklist: [
					'Output voltage must match exactly',
					'Wattage equal or higher, never lower',
					'Pin/connector type and size must fit',
					'Type-C needs the right PD wattage'
				]
			},
			{
				title: 'Barrel pin vs Type-C Power Delivery',
				body: [
					'Older and many budget laptops use a round barrel pin in a specific diameter (and brands like Dell and HP use a centre signal pin). Newer thin laptops charge over USB-C Power Delivery (PD). These two systems are not interchangeable.',
					'If your laptop charges from a USB-C port, buy a PD charger rated for at least the original wattage. A low-watt phone USB-C charger may keep a laptop alive at idle but will not charge it properly under load.'
				]
			},
			{
				title: 'Brand connector notes (HP, Dell, Lenovo)',
				body: [
					'HP uses a blue “smart pin” on many models and USB-C on others. Dell uses a 4.5mm barrel with a centre pin and will warn “adapter cannot be determined” if the pin signal is wrong. Lenovo uses a rectangular slim tip, an older round pin, or USB-C. Match your brand’s exact connector, not just the wattage.'
				]
			}
		],
		faqs: [
			{
				question: 'Can I use a higher-wattage charger on my laptop?',
				answer:
					'Yes, if the voltage and connector match. A 90W charger safely runs a laptop that came with 65W. Avoid chargers rated below the original wattage.'
			},
			{
				question: 'Will any Type-C charger charge my USB-C laptop?',
				answer:
					'Only if it supports Power Delivery at the required wattage. A low-watt USB-C phone charger will not properly charge a laptop under load.'
			},
			{
				question: 'My laptop shows “plugged in, not charging” — is it the charger?',
				answer:
					'Often yes, especially with a wrong-wattage or failing adapter. It can also be the battery or DC jack. Test with a correctly rated, known-good charger first.'
			},
			{
				question: 'How do I know the pin size of my laptop charger?',
				answer:
					'Match it to your original adapter and your laptop brand’s connector type. If unsure, send us your laptop model and we will confirm the correct charger.'
			}
		],
		relatedGuideSlugs: [
			'laptop-not-turning-on',
			'laptop-battery-price-india',
			'how-to-find-laptop-model-number'
		]
	},
	{
		slug: 'laptop-screen-vertical-lines',
		title: 'Vertical Lines on a Laptop Screen: Cable, Panel, or Replacement?',
		shortTitle: 'Vertical lines on screen',
		description:
			'Diagnose vertical lines on a laptop screen, tell a display-cable fault from a failed panel, and choose the correct replacement screen by size, resolution and connector.',
		eyebrow: 'Screen diagnosis',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: 'vertical lines on laptop screen',
		keywords: [
			'vertical lines on laptop screen',
			'laptop screen problems vertical lines',
			'laptop screen lines fix',
			'laptop display problem',
			'laptop screen replacement'
		],
		productQuery: 'screen display panel',
		productCategory: 'displays',
		productCtaLabel: 'Browse screens',
		summary: [
			'Connect an external monitor first: a clean external picture means the fault is in the laptop panel or its cable.',
			'Lines that change when you flex the lid point to the display cable; fixed lines usually mean the panel itself.',
			'Match size, resolution, pin count and connector position before ordering a replacement screen.'
		],
		sections: [
			{
				title: 'Step 1: rule out the graphics with an external monitor',
				body: [
					'Plug the laptop into a TV or monitor via HDMI. If the external screen is perfectly clean, the graphics chip and drivers are fine and the fault is in the laptop’s own panel or display cable. If the external screen also shows lines, the problem is deeper (GPU/board) and a new panel will not fix it.'
				],
				checklist: [
					'External picture clean → panel or cable fault',
					'External picture also faulty → board/GPU issue',
					'Lines change when lid flexes → suspect cable',
					'Lines fixed regardless → suspect panel'
				]
			},
			{
				title: 'Step 2: cable fault vs panel fault',
				body: [
					'Gently move the screen on its hinge while the laptop is on. If the lines flicker, change, or briefly disappear, the display (LVDS/eDP) cable is likely pinched or worn — a cheaper fix. If the lines stay exactly the same, the panel’s internal traces have failed and the screen needs replacing.'
				]
			},
			{
				title: 'Step 3: order the correct replacement screen',
				body: [
					'Read the panel part number on the back of the old screen and match five things: size (e.g. 15.6"), resolution (HD 1366×768 vs FHD 1920×1080), connector pin count (commonly 30-pin or 40-pin), connector position, and the mounting/bracket style. Buying by laptop model alone is risky because one model can ship several different panels.'
				]
			}
		],
		faqs: [
			{
				question: 'Are vertical lines on a laptop screen fixable without replacing it?',
				answer:
					'Sometimes. If the lines come from a worn or loose display cable (they change when you flex the lid), replacing the cable can fix it. If the panel’s internal traces have failed, the screen must be replaced.'
			},
			{
				question: 'How do I know if it is the screen or the graphics card?',
				answer:
					'Connect an external monitor. If the external display is clean, the laptop panel/cable is at fault. If the external display also shows lines, the graphics chip or board is the problem.'
			},
			{
				question: 'What screen specs must match for a replacement?',
				answer:
					'Size, resolution, connector pin count (30-pin vs 40-pin), connector position and mounting type. The panel part number on the old screen confirms all of these.'
			}
		],
		relatedGuideSlugs: [
			'how-to-find-laptop-screen-part-number',
			'30-pin-vs-40-pin-laptop-screen',
			'laptop-not-turning-on'
		]
	},
	{
		slug: 'laptop-keyboard-replacement-guide',
		title: 'Laptop Keyboard Replacement: Layout, Frame & Backlight Compatibility',
		shortTitle: 'Keyboard replacement guide',
		description:
			'When to replace a laptop keyboard instead of repairing keys, and how to match the correct variant — backlit vs non-backlit, with or without frame and power button.',
		eyebrow: 'Keyboard buying guide',
		updatedAt: UPDATED_AT,
		readTime: '5 min read',
		primaryKeyword: 'laptop keyboard replacement',
		keywords: [
			'laptop keyboard replacement',
			'laptop keyboard not working',
			'backlit laptop keyboard',
			'hp laptop keyboard',
			'dell laptop keyboard',
			'laptop keyboard keys not working'
		],
		productQuery: 'keyboard',
		productCategory: 'keyboards',
		productCtaLabel: 'Browse keyboards',
		summary: [
			'If several keys fail, stick, or repeat, replacing the whole keyboard is more reliable than fixing single keys.',
			'Match three things: backlit vs non-backlit, with or without frame, and connector/layout.',
			'A non-backlit replacement will never light up even if it physically fits.'
		],
		sections: [
			{
				title: 'Repair keys or replace the keyboard?',
				body: [
					'A single popped keycap can sometimes be refitted. But when multiple keys stop working, repeat, or stick — especially after a liquid spill — the membrane or ribbon underneath is usually damaged. Replacing the whole keyboard fixes every key at once and is the lasting solution.'
				],
				checklist: [
					'Multiple dead/stuck keys → replace',
					'Liquid spill → replace, do not just dry',
					'One loose keycap → refit may work',
					'Backlight dead but keys work → check ribbon/variant'
				]
			},
			{
				title: 'Match the right keyboard variant',
				body: [
					'One laptop model can have several keyboard variants. Confirm whether your keyboard is backlit (does it light up via an Fn shortcut?), whether it includes the surrounding frame/palmrest, and whether the power button is built into the keyboard. A backlit keyboard has an extra ribbon, so a non-backlit replacement will fit but never light up.'
				]
			},
			{
				title: 'Layout and connector',
				body: [
					'Most laptops sold in India use a US/English layout. Check that the key arrangement (especially the Enter key shape and any extra keys) matches your current keyboard, and that the ribbon connector is the same. If unsure, send your laptop model and we will confirm the variant.'
				]
			}
		],
		faqs: [
			{
				question: 'Why are some of my laptop keyboard keys not working?',
				answer:
					'A few dead keys usually mean a damaged membrane or ribbon, common after spills or wear. Replacing the whole keyboard restores all keys reliably.'
			},
			{
				question: 'How do I know if I need a backlit keyboard?',
				answer:
					'If your current keyboard lights up (often via Fn + space or an Fn key), order a backlit replacement. A non-backlit keyboard will fit but will not light up.'
			},
			{
				question: 'Does the replacement keyboard include the frame and power button?',
				answer:
					'It depends on the variant. Some ship as a bare keyboard, others include the frame/palmrest and power button. The product page states what is included.'
			}
		],
		relatedGuideSlugs: ['how-to-find-laptop-model-number', 'laptop-not-turning-on']
	},
	{
		slug: 'how-to-find-laptop-model-number',
		title: 'How to Find Your Laptop Model Number Before Buying Spare Parts',
		shortTitle: 'Find your laptop model',
		description:
			'Find your exact laptop model number and part numbers from the bottom sticker, BIOS and system info, so you order the correct compatible battery, charger, keyboard or screen.',
		eyebrow: 'Compatibility basics',
		updatedAt: UPDATED_AT,
		readTime: '4 min read',
		primaryKeyword: 'how to find laptop model number',
		keywords: [
			'how to find laptop model number',
			'laptop model number',
			'compatible laptop parts',
			'laptop part number',
			'find laptop battery model number'
		],
		productQuery: '',
		productCategory: '',
		productCtaLabel: 'Browse all parts',
		summary: [
			'The bottom sticker, BIOS, and system info all reveal your laptop model number.',
			'For parts, the part number on the component itself is even more precise than the model name.',
			'Send us the model and part number and we will confirm compatibility before dispatch.'
		],
		sections: [
			{
				title: 'Where the laptop model number lives',
				body: [
					'The fastest source is the sticker on the bottom of the laptop, which lists the model name and often a product/serial number. If the sticker is worn, the model also appears in the BIOS/UEFI setup screen and in the operating system: on Windows, open System Information (msinfo32) or run “wmic csproduct get name” in Command Prompt.',
					'Write down the full model string, including any suffix (for example “15-da0326tu” rather than just “HP 15”). Small suffix differences often mean different parts.'
				],
				checklist: [
					'Bottom sticker model + serial',
					'BIOS/UEFI system information',
					'Windows System Information (msinfo32)',
					'Note the full model suffix'
				]
			},
			{
				title: 'Why the part number beats the model name',
				body: [
					'For batteries, screens and keyboards, the part number printed on the component is the safest identifier because one laptop model can ship with several variants. Read the battery part number on its label, the panel code on the back of the screen, or the keyboard variant details, and match that.',
					'When you have both the laptop model and the component part number, ordering the correct compatible part is straightforward — and you can send both to us to confirm before we dispatch.'
				]
			}
		],
		faqs: [
			{
				question: 'Where is my laptop model number?',
				answer:
					'On the bottom sticker, in the BIOS/UEFI screen, or in Windows System Information (run msinfo32). Note the full model including any suffix.'
			},
			{
				question: 'Is the model number enough to buy the right part?',
				answer:
					'It is a good start, but the part number on the component (battery, screen, keyboard) is more precise because one model can use several variants. Use both where possible.'
			},
			{
				question: 'What if my bottom sticker is worn off?',
				answer:
					'Check the BIOS/UEFI setup screen or Windows System Information for the model, and read the part number directly off the component you are replacing.'
			}
		],
		relatedGuideSlugs: [
			'laptop-battery-price-india',
			'laptop-keyboard-replacement-guide',
			'how-to-find-laptop-screen-part-number'
		]
	},
	{
		slug: 'laptop-not-turning-on',
		title: 'Laptop Not Turning On? Check Charger, Battery, RAM and Screen',
		shortTitle: 'Laptop won’t turn on',
		description:
			'A step-by-step check for a laptop that will not turn on — charger, battery, RAM and display — so you can find the failed part and order the right replacement.',
		eyebrow: 'Troubleshooting',
		updatedAt: UPDATED_AT,
		readTime: '6 min read',
		primaryKeyword: 'laptop not turning on',
		keywords: [
			'laptop not turning on',
			'why is my laptop not turning on',
			'laptop screen not turning on',
			'laptop wont turn on',
			'laptop black screen'
		],
		productQuery: '',
		productCategory: '',
		productCtaLabel: 'Browse all parts',
		summary: [
			'Work from the simplest cause outward: power, then battery, then display, then RAM.',
			'A power light with a black screen often means a display or RAM issue, not a dead laptop.',
			'Each symptom points to a specific replaceable part.'
		],
		sections: [
			{
				title: 'Step 1: is it getting power?',
				body: [
					'Check the charger light and the laptop’s charge LED. If nothing lights up, suspect the charger or DC jack first — test with a known-good charger of the correct rating. A laptop that runs only while plugged in usually has a failed battery.'
				],
				checklist: [
					'No lights at all → charger or DC jack',
					'Runs only on AC → battery',
					'Lights on, black screen → display or RAM',
					'Fans spin, no display → RAM or panel'
				]
			},
			{
				title: 'Step 2: power but black screen',
				body: [
					'If the power light and fans come on but the screen stays black, connect an external monitor. A working external picture means the laptop is running and the laptop panel (or its cable) has failed. No picture on either screen points to RAM or the board.'
				]
			},
			{
				title: 'Step 3: reseat or replace RAM',
				body: [
					'A laptop that powers on with no display and no beeps can have a loose or failed RAM module. If you are comfortable opening the back panel, reseat the RAM; if a module has failed, replacing it can bring the laptop back. If reseating and a known-good charger do not help and the external monitor is also blank, the issue is likely on the board.'
				]
			}
		],
		faqs: [
			{
				question: 'My laptop has power but the screen is black — what is wrong?',
				answer:
					'Connect an external monitor. If it shows a picture, the laptop panel or display cable has failed. If both screens are blank, suspect RAM or the motherboard.'
			},
			{
				question: 'How do I know if it is the charger or the battery?',
				answer:
					'No lights at all points to the charger or DC jack — test with a known-good charger. A laptop that runs only while plugged in usually needs a new battery.'
			},
			{
				question: 'Can bad RAM stop a laptop from turning on?',
				answer:
					'Yes. A loose or failed RAM module can cause power-on with no display and no beeps. Reseating or replacing the RAM can fix it.'
			}
		],
		relatedGuideSlugs: [
			'laptop-charger-buying-guide',
			'laptop-battery-price-india',
			'laptop-screen-vertical-lines'
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
