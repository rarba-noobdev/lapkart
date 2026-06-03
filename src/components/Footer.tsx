import { Link } from "@tanstack/react-router";
import { Flame, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Footer() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <footer className="relative mt-24 overflow-hidden bg-[var(--accent-black)] text-white/70">
      <div className="relative container mx-auto px-4 pb-8 pt-16">
        <div className="grid gap-12 border-b border-white/8 pb-12 md:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-baseline gap-2">
              <Flame className="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
              <span className="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
                lap<span className="text-[var(--heat-100)]">kart</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-body-medium leading-relaxed text-white/60">
              {isAdmin
                ? "Operations workspace for catalog control, user management, order edits, and fulfillment."
                : "India's marketplace for genuine laptop components, from RAM and SSDs to batteries, displays, and replacement hardware."}
            </p>
            <p className="mt-6 text-mono-x-small uppercase tracking-[0.16em] text-white/40">
              {isAdmin ? "Admin-only session" : "Fast dispatch, secure checkout, verified sourcing"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <FootCol
              title={isAdmin ? "Operations" : "Shop"}
              items={
                isAdmin
                  ? [
                      { label: "Admin dashboard", to: "/admin" },
                      { label: "Storefront preview", to: "/products" },
                      { label: "Catalog management", to: "/admin" },
                      { label: "Order queue", to: "/admin" },
                    ]
                  : [
                      { label: "All components", to: "/products" },
                      { label: "Cart", to: "/cart" },
                      { label: "Orders", to: "/orders" },
                      { label: "Account", to: "/dashboard" },
                    ]
              }
            />
            <FootCol
              title={isAdmin ? "Catalog" : "Categories"}
              items={
                isAdmin
                  ? [
                      { label: "Pricing control" },
                      { label: "Stock updates" },
                      { label: "Media and specs" },
                      { label: "Archive unused SKUs" },
                    ]
                  : [
                      { label: "RAM and storage" },
                      { label: "Displays" },
                      { label: "Batteries" },
                      { label: "Processors" },
                    ]
              }
            />
            <FootCol
              title={isAdmin ? "Fulfillment" : "Support"}
              items={
                isAdmin
                  ? [
                      { label: "Shiprocket queue" },
                      { label: "AWB assignment" },
                      { label: "Pickup scheduling" },
                      { label: "Tracking refresh" },
                    ]
                  : [
                      { label: "Fast dispatch across India" },
                      { label: "7-day returns" },
                      { label: "Warranty-backed parts" },
                      { label: "Secure Razorpay checkout" },
                    ]
              }
            />
            <FootCol
              title="Access"
              items={
                isAdmin
                  ? [
                      { label: "Admin dashboard", to: "/admin" },
                      { label: "Storefront preview", to: "/products" },
                      { label: "Sign in", to: "/login" },
                    ]
                  : [
                      { label: "Sign in", to: "/login" },
                      { label: "Customer dashboard", to: "/dashboard" },
                      { label: "Admin dashboard", to: "/admin" },
                    ]
              }
            />
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
          <p className="text-mono-x-small uppercase tracking-[0.16em] text-white/40">
            {new Date().getFullYear()} LapKart.{" "}
            {isAdmin ? "Operations console." : "Genuine parts marketplace."}
          </p>
          <div className="text-mono-x-small uppercase tracking-wider text-white/40">
            Bengaluru service desk · Monday to Saturday
          </div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; to?: string }>;
}) {
  return (
    <div>
      <h3 className="mb-4 text-mono-x-small uppercase tracking-[0.18em] text-white/40">{title}</h3>
      <ul className="space-y-2.5">
        {items.map(({ label, to }) => (
          <li key={label}>
            {to ? (
              <Link
                to={to}
                className="group inline-flex items-center gap-1 text-body-small text-white/75 transition-colors hover:text-[var(--heat-100)]"
              >
                {label}
                <ArrowUpRight className="size-3 -translate-x-1 opacity-0 transition-[transform,opacity] group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
            ) : (
              <span className="text-body-small text-white/55">{label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
