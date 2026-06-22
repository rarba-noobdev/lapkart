# SEO Keyword Implementation Report — LapKart

Implementation of the cleaned SEO keyword research
(`lapkart-clean-seo-keywords-research.xlsx`). Covers **Batch 1** (infra + highest-value
pages), **Batch 2** (Asus/Acer + screen/cooling brand pages, RAM/SSD landing, 7 more blogs)
plus full planning and Review Queue decisions. No SEO traffic outcomes are claimed —
implementation work only.

## Batch 4 additions (this update)

Totals after Batch 4: **42 landing pages** and **16 blog/guide articles** live.

- New category landing `/parts/laptop-display-cable` — backed by **258 active flex/display
  cables** (LVDS/eDP). Strong internal link with the screen vertical-lines / flickering blogs
  (cable vs panel diagnosis).
- New blog `laptop-display-cable-replacement`.

**Not done (and why):** stocking-dependent surfaces — RAM/SSD, laptop hinge, motherboard,
trackpad/touchpad — were **not** populated with products. Inserting fake sellable inventory
into the live catalog is unsafe (customers could order unfulfillable items), so those remain
owner/admin actions. Their landings either already exist and auto-fill (RAM/SSD) or are held
until real stock exists. Remaining work is genuine long-tail (more low-volume model/brand
pages) with diminishing returns versus the 42 pages now live.

Validation after Batch 4: `npm run check` 0 errors/0 warnings; `npm run build` success.

---

## Batch 3 additions

Totals after Batch 3: **41 landing pages** and **15 blog/guide articles** live.

- RAM & SSD landing wired to **both** `ram` + `ssd` categories (multi-category grid merge in
  the cluster loader). `ram` category already exists in `catalog.ts`; it is unstocked, so the
  grid currently shows the 8 SSDs and fills automatically as RAM/SSD products are added.
  **Stocking RAM/SSD remains an owner/catalog action.**
- New category landings (inventory-backed): `/parts/laptop-dc-jack` (260 DC jacks),
  `/parts/laptop-speaker` (316 speakers).
- New brand landings (inventory-verified): battery `toshiba` (32), `apple` (12), `msi` (11),
  `samsung` (11); charger `apple` (21), `msi` (11); keyboard `apple` (17), `toshiba` (10);
  screen `samsung` (457), `msi` (19).
- New blogs: `laptop-dc-jack-charging-port`, `keyboard-keys-not-working`.
- **Deliberately skipped** (0 active inventory → would be thin): laptop hinge, motherboard,
  and trackpad/touchpad pages and blogs. Flagged owner-review (stock first).

Validation after Batch 3: `npm run check` 0 errors/0 warnings; `npm run build` success.

---

## Batch 2 additions

Totals after Batch 2: **27 landing pages** and **13 blog/guide articles** live.

New landing pages (all inventory-verified):
- Brand battery: `/parts/laptop-battery/asus`, `/acer`
- Brand charger: `/parts/laptop-charger/asus`, `/acer`
- Brand keyboard: `/parts/laptop-keyboard/asus`, `/acer`
- Brand screen: `/parts/laptop-screen/{hp,dell,lenovo,asus,acer}` (screen had no brand pages in Batch 1)
- Brand cooling: `/parts/laptop-cooling-fan/{hp,dell}`
- New category landing: `/parts/laptop-ram-ssd` (category `ssd`; lists the 8 in-stock SSDs +
  RAM/SSD upgrade content). **Inventory caveat:** RAM has 0 active products and SSD only 8 —
  stocking RAM/SSD is an owner/catalog action; the page is built and ready and will fill as
  inventory is added.

New blogs:
- `laptop-cooling-fan-replacement`, `best-ssd-for-laptop`, `laptop-ram-upgrade-guide`,
  `laptop-screen-flickering`, `laptop-screen-price-india`, `type-c-laptop-charger-guide`,
  `macbook-charger-guide`.

Validation after Batch 2: `npm run check` 0 errors/0 warnings; `npm run build` success.
All new brand pages confirmed against live inventory (battery Asus 120 / Acer 58; charger
Acer 104 / Asus 45; keyboard Asus 53 / Acer 30; screen 700–1,500 per brand; cooling HP 101 /
Dell 75). Sitemap (`landingPaths()`) and guides auto-include the new URLs.

