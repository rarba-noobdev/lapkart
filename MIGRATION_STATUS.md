# SvelteKit Migration Status

Frontend migration is complete. The repo root now runs on Svelte 5 and SvelteKit 2.

What is in the SvelteKit app:

- root frontend tooling, Vite config, and Vercel adapter
- shared design system and Tailwind v4 styles
- Supabase auth, cart, catalog, order, and admin data access
- storefront routes: `/`, `/products`, `/product/[id]`, `/cart`
- checkout with delivery pin capture, courier quoting, coupon preview, COD gating, and Razorpay handoff
- account routes: `/login`, `/dashboard`, `/orders`, `/order/[id]`
- static content routes
- admin analytics, catalog CRUD, coupon CRUD, role/profile edits, fulfillment actions, support inbox, order lifecycle updates, returns, and refunds
- Svelte MCP agent guidance in `AGENTS.md` and `.mcp.json`

Validation notes:

- `npm run check` should pass cleanly on the migrated app.
- `npm run build` compiles the SvelteKit app, but on this Windows machine the Vercel adapter can still fail at the final symlink step with `EPERM` even when the client and server builds are otherwise valid.

Removed during finalization:

- `legacy-react-src/`
- obsolete migration-era config and docs references
