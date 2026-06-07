# India Legal Compliance Checklist for a Vibe-Coded App

> Not legal advice. Use this as an engineering/legal readiness checklist, then have a lawyer review before launch, especially if your app handles money, health, children, credit, gambling/gaming, UGC, AI-generated media, identity/KYC, or regulated sectors.

## 0. First: classify the app

Ask these before coding compliance:

- [ ] Does the app collect personal data? If yes, DPDP compliance is mandatory.
- [ ] Does it use AI to create/edit/generate images, video, voice, avatars, deepfakes, documents, or posts? If yes, add synthetic-content controls.
- [ ] Does it let users post, upload, comment, message, list products, or share content? If yes, treat it as an intermediary/UGC platform.
- [ ] Does it sell goods/services, subscriptions, digital products, bookings, or paid plans to consumers? If yes, add consumer/e-commerce compliance.
- [ ] Does it collect payments directly, hold money, operate wallets, issue prepaid value, or offer UPI/payment flows? If yes, do not build regulated payment rails without RBI/NPCI counsel; use licensed payment providers unless you are licensed.
- [ ] Does it market through SMS/voice/WhatsApp/email/push? If yes, add consent and unsubscribe/DND controls.
- [ ] Does it target children under 18 or likely attract them? If yes, add age gate, verifiable parental consent, no behavioural tracking/ads profiling unless reviewed.
- [ ] Does it process health, finance, Aadhaar/KYC, biometrics, government IDs, location, sexual content, political opinions, or employment data? If yes, treat as high-risk.

## 1. Mandatory baseline pages/components

### Public pages/screens

- [ ] Privacy Notice / Privacy Policy
- [ ] Terms of Service / User Agreement
- [ ] Contact page with legal entity name, address, support email, and grievance contact
- [ ] Consent management screen
- [ ] Account deletion / data deletion flow
- [ ] Refund, cancellation, shipping/delivery, exchange, warranty page if selling anything
- [ ] Community Guidelines if user-generated content exists
- [ ] Report Abuse / Report Content flow if UGC or AI-generation exists
- [ ] Cookie policy and cookie consent banner if using cookies/trackers on web
- [ ] AI-generated content disclosure if AI media/content features exist
- [ ] Open-source notices page if using OSS packages that require attribution

### Internal/admin requirements

- [ ] Data inventory: every field collected, purpose, storage location, retention, processor/vendor, deletion rule
- [ ] Consent ledger: user ID, consent text/version, purpose, timestamp, source screen, withdrawal timestamp
- [ ] Data processor/vendor register with DPAs/security obligations
- [ ] Incident response plan
- [ ] Grievance ticketing system with SLA fields
- [ ] Audit log for consent, deletion, admin access, security incidents, payment/refund events
- [ ] Role-based admin access and MFA
- [ ] Backups with retention/deletion handling

## 2. DPDP Act + DPDP Rules implementation checklist

The Digital Personal Data Protection Act, 2023 applies to digital personal data processed in India and also outside India where processing is connected with offering goods/services to people in India. The Act requires lawful processing, notice, consent or recognised uses, rights handling, and security safeguards. The Digital Personal Data Protection Rules, 2025 were notified on 13 November 2025; Rules 1, 2 and 17-21 came into force on publication, Rule 4 comes into force one year after publication, and Rules 3, 5-16, 22 and 23 come into force eighteen months after publication.

### Engineering tasks

