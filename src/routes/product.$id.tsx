import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Check,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { useAuth } from "@/lib/auth";
import { discountPct, formatINR } from "@/lib/catalog";
import { cart } from "@/lib/cart-store";
import { useProduct, useProducts } from "@/lib/products-db";

export const Route = createFileRoute("/product/$id")({
  head: () => ({ meta: [{ title: "Product - lapkart" }] }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { role } = useAuth();
  const { data: product, isLoading } = useProduct(id);
  const { data: allProducts = [] } = useProducts();
  const [added, setAdded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const navigate = useNavigate();
  const isAdmin = role === "admin";

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

  if (!product) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="text-label-small text-[var(--heat-100)]">Not found</p>
          <h1 className="mt-3 font-display text-title-h3 text-foreground">Product not found</h1>
          <Link
            to="/products"
            className="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-label-medium"
          >
            Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const related = allProducts
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 6);

  const addToCart = () => {
    cart.add(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <nav className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
          <Link to="/" className="transition-colors hover:text-[var(--heat-100)]">
            home
          </Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <Link to="/products" className="transition-colors hover:text-[var(--heat-100)]">
            catalog
          </Link>
          <span className="mx-2 text-[var(--black-alpha-24)]">/</span>
          <span className="inline-block max-w-[280px] align-bottom text-[var(--heat-100)] line-clamp-1">
            {product.title}
          </span>
        </nav>

        <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
          <div className="space-y-4 md:sticky md:top-28 md:self-start">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-muted)] bg-white">
              {discountPct(product) >= 30 && (
                <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-sm bg-[var(--heat-100)] px-2.5 py-1 text-mono-x-small font-medium tracking-wide text-white shadow-[0_2px_8px_0_var(--heat-40)]">
                  -{discountPct(product)}% off
                </span>
              )}
              <img
                src={product.images?.[imageIndex] ?? product.image}
                alt={product.title}
                className="size-full object-contain p-10"
              />
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    onClick={() => setImageIndex(index)}
                    className={`size-16 shrink-0 overflow-hidden rounded-md border bg-[var(--background-lighter)] transition-[border-color,opacity,box-shadow] ${
                      index === imageIndex
                        ? "border-[var(--heat-100)] ring-2 ring-[var(--heat-12)]"
                        : "border-[var(--border-faint)] opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={imageUrl} alt="" className="size-full object-contain p-1" />
                  </button>
                ))}
              </div>
            )}

            {isAdmin ? (
              <div className="grid gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-4">
                <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                  Admin session
                </p>
                <p className="text-body-small text-[var(--black-alpha-64)]">
                  Purchasing is disabled for admin accounts. Use the operations console to update
                  this listing, stock, pricing, and order flow.
                </p>
                <div className="flex gap-3">
                  <Link
                    to="/admin"
                    className="button button-primary inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-label-medium"
                  >
                    Open admin console
                  </Link>
                  <Link
                    to="/products"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] text-label-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
                  >
                    Back to catalog
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={addToCart}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--heat-100)] bg-white text-label-medium font-medium text-[var(--heat-100)] transition-[background-color,border-color,color] hover:bg-[var(--heat-4)]"
                >
                  {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
                  {added ? "Added" : "Add to cart"}
                </button>
                <button
                  onClick={() => {
                    cart.add(product.id, 1);
                    navigate({ to: "/cart" });
                  }}
                  className="button button-primary flex h-12 flex-1 items-center justify-center gap-2 rounded-md text-label-medium"
                >
                  <Zap className="size-4 fill-current" /> Buy now
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--heat-100)]">
                {product.brand}
              </p>
              <h1 className="mt-2 text-balance font-display text-title-h3 leading-tight text-foreground">
                {product.title}
              </h1>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <span className="inline-flex items-center gap-1 text-body-large text-foreground">
                <Star className="size-4 fill-[var(--accent-honey)] text-[var(--accent-honey)]" />
                {product.rating.toFixed(1)}
              </span>
              <span className="text-mono-small text-[var(--black-alpha-48)]">
                {product.reviews.toLocaleString("en-IN")} ratings
              </span>
              <span className="size-1 rounded-full bg-[var(--accent-forest)]" />
              <span className="text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
                in stock
              </span>
            </div>

            <div className="flex items-baseline gap-4 border-b border-[var(--border-faint)] pb-6">
              <span className="font-display text-title-h2 text-foreground">
                {formatINR(product.price)}
              </span>
              <span className="text-body-large text-[var(--black-alpha-40)] line-through">
                {formatINR(product.mrp)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--accent-forest)]/10 px-2 py-0.5 text-mono-small font-medium text-[var(--accent-forest)]">
                {discountPct(product)}% off
              </span>
            </div>
            <p className="-mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              Inclusive of taxes · Free delivery on orders above ₹999
            </p>

            <div>
              <h3 className="mb-3 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                Highlights
              </h3>
              <ul className="space-y-2.5">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-3 text-body-medium text-foreground">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-[var(--heat-100)]" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 rounded-lg border border-[var(--border-muted)] bg-white p-5">
              <Row k="Compatibility" v={product.compatibility} />
              <Row k="Warranty" v={product.warranty} />
              <Row
                k="Stock"
                v={product.stock > 0 ? `${product.stock} units available` : "Out of stock"}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Truck, title: "Free delivery" },
                { icon: ShieldCheck, title: "Genuine product" },
                { icon: RotateCcw, title: "7-day returns" },
              ].map(({ icon: Icon, title }) => (
                <div
                  key={title}
                  className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-faint)] bg-white py-4 text-center"
                >
                  <Icon className="size-5 text-[var(--heat-100)]" strokeWidth={2.2} />
                  <span className="text-label-small text-foreground">{title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-20">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <span className="text-label-small text-[var(--heat-100)]">Also in catalog</span>
                <h2 className="mt-2 font-display text-title-h4 text-foreground">
                  Similar products
                </h2>
              </div>
              <Link
                to="/products"
                className="group inline-flex items-center gap-1 text-label-small text-foreground transition-colors hover:text-[var(--heat-100)]"
              >
                View all{" "}
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {related.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} p={relatedProduct} />
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
    <div className="grid gap-1 text-body-small sm:grid-cols-[140px_1fr] sm:gap-2">
      <span className="pt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {k}
      </span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}
