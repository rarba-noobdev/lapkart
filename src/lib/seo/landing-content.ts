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
	categories?: string[]; // multiple categories merged into the grid (e.g. ['ram','ssd'])
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
			},
			{
				slug: 'asus',
				name: 'Asus',
				brand: 'Asus',
				h1: 'Asus Laptop Battery Replacements (VivoBook, ZenBook, TUF, ROG)',
				title: 'Asus Laptop Battery Replacement Online | VivoBook, ZenBook, TUF',
				metaDescription:
					'Replacement Asus laptop batteries for VivoBook, ZenBook, TUF and ROG. Match by Asus part number and voltage. Warranty, COD and Tamil Nadu delivery.',
				intro: [
					'Asus uses different battery codes across VivoBook, ZenBook, TUF and ROG (codes like B31N1535 or C31N1620). A VivoBook battery will not fit a TUF gaming model just because both are Asus, so match the Asus part number and voltage from your old battery.',
					'Each Asus battery lists voltage and capacity. Many slim VivoBook and ZenBook models use internal batteries that need the base removed; send the Asus part number or model for a fit check before dispatch.'
				],
				faqs: [
					{
						question: 'Where is the Asus battery part number?',
						answer:
							'On the battery label (codes such as B31N1535) or the laptop base. Match that code and the voltage for an Asus replacement.'
					},
					{
						question: 'Do Asus gaming laptops use different batteries?',
						answer:
							'Yes. TUF and ROG batteries are higher-capacity and use different codes from VivoBook/ZenBook. Always match the exact Asus part number.'
					}
				]
			},
			{
				slug: 'acer',
				name: 'Acer',
				brand: 'Acer',
				h1: 'Acer Laptop Battery Replacements (Aspire, Nitro, Swift, Predator)',
				title: 'Acer Laptop Battery Replacement Online | Aspire, Nitro, Swift',
				metaDescription:
					'Replacement Acer laptop batteries for Aspire, Nitro, Swift and Predator. Match by Acer part number and voltage. Warranty, COD and Tamil Nadu delivery.',
				intro: [
					'Acer battery codes vary across Aspire, Nitro, Swift and Predator (codes like AP18C8K, AC14B8K or AP16M5J). Match the Acer part number and voltage on the old battery rather than the series name alone.',
					'Listings show voltage and capacity. Many slim Aspire and Swift models have internal batteries; share the Acer part number or model for a compatibility check before we ship.'
				],
				faqs: [
					{
						question: 'How do I find my Acer battery code?',
						answer:
							'Read the label on the old Acer battery (for example AP18C8K) or the laptop base, and match that code and voltage.'
					},
					{
						question: 'Are Aspire and Nitro batteries the same?',
						answer:
							'No. Nitro gaming models use higher-capacity batteries with different codes from Aspire. Match the exact Acer part number for your model.'
					}
				]
			},
			{
				slug: 'toshiba',
				name: 'Toshiba',
				brand: 'Toshiba',
				h1: 'Toshiba Laptop Battery Replacements (Satellite, Tecra, Portege)',
				title: 'Toshiba Laptop Battery Replacement | Satellite, Tecra, Portege',
				metaDescription:
					'Replacement Toshiba laptop batteries for Satellite, Tecra and Portege. Match by Toshiba PA-series part number and voltage. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Toshiba batteries use PA-series codes (for example PA5024U or PA5109U) across Satellite, Tecra and Portege models. Match the Toshiba part number and voltage from the old battery rather than the series name.',
					'Each Toshiba battery lists voltage and capacity. Send the PA code or laptop model for a compatibility check before dispatch.'
				],
				faqs: [
					{
						question: 'Where is the Toshiba battery part number?',
						answer:
							'On the battery label as a PA-series code (e.g. PA5024U-1BRS). Match that code and the voltage for a Toshiba replacement.'
					}
				]
			},
			{
				slug: 'apple',
				name: 'Apple',
				brand: 'Apple',
				h1: 'MacBook Battery Replacements (MacBook Air & Pro)',
				title: 'MacBook Battery Replacement | MacBook Air, MacBook Pro',
				metaDescription:
					'Replacement MacBook batteries for MacBook Air and MacBook Pro by model code (A-number). Match the exact model before buying. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'MacBook batteries are matched by the laptop’s model number (the “A” number such as A1466 or A1502) printed on the underside, since each MacBook generation uses a different battery. Confirm the A-number before ordering.',
					'These MacBook batteries list the models they fit. MacBook battery replacement usually needs the bottom case opened; a technician can fit it if you prefer.'
				],
				faqs: [
					{
						question: 'How do I find my MacBook model for the battery?',
						answer:
							'Read the “Model A####” number on the underside of the MacBook, or check About This Mac. Match that A-number to the battery listing.'
					}
				]
			},
			{
				slug: 'msi',
				name: 'MSI',
				brand: 'MSI',
				h1: 'MSI Laptop Battery Replacements (GF, GL, Modern Series)',
				title: 'MSI Laptop Battery Replacement | GF63, GL63, Modern',
				metaDescription:
					'Replacement MSI laptop batteries for GF, GL and Modern gaming/creator series. Match by MSI BTY-series part number and voltage. Warranty, COD, delivery.',
				intro: [
					'MSI gaming and creator laptops use BTY-series battery codes (for example BTY-M6K) that vary by model. Match the MSI part number and voltage from the old battery; gaming batteries are higher-capacity.',
					'Listings show voltage and capacity. Share the BTY code or model for a fit check before dispatch.'
				],
				faqs: [
					{
						question: 'How do I identify my MSI battery?',
						answer:
							'Read the BTY-series code on the old MSI battery (e.g. BTY-M6K) and match that code and the voltage.'
					}
				]
			},
			{
				slug: 'samsung',
				name: 'Samsung',
				brand: 'Samsung',
				h1: 'Samsung Laptop Battery Replacements (NP Series)',
				title: 'Samsung Laptop Battery Replacement | NP Series Notebooks',
				metaDescription:
					'Replacement Samsung laptop batteries for NP-series notebooks. Match by Samsung part number (AA-series) and voltage. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Samsung notebook batteries use AA-series codes across the NP range (for example AA-PBVN3AB). Match the Samsung part number and voltage from the old battery, using the NP model as a backup clue.',
					'Each Samsung battery lists voltage and capacity. Send the part number or NP model for confirmation before we ship.'
				],
				faqs: [
					{
						question: 'How do I find my Samsung laptop battery code?',
						answer:
							'Read the AA-series code on the old battery or the NP model on the base, and match the code and voltage.'
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
			},
			{
				slug: 'asus',
				name: 'Asus',
				brand: 'Asus',
				h1: 'Asus Laptop Chargers & Adapters (45W, 65W, 120W, Type-C)',
				title: 'Asus Laptop Charger Replacement | 45W, 65W, Barrel & Type-C',
				metaDescription:
					'Replacement Asus laptop chargers in 45W, 65W and higher, barrel-pin and USB-C, for VivoBook, ZenBook, TUF and ROG. Match wattage and pin. Warranty, COD, delivery.',
				intro: [
					'Asus uses a small barrel pin on many VivoBook and ZenBook models, USB-C on slimmer ones, and high-wattage barrel adapters on TUF/ROG gaming laptops. Gaming models need much higher wattage, so match the exact Asus adapter rating and connector from your old charger.',
					'Each Asus charger lists wattage, output and connector. A low-watt charger on a TUF/ROG model will not keep up under load, so confirm the rating before buying.'
				],
				faqs: [
					{
						question: 'Why does my Asus gaming laptop need a high-wattage charger?',
						answer:
							'TUF and ROG laptops draw far more power than VivoBook/ZenBook. Use the original high-wattage Asus adapter rating; a 65W charger will not properly power a gaming model.'
					},
					{
						question: 'Does my Asus charge over USB-C?',
						answer:
							'Many slim VivoBook and ZenBook models support USB-C Power Delivery. If your Asus has no barrel port, use a PD charger of at least the original wattage.'
					}
				]
			},
			{
				slug: 'acer',
				name: 'Acer',
				brand: 'Acer',
				h1: 'Acer Laptop Chargers & Adapters (45W, 65W, 135W, Type-C)',
				title: 'Acer Laptop Charger Replacement | 45W, 65W, Barrel & Type-C',
				metaDescription:
					'Replacement Acer laptop chargers in 45W, 65W and higher, barrel-pin and USB-C, for Aspire, Swift and Nitro. Match wattage and pin size. Warranty, COD, delivery.',
				intro: [
					'Acer uses a barrel pin on most Aspire and Swift models, USB-C on some slim ones, and higher-wattage adapters on Nitro/Predator gaming laptops. Match the Acer adapter wattage and the barrel size from your original charger.',
					'Listings show wattage, output and connector. A Nitro gaming laptop needs its higher-wattage adapter; a lower-watt charger will throttle or fail to charge under load.'
				],
				faqs: [
					{
						question: 'What wattage Acer charger do I need?',
						answer:
							'Match the original Acer adapter label. Aspire/Swift are commonly 45W or 65W; Nitro/Predator need higher wattage. Same or higher wattage, same voltage and pin.'
					},
					{
						question: 'Does my Acer charge over USB-C?',
						answer:
							'Some slim Swift and Spin models charge via USB-C PD. If there is no barrel port, use a PD charger of at least the original wattage.'
					}
				]
			},
			{
				slug: 'apple',
				name: 'Apple',
				brand: 'Apple',
				h1: 'MacBook Chargers & Adapters (USB-C & MagSafe)',
				title: 'MacBook Charger Replacement | USB-C, MagSafe, Air & Pro',
				metaDescription:
					'Replacement MacBook chargers: USB-C Power Delivery and MagSafe for MacBook Air and Pro. Match the wattage to your model. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Modern MacBooks charge over USB-C Power Delivery, and newer models add MagSafe 3 while still accepting USB-C. Match the wattage to your model — MacBook Air around 30–35W, MacBook Pro 67W and up. Older MacBooks used MagSafe 1/2 (different connectors).',
					'These MacBook chargers list wattage and connector. A lower-wattage charger charges slowly and may not keep up under load.'
				],
				faqs: [
					{
						question: 'What wattage charger does my MacBook need?',
						answer:
							'MacBook Air is ~30–35W; MacBook Pro models need 67W to 140W depending on size. Match or exceed the original wattage.'
					}
				]
			},
			{
				slug: 'msi',
				name: 'MSI',
				brand: 'MSI',
				h1: 'MSI Laptop Chargers & Adapters (Gaming Wattage)',
				title: 'MSI Laptop Charger Replacement | GF, GL, Gaming Adapters',
				metaDescription:
					'Replacement MSI laptop chargers in the high wattages gaming laptops need, with the correct barrel pin. Match wattage and connector. Warranty, COD, delivery.',
				intro: [
					'MSI gaming laptops draw high power, so they ship with high-wattage barrel adapters (often 120W, 150W, 180W or more). Using a lower-wattage charger will throttle the laptop or fail to charge under load, so match the exact MSI adapter rating and pin.',
					'Each MSI charger lists wattage, output and connector. Confirm the rating on your original adapter before buying.'
				],
				faqs: [
					{
						question: 'Why does my MSI laptop need such a high-wattage charger?',
						answer:
							'Gaming GPUs and CPUs draw a lot of power. Use the original MSI wattage (often 120W+); a lower-watt charger cannot keep up.'
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
			},
			{
				slug: 'asus',
				name: 'Asus',
				brand: 'Asus',
				h1: 'Asus Laptop Keyboard Replacements (VivoBook Backlit, TUF, ROG)',
				title: 'Asus Laptop Keyboard Replacement | VivoBook Backlit, TUF, ROG',
				metaDescription:
					'Replacement Asus laptop keyboards for VivoBook, ZenBook, TUF and ROG: backlit and non-backlit, with or without frame. Match the Asus model and connector. Warranty, COD.',
				intro: [
					'Asus keyboards vary a lot by backlight: many VivoBook models are backlit, gaming TUF/ROG keyboards use RGB or single-colour backlighting with different connectors, and some budget VivoBooks are non-backlit. Confirm whether your current keyboard lights up and whether the frame is included.',
					'These Asus keyboards mark layout and backlight. Send your Asus model (for example VivoBook 15 X512) to confirm the backlit variant before dispatch.'
				],
				faqs: [
					{
						question: 'Does my Asus VivoBook have a backlit keyboard?',
						answer:
							'Some VivoBook variants are backlit and some are not. If yours lights up via an Fn shortcut, order a backlit replacement; a non-backlit keyboard will fit but never light up.'
					},
					{
						question: 'Are TUF/ROG gaming keyboards different?',
						answer:
							'Yes. Gaming keyboards use different backlighting and connectors from VivoBook/ZenBook. Match the exact Asus model and keyboard variant.'
					}
				]
			},
			{
				slug: 'acer',
				name: 'Acer',
				brand: 'Acer',
				h1: 'Acer Laptop Keyboard Replacements (Aspire, Nitro, Swift)',
				title: 'Acer Laptop Keyboard Replacement | Aspire, Nitro, Swift, Backlit',
				metaDescription:
					'Replacement Acer laptop keyboards for Aspire, Nitro and Swift: backlit and non-backlit variants. Match the Acer model and connector. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'Acer keyboards differ by backlight across Aspire, Nitro and Swift, and Nitro gaming models use a different backlit keyboard from standard Aspire units. Confirm whether your keyboard lights up and whether the frame is part of the unit.',
					'Listings mark layout and backlight. Share your Acer model (for example Aspire 5 A515) to confirm the variant before we ship.'
				],
				faqs: [
					{
						question: 'Which Acer laptops have a backlit keyboard?',
						answer:
							'Many Nitro and higher Aspire/Swift models are backlit; entry Aspire units often are not. If yours lights up, order a backlit replacement.'
					},
					{
						question: 'Why are some keys on my Acer not working?',
						answer:
							'Multiple dead keys usually mean a damaged membrane or ribbon. Replacing the whole Acer keyboard restores all keys reliably.'
					}
				]
			},
			{
				slug: 'apple',
				name: 'Apple',
				brand: 'Apple',
				h1: 'MacBook Keyboard Replacements (Air & Pro by Model)',
				title: 'MacBook Keyboard Replacement | MacBook Air, MacBook Pro',
				metaDescription:
					'Replacement MacBook keyboards matched by model (A-number) for MacBook Air and Pro. Confirm the exact model before buying. Warranty, COD, Tamil Nadu delivery.',
				intro: [
					'MacBook keyboards are matched by the laptop model (the “A” number such as A1466), since layout and fitment change between generations. Many MacBook keyboards are part of the top case, so check whether you need just the keyboard or the assembly.',
					'These MacBook keyboards list the models they fit. Confirm your A-number before ordering; a technician is recommended for top-case fitment.'
				],
				faqs: [
					{
						question: 'Is the MacBook keyboard separate or part of the top case?',
						answer:
							'On many MacBooks the keyboard is integrated into the top case. The product page states whether it is a standalone keyboard or a top-case assembly for your model.'
					}
				]
			},
			{
				slug: 'toshiba',
				name: 'Toshiba',
				brand: 'Toshiba',
				h1: 'Toshiba Laptop Keyboard Replacements (Satellite, Tecra)',
				title: 'Toshiba Laptop Keyboard Replacement | Satellite, Tecra',
				metaDescription:
					'Replacement Toshiba laptop keyboards for Satellite and Tecra: backlit and non-backlit variants. Match the Toshiba model and connector. Warranty, COD, delivery.',
				intro: [
					'Toshiba Satellite and Tecra keyboards vary by backlight and connector. Confirm whether your current keyboard lights up and match the Toshiba model and ribbon connector before ordering.',
					'Listings mark layout and backlight. Share your Toshiba model for a variant check before dispatch.'
				],
				faqs: [
					{
						question: 'How do I match a Toshiba keyboard?',
						answer:
							'Use the Toshiba model number and confirm backlight and connector against your current keyboard. Multiple dead keys usually mean the whole keyboard needs replacing.'
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
		brands: [
			{
				slug: 'hp',
				name: 'HP',
				brand: 'HP',
				h1: 'HP Laptop Screen & Display Replacements (HD, FHD, 30/40-pin)',
				title: 'HP Laptop Screen Replacement | Pavilion, 15s, Omen, HD/FHD',
				metaDescription:
					'Replacement HP laptop screens for Pavilion, 15s and Omen: HD and FHD panels in 30-pin and 40-pin. Match by panel part number, size and connector. Warranty, COD.',
				intro: [
					'HP laptops ship with several panel variants even within one model line, so an HP 15s can use different HD or FHD panels with 30-pin or 40-pin connectors. Match the panel part number on the back of the old screen, plus size, resolution and connector position.',
					'These HP displays list size, resolution and pin count. Send your HP model and panel code for a fit check before dispatch.'
				],
				faqs: [
					{
						question: 'Can I upgrade my HP from HD to FHD?',
						answer:
							'Sometimes, if the connector, size and mounting match and the board supports it. Confirm the panel part number and pin count first; it is not guaranteed across all HP models.'
					}
				]
			},
			{
				slug: 'dell',
				name: 'Dell',
				brand: 'Dell',
				h1: 'Dell Laptop Screen & Display Replacements (Inspiron, Latitude)',
				title: 'Dell Laptop Screen Replacement | Inspiron, Latitude, Vostro, FHD',
				metaDescription:
					'Replacement Dell laptop screens for Inspiron, Latitude and Vostro: HD and FHD panels, 30-pin and 40-pin. Match by panel part number and connector. Warranty, COD.',
				intro: [
					'Dell Inspiron, Latitude and Vostro models use a range of panels, including touch variants that change the connector. Match the Dell panel part number, size, resolution and pin count from the old screen, and note whether your laptop is touch.',
					'Each Dell display lists its specs. Share your Dell model or service tag for a compatibility check before we ship.'
				],
				faqs: [
					{
						question: 'How do I know if my Dell screen is touch?',
						answer:
							'Touch panels have a glass digitiser and a different connector. Check whether your current screen responds to touch and match a touch or non-touch Dell panel accordingly.'
					}
				]
			},
			{
				slug: 'lenovo',
				name: 'Lenovo',
				brand: 'Lenovo',
				h1: 'Lenovo Laptop Screen & Display Replacements (IdeaPad, ThinkPad)',
				title: 'Lenovo Laptop Screen Replacement | IdeaPad, ThinkPad, HD/FHD',
				metaDescription:
					'Replacement Lenovo laptop screens for IdeaPad and ThinkPad: HD and FHD panels, 30-pin and 40-pin. Match by panel part number and connector. Warranty, COD, delivery.',
				intro: [
					'Lenovo IdeaPad and ThinkPad models use several panel variants, and vertical lines on Lenovo screens are a common replacement trigger. Match the Lenovo panel part number, size, resolution and connector position from the old screen.',
					'Listings show size, resolution and pin count. Send your Lenovo model and panel code for a fit check before dispatch.'
				],
				faqs: [
					{
						question: 'My Lenovo screen has vertical lines — replace the panel?',
						answer:
							'Test with an external monitor first. If the external picture is clean and the lines are fixed, the Lenovo panel needs replacing; match its part number and connector.'
					}
				]
			},
			{
				slug: 'asus',
				name: 'Asus',
				brand: 'Asus',
				h1: 'Asus Laptop Screen & Display Replacements (VivoBook, TUF, FHD)',
				title: 'Asus Laptop Screen Replacement | VivoBook, ZenBook, TUF, FHD',
				metaDescription:
					'Replacement Asus laptop screens for VivoBook, ZenBook and TUF: FHD IPS and higher-refresh panels, 30-pin and 40-pin. Match by panel part number. Warranty, COD.',
				intro: [
					'Asus VivoBook and ZenBook models mostly use FHD IPS panels, while TUF/ROG gaming models use higher-refresh panels with 40-pin connectors. Match the Asus panel part number, size, resolution, refresh rate and pin count from the old screen.',
					'Each Asus display lists its specs. Gaming panels are not interchangeable with standard ones, so confirm the connector before buying.'
				],
				faqs: [
					{
						question: 'Do Asus gaming laptops use a different screen?',
						answer:
							'Yes. TUF/ROG high-refresh panels (120Hz+) use different connectors and pin counts from standard 60Hz panels. Match the exact Asus panel part number.'
					}
				]
			},
			{
				slug: 'acer',
				name: 'Acer',
				brand: 'Acer',
				h1: 'Acer Laptop Screen & Display Replacements (Aspire, Nitro, FHD)',
				title: 'Acer Laptop Screen Replacement | Aspire, Nitro, Swift, FHD',
				metaDescription:
					'Replacement Acer laptop screens for Aspire, Nitro and Swift: FHD IPS and high-refresh panels, 30-pin and 40-pin. Match by panel part number. Warranty, COD, delivery.',
				intro: [
					'Acer Aspire and Swift models use HD/FHD panels, while Nitro/Predator gaming models use high-refresh panels with different connectors. Match the Acer panel part number, size, resolution, refresh rate and pin count from the old screen.',
					'Listings show the panel specs. Confirm the connector and refresh rate for gaming models before ordering.'
				],
				faqs: [
					{
						question: 'What specs must match for an Acer screen?',
						answer:
							'Size, resolution, refresh rate, pin count (30 vs 40) and connector position. The panel part number on the old Acer screen confirms all of these.'
					}
				]
			},
			{
				slug: 'samsung',
				name: 'Samsung',
				brand: 'Samsung',
				h1: 'Samsung Laptop Screen & Display Replacements',
				title: 'Samsung Laptop Screen Replacement | NP Series, HD/FHD',
				metaDescription:
					'Replacement Samsung laptop screens for NP-series notebooks: HD and FHD panels in 30-pin and 40-pin. Match by panel part number and connector. Warranty, COD.',
				intro: [
					'Samsung notebook panels (and the panels Samsung manufactures for other brands) come in HD and FHD with different connectors. Match the panel part number, size, resolution and pin count from the back of the old screen.',
					'Listings show the panel specs. Send your Samsung model or panel code for a fit check before dispatch.'
				],
				faqs: [
					{
						question: 'How do I match a Samsung laptop screen?',
						answer:
							'Read the panel part number on the back of the old screen and match size, resolution, pin count and connector position. The NP model is a backup clue.'
					}
				]
			},
			{
				slug: 'msi',
				name: 'MSI',
				brand: 'MSI',
				h1: 'MSI Laptop Screen & Display Replacements (Gaming Panels)',
				title: 'MSI Laptop Screen Replacement | FHD, 120Hz+ Gaming Panels',
				metaDescription:
					'Replacement MSI laptop screens: FHD and high-refresh gaming panels with 40-pin connectors. Match by panel part number and refresh rate. Warranty, COD, delivery.',
				intro: [
					'MSI gaming laptops mostly use FHD high-refresh panels (120Hz and above) with 40-pin connectors. A standard 60Hz panel will not match a high-refresh model, so match the MSI panel part number, refresh rate and pin count from the old screen.',
					'Each MSI display lists resolution, refresh rate and connector. Confirm the refresh rate before ordering.'
				],
				faqs: [
					{
						question: 'Can I put a 60Hz panel in a 120Hz MSI laptop?',
						answer:
							'Not reliably — high-refresh models use different panels and connectors. Match the MSI panel part number, refresh rate and pin count.'
					}
				]
			}
		]
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
		relatedGuideSlugs: ['laptop-cooling-fan-replacement', 'laptop-not-turning-on'],
		brands: [
			{
				slug: 'hp',
				name: 'HP',
				brand: 'HP',
				h1: 'HP Laptop Cooling Fan & Heatsink Replacements',
				title: 'HP Laptop Cooling Fan Replacement | Pavilion, 15s, Omen',
				metaDescription:
					'Replacement HP laptop cooling fans and fan+heatsink assemblies for Pavilion, 15s and Omen. Fix overheating and loud fan noise. Match by model. Warranty, COD.',
				intro: [
					'HP cooling fans differ by model and by whether they come bare or attached to the heatsink. Pavilion, 15s and Omen units use different fans, so match your HP model and the existing fan connector before ordering.',
					'These HP fans list the fit. If cleaning dust has not fixed noise or overheating on your HP, the fan bearing is likely worn and the fan should be replaced.'
				],
				faqs: [
					{
						question: 'Does the HP fan come with the heatsink?',
						answer:
							'It varies by model — some HP units are bare fans, some are fan+heatsink assemblies. The product page states which; match it to your laptop.'
					}
				]
			},
			{
				slug: 'dell',
				name: 'Dell',
				brand: 'Dell',
				h1: 'Dell Laptop Cooling Fan & Heatsink Replacements',
				title: 'Dell Laptop Cooling Fan Replacement | Inspiron, Latitude, Vostro',
				metaDescription:
					'Replacement Dell laptop cooling fans and fan+heatsink assemblies for Inspiron, Latitude and Vostro. Fix overheating and noise. Match by model. Warranty, COD.',
				intro: [
					'Dell cooling fans vary across Inspiron, Latitude and Vostro, and some dual-fan models need the correct left/right unit. Match your Dell model and the existing fan connector and side before ordering.',
					'Listings show the fit. If your Dell still overheats or is loud after cleaning and repasting, replace the fan.'
				],
				faqs: [
					{
						question: 'My Dell has two fans — which one do I need?',
						answer:
							'Dual-fan Dell models use separate left and right fans with different connectors. Identify the failing side and match that exact part.'
					}
				]
			}
		]
	},
	{
		slug: 'laptop-ram-ssd',
		name: 'Laptop RAM & SSD',
		category: 'ssd',
		categories: ['ram', 'ssd'],
		h1: 'Laptop RAM & SSD Upgrades (DDR4 SODIMM, SATA & NVMe)',
		title: 'Laptop RAM & SSD Upgrade Online (DDR4 SODIMM, SATA, NVMe)',
		metaDescription:
			'Upgrade your laptop with the correct RAM and SSD: DDR4 SODIMM memory and SATA or NVMe M.2 SSDs. Check slot type and compatibility before buying. Warranty, COD, delivery.',
		keywords: [
			'laptop ssd',
			'laptop ram',
			'ssd for laptop',
			'8gb ddr4 laptop ram',
			'nvme ssd laptop',
			'laptop ram upgrade'
		],
		intro: [
			'A RAM and SSD upgrade is the cheapest way to make an old laptop feel new: more RAM stops slowdowns when many tabs or apps are open, and an SSD makes the laptop boot and load far faster than a hard disk. Both must match your laptop, so check the slot type before buying.',
			'For RAM, match the generation and form factor — most laptops use DDR4 SODIMM, and the speed should match or exceed the existing module. For storage, check whether your laptop takes a 2.5" SATA SSD, an M.2 SATA, or an M.2 NVMe drive; the M.2 types look similar but are not always interchangeable.',
			'Browse available SSDs below. If you are unsure which RAM or SSD your laptop supports, send us the laptop model and we will confirm the correct type before dispatch.'
		],
		faqs: [
			{
				question: 'How do I know if my laptop takes SATA or NVMe SSD?',
				answer:
					'Check the laptop specs or the existing drive: a 2.5" bay takes a SATA SSD, while a small M.2 slot may take M.2 SATA or M.2 NVMe. Some laptops support only one type, so confirm the M.2 key and protocol before buying.'
			},
			{
				question: 'What RAM does my laptop need?',
				answer:
					'Most laptops use DDR4 SODIMM. Match the generation (DDR4 vs DDR5 — they are not interchangeable) and use the same or higher speed. Check the maximum supported capacity for your model.'
			},
			{
				question: 'Will adding an SSD or more RAM void my warranty?',
				answer:
					'On most laptops with an accessible service panel, upgrading RAM or storage is user-serviceable, but check your manufacturer’s policy. A technician can fit it if you prefer.'
			},
			{
				question: 'Can I add an SSD and keep my old hard disk?',
				answer:
					'Often yes, if your laptop has both an M.2 slot and a 2.5" bay, or supports a caddy in the optical bay. Confirm the available slots for your model.'
			}
		],
		relatedClusters: ['laptop-battery'],
		relatedGuideSlugs: ['best-ssd-for-laptop', 'laptop-ram-upgrade-guide'],
		brands: []
	},
	{
		slug: 'laptop-dc-jack',
		name: 'Laptop DC Jack',
		category: 'dc_jacks',
		h1: 'Laptop DC Jack & Charging Port Replacements',
		title: 'Laptop DC Jack / Charging Port Replacement (HP, Dell, Lenovo, Acer)',
		metaDescription:
			'Replacement laptop DC jacks and charging ports for HP, Dell, Lenovo, Asus and Acer. Fix loose charging and "plugged in, not charging". Match by model. Warranty, COD.',
		keywords: [
			'laptop dc jack',
			'laptop charging port',
			'dc jack replacement',
			'laptop power jack',
			'laptop charging port repair'
		],
		intro: [
			'If your laptop charges only when the cable is held at an angle, the port feels loose, or it stops charging after a knock to the plug, the DC jack (charging port) is usually the fault — not the charger or battery. The jack is a cheap part, though fitting it needs soldering or a connector swap depending on the model.',
			'LapKart stocks DC jacks and charging-port cables for HP, Dell, Lenovo, Asus and Acer. Some models use a soldered jack on the board, others a jack-on-cable that plugs in. Match your laptop model and the existing jack type before ordering.',
			'Each DC jack lists the fit and warranty, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know if my DC jack is faulty?',
				answer:
					'Tell-tale signs: charging only at a certain cable angle, a wobbly port, sparking or heat at the plug, or intermittent charging that is not fixed by a known-good charger. Those point to the DC jack rather than the adapter.'
			},
			{
				question: 'Is the DC jack soldered or a plug-in cable?',
				answer:
					'It depends on the model. Some laptops have a soldered jack on the motherboard; many newer ones use a jack-on-cable that connects to the board. The product page states the type; match it to your laptop.'
			},
			{
				question: 'Can I replace a laptop DC jack myself?',
				answer:
					'A jack-on-cable is straightforward if you can open the laptop. A soldered jack needs soldering skills and is best done by a technician.'
			}
		],
		relatedClusters: ['laptop-charger'],
		relatedGuideSlugs: ['laptop-dc-jack-charging-port', 'laptop-charger-buying-guide'],
		brands: []
	},
	{
		slug: 'laptop-speaker',
		name: 'Laptop Speaker',
		category: 'speakers',
		h1: 'Laptop Speaker Replacements (HP, Dell, Lenovo, Asus, Acer)',
		title: 'Laptop Speaker Replacement Online (Left/Right Internal Speakers)',
		metaDescription:
			'Replacement internal laptop speakers for HP, Dell, Lenovo, Asus and Acer. Fix crackling, distorted or dead sound. Match by model and side. Warranty, COD, delivery.',
		keywords: [
			'laptop speaker',
			'laptop speaker replacement',
			'laptop speaker price',
			'internal laptop speaker',
			'laptop speaker not working'
		],
		intro: [
			'Crackling, distorted, or completely dead internal sound (when headphones still work) usually means a blown internal speaker. Laptop speakers come as left/right pairs and are model-specific, so match your laptop model and the side you need.',
			'LapKart stocks internal speaker sets for HP, Dell, Lenovo, Asus and Acer. Speakers differ by model, connector and mounting, so confirm the fit before ordering.',
			'Each speaker set lists the fit and warranty, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know if my laptop speaker is blown?',
				answer:
					'If sound is crackly or distorted at normal volume, or one side is dead, but headphones play cleanly, the internal speaker is the fault rather than the audio chip or drivers.'
			},
			{
				question: 'Do I need both speakers or just one?',
				answer:
					'Speakers are usually sold as a left+right set, but some models offer single sides. If only one side is dead, you can often replace just that side — match the model and side.'
			},
			{
				question: 'Is it the speaker or a software/driver problem?',
				answer:
					'Test with headphones and check the audio driver and volume mixer first. If headphones are clean and the internal sound is distorted or dead, replace the speaker.'
			}
		],
		relatedClusters: ['laptop-keyboard'],
		relatedGuideSlugs: [],
		brands: []
	},
	{
		slug: 'laptop-display-cable',
		name: 'Laptop Display Cable',
		category: 'flex_cables',
		h1: 'Laptop Display Cable & Flex Cable Replacements (LVDS / eDP)',
		title: 'Laptop Display Cable Replacement (LVDS / eDP Flex Cable)',
		metaDescription:
			'Replacement laptop display cables and flex cables (LVDS/eDP) for HP, Dell, Lenovo, Asus and Acer. Fix flicker and screen lines caused by a worn cable. Match by model. Warranty, COD.',
		keywords: [
			'laptop display cable',
			'laptop lcd cable',
			'laptop flex cable',
			'laptop lvds cable',
			'laptop screen cable replacement'
		],
		intro: [
			'When a laptop screen flickers, shows lines that change as you move the lid, or goes blank at certain hinge angles, the display cable (the LVDS/eDP flex cable running through the hinge) is often the cause — not the panel. The cable is far cheaper than a screen, so it is worth ruling in before replacing the display.',
			'LapKart stocks display/flex cables for HP, Dell, Lenovo, Asus and Acer. Cables differ by model, screen resolution (an FHD cable can differ from an HD cable for the same laptop), and connector, so match your laptop model and screen variant before ordering.',
			'Each cable lists the fit and warranty, with COD at checkout and Tamil Nadu delivery from Rs 50 (free over Rs 2,000).'
		],
		faqs: [
			{
				question: 'How do I know it is the cable and not the screen?',
				answer:
					'If the lines or flicker change when you gently flex the lid on its hinge, or the picture cuts at certain angles, the display cable is the likely fault. Fixed lines that do not change usually mean the panel. An external monitor that looks clean confirms the fault is in the laptop’s panel or cable.'
			},
			{
				question: 'Does the display cable depend on my screen resolution?',
				answer:
					'Often yes. The same laptop model can use a different cable for HD vs FHD panels, and touch vs non-touch. Match the cable to your laptop model and screen variant.'
			},
			{
				question: 'Is the display cable easy to replace?',
				answer:
					'It runs from the motherboard, through the hinge, to the panel. Replacing it needs the screen bezel and panel removed, so it is a moderate repair — straightforward for a technician.'
			}
		],
		relatedClusters: ['laptop-screen'],
		relatedGuideSlugs: ['laptop-display-cable-replacement', 'laptop-screen-vertical-lines'],
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