- [ ] Collect only data needed for each purpose.
- [ ] Show a clear standalone privacy notice before or at data collection.
- [ ] Notice must include: itemised personal data, specific purposes, goods/services enabled by processing, consent withdrawal method, rights request method, grievance method, and contact person/DPO details.
- [ ] Give consent in clear affirmative action; do not use pre-ticked boxes.
- [ ] Store consent proof.
- [ ] Withdrawal must be as easy as giving consent.
- [ ] On withdrawal, stop processing and instruct processors to stop unless retention is legally required.
- [ ] Provide access, correction, completion, update, erasure, grievance, and nomination workflows.
- [ ] Publish a grievance response period and implement it technically.
- [ ] Implement reasonable security safeguards: encryption in transit and at rest, access control, logging, vulnerability management, backup, breach detection.
- [ ] Maintain processor contracts requiring confidentiality, security, breach support, deletion assistance, and no sub-processing without approval.
- [ ] Have breach notification playbook for the Data Protection Board and affected users.
- [ ] For children: age gate; verifiable parental consent before processing child data; disable behavioural monitoring/profiling/targeted ads unless reviewed by counsel.
- [ ] Implement deletion/retention rules by purpose. Do not keep inactive accounts forever unless legally required.

## 3. IT Rules / intermediary / UGC checklist

If the app hosts/transmits user content, profiles, posts, messages, comments, reviews, listings, files, or AI outputs from users, add this.

- [ ] Publish rules, privacy policy, and user agreement prominently in English or an Eighth Schedule language chosen by the user.
- [ ] Inform users that prohibited content includes unlawful, harmful, infringing, obscene, invasive of privacy, impersonation, false/misleading, child sexual abuse, non-consensual intimate imagery, malware, and other illegal content.
- [ ] Re-inform users of rules at least every 3 months.
- [ ] Appoint/publish grievance officer name and contact.
- [ ] Acknowledge grievances within 24 hours and resolve within 7 days where applicable.
- [ ] For complaints involving impersonation, artificially morphed images, or similar personal harm, provide fast removal/disablement handling.
- [ ] Preserve logs/evidence for reported content and moderation decisions.
- [ ] Add content reporting UI on every UGC item.
- [ ] Add admin moderation queue, audit trail, notice-to-user, appeal flow, and repeat-offender controls.

## 4. AI-generated / synthetic content checklist

If the app creates, edits, modifies, shares, publishes, or disseminates AI-generated audio, image, video, or audiovisual content:

- [ ] Add policy that users cannot create illegal synthetic content.
- [ ] Block child sexual abuse material, non-consensual intimate imagery, obscene/sexually explicit illegal content, false electronic records, weapons/explosives instructions, and deceptive impersonation.
- [ ] Label synthetic audio/visual/audiovisual output prominently.
- [ ] For audio, prepend an audio disclosure where required.
- [ ] Embed metadata/watermark where technically feasible.
- [ ] Add user declaration: “Is this AI-generated or modified?” before upload/publish.
- [ ] Add reporting route for deepfake/impersonation complaints.
- [ ] Log prompt, output ID, model, timestamp, user ID, label status, and safety action.

## 5. Consumer protection / e-commerce checklist

If selling goods/services, subscriptions, digital products, bookings, courses, SaaS plans, marketplace services, or in-app purchases to consumers:

- [ ] Show legal entity name.
- [ ] Show principal geographic address/headquarters and branches if applicable.
- [ ] Show website/app details.
- [ ] Show customer care and grievance officer email/mobile/landline if available.
- [ ] Appoint consumer grievance officer and show name/contact/designation.
- [ ] Grievance officer should acknowledge consumer complaints within 48 hours and redress within 1 month.
- [ ] Do not use pre-ticked consent for purchases.
- [ ] State total price, breakup of charges, taxes, fees, shipping, subscription renewal, cancellation, refund timeline.
- [ ] Publish refund, return, exchange, warranty, guarantee, delivery/shipment, payment method security, chargeback/cancellation details.
- [ ] Provide ticket number and complaint status tracking.
- [ ] For marketplace: disclose seller details, seller address, customer care, ratings/feedback, ranking parameters, and differentiated treatment.
- [ ] Do not manipulate price or discriminate arbitrarily between same-class consumers.

## 6. Payments / fintech checklist

