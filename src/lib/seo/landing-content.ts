// SEO landing-page content for LapKart part clusters and brand+part pages.
// Source of truth: cleaned keyword research (see SEO_KEYWORD_IMPLEMENTATION_REPORT.md).
// Each entry carries unique copy + FAQs so the generated /parts routes are never thin.
// Catalog product lists are fetched server-side via searchProducts() using `category`
// (and `brand` for brand pages); copy here is the indexable, crawler-visible content.

export type LandingFaq = {
	question: string;
	answer: string;
};

export type BrandLanding = {
	slug: string; // url segment, e.g. 'dell'
	name: string; // display name, e.g. 'Dell'
	brand: string; // exact products.brand value used for filtering, e.g. 'Dell'
	h1: string;
	title: string;
	metaDescription: string;
	intro: string[];
	faqs: LandingFaq[];
};

export type Landing = {
	slug: string; // cluster url segment, e.g. 'laptop-battery'
	name: string; // 'Laptop Battery'
	category?: string; // catalog category slug, e.g. 'batteries' (omitted for the hub)
	productQuery?: string;
	h1: string;
	title: string;
	metaDescription: string;
	keywords: string[];
	intro: string[];
	faqs: LandingFaq[];
	relatedClusters: string[]; // other landing slugs
	relatedGuideSlugs: string[]; // /guides slugs
	isHub?: boolean; // laptop-spare-parts overview hub (no single product category)
	brands: BrandLanding[];
};

