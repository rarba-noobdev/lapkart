import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { discountPct, formatINR } from "@/lib/catalog";
import { useProduct, useProducts } from "@/lib/products-db";
import { ProductCard } from "@/components/ProductCard";
import { cart } from "@/lib/cart-store";
import { Star, ShoppingCart, Zap, ShieldCheck, Truck, RotateCcw, Check, ArrowUpRight, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/product/$id")({
  head: () => ({ meta: [{ title: "Product — lapkart" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data: p, isLoading } = useProduct(id);
  const { data: allProducts = [] } = useProducts();
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const nav = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="grid place-items-center py-32">
          <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">404 / not_found</p>
          <h1 className="mt-3 font-display text-title-h3 text-foreground">Product not found</h1>
          <Link to="/products" className="button button-primary mt-6 inline-flex items-center gap-2 rounded-md px-5 h-10 text-label-medium">
            Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const related = allProducts.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 6);

  const addToCart = () => {
    cart.add(p.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <nav className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
          <Link to="/" className="hover:text-[var(--heat-100)] transition-colors">home</Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <Link to="/products" className="hover:text-[var(--heat-100)] transition-colors">catalog</Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <span className="text-[var(--heat-100)] line-clamp-1 inline-block max-w-[280px] align-bottom">{p.title}</span>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
          {/* Gallery */}
          <div className="md:sticky md:top-28 md:self-start space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-muted)] bg-white">
              {discountPct(p) >= 30 && (
                <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2.5 py-1 text-mono-x-small font-medium text-white shadow-[0_2px_8px_0_var(--heat-40)] tracking-wide">
                  −{discountPct(p)}% off
                </span>
              )}
              <img src={(p.images?.[imgIdx]) ?? p.image} alt={p.title} className="size-full object-contain p-10" />
            </div>
            {p.images && p.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {p.images.map((url, i) => (
                  <button
                    key={url}
                    onClick={() => setImgIdx(i)}
                    className={`shrink-0 rounded-md border overflow-hidden size-16 bg-[var(--background-lighter)] transition-all ${i === imgIdx ? 'border-[var(--heat-100)] ring-2 ring-[var(--heat-12)]' : 'border-[var(--border-faint)] opacity-70 hover:opacity-100'}`}
                  >
                    <img src={url} alt="" className="size-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={addToCart}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--heat-100)] bg-white text-[var(--heat-100)] h-12 text-label-medium font-medium transition-all hover:bg-[var(--heat-4)]"
              >
                {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                {added ? "Added" : "Add to cart"}
              </button>
              <button
                onClick={() => { cart.add(p.id, 1); nav({ to: "/cart" }); }}
                className="button button-primary flex flex-1 items-center justify-center gap-2 rounded-md h-12 text-label-medium"
              >
                <Zap className="size-4 fill-current" /> Buy now
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--heat-100)]">{p.brand}</p>
              <h1 className="mt-2 font-display text-title-h3 text-foreground text-balance leading-tight">{p.title}</h1>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="inline-flex items-center gap-1 text-body-large text-foreground">
                <Star className="size-4 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
                {p.rating.toFixed(1)}
              </span>
              <span className="text-mono-small text-[var(--black-alpha-48)]">
                {p.reviews.toLocaleString("en-IN")} ratings
              </span>
              <span className="size-1 rounded-full bg-[var(--accent-forest)]" />
              <span className="text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">in stock</span>
            </div>

            <div className="flex items-baseline gap-4 border-b border-[var(--border-faint)] pb-6">
              <span className="font-display text-title-h2 text-foreground">{formatINR(p.price)}</span>
              <span className="text-body-large text-[var(--black-alpha-40)] line-through">{formatINR(p.mrp)}</span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--accent-forest)]/10 text-[var(--accent-forest)] px-2 py-0.5 text-mono-small font-medium">
                {discountPct(p)}% off
              </span>
            </div>
            <p className="-mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              inclusive of taxes · free delivery on ₹999+
            </p>

            <div>
              <h3 className="mb-3 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">Highlights</h3>
              <ul className="space-y-2.5">
                {p.highlights.map((h: string) => (
                  <li key={h} className="flex gap-3 text-body-medium text-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--heat-100)]" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-5">
              <Row k="Compatibility" v={p.compatibility} />
              <Row k="Warranty" v={p.warranty} />
              <Row k="Stock" v={p.stock > 0 ? `${p.stock} units available` : "Out of stock"} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { i: Truck, t: "Free delivery" },
                { i: ShieldCheck, t: "Genuine product" },
                { i: RotateCcw, t: "7-day returns" },
              ].map(({ i: Icon, t }) => (
                <div
                  key={t}
                  className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-faint)] bg-white py-4 text-center"
                >
                  <Icon className="size-5 text-[var(--heat-100)]" strokeWidth={2.2} />
                  <span className="text-label-small text-foreground">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">also in catalog</span>
                <h2 className="mt-2 font-display text-title-h4 text-foreground">Similar products</h2>
              </div>
              <Link to="/products" className="group inline-flex items-center gap-1 text-label-small text-foreground hover:text-[var(--heat-100)] transition-colors">
                View all <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((r) => (
                <ProductCard key={r.id} p={r} />
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-body-small">
      <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)] pt-0.5">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
