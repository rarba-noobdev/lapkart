# Product

## Register

product

## Users

LapKart serves two primary user groups: customers buying laptop replacement parts and operators managing ecommerce fulfillment. Customers need fast product discovery, secure checkout, saved addresses, order history, and shipment tracking. Admins need reliable catalog, order, coupon, role, return, refund, and fulfillment controls without relying on client-side trust.

## Product Purpose

LapKart is a SvelteKit ecommerce application for verified laptop parts and replacement hardware. Success means customers can confidently buy genuine components while the operations team can manage inventory, payments, logistics, and user roles through backend-enforced workflows.

## Brand Personality

Precise, technical, and reliable. The interface should feel like a focused hardware operations product, not a generic ecommerce template.

## Anti-references

Avoid AI-slop layouts, oversized split-screen auth pages, decorative gradients without purpose, generic SaaS cards, purple-first palettes, fragile client-only state, and UI that hides security gaps behind polished visuals. Preserve the Firecrawl-inspired heat-orange, neutral, border-led design language defined in `design_system.md`.

## Design Principles

1. Security is visible but not theatrical: authentication, roles, and operational state should read as trustworthy without adding fake dashboards or decorative noise.
2. Product work stays task-first: forms, tables, buttons, and status states must be consistent, compact, and predictable.
3. The design system wins: use the existing heat color, Geist typography, border tokens, radius scale, and motion timing before inventing new styling.
4. Motion must clarify state: use short, interruptible transitions for mode changes, loading feedback, hover affordances, and page entrance only.
5. Responsive behavior must be structural: auth, checkout, admin, and order pages should remain usable on mobile without horizontal overflow or oversized panels.

## Accessibility & Inclusion

Target WCAG AA contrast, visible focus states, semantic controls, descriptive labels, keyboard-accessible flows, and reduced-motion fallbacks. Error, loading, disabled, and success states must be readable without relying on color alone.