---

## Batch 1 (original)

## Counts

| Metric | Value |
| --- | --- |
| Raw keywords in upload | 12,996 |
| High-confidence relevant (source of truth) | 2,039 |
| Review Queue reviewed | 337 |
| Review Queue kept (as supporting keywords) | ~120 (generic charger/keyboard/adapter terms folded into stocked clusters) |
| Review Queue → owner review | ~40 (RAM/SSD spec terms — blocked on inventory) |
| Review Queue rejected | ~80 (competitor/other-shop names, "store near me" local intent) |
| Landing pages created | **14** (`/parts` hub + 5 category + 8 brand) |
| Blog/guide articles created | **6** (P1) |
| Existing guides generalized | 4 screen guides (now category-aware) |
| Images added | 0 (owner decision — suggestions documented below) |
| Schema types added | BreadcrumbList, ItemList, FAQPage (landings); TechArticle + FAQPage + Breadcrumb (guides) |

## Landing pages created (new indexable routes)

Route shape: clean, hierarchical, breadcrumb-friendly (Google-preferred). Catalog
`/products?category=` URLs are `noindex` when filtered, so dedicated routes were used.

- `/parts` — Laptop spare parts hub (links all clusters + top guides)
- `/parts/laptop-battery` (+ `/dell`, `/hp`, `/lenovo`)
- `/parts/laptop-charger` (+ `/hp`, `/dell`, `/lenovo`)
- `/parts/laptop-keyboard` (+ `/hp`, `/dell`)
- `/parts/laptop-screen`
- `/parts/laptop-cooling-fan`

Each has a unique H1, SEO title, meta description, canonical, OG tags, intro copy,
server-rendered in-stock product grid (`searchProducts` by category/brand), visible FAQ,
breadcrumbs, and JSON-LD (BreadcrumbList + ItemList + FAQPage). All 8 brand pages were
inventory-verified before creation (battery: HP 190 / Lenovo 188 / Dell 139; charger:
HP 374 / Dell 157 / Lenovo 63; keyboard: HP 124 / Dell 68).

**Not created (deliberately, to avoid thin pages):** `laptop-ram-ssd` landing — catalog has
0 RAM and 8 SSD active products. Flagged owner-review.

## Blogs / guides created (`/guides/<slug>`)

1. `laptop-battery-price-india` — original vs compatible, warranty, model matching
2. `laptop-charger-buying-guide` — wattage, pin size, Type-C PD, safety
3. `laptop-screen-vertical-lines` — cable vs panel diagnosis → replacement
4. `laptop-keyboard-replacement-guide` — layout, frame, backlight compatibility
5. `how-to-find-laptop-model-number` — sticker / BIOS / system info + part numbers
6. `laptop-not-turning-on` — charger/battery/RAM/screen diagnostic routing

Each includes SEO title, meta description, slug, H1, intro, structured H2/H3 sections with
checklists, buying guidance, compatibility warnings, visible FAQ, internal links, and
TechArticle + FAQPage + BreadcrumbList schema. The guides system (`src/lib/guides.ts`) was
generalized from screen-only to category-aware (`productCategory` field), and
`/guides/[slug]/+page.server.ts` / `+page.svelte` now resolve the related-products category
and CTA labels dynamically (legacy screen guides unchanged in behaviour).

## Schema added

- Landings: `BreadcrumbList`, `ItemList` (in-stock products), `FAQPage` (visible FAQ only).
- Guides: `TechArticle`, `FAQPage`, `BreadcrumbList`.
- Product/Offer/Organization schema already existed on product pages — untouched.
- No fake reviews/ratings/availability added; FAQ schema only where FAQ is on-page.

## Internal links added

- Footer "Shop parts": `/parts`, battery, charger, keyboard, screen (site-wide).
- Cluster landing → brand landings + related cluster + related guides + catalog category.
- Brand landing → sibling brands + parent cluster + guides.
- Guides → matching cluster landing / catalog + sibling guides.
- `/parts` hub → all clusters + 3 top guides.

