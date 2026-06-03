import { Link } from "@tanstack/react-router";
import { Star, ArrowUpRight } from "lucide-react";
import { type Product, discountPct, formatINR } from "@/lib/catalog";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      aria-label={`${p.title} by ${p.brand}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-muted)] bg-white transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:-translate-y-1 hover:border-[var(--heat-20)] hover:shadow-[0_24px_56px_-24px_var(--heat-40),0_4px_12px_-4px_rgba(0,0,0,0.06)]"
    >
      {/* Heat ribbon for sale */}
      {discountPct(p) >= 30 && (
        <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2 py-0.5 text-mono-x-small font-medium text-white shadow-[0_2px_8px_0_var(--heat-40)] tracking-wide">
          −{discountPct(p)}%
        </span>
      )}

      <div className="relative aspect-square overflow-hidden bg-[var(--background-lighter)]">
        <img
          src={p.images?.[0] ?? p.image}
          alt={p.title}
          loading="lazy"
          width={640}
          height={640}
          className="size-full object-contain p-6 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
        />
        {/* Inside border overlay */}
        <span className="pointer-events-none absolute inset-0 border-b border-[var(--border-faint)]" />
        <ArrowUpRight className="absolute top-3 right-3 size-4 text-[var(--black-alpha-32)] transition-[transform,color] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--heat-100)]" />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 py-4">
        <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">
          {p.brand}
        </p>
        <h3 className="line-clamp-2 text-label-small text-foreground leading-snug min-h-[40px]">
          {p.title}
        </h3>

        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-0.5 text-body-small text-foreground">
            <Star className="size-3 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
            {p.rating.toFixed(1)}
          </span>
          <span className="text-mono-x-small text-[var(--black-alpha-40)]">
            ({p.reviews.toLocaleString("en-IN")})
          </span>
        </div>

        <div className="mt-auto pt-3 flex items-baseline gap-2 border-t border-[var(--border-faint)]">
          <span className="text-label-large font-medium text-foreground">{formatINR(p.price)}</span>
          <span className="text-body-small text-[var(--black-alpha-40)] line-through">
            {formatINR(p.mrp)}
          </span>
        </div>
      </div>
    </Link>
  );
}
