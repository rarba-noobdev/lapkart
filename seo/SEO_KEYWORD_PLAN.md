# LapKart SEO Keyword Plan

Internal planning derived from `lapkart-clean-seo-keywords-research.xlsx`
(parsed to `.firecrawl/seo-keywords.md`). Source of truth = the **Relevant Keywords**
sheet (2,039 high-confidence) + reviewed **Review Queue** (337). Scope: laptop replacement
parts only. Mobile / phone / software / service-center keywords are out of scope and were
already removed upstream (10,620 removed, 81.7%).

## 1. Keyword classification

| Class | Page type | Examples | Where it lives |
| --- | --- | --- | --- |
| Category landing | `/parts/<cluster>` | laptop battery, laptop charger, laptop keyboard, laptop screen, laptop cooling fan | New indexable routes |
| Brand + part landing | `/parts/<cluster>/<brand>` | dell laptop battery, hp laptop charger, lenovo laptop battery | New indexable routes |
| Product-support | existing `/product/[id]` | exact part numbers, model-specific codes | Already covered by Postgres search + product schema |
| Blog / guide | `/guides/<slug>` | laptop battery price, how to choose laptop charger, vertical lines on laptop screen, laptop not turning on | Guides system (extended) |
| FAQ | inline on landing + guide | "how do I find my battery", "30-pin vs 40-pin" | Visible FAQ + FAQPage schema |
| Ignore | — | mobile, phone parts, software how-to, service center, "near me" store intent | Not targeted |
| Owner review | — | competitor brand names, generic component terms without catalog fit | See §3 |

## 2. Cluster priorities (clean volume, KD, inventory)

| Cluster | Clean vol | Inventory (active) | Priority | Reason |
| --- | --- | --- | --- | --- |
| Charger/Adapter | 257,340 | 800 | **P1** | Top volume, strong inventory across HP/Dell/Lenovo/Acer |
| Keyboard | 256,370 | 405 | **P1** | High volume, good brand coverage |
| Battery | 255,590 | 819 | **P1** | High volume + 547 P1 keywords, deep inventory |
| Screen/Display | 200,900 | 6,993 | **P1** | Largest inventory; existing screen guides already live |
| Fan/Cooling | 14,930 | 244 | **P2** | Decent inventory, strong diagnostic intent |
| RAM/SSD/Storage | 83,260 | **ssd 8, ram 0** | **Hold** | High demand but **no inventory** — landing would be thin. Blog only / owner to stock. |
| General Spares | 22,230 | (hub) | **P1** | Hub page `/parts` builds topical authority + internal linking |
| Motherboard/Ports | 10,430 | dc_jacks 260 | **P3** | Future batch |
| Hinges/Body | 6,840 | hinges (low) | **P3** | Future batch |
| Cable/Internal | 15,460 | speakers 316, flex 258 | **P3** | Future batch |

Brand priority within clusters follows the Landing Pages sheet volume **and** confirmed
inventory: battery → HP/Lenovo/Dell; charger → HP/Dell/Lenovo; keyboard → HP/Dell.

## 3. Review Queue (337 medium-confidence) — decisions

Decided by rule (the queue is uniform "generic component / possible fit only if mapped to a
matching catalog category"). Per-keyword reasons follow these rules rather than 337 hand-typed
rows (stated honestly):

| Rule | Decision | Reason | Example keywords |
| --- | --- | --- | --- |
| Generic component term that maps to a stocked cluster | **Keep (supporting)** | We have the category; use as supporting keyword on the cluster landing, not a new page | charger adapter, 65w charger, power adapter, universal charger, ac adapter, lapcare keyboard (as keyboard support) |
| Generic RAM/SSD spec terms | **Owner review** | High intent but **no RAM/SSD inventory**; do not publish a thin page. Revisit when stocked | 512 gb ssd price, ssd 128gb, 8gb ddr4 ram 3200mhz, m.2 ssd 1tb |
| Competitor / other-shop brand names | **Reject** | Branded navigational intent for other stores; not ours to rank for | mcarespareparts, lapcare (as brand), spare parts store |
| "store near me" / local-shop intent | **Reject** | LapKart ships, no physical storefront targeting; weak fit | spare parts store near me, laptop parts shop near me |
| Diagnostic phrases (keys not working, etc.) | **Keep (blog)** | Informational → commercial; route via a guide to the matching part | keyboard keys not working → keyboard guide |

Net Review Queue outcome (rule-based):
- **Keep as supporting keywords:** generic charger/keyboard/adapter terms folded into the
  existing charger/keyboard landings (~120 terms by cluster).
- **Owner review:** RAM/SSD spec terms (~40) — blocked on inventory.
- **Reject:** competitor names + local-store intent (~80).
- Remaining queue terms inherit the same rule by cluster.

## 4. Internal-linking map

- Blog → cluster landing + sibling blog (e.g. battery-price → /parts/laptop-battery + charger guide).
- Cluster landing → brand landings + related cluster + related guides + catalog category.
- Brand landing → sibling brands + parent cluster + guides.
- `/parts` hub → all clusters + top guides.
- Footer → `/parts`, battery, charger, keyboard, screen (site-wide crawlable links).

## 5. Indexability rules applied

- New `/parts/*` routes are server-rendered (real crawlable content), not query-filtered
  catalog URLs (those stay `noindex` when filtered — see `shouldNoIndexPath`).
- One canonical per landing; unique title/meta/H1/FAQ per entry (no thin/duplicate pages).
- FAQPage schema emitted only where the FAQ is visible on the page.
- Landing + guide URLs added to `sitemap-static.xml`.

## 6. Out of scope / follow-up batches

- RAM/SSD, motherboard/DC-jack, hinges/body, internal-cable landings (await inventory / lower
  priority).
- Remaining ~40 brand landings (Asus/Acer/Apple/MSI/Toshiba/Samsung variants) and ~27
  lower-volume blogs from the Blog Ideas sheet.
- Images (owner decision: not implemented this pass; suggestions documented in the report).