export const landings: Landing[] = [
	{
		slug: 'laptop-battery',
		name: 'Laptop Battery',
		category: 'batteries',
		h1: 'Laptop Battery Replacements for HP, Dell, Lenovo, Asus & Acer',
		title: 'Laptop Battery Replacement Online (HP, Dell, Lenovo, Asus, Acer)',
		metaDescription:
			'Buy the correct replacement laptop battery by model and part number. OEM and compatible batteries for HP, Dell, Lenovo, Asus and Acer with warranty, COD and fast Tamil Nadu delivery.',
		keywords: [
			'laptop battery',
			'laptop battery price',
			'hp laptop battery',
			'dell laptop battery',
			'lenovo laptop battery',
			'compatible laptop battery',
			'laptop battery replacement'
		],
		intro: [
			'A weak laptop battery that drains in minutes, refuses to charge past a point, or shuts the laptop down without warning is usually ready for replacement. The safe way to buy is by your exact laptop model and the battery part number printed on the old cell, not by guessing from the brand alone.',
			'LapKart stocks original and compatible replacement batteries for most HP, Dell, Lenovo, Asus and Acer laptops, with the voltage (V) and capacity (Wh/mAh) listed so you can match the old battery exactly. A battery with the wrong voltage or connector will not work and can be unsafe, so always confirm the part number before ordering.',
			'Every battery listing shows price, warranty and stock up front. Most parts ship across Tamil Nadu from Rs 50 (free above Rs 2,000), with COD available at checkout.'
		],
		faqs: [
			{
				question: 'How do I find the right battery for my laptop?',
				answer:
					'Flip the laptop over or remove the old battery and read the part number and voltage printed on it (for example, a code like “HSTNN-LB7J” with “11.55V 41Wh”). Match that part number, voltage and capacity to the listing. The laptop model number on the bottom sticker also helps narrow it down.'
			},
			{
				question: 'What is the difference between an original and a compatible battery?',
				answer:
					'An original (OEM) battery is made or branded by the laptop manufacturer. A compatible battery is built to the same voltage, capacity, connector and shape and works the same way, usually at a lower price. Both are fine as long as the voltage and part number match your laptop.'
			},
			{
				question: 'Will a higher-capacity (mAh/Wh) battery damage my laptop?',
				answer:
					'No. A higher-capacity battery at the same voltage simply lasts longer per charge. What you must never change is the voltage. A different voltage can fail to charge or harm the laptop.'
			},
			{
				question: 'Is there a warranty on replacement laptop batteries?',
				answer:
					'Yes. Replacement batteries carry a replacement warranty (commonly 6 months); the exact term is shown on each product page along with the DOA (dead-on-arrival) support window.'
			},
			{
				question: 'Do you offer cash on delivery for laptop batteries?',
				answer:
					'COD is available on eligible orders at checkout, alongside UPI and card payments. Delivery across Tamil Nadu starts at Rs 50 and is free over Rs 2,000.'
			}
		],
		relatedClusters: ['laptop-charger'],
		relatedGuideSlugs: ['laptop-battery-price-india', 'laptop-not-turning-on'],
		brands: [
			{
				slug: 'hp',
				name: 'HP',
				brand: 'HP',
				h1: 'HP Laptop Battery Replacements (Pavilion, ProBook, EliteBook, 15s)',
				title: 'HP Laptop Battery Replacement Online | Pavilion, ProBook, 15s',
				metaDescription:
					'Replacement HP laptop batteries for Pavilion, ProBook, EliteBook, Omen and 15s series. Match by HP part number and voltage. Warranty, COD and Tamil Nadu delivery.',
				intro: [
					'HP uses several different battery part numbers across Pavilion, ProBook, EliteBook, Omen and the 15s range, so two HP laptops that look similar can need completely different batteries. Always match the HP part number (for example HT03XL, KI04, or HSTNN-series codes) and the voltage printed on your old battery.',
					'These HP batteries are listed with capacity and voltage so you can confirm the fit before buying. If you are unsure, send us the HP part number or the laptop model from the bottom sticker and we will confirm compatibility before dispatch.'
				],
				faqs: [
					{
						question: 'Where is the HP battery part number?',
						answer:
							'On the battery label itself (codes like HT03XL or HSTNN-LB7J) or on the bottom of the laptop. That code is the most reliable way to match an HP replacement battery.'
					},
					{
						question: 'Is an HP-compatible battery safe to use?',
						answer:
							'Yes, when it matches your HP model’s voltage, capacity range and connector. Compatible HP batteries are a common, lower-cost alternative to OEM and carry a replacement warranty.'
					}
				]
			},
			{
				slug: 'dell',
				name: 'Dell',
				brand: 'Dell',
				h1: 'Dell Laptop Battery Replacements (Inspiron, Latitude, Vostro, XPS)',
				title: 'Dell Laptop Battery Replacement Online | Inspiron, Latitude, Vostro',
				metaDescription:
					'Replacement Dell laptop batteries for Inspiron, Latitude, Vostro and XPS. Match by Dell part number and voltage. Warranty, COD and fast Tamil Nadu delivery.',
				intro: [
					'Dell battery codes vary widely across Inspiron, Latitude, Vostro and XPS lines. A Latitude battery will not fit an Inspiron just because both are Dell, so match the Dell part number and voltage from the old battery before ordering.',
					'Each Dell battery here lists voltage and capacity (Wh). Share your Dell part number or service tag model if you want compatibility confirmed before we ship.'
				],
				faqs: [
					{
						question: 'How do I check which Dell battery I need?',
						answer:
							'Read the part number and voltage on the old Dell battery, or use the laptop model from the bottom sticker. Dell service tags can also identify the exact configuration.'
					},
					{
						question: 'Do Dell laptops need a specific voltage battery?',
						answer:
							'Yes. Use the exact voltage printed on the original Dell battery. Capacity (Wh) can be equal or higher, but the voltage must match.'
					}
				]
			},
			{
				slug: 'lenovo',
				name: 'Lenovo',
				brand: 'Lenovo',
				h1: 'Lenovo Laptop Battery Replacements (IdeaPad, ThinkPad, Yoga)',
				title: 'Lenovo Laptop Battery Replacement Online | IdeaPad, ThinkPad, Yoga',
				metaDescription:
					'Replacement Lenovo laptop batteries for IdeaPad, ThinkPad and Yoga series. Match by Lenovo part number and voltage. Warranty, COD and Tamil Nadu delivery.',
				intro: [
					'Lenovo spreads battery part numbers across IdeaPad, ThinkPad and Yoga families, and ThinkPad models in particular use many different codes. Match the Lenovo part number (for example L17L3PB0 or similar) and the voltage from your old battery.',
					'Listings show voltage and capacity so you can confirm the fit. Send the Lenovo part number or model if you want us to verify before dispatch.'
				],
				faqs: [
					{
						question: 'Are ThinkPad and IdeaPad batteries interchangeable?',
						answer:
							'No. ThinkPad and IdeaPad use different battery part numbers and connectors. Always match the exact Lenovo part number for your model.'
					},
					{
						question: 'Can I replace a Lenovo internal battery myself?',
						answer:
							'Many IdeaPad and ThinkPad models have internal batteries that need the back cover removed. If you are comfortable opening the base and disconnecting the battery connector, replacement is straightforward; otherwise a technician can fit it.'
					}
				]
			}
		]
	},
	{
		slug: 'laptop-charger',
		name: 'Laptop Charger',
		category: 'chargers',
		h1: 'Laptop Chargers & Adapters for HP, Dell, Lenovo, Asus & Acer',
		title: 'Laptop Charger / Adapter Replacement Online (HP, Dell, Lenovo)',
		metaDescription:
			'Buy the correct laptop charger by wattage, pin type and model. Barrel-pin and Type-C PD adapters for HP, Dell, Lenovo, Asus and Acer. Warranty, COD, Tamil Nadu delivery.',
		keywords: [
			'laptop charger',
			'laptop adapter',
			'laptop charger price',
			'hp laptop charger',
			'dell laptop charger',
			'lenovo laptop charger',
			'type c laptop charger',
			'65w laptop charger'
		],
		intro: [
			'A laptop that charges only at a certain cable angle, shows “plugged in, not charging”, or does not power on at all often has a failed charger rather than a failed battery. Replacing the adapter is the cheapest first fix, but it must match three things: wattage (W), pin/connector type, and output voltage.',
			'LapKart stocks barrel-pin and USB-C Power Delivery (PD) chargers for HP, Dell, Lenovo, Asus and Acer. Using a lower-wattage charger can make the laptop charge slowly or not at all under load, and a wrong pin size simply will not fit, so match the original adapter’s rating printed on its label.',
			'Each charger lists wattage, connector and output up front, with warranty and COD at checkout, and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know my laptop charger wattage?',
				answer:
					'Read the original adapter’s label. It shows output like “19.5V 3.34A” — multiply volts by amps to get watts (here ~65W). Buy the same wattage or higher, never lower, and keep the same voltage and pin type.'
			},
			{
				question: 'Can I use a higher-wattage charger safely?',
				answer:
					'Yes, if the voltage and connector match. A 90W charger on a laptop that came with 65W is safe — the laptop only draws what it needs. A lower-wattage charger is the one to avoid.'
			},
			{
				question: 'What is the difference between barrel-pin and Type-C chargers?',
				answer:
					'Older laptops use a round barrel pin in a specific diameter. Newer thin laptops charge over USB-C Power Delivery. They are not interchangeable; check which port your laptop uses and the required PD wattage for Type-C.'
			},
			{
				question: 'My laptop says “plugged in, not charging” — is it the charger?',
				answer:
					'Often yes, especially if the laptop runs only while plugged in or charges intermittently. It can also be the battery or DC jack. See our diagnosis guide and test with a known-good charger of the correct rating.'
			},
			{
				question: 'Do replacement chargers include the power cable?',
				answer:
					'Cable inclusion is noted on each product page. Warranty terms and COD eligibility are shown there too.'
			}
		],
		relatedClusters: ['laptop-battery'],
		relatedGuideSlugs: ['laptop-charger-buying-guide', 'laptop-not-turning-on'],
		brands: [
			{
				slug: 'hp',
				name: 'HP',
				brand: 'HP',
				h1: 'HP Laptop Chargers & Adapters (45W, 65W, Type-C, Smart Pin)',
				title: 'HP Laptop Charger Replacement | 45W, 65W, Type-C, Blue Pin',
				metaDescription:
					'Replacement HP laptop chargers in 45W, 65W and USB-C, with the correct HP smart blue-pin or Type-C connector. Match by wattage and pin. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'HP uses a blue “smart pin” barrel connector on many models and USB-C on newer ones, in 45W and 65W ratings (higher for Omen/gaming). The blue smart pin and the older yellow pin are different, so match HP’s connector and wattage from your original adapter label.',
					'These HP chargers list wattage, output and connector. If your HP runs only on AC and will not charge, confirm the adapter rating here before buying.'
				],
				faqs: [
					{
						question: 'Which HP laptops use the blue smart pin?',
						answer:
							'Most recent HP Pavilion, ProBook and 15s barrel-charging models use the blue smart pin. Confirm by the pin on your existing HP adapter or the port on the laptop.'
					},
					{
						question: 'Is a 65W HP charger okay for a 45W HP laptop?',
						answer:
							'Yes, as long as the connector matches. A 65W HP adapter safely runs a 45W HP laptop and charges a little faster under load.'
					}
				]
			},
			{
				slug: 'dell',
				name: 'Dell',
				brand: 'Dell',
				h1: 'Dell Laptop Chargers & Adapters (45W, 65W, 90W, Type-C)',
				title: 'Dell Laptop Charger Replacement | 45W, 65W, 90W, Barrel & Type-C',
				metaDescription:
					'Replacement Dell laptop chargers in 45W, 65W, 90W barrel-pin and USB-C. Match the Dell 4.5mm pin and wattage. Warranty, COD and fast Tamil Nadu delivery.',
				intro: [
					'Dell uses a 4.5mm barrel pin with a centre signal pin on many Inspiron, Latitude and Vostro models, plus USB-C on newer ones, rated 45W, 65W or 90W. A Dell charger missing the centre pin signal can cause “unknown adapter” warnings and slow charging.',
					'Each Dell charger lists wattage and connector. Match the rating on your old Dell adapter, or send the model and we will confirm.'
				],
				faqs: [
					{
						question: 'Why does my Dell say “adapter cannot be determined”?',
						answer:
							'That warning usually means a non-genuine or faulty adapter, a damaged centre pin, or a wrong-wattage charger. Use a correctly rated Dell adapter with the proper 4.5mm pin to clear it.'
					},
					{
						question: 'Can I use a 90W Dell charger on a 65W Dell laptop?',
						answer:
							'Yes. Same connector, higher wattage is safe. Avoid going below the original wattage.'
					}
				]
			},
			{
				slug: 'lenovo',
				name: 'Lenovo',
				brand: 'Lenovo',
				h1: 'Lenovo Laptop Chargers & Adapters (Slim Tip, Round Pin, USB-C)',
				title: 'Lenovo Laptop Charger Replacement | Slim Tip, Round Pin, USB-C',
				metaDescription:
					'Replacement Lenovo laptop chargers: rectangular slim-tip, round-pin and USB-C in 45W and 65W. Match the Lenovo connector and wattage. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Lenovo uses a rectangular “slim tip”, an older round pin, and USB-C across IdeaPad, ThinkPad and Yoga, typically at 45W or 65W. The slim tip and round pin are not interchangeable, so match Lenovo’s connector shape and wattage from your old adapter.',
					'These Lenovo chargers list wattage, output and connector. Confirm the tip type on your current adapter before ordering.'
				],
				faqs: [
					{
						question: 'What is the Lenovo slim-tip charger?',
						answer:
							'It is Lenovo’s rectangular charging connector with a small pin inside, used on many ThinkPad and IdeaPad models. It is different from the older round-pin and from USB-C.'
					},
					{
						question: 'Does my Lenovo charge over USB-C?',
						answer:
							'Many newer ThinkPad and Yoga models charge via USB-C Power Delivery. If your laptop has no barrel port and charges from a USB-C port, use a PD charger of the correct wattage.'
					}
				]
			}
		]
	},
	{
		slug: 'laptop-keyboard',
		name: 'Laptop Keyboard',
		category: 'keyboards',
		h1: 'Laptop Keyboard Replacements for HP, Dell, Lenovo, Asus & Acer',
		title: 'Laptop Keyboard Replacement Online (Backlit & Non-Backlit)',
		metaDescription:
			'Replacement laptop keyboards by model: backlit, non-backlit, with frame or power button. HP, Dell, Lenovo, Asus, Acer layouts. Warranty, COD and Tamil Nadu delivery.',
		keywords: [
			'laptop keyboard',
			'laptop keyboard price',
			'hp laptop keyboard',
			'dell laptop keyboard',
			'backlit laptop keyboard',
			'laptop keyboard replacement'
		],
		intro: [
			'When several keys stop working, keys repeat or stick, or liquid has gone into the keyboard, replacing the whole keyboard is usually more reliable than repairing individual keys. The catch is that one laptop model can have several keyboard variants: backlit vs non-backlit, with or without the surrounding frame (palmrest), and with or without an integrated power button.',
			'LapKart lists laptop keyboards by model with the layout and backlight clearly marked, so you order the variant that actually fits. A keyboard for the same model but the wrong variant may not seat correctly or may be missing the backlight ribbon, so match your existing keyboard’s features and connector.',
			'Each keyboard shows price, warranty and stock, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know if my laptop keyboard is backlit?',
				answer:
					'If your current keyboard lights up (often via an Fn + space or Fn + F-key shortcut), order a backlit replacement. A backlit keyboard has an extra ribbon connector, so a non-backlit replacement will not light up even if it fits.'
			},
			{
				question: 'Should I replace just the keys or the whole keyboard?',
				answer:
					'Single keycaps can sometimes be refitted, but if multiple keys fail, the membrane or ribbon is usually damaged and replacing the whole keyboard is the lasting fix.'
			},
			{
				question: 'Does the replacement keyboard include the frame?',
				answer:
					'It depends on the variant. Some models ship the bare keyboard, others include the top frame/palmrest. Each product page states what is included; match it to how your current keyboard is built.'
			},
			{
				question: 'Will a US-layout keyboard work on my laptop?',
				answer:
					'Most Indian laptops use a US/English layout. Confirm the key arrangement (especially the Enter key shape and extra keys) matches your current keyboard before ordering.'
			},
			{
				question: 'Is keyboard replacement covered by warranty?',
				answer:
					'Replacement keyboards carry a replacement warranty shown on each product page, with DOA support if a unit arrives faulty.'
			}
		],
		relatedClusters: ['laptop-screen'],
		relatedGuideSlugs: ['laptop-keyboard-replacement-guide', 'how-to-find-laptop-model-number'],
		brands: [
			{
				slug: 'hp',
				name: 'HP',
				brand: 'HP',
				h1: 'HP Laptop Keyboard Replacements (Backlit, Frame, Power Button)',
				title: 'HP Laptop Keyboard Replacement | Backlit, With Frame, 15s',
				metaDescription:
					'Replacement HP laptop keyboards: backlit and non-backlit, with or without frame and power button, for Pavilion, ProBook and 15s. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'HP keyboards differ by backlight, by whether the top frame is included, and by whether the power button is built in. A Pavilion 15 keyboard and a 15s keyboard can look alike yet use different connectors, so match the HP model and the features of your current keyboard.',
					'These HP keyboards show layout and backlight. Send your HP model number if you want the variant confirmed before dispatch.'
				],
				faqs: [
					{
						question: 'Do HP keyboards come with the frame?',
						answer:
							'Some HP keyboard variants include the top frame/palmrest and some are bare. The product page states which; match it to your current keyboard build.'
					},
					{
						question: 'How do I enable the backlight after replacing an HP keyboard?',
						answer:
							'On most HP models press Fn + F5 (or the backlight key). The backlight only works if you fitted a backlit variant with its ribbon connected.'
					}
				]
			},
			{
				slug: 'dell',
				name: 'Dell',
				brand: 'Dell',
				h1: 'Dell Laptop Keyboard Replacements (Inspiron, Latitude, Vostro)',
				title: 'Dell Laptop Keyboard Replacement | Inspiron, Latitude, Backlit',
				metaDescription:
					'Replacement Dell laptop keyboards for Inspiron, Latitude and Vostro: backlit and non-backlit variants. Match the Dell model and connector. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Dell keyboards vary across Inspiron, Latitude and Vostro by backlight and ribbon connector. Latitude models in particular often use a different connector and a pointing-stick variant, so match your Dell model and existing keyboard features.',
					'Listings mark layout and backlight. Share your Dell model or service tag for a compatibility check before shipping.'
				],
				faqs: [
					{
						question: 'Why are some Dell keyboard keys not working?',
						answer:
							'A few dead keys usually mean a damaged membrane or ribbon, common after spills or wear. Replacing the keyboard restores all keys at once.'
					},
					{
						question: 'Do Dell Latitude keyboards have a different connector?',
						answer:
							'Often yes, and some include a pointing stick (trackpoint). Match the exact Latitude variant and connector to your laptop.'
					}
				]
			}
		]
	},
	{
		slug: 'laptop-screen',
		name: 'Laptop Screen',
		category: 'displays',
		productQuery: '',
		h1: 'Laptop Screen & Display Replacements (30-pin, 40-pin, HD, FHD)',
		title: 'Laptop Screen / Display Replacement Online (HD, FHD, IPS)',
		metaDescription:
			'Replacement laptop screens and displays by size, resolution and connector. 30-pin and 40-pin HD/FHD/IPS panels for HP, Dell, Lenovo, Asus, Acer. Warranty, COD, delivery.',
		keywords: [
			'laptop screen',
			'laptop display price',
			'laptop screen replacement',
			'laptop screen problems vertical lines',
			'30 pin laptop screen',
			'40 pin laptop screen'
		],
		intro: [
			'Cracked glass, vertical or horizontal lines, a black display with a working external monitor, or heavy flicker usually mean the panel needs replacing. The safest match is the panel part number on the back of the old screen, because a single laptop model can ship with several different panels.',
			'Five things must match: size (e.g. 14"/15.6"), resolution (HD 1366×768 vs FHD 1920×1080), connector pin count (commonly 30-pin or 40-pin), connector position, and mounting/bracket style. Guessing the pin count or buying by laptop model alone is the most common cause of a wrong screen order.',
			'LapKart lists displays with these specs and a 6-month replacement warranty where applicable, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I find my laptop screen part number?',
				answer:
					'Remove the bezel and read the sticker on the back of the panel (codes like N156BGA-EA2 or B140XTN). That part number, plus size, resolution, pin count and connector position, is the safest way to match a replacement.'
			},
			{
				question: 'What is the difference between a 30-pin and 40-pin laptop screen?',
				answer:
					'The pin count is the number of contacts on the screen’s video connector. 30-pin is common on standard HD/FHD panels; 40-pin appears on touch and some higher-refresh or special panels. They are not interchangeable — count the pins on your old screen’s connector.'
			},
			{
				question: 'My laptop has vertical lines — is it the screen or the cable?',
				answer:
					'Connect an external monitor: if the external picture is clean, the fault is in the laptop panel or its display cable. Lines that change when you flex the lid hint at a cable; fixed lines usually mean the panel needs replacing.'
			},
			{
				question: 'Can I put an FHD screen in a laptop that came with HD?',
				answer:
					'Sometimes, if the connector, size and mounting match and the laptop board supports the resolution. It is not guaranteed, so confirm the panel part number and connector before upgrading.'
			},
			{
				question: 'Is there a warranty on replacement laptop screens?',
				answer:
					'Yes, a replacement warranty (commonly 6 months) shown on each product page, with DOA support and a return process for verified defects.'
			}
		],
		relatedClusters: ['laptop-keyboard'],
		relatedGuideSlugs: [
			'laptop-screen-vertical-lines',
			'how-to-find-laptop-screen-part-number',
			'30-pin-vs-40-pin-laptop-screen'
		],
		brands: []
	},
	{
		slug: 'laptop-cooling-fan',
		name: 'Laptop Cooling Fan',
		category: 'cooling',
		h1: 'Laptop Cooling Fan & Heatsink Replacements',
		title: 'Laptop Cooling Fan Replacement Online (HP, Dell, Asus, Acer)',
		metaDescription:
			'Replacement laptop cooling fans and heatsink fans for HP, Dell, Asus and Acer. Fix overheating, shutdowns and loud fan noise. Match by model. Warranty, COD, delivery.',
		keywords: [
			'laptop fan',
			'laptop cooling fan',
			'laptop cooling fan price',
			'laptop heatsink fan',
			'hp laptop fan'
		],
		intro: [
			'A laptop that runs hot, gets loud, throttles to a crawl, or shuts down during games or video calls often has a worn or clogged cooling fan. If cleaning the dust and repasting does not fix the noise or temperatures, the fan bearing is usually failing and the fan should be replaced.',
			'LapKart stocks replacement cooling fans (and fan+heatsink assemblies) matched to specific HP, Dell, Asus and Acer models. Fans differ by connector, blade size and whether they come as a bare fan or attached to the heatsink, so match your model and the existing fan’s connector.',
			'Each fan lists the fit and warranty, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know my laptop fan is failing?',
				answer:
					'Constant loud whirring or rattling, hot palmrest, sudden shutdowns under load, or a fan that does not spin are signs. If cleaning dust does not help, the fan bearing is likely worn and needs replacement.'
			},
			{
				question: 'Is it the fan or do I just need cleaning and thermal paste?',
				answer:
					'Try cleaning the dust and reapplying thermal paste first. If noise or high temperatures continue, or the fan does not spin, replace the fan.'
			},
			{
				question: 'Does the cooling fan come with the heatsink?',
				answer:
					'It varies by model — some are bare fans, some are fan+heatsink assemblies. The product page states which; match it to how your laptop’s cooling is built.'
			}
		],
		relatedClusters: ['laptop-battery'],
		relatedGuideSlugs: ['laptop-not-turning-on'],
		brands: []
	}
];

