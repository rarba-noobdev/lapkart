import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { discountPct, formatINR, getProduct, products } from "@/lib/catalog";
import { ProductCard } from "@/components/ProductCard";
import { cart } from "@/lib/cart-store";
import { Star, ShoppingCart, Zap, ShieldCheck, Truck, RotateCcw, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }) => {
    const p = getProduct(params.id);
    if (!p) throw notFound();
    return { product: p };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.title} — LapKart` },
          { name: "description", content: loaderData.product.highlights.join(". ") },
          { property: "og:title", content: loaderData.product.title },
          { property: "og:image", content: loaderData.product.image },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <Link to="/products" className="mt-4 inline-block text-primary hover:underline">
          ← Back to all products
        </Link>
      </div>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product: p } = Route.useLoaderData();
  const [added, setAdded] = useState(false);
  const nav = useNavigate();
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 6);

  const addToCart = () => {
    cart.add(p.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <nav className="mb-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">Home</Link> /{" "}
          <Link to="/products" className="hover:text-primary">Products</Link> /{" "}
          <span className="text-foreground">{p.title}</span>
        </nav>

        <div className="grid gap-6 rounded-lg bg-card p-4 shadow-[var(--shadow-card)] md:grid-cols-[1fr_1.2fr] md:p-6">
          {/* Gallery */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="aspect-square overflow-hidden rounded-lg border border-border bg-white">
              <img src={p.image} alt={p.title} className="size-full object-contain p-6" />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={addToCart}
                className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-saffron px-5 py-3 text-sm font-bold text-saffron-foreground shadow-md transition hover:brightness-105"
              >
                {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                {added ? "Added!" : "Add to Cart"}
              </button>
              <button
                onClick={() => {
                  cart.add(p.id, 1);
                  nav({ to: "/cart" });
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-[oklch(0.7_0.18_40)] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105"
              >
                <Zap className="size-4 fill-current" /> Buy Now
              </button>
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.brand}</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug md:text-2xl">{p.title}</h1>

            <div className="mt-2 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-sm bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">
                {p.rating.toFixed(1)} <Star className="size-3 fill-current" />
              </span>
              <span className="text-sm text-muted-foreground">
                {p.reviews.toLocaleString("en-IN")} ratings
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-bold">{formatINR(p.price)}</span>
              <span className="text-sm text-muted-foreground line-through">{formatINR(p.mrp)}</span>
              <span className="text-sm font-semibold text-success">{discountPct(p)}% off</span>
            </div>
            <p className="text-xs text-muted-foreground">Inclusive of all taxes · Free delivery</p>

            <div className="mt-5">
              <h3 className="mb-2 text-sm font-bold">Highlights</h3>
              <ul className="space-y-1.5 text-sm">
                {p.highlights.map((h: string) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 grid gap-2 rounded-md border border-border p-3 text-sm">
              <Row k="Compatibility" v={p.compatibility} />
              <Row k="Warranty" v={p.warranty} />
              <Row k="Stock" v={p.stock > 0 ? `In stock (${p.stock} left)` : "Out of stock"} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
              {[
                { i: Truck, t: "Free Delivery" },
                { i: ShieldCheck, t: "Genuine Product" },
                { i: RotateCcw, t: "7 Day Returns" },
              ].map(({ i: Icon, t }) => (
                <div key={t} className="flex flex-col items-center gap-1.5 rounded-md bg-muted py-3 text-center">
                  <Icon className="size-5 text-primary" />
                  <span className="font-semibold">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-bold">Similar Products</h2>
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
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