## Sitemap / indexability

- `/parts`, all 13 landing paths, and all guide routes added to `sitemap-static.xml`
  (`landingPaths()` + existing `guideRoutes`).
- New routes are server-rendered; main content is crawler-visible, not client-only.
- Canonical + unique title/meta per page; FAQ schema only where visible.

## Image suggestions (NOT implemented — owner skipped images)

Per-blog descriptive filenames + alt text for a future image pass:
- Battery price: `laptop-battery-part-number-label.jpg` — alt "Laptop battery label showing part number and voltage".
- Charger guide: `laptop-charger-wattage-label.jpg` — alt "Laptop adapter label showing 19.5V 3.34A output".
- Screen lines: `laptop-screen-vertical-lines-example.jpg` — alt "Laptop screen showing vertical lines".
- Keyboard guide: `laptop-keyboard-ribbon-connector.jpg` — alt "Laptop keyboard ribbon connector".
- Model number: `laptop-bottom-sticker-model-number.jpg` — alt "Laptop bottom sticker with model number".
- Not turning on: `laptop-ram-slot-reseat.jpg` — alt "Reseating laptop RAM module in slot".
Where helpful, LapKart's own catalog product images can illustrate inline (no external hotlinking).

## Keywords rejected (with reason)

- Mobile/phone/tablet/watch/auto/drone terms — removed upstream (different product domain).
- Software how-to / screenshot / driver / customer-care — not parts intent.
- Service-center / repair-shop intent — LapKart sells parts, not on-site service.
- Competitor / other-shop brand names (mcarespareparts, etc.) — others' branded intent.
- "store near me" / local-shop — no physical storefront targeting.
- Generic battery/display terms without laptop context — phone-intent pollution.

## Remaining opportunities (follow-up batches)

- Stock RAM/SSD, then build `/parts/laptop-ram-ssd` (83k volume currently un-served).
- Remaining brand landings: Asus/Acer/Apple/MSI/Toshiba/Samsung × battery/charger/keyboard/screen.
- Lower-volume blogs from the Blog Ideas sheet (~27): screen flickering, screen price,
  type-c charger, macbook charger, cooling fan replacement, trackpad, hinge, motherboard,
  DC jack, RAM/SSD upgrade, etc.
- Motherboard/DC-jack, hinges/body, internal-cable cluster landings.
- Optional: image pass using the filenames/alt above.

## Owner-review items

- RAM/SSD demand vs zero/low inventory — decide whether to stock or skip.
- Confirm brand naming for Apple vs MacBook in any future brand landings.
- Approve adding more brand landings (Asus/Acer have strong inventory: displays, chargers).

## Validation

- `npm run check` (svelte-kit sync + svelte-check): **0 errors, 0 warnings**.
- `npm run build` (Vite production build): **success** (`✓ built`). The only notice is
  adapter-auto "could not detect a supported production environment", which is expected for a
  local build without `VERCEL` env set; compilation completed fully.
- Post-deploy smoke test recommended: load `/parts`, `/parts/laptop-battery`,
  `/parts/laptop-battery/dell`, `/guides/laptop-battery-price-india`; confirm product lists
  render and view-source shows the JSON-LD blocks + unique canonical/title.

## Files changed

New:
- `src/lib/seo/landing-content.ts`
- `src/lib/components/LandingPage.svelte`
- `src/routes/parts/+page.ts`, `src/routes/parts/+page.svelte`
- `src/routes/parts/[cluster]/+page.server.ts`, `+page.svelte`
- `src/routes/parts/[cluster]/[brand]/+page.server.ts`, `+page.svelte`
- `seo/SEO_KEYWORD_PLAN.md`, `SEO_KEYWORD_IMPLEMENTATION_REPORT.md`

Modified:
- `src/lib/guides.ts` (category-aware type + 6 new articles)
- `src/routes/guides/[slug]/+page.server.ts`, `+page.svelte` (dynamic category/labels)
- `src/routes/sitemap-static.xml/+server.ts` (landing + parts routes)
- `src/lib/components/Footer.svelte` (parts links)