// Content for the /parts hub index (laptop spare parts overview).
export const partsHub = {
	h1: 'Laptop Spare Parts & Replacement Hardware',
	title: 'Laptop Spare Parts Online — Batteries, Chargers, Keyboards, Screens',
	metaDescription:
		'Genuine and compatible laptop spare parts: batteries, chargers, keyboards, screens and cooling fans for HP, Dell, Lenovo, Asus and Acer. Match by model and part number. Warranty, COD, Tamil Nadu delivery.',
	keywords: [
		'laptop spare parts',
		'laptop parts',
		'laptop replacement parts',
		'compatible laptop parts',
		'laptop spare parts online'
	],
	intro: [
		'LapKart is a focused store for laptop replacement hardware: the parts that bring a working laptop back to life instead of replacing the whole machine. We stock batteries, chargers, keyboards, screens, cooling fans, DC jacks, speakers and more for HP, Dell, Lenovo, Asus and Acer.',
		'Before buying any part, identify your exact laptop model (bottom sticker) and the part number printed on the old component. The same laptop model can use several variants of a battery, keyboard or screen, so matching the part number is what avoids wrong orders.',
		'Browse by part type below. Every listing shows price, warranty and stock, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
	],
	faqs: [
		{
			question: 'How do I find the right spare part for my laptop?',
			answer:
				'Start with your laptop model number (on the bottom sticker), then read the part number printed on the specific component you are replacing. Match both to the listing. For screens and batteries the part number is essential.'
		},
		{
			question: 'Do you sell original or compatible laptop parts?',
			answer:
				'Both. Many parts are available as original (OEM) or lower-cost compatible versions built to the same specification. Each product page states the type, warranty and condition.'
		},
		{
			question: 'Which laptop brands do you cover?',
			answer:
				'Primarily HP, Dell, Lenovo, Asus and Acer, with parts for Apple, Samsung, Toshiba, MSI and others depending on the component.'
		}
	]
};

const landingBySlug = new Map(landings.map((l) => [l.slug, l]));

export function getLanding(slug: string): Landing | undefined {
	return landingBySlug.get(slug);
}

export function getBrandLanding(
	cluster: string,
	brandSlug: string
): { landing: Landing; brand: BrandLanding } | undefined {
	const landing = landingBySlug.get(cluster);
	if (!landing) return undefined;
	const brand = landing.brands.find((b) => b.slug === brandSlug);
	if (!brand) return undefined;
	return { landing, brand };
}

// All indexable landing paths, for the sitemap.
export function landingPaths(): string[] {
	const paths: string[] = [];
	for (const landing of landings) {
		paths.push(`/parts/${landing.slug}`);
		for (const brand of landing.brands) {
			paths.push(`/parts/${landing.slug}/${brand.slug}`);
		}
	}
	return paths;
}

export function clusterLink(slug: string) {
	const l = landingBySlug.get(slug);
	return l ? { title: l.name, href: `/parts/${l.slug}`, description: l.title } : null;
}
