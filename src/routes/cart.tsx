import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CartPageSkeleton } from "@/components/LoadingSkeletons";
import { formatINR } from "@/lib/catalog";
import { cart, useCartState } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth";
import { useProductsByIds } from "@/lib/products-db";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart - lapkart" }] }),
  component: CartPage,
});

function CartPage() {
  const navigate = Route.useNavigate();
  const { role } = useAuth();
  const { items, isHydrated } = useCartState();
  const { data: products = [], isLoading: productsLoading } = useProductsByIds(
    items.map((item) => item.id),
  );

  useEffect(() => {
    if (role === "admin") {
      void navigate({ to: "/admin", replace: true });
    }
  }, [navigate, role]);

  if (role === "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <p className="text-body-medium text-[var(--black-alpha-56)]">
          Redirecting to the admin console.
        </p>
      </div>
    );
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const rows = items
    .map((item) => ({ product: productsById.get(item.id), qty: item.qty }))
    .filter(
      (row): row is { product: NonNullable<typeof row.product>; qty: number } => !!row.product,
    );

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const mrp = rows.reduce((sum, row) => sum + row.product.mrp * row.qty, 0);
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
          <p className="mt-6 text-label-small text-[var(--heat-100)]">Cart is empty</p>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-body-medium text-[var(--black-alpha-56)]">
            Add laptop parts to get started.
          </p>
          <Link
            to="/products"
            className="button button-primary mt-8 inline-flex h-12 items-center gap-2 rounded-md px-6 text-label-medium"
          >
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
          <span className="text-label-small text-[var(--heat-100)]">Cart</span>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">
            Your selection <span className="text-[var(--black-alpha-40)]">({rows.length})</span>
          </h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white">
            <ul>
              {rows.map(({ product, qty }) => (
                <li
                  key={product.id}
                  className="flex flex-col gap-5 border-b border-[var(--border-faint)] p-5 last:border-0 sm:flex-row"
                >
                  <Link
                    to="/product/$id"
                    params={{ id: product.id }}
                    className="size-24 shrink-0 overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)]"
                  >
                    <img
                      src={product.images?.[0] ?? product.image}
                      alt={product.title}
                      className="size-full object-contain p-2"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">
                      {product.brand}
                    </p>
                    <Link
                      to="/product/$id"
                      params={{ id: product.id }}
                      className="mt-0.5 block line-clamp-2 text-label-medium text-foreground transition-colors hover:text-[var(--heat-100)]"
                    >
                      {product.title}
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-md border border-[var(--border-muted)] bg-white">
                        <button
                          onClick={() => cart.setQty(product.id, qty - 1)}
                          className="grid size-11 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)]"
                          aria-label="Decrease"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-8 text-center text-mono-small font-medium text-foreground">
                          {qty}
                        </span>
                        <button
                          onClick={() => cart.setQty(product.id, qty + 1)}
                          className="grid size-11 place-items-center text-[var(--black-alpha-48)] transition-colors hover:text-[var(--heat-100)]"
                          aria-label="Increase"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-right">
                        <span className="text-label-large font-medium text-foreground">
                          {formatINR(product.price * qty)}
                        </span>
                        <p className="text-mono-x-small text-[var(--black-alpha-40)] line-through">
                          {formatINR(product.mrp * qty)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => cart.remove(product.id)}
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
              <h2 className="mb-5 text-label-medium text-foreground">Order summary</h2>
              <dl className="space-y-3 text-body-medium">
                <Row k={`Subtotal (${rows.length} items)`} v={formatINR(mrp)} />
                <Row k="Discount" v={`- ${formatINR(savings)}`} accent="forest" />
                <Row
                  k="Delivery"
                  v={shipping === 0 ? "FREE" : formatINR(shipping)}
                  accent={shipping === 0 ? "forest" : undefined}
                />
                <div className="mt-3 border-t border-dashed border-[var(--border-muted)] pt-3">
                  <div className="flex items-baseline justify-between">
                    <dt className="text-label-large text-foreground">Total</dt>
                    <dd className="font-display text-title-h4 text-foreground">
                      {formatINR(total)}
                    </dd>
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
                className="button button-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md text-label-medium"
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
      <dd className={accent === "forest" ? "text-[var(--accent-forest)]" : "text-foreground"}>
        {v}
      </dd>
    </div>
  );
}
