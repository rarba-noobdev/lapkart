import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartPageSkeleton } from "@/components/LoadingSkeletons";
import { cart, useCartState } from "@/lib/cart-store";
import { formatINR } from "@/lib/catalog";
import { useProductsByIds } from "@/lib/products-db";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — lapkart" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, isHydrated } = useCartState();
  const { data: prods = [], isLoading: productsLoading } = useProductsByIds(items.map((i) => i.id));
  const byId = new Map(prods.map((p) => [p.id, p]));
  const rows = items
    .map((i) => ({ p: byId.get(i.id), qty: i.qty }))
    .filter((r): r is { p: NonNullable<typeof r.p>; qty: number } => !!r.p);

  const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const mrp = rows.reduce((s, r) => s + r.p.mrp * r.qty, 0);
  const savings = mrp - subtotal;
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  if (!isHydrated || (items.length > 0 && productsLoading)) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <CartPageSkeleton />
        <Footer />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto flex flex-col items-center justify-center px-4 py-32 text-center">
          <div className="grid size-20 place-items-center rounded-full border border-[var(--border-muted)] bg-white text-[var(--heat-100)]">
            <ShoppingBag className="size-9" strokeWidth={1.8} />
          </div>
          <p className="mt-6 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">empty_state</p>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-body-medium text-[var(--black-alpha-56)]">Add laptop parts to get started.</p>
          <Link to="/products" className="button button-primary mt-8 inline-flex items-center gap-2 rounded-md px-6 h-12 text-label-medium">
            Shop components <ArrowRight className="size-4" />
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">cart</span>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">
            Your selection <span className="text-[var(--black-alpha-40)]">({rows.length})</span>
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white">
            <ul>
              {rows.map(({ p, qty }) => (
                <li key={p.id} className="flex gap-5 border-b border-[var(--border-faint)] p-5 last:border-0">
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="size-24 shrink-0 overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)]"
                  >
                    <img src={(p.images?.[0]) ?? p.image} alt={p.title} className="size-full object-contain p-2" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">{p.brand}</p>
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="mt-0.5 block line-clamp-2 text-label-medium text-foreground hover:text-[var(--heat-100)] transition-colors"
                    >
                      {p.title}
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-md border border-[var(--border-muted)] bg-white">
                        <button
                          onClick={() => cart.setQty(p.id, qty - 1)}
                          className="grid size-9 place-items-center text-[var(--black-alpha-48)] hover:text-[var(--heat-100)] transition-colors"
                          aria-label="Decrease"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-mono-small font-medium text-foreground">{qty}</span>
                        <button
                          onClick={() => cart.setQty(p.id, qty + 1)}
                          className="grid size-9 place-items-center text-[var(--black-alpha-48)] hover:text-[var(--heat-100)] transition-colors"
                          aria-label="Increase"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <span className="text-label-large font-medium text-foreground">{formatINR(p.price * qty)}</span>
                        <p className="text-mono-x-small text-[var(--black-alpha-40)] line-through">{formatINR(p.mrp * qty)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => cart.remove(p.id)}
                      className="mt-3 inline-flex items-center gap-1.5 text-mono-x-small uppercase tracking-wider text-[var(--accent-crimson)] hover:underline"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-28">
            <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
              <h2 className="mb-5 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
                Order summary
              </h2>
              <dl className="space-y-3 text-body-medium">
                <Row k={`Subtotal (${rows.length} items)`} v={formatINR(mrp)} />
                <Row k="Discount" v={`− ${formatINR(savings)}`} accent="forest" />
                <Row
                  k="Delivery"
                  v={shipping === 0 ? "FREE" : formatINR(shipping)}
                  accent={shipping === 0 ? "forest" : undefined}
                />
                <div className="border-t border-dashed border-[var(--border-muted)] pt-3 mt-3">
                  <div className="flex justify-between items-baseline">
                    <dt className="text-label-large text-foreground">Total</dt>
                    <dd className="font-display text-title-h4 text-foreground">{formatINR(total)}</dd>
                  </div>
                </div>
              </dl>
              {savings > 0 && (
                <div className="mt-4 rounded-md bg-[var(--accent-forest)]/8 px-3 py-2 text-mono-small text-[var(--accent-forest)]">
                  You save {formatINR(savings)} on this order
                </div>
              )}
              <Link
                to="/checkout"
                className="button button-primary mt-5 flex w-full items-center justify-center gap-2 rounded-md h-12 text-label-medium"
              >
                Proceed to checkout <ArrowRight className="size-4" />
              </Link>
              <p className="mt-3 text-center text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-40)]">
                Safe payments · Easy returns
              </p>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: "forest" }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--black-alpha-72)]">{k}</dt>
      <dd className={accent === "forest" ? "text-[var(--accent-forest)]" : "text-foreground"}>{v}</dd>
    </div>
  );
}
