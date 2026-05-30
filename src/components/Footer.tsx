import { Link } from "@tanstack/react-router";
import { Flame, ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative mt-24 bg-[var(--accent-black)] text-white/70 overflow-hidden">
      {/* heat glow accent */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-[260px] w-[260px] rounded-full bg-[var(--heat-100)] opacity-[0.08] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-[300px] w-[300px] rounded-full bg-[var(--heat-100)] opacity-[0.06] blur-[100px]" />

      <div className="relative container mx-auto px-4 pt-16 pb-8">
        {/* Top brand row */}
        <div className="grid gap-12 md:grid-cols-[1.4fr_2fr] pb-12 border-b border-white/8">
          <div>
            <div className="flex items-baseline gap-2">
              <Flame className="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
              <span className="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
                lap<span className="text-[var(--heat-100)]">kart</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-body-medium text-white/60 leading-relaxed">
              India's marketplace for genuine laptop components — RAM, SSDs, batteries, displays.
              Tested. Certified. Delivered fast.
            </p>
            <div className="mt-6 flex items-center gap-2 text-mono-x-small uppercase tracking-[0.16em] text-white/40">
              <span className="size-1.5 rounded-full bg-[var(--accent-forest)] animate-pulse" />
              All systems operational
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <FootCol title="Shop" links={[
              ["All Components", "/products"],
              ["RAM & Storage", "/products"],
              ["Batteries", "/products"],
              ["Displays", "/products"],
            ]} />
            <FootCol title="Company" links={[
              ["About", "#"],
              ["Careers", "#"],
              ["Press", "#"],
              ["Contact", "#"],
            ]} />
            <FootCol title="Help" links={[
              ["Shipping", "#"],
              ["Returns", "#"],
              ["Warranty", "#"],
              ["FAQ", "#"],
            ]} />
            <FootCol title="Legal" links={[
              ["Privacy", "#"],
              ["Terms", "#"],
              ["Security", "#"],
              ["EPR", "#"],
            ]} />
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col items-start justify-between gap-4 pt-8 sm:flex-row sm:items-center">
          <p className="text-mono-x-small uppercase tracking-[0.16em] text-white/40">
            © {new Date().getFullYear()} lapkart · Built in Bengaluru
          </p>
          <div className="flex items-center gap-6 text-mono-x-small uppercase tracking-wider text-white/40">
            <span>v0.4.2</span>
            <span className="text-white/20">/</span>
            <span>Made with <span className="text-[var(--heat-100)]">heat</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-4 text-mono-x-small uppercase tracking-[0.18em] text-white/40">{title}</h3>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link
              to={href}
              className="group inline-flex items-center gap-1 text-body-small text-white/75 hover:text-[var(--heat-100)] transition-colors"
            >
              {label}
              <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
