import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { type Product, discountPct, formatINR } from "@/lib/catalog";

export function ProductCard({ p }: { p: Product }) {
  return (
    <Link
      to="/product/$id"
      params={{ id: p.id }}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="aspect-square overflow-hidden bg-white">
        <img
          src={p.image}
          alt={p.title}
          loading="lazy"
          width={640}
          height={640}
          className="size-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {p.brand}
        </p>
        <h3 className="line-clamp-2 text-sm font-medium text-foreground">{p.title}</h3>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-sm bg-success px-1.5 py-0.5 text-[11px] font-bold text-success-foreground">
            {p.rating.toFixed(1)} <Star className="size-2.5 fill-current" />
          </span>
          <span className="text-xs text-muted-foreground">({p.reviews.toLocaleString("en-IN")})</span>
        </div>
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-bold text-foreground">{formatINR(p.price)}</span>
          <span className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
          <span className="text-xs font-semibold text-success">{discountPct(p)}% off</span>
        </div>
      </div>
    </Link>
  );
}