- [ ] Prefer using licensed payment aggregators/gateways for card/UPI/netbanking.
- [ ] Do not hold customer funds, operate wallet/PPI, issue stored value, run UPI TPAP, or settle merchant money unless licensed/approved.
- [ ] If only integrating Razorpay/Stripe/Cashfree/PayU/etc., store only payment IDs, order IDs, and status; avoid storing card data.
- [ ] Implement refund webhook reconciliation.
- [ ] Maintain invoice, order, payment, refund audit logs.
- [ ] Add payment failure and refund support flow.
- [ ] If becoming a payment aggregator, consult RBI counsel; PA framework includes licensing, capital, governance, merchant due diligence, escrow/settlement, cybersecurity, and grievance obligations.

## 7. Marketing communications checklist

- [ ] Separate transactional, service, and promotional communications.
- [ ] Keep explicit opt-in for promotional SMS/calls/WhatsApp/email.
- [ ] Provide unsubscribe/opt-out.
- [ ] Do not send promotional SMS/calls to DND users except as permitted through registered consent/templates.
- [ ] Use DLT-registered headers/templates for bulk SMS in India.
- [ ] Log consent: channel, purpose, timestamp, copy of message, source.

## 8. IP / code provenance checklist for vibe-coded apps

- [ ] Keep repository ownership under your legal entity/founder.
- [ ] Add LICENSE file.
- [ ] Run license scanner for dependencies.
- [ ] Keep OSS attribution notices.
- [ ] Avoid copying proprietary code from Stack Overflow, GitHub, blogs, or AI outputs unless licence permits.
- [ ] Save AI prompts and outputs that materially generate code/designs for provenance.
- [ ] Search app name/logo in Indian trademark database before launch.
- [ ] Register trademark for brand if serious.
- [ ] Add user content licence in Terms: user owns content but grants app a limited licence to host/process/display it.
- [ ] Add DMCA-like/IP complaint workflow even though India uses its own legal framework.

## 9. Security checklist

- [ ] HTTPS everywhere; HSTS on web.
- [ ] Password hashing with Argon2id/bcrypt; never plain passwords.
- [ ] MFA for admins.
- [ ] RBAC for admin panels.
- [ ] Input validation and output escaping.
- [ ] CSRF/XSS/SQLi protections.
- [ ] Rate limits for login, OTP, password reset, AI generation, uploads, payment attempts.
- [ ] File upload scanning, content-type validation, size limits, private buckets.
- [ ] Secrets in secret manager, not `.env` committed.
- [ ] Dependency scanning and regular updates.
- [ ] Audit logs for admin access and personal-data access.
- [ ] Data encryption at rest for sensitive fields.
- [ ] Backups tested; deletion propagation documented.
- [ ] Incident response runbook.

## 10. Copy-paste prompts for coding agent

### Prompt 1 — compliance discovery

```text
Act as a senior Indian app compliance engineer. Inspect this codebase and produce a compliance gap report for an India-facing app. Identify whether the app collects personal data, has user-generated content, AI-generated content, payments, subscriptions, e-commerce, children, health/finance/ID data, marketing communications, cookies, or marketplace features. Output: risk classification, missing legal pages, missing backend tables, missing UI flows, missing admin workflows, and prioritized implementation tasks. Do not write generic advice; cite exact files/routes/components/db tables you inspected.
```

### Prompt 2 — privacy notice generator

```text
Create a DPDP-ready Privacy Notice implementation for this app. First scan all forms, API routes, database schema, analytics SDKs, auth providers, payment providers, AI providers, storage buckets, logs, and third-party APIs. Build a data inventory table with: data field, source screen/API, purpose, legal basis/consent purpose, retention, processor, user rights supported, deletion method. Then generate /privacy page content and in-app short notices shown before collection. Add versioning for privacy notice and consent text.
```

### Prompt 3 — consent ledger

```text
Implement a consent management system. Requirements: consent_purposes table, user_consents table, consent versioning, source screen, timestamp, IP/user-agent where appropriate, withdrawal timestamp, audit log, API to grant/withdraw/list consents, and UI in account settings. Withdrawal must be as easy as giving consent. Add tests for granting, withdrawing, and checking consent before processing optional analytics/marketing/AI-training purposes.
```

### Prompt 4 — data deletion and rights requests

