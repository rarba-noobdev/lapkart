# LapKart — Outstanding Work

Living checklist. Two kinds of items: **[CODE]** = I (the agent) build it; **[YOU]** =
manual step only you can do (secrets, paid providers, legal text, device hardware,
dashboard toggles). Updated as work lands.

---

## YOU — manual steps blocking go-live

These cannot be done from code. Nothing below is optional for a real launch.

- [ ] **Register the Shiprocket webhook** — Shiprocket panel → Settings → API → Webhooks.
  - URL: `https://jcktbslbbidjqwpgvsid.supabase.co/functions/v1/api/logistics/events`
  - Auth type: **API Key** header, key name `x-api-key`
  - Token: `7ff6fbf1df2021bfc664d29472f9bbc311eec6dbc4a30c45` (already set as the
    `SHIPROCKET_WEBHOOK_TOKEN` Supabase secret and in local `.env`)
  - Enable the toggle. Until this is done, order tracking is not webhook-driven.
- [ ] **Supply real legal values** for the contact / policy pages (DPDP + IT Rules + Consumer Protection):
  - Registered legal entity name
  - Principal place of business (full address)
  - Grievance Officer name + designation + contact (email/phone)
  - Hand these to me and I will wire them into `/contact` and the policy pages.
- [ ] **Enable leaked-password protection** — Supabase Dashboard → Authentication →
  Policies → turn on "Leaked password protection" (HaveIBeenPwned).
- [ ] **Razorpay live keys** — set `VITE_RAZORPAY_KEY_ID` (client) and
  `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (edge secrets) to live values, then
  do one real low-value payment to confirm the CSP allows the Razorpay iframe.
- [ ] **SMS / OTP provider** (only if we ship guest phone-OTP checkout) — Supabase
  phone auth needs an SMS provider (Twilio / MSG91 / etc). This costs money per SMS.
  Decide provider + fund it, or we keep email-based auth.
- [ ] **WhatsApp Business API** (for abandoned-cart + referral share + review nudge) —
  set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and approve message
  templates with Meta. Until then those features stay as logged stubs.
- [ ] **Rebuild the Android APK** so the `MainActivity.java` host-validation change
  ships (needs a build; I cannot run the Android toolchain here).
- [ ] **Device-test** navbar / skeleton / search / sticky ATC bar on a real phone
  once USB is reconnected (adb was dropped this session).

---

## CODE — compliance / security (mostly done)

- [x] CSP + security headers (svelte.config.js, hooks.server.ts)
- [x] Cookie consent banner + Google Consent Mode v2
- [x] DPDP consent ledger + `record_consent` RPC (migration applied)
- [x] DPDP data export (`/profile/export`) + account-deletion request queue (applied)
- [x] Grievance / complaint system: `/grievances` + admin queue (applied)
- [x] Upload hardening: size cap + magic-byte sniffing (deployed)
- [x] Fixed admin cancel bug (`admin_order_events_type_chk`) — applied
- [ ] **Wire grievance-officer details into `/contact`** — blocked on YOU legal values above.
- [ ] Optional: escape PostgREST `.or()` filter interpolation (comma/paren) in
      products.ts + edge fn (low severity, offered earlier).

---

## CODE — admin console (done)

- [x] Command palette (Ctrl/Cmd+K) with live order/product search
- [x] Grouped sidebar, number-key section switching, sticky topbar
- [x] Server-paginated catalog + orders (was capped at 50)
- [x] Per-section redesign: timelines, stage chips, stock dots, usage meters
- [x] Shiprocket webhook handler aligned to documented payload + multi-status filter
- [x] Realtime client heartbeat tuning

---

## CODE — Prompt 9: mobile conversion UI

- [x] Sticky add-to-cart bar (thumb-zone, IntersectionObserver, morph to "Go to cart")
- [x] Honest scarcity badges (real stock <= 5) on cards + PDP "You save Rs X"
- [x] Expanded PDP trust strip
- [x] "FREE delivery" hint on qualifying product cards
- [x] **Dispatch-cutoff countdown** — DispatchCountdown.svelte, driven by
      `manual_cutoff_hour_ist`; switches to "Ships tomorrow" after cutoff
- [x] **Cart fee transparency** — delivery (FREE when unlocked) + COD handling
      fee disclosed in cart, "final price / no hidden charges" microcopy
- [x] **"Ordered N times this week"** badge (N >= 3) — `product_weekly_order_counts`
      materialized view, refreshed nightly via pg_cron (01:00 IST)
- [x] **Recently-bought ticker** — `recent_purchases()` SECURITY DEFINER fn
      (product + city + time only, no PII), RecentlyBought.svelte rotating ticker
- [ ] **Review prompt** 3 days after delivery (one-tap stars) — push/WhatsApp stub
- [ ] **Frictionless checkout** — pincode-first address (auto-fill city/state),
      single-screen accordion, sticky "Pay Rs X"; guest phone-OTP blocked on SMS provider
- [ ] **Re-engagement** — abandoned-cart edge stub (4h, only when stock genuinely
      low), exit-intent "save cart to WhatsApp", PWA offline cart toast

---

## CODE — Prompt 10: promotions & gamification (not started)

Guardrails: every reward passes the `min_margin_floor_pct` gate; rewards pay
**store credit with expiry**, never cash; per-customer caps.

- [ ] Schema: `promotions`, `customer_rewards`, extend `coupons`
      (first_order_only, free_delivery / store_credit types, applicable_categories),
      `store_credits.source_promotion_id`, `products.clearance`
- [ ] `validate_coupon(code, cart, customer_id)` RPC → ok | reason
- [ ] Coupon engine in cart: apply field, inline validation, **auto-suggest best
      valid coupon**; seed WELCOME50 + CHENNAI
- [ ] Scratch card after delivered + prepaid: locked reward, weighted server-side
      draw, canvas scratch-off (reveal at 60%), 30-day credit expiry, budget cap
- [ ] Streak / repeat-purchase ladder (`order_streak`, app_settings ladder,
      progress ring on profile)
- [ ] Referral (both-sides credit, Tamil + English share text, return-window hold,
      10/month cap)
- [ ] Flash / festival sales (margin-gated or clearance, real countdown + sold bar,
      festival theming)
- [ ] Promo analytics in admin (redemptions, breakage, incremental orders, margin
      impact) + per-promotion kill switch

---

## Notes

- Stack is **SvelteKit 5 (runes) + Tailwind v4 + Supabase**, not the React/TanStack
  the original prompts assume. Every feature is adapted accordingly.
- DB migrations live in `supabase/migrations/` and are applied to the remote
  project via MCP after review. Types in `src/lib/supabase/types.ts` are hand-
  augmented because migrations are file-first.
- "Honest scarcity" rule: every urgency/scarcity number must come from a real
  query. No fabricated timers or viewer counts. Enforced in code comments.
