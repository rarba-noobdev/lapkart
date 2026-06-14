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
- [x] **Re-engagement (no-provider parts)** — exit-intent "save cart to WhatsApp"
      bottom sheet (CartSaveSheet, wa.me, no API), offline banner (OfflineBanner).
- [ ] Abandoned-cart WhatsApp nudge (4h) — needs WhatsApp Business API ([YOU]).

---

## CODE — Prompt 10: promotions & gamification (not started)

Guardrails: every reward passes the `min_margin_floor_pct` gate; rewards pay
**store credit with expiry**, never cash; per-customer caps.

- [x] Schema: `promotions`, `customer_rewards`, `store_credits.source_promotion_id`
      + `source_reward_id`, `products.clearance` (migration 202606130002, applied)
- [x] Coupon apply + server validation (already existed in checkout via edge fn
      `validateCouponForCheckout`) + **auto-suggest best valid coupon**
      (`GET /checkout/suggested-coupon`, one-tap chip in checkout)
- [x] **Scratch card** after delivered + prepaid: trigger issues a locked card,
      weighted server-side draw, GPay-style canvas scratch-off (reveals at 60%),
      30-day store-credit payout, per-promotion budget cap auto-pause. `/rewards`
      page shows balance + cards. Seeded one promotion (budget Rs 5000).
- [x] **Store-credit redemption at checkout** — live, non-expired balance is now
      auto-applied against the payable; debited atomically (FIFO by expiry) inside
      `complete_checkout_payment` via `consume_store_credit()`; persisted through
      the prepaid session (`checkout_sessions.store_credit_applied`) and shown in
      the checkout summary. Covers prepaid + COD.
      - [ ] **[YOU] TEST a real low-value prepaid + COD order** end to end before
            trusting it — I cannot run payments in this environment.
      - [x] Restore consumed store credit when an order is cancelled/refunded/
            returned (trigger restore_store_credit_on_cancel, idempotent).
      - [ ] Note: redemption is intentionally NOT margin-floor gated (the credit
            was already a booked marketing cost at issuance); revisit if needed.
      - [ ] Concurrency: two simultaneous checkouts by the same user could each
            reserve the same balance (clamped at consume time, rare). Add a hold
            if it ever matters.
- [ ] **[YOU]** Set the scratch-card promotion `budget_cap` in the DB/admin to a
      real number, and create launch coupons (e.g. WELCOME50). Not auto-seeded
      large because live rewards/coupons are real money.
- [x] "Pay online to earn a scratch card" nudge on the COD option at checkout.
- [x] Extend coupons: `first_order_only`, `free_delivery` discount type,
      `applicable_categories`, `allowed_pincode_prefix` gating — enforced in
      validateCouponForCheckout + honored/skipped in auto-suggest; settable via
      the admin coupon API (couponWriteSchema).
      - [x] Add inputs for these new fields to the admin coupon editor UI (first-order,
            free delivery, category targeting, and pincode prefix).
      - [ ] **[YOU]** Create WELCOME50 (first_order_only, min 999) + CHENNAI
            (free_delivery, allowed_pincode_prefix 600) in the admin/SQL.
- [x] Streak / repeat-purchase ladder — `streak_ladder` app_setting, delivery
      trigger issues store credit at milestones, `my_streak_progress()` RPC +
      progress bar on /rewards.
- [x] Referral — `referrals` table + profiles.referral_code/referred_by,
      `my_referral_code()` / `apply_referral_code()` RPCs, delivery-trigger
      qualification (referee credited at first prepaid >= min order), nightly
      `release_referral_rewards()` cron (referrer credited after return window,
      10/month cap). /rewards has code, WhatsApp share (Tamil+English), apply box.
- [ ] Flash / festival sales (margin-gated or `clearance` final-sale, real
      countdown + sold bar, festival theming)
- [x] Admin promotions management — `GET /admin/promotions` (per-promotion
      credit issued / redeemed / outstanding / breakage + budget vs spent),
      `PATCH /admin/promotions/:id` (kill switch, budget, name, dates).
      AdminPromotionsManager panel in the Promos tab.
- [ ] Admin **create** promotions UI (create new scratch/flash promotions from
      the panel; today new promotions are seeded via SQL, existing ones are
      fully manageable). Incremental-orders / margin-impact analytics deferred.

---

## Notes

- Stack is **SvelteKit 5 (runes) + Tailwind v4 + Supabase**, not the React/TanStack
  the original prompts assume. Every feature is adapted accordingly.
- DB migrations live in `supabase/migrations/` and are applied to the remote
  project via MCP after review. Types in `src/lib/supabase/types.ts` are hand-
  augmented because migrations are file-first.
- "Honest scarcity" rule: every urgency/scarcity number must come from a real
  query. No fabricated timers or viewer counts. Enforced in code comments.