```text
Implement India DPDP-style user rights workflows: access/export, correction, update, erasure, grievance, and account deletion. Add authenticated user routes, admin queue, SLA fields, email/in-app notifications, identity verification for sensitive requests, deletion propagation to primary DB, object storage, analytics where possible, and processors where supported. Keep minimal legal/audit records where required. Add tests and admin UI.
```

### Prompt 5 — grievance officer and ticketing

```text
Build a grievance redressal module. Publicly expose legal entity contact, grievance officer name/designation/email, and complaint form. Store ticket number, complainant, category, related content/order/payment, timestamps, status, SLA deadline, assigned admin, action taken, resolution note, appeal/escalation status. Send acknowledgement automatically. Add dashboards for 24h, 48h, 7-day, 15-day, and 30-day SLAs because obligations differ by feature category.
```

### Prompt 6 — UGC/intermediary safety

```text
If this app has UGC, implement intermediary compliance features: Community Guidelines, prohibited content policy, report button on every content item, moderation queue, content disable/remove actions, user notice, appeal flow, repeat offender detection, audit logs, preservation of evidence, and admin search. Add checks for impersonation, privacy invasion, IP infringement, CSAM, non-consensual intimate imagery, malware, illegal goods/services, and misleading/fraud content.
```

### Prompt 7 — AI synthetic content labelling

```text
If this app creates, edits, uploads, or shares AI-generated audio, image, video, or audiovisual content, implement synthetic content compliance. Add user declaration before upload/publish, automated metadata detection where possible, visible label/watermark for visual media, prefixed audio disclosure for audio, metadata embedding, blocked-content safety rules, report deepfake/impersonation flow, and logs linking user, prompt, model, output, safety result, and label status.
```

### Prompt 8 — e-commerce disclosures

```text
If this app sells anything, implement consumer/e-commerce disclosures. Add pages/components for legal entity name, address, support, grievance officer, total price, taxes, fees, delivery/shipping, cancellation, refund, return, exchange, warranty, guarantee, payment methods, payment security, chargeback/cancellation of recurring payments, complaint ticket tracking, and explicit purchase consent. Ensure no pre-ticked purchase consent boxes. Add order/refund status events and emails.
```

### Prompt 9 — marketplace seller compliance

```text
If this app is a marketplace, add seller onboarding and disclosure compliance. Store seller legal name, business name, registration status, geographic address, customer care, GST/PAN where needed, policies, ratings, product/service accuracy undertaking, and grievance contact. Show seller details to consumers. Add ranking-parameter disclosure and differentiated-treatment disclosure. Add repeat infringer/offender tracking for IP and legal removals.
```

### Prompt 10 — security hardening

```text
Perform a security hardening pass. Add HTTPS/HSTS, secure cookies, CSRF protection, input validation, output escaping, rate limits, password hashing, MFA for admins, RBAC, audit logs, secret scanning, dependency scanning, file upload validation, malware scanning hooks, encryption for sensitive fields, backup/restore tests, deletion propagation, and incident response logging. Create a SECURITY.md and incident_response.md.
```

## 11. Launch gate

Do not launch until:

- [ ] Privacy notice, Terms, refund/cancellation, grievance, and contact pages are live.
- [ ] Consent ledger works.
- [ ] Account deletion and data deletion work.
- [ ] Admin grievance/moderation dashboards work.
- [ ] Payments are through licensed providers unless separately licensed.
- [ ] All third-party processors are listed.
- [ ] Security checklist is passed.
- [ ] Lawyer reviews sector-specific risk.

## 12. Source list for legal review

- Digital Personal Data Protection Act, 2023 — MeitY / Gazette.
- Digital Personal Data Protection Rules, 2025 — MeitY / Gazette.
- Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, updated 10 Feb 2026 — MeitY.
- Consumer Protection (E-Commerce) Rules, 2020.
- RBI payment aggregator/payment security directions, if payment business is regulated.
- TRAI TCCCPR/DND framework for commercial SMS/voice.
- Copyright Act / Copyright Office software FAQ; Trade Marks Act / IP India trademark search.
