import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cart, useCart } from "@/lib/cart-store";
import { formatINR, getProduct } from "@/lib/catalog";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — LapKart" }] }),
  component: CartPage,
});

function CartPage() {
  const items = useCart();
  const rows = items
    .map((i) => ({ p: getProduct(i.id), qty: i.qty }))
    .filter((r): r is { p: NonNullable<ReturnType<typeof getProduct>>; qty: number } => !!r.p);

  const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const mrp = rows.reduce((s, r) => s + r.p.mrp * r.qty, 0);
  const savings = mrp - subtotal;
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-muted/40">
        <Header />
        <div className="container mx-auto flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="size-10" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-1 text-muted-foreground">Add laptop parts to get started.</p>
          <Link
            to="/products"
            className="mt-6 inline-block rounded-sm bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
          >
            Shop Components
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg bg-card shadow-[var(--shadow-card)]">
          <div className="border-b border-border p-4">
            <h1 className="text-lg font-bold">My Cart ({rows.length})</h1>
          </div>
          <ul>
            {rows.map(({ p, qty }) => (
              <li key={p.id} className="flex gap-4 border-b border-border p-4 last:border-0">
                <Link
                  to="/product/$id"
                  params={{ id: p.id }}
                  className="size-24 shrink-0 overflow-hidden rounded-md bg-white"
                >
                  <img src={p.image} alt={p.title} className="size-full object-contain p-2" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/product/$id"
                    params={{ id: p.id }}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.brand}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-bold">{formatINR(p.price)}</span>
                    <span className="text-xs text-muted-foreground line-through">{formatINR(p.mrp)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-border">
                      <button
                        onClick={() => cart.setQty(p.id, qty - 1)}
                        className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label="Decrease"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{qty}</span>
                      <button
                        onClick={() => cart.setQty(p.id, qty + 1)}
                        className="grid size-7 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label="Increase"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => cart.remove(p.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="h-fit rounded-lg bg-card p-5 shadow-[var(--shadow-card)] lg:sticky lg:top-24">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Price Details
          </h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt>Price ({rows.length} items)</dt>
              <dd>{formatINR(mrp)}</dd>
            </div>
            <div className="flex justify-between text-success">
              <dt>Discount</dt>
              <dd>− {formatINR(savings)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery Charges</dt>
              <dd className={shipping === 0 ? "text-success" : ""}>
                {shipping === 0 ? "FREE" : formatINR(shipping)}
              </dd>
            </div>
            <div className="border-t border-dashed border-border pt-3" />
            <div className="flex justify-between text-base font-bold">
              <dt>Total Amount</dt>
              <dd>{formatINR(total)}</dd>
            </div>
          </dl>
          {savings > 0 && (
            <p className="mt-3 text-sm font-semibold text-success">
              You save {formatINR(savings)} on this order
            </p>
          )}
          <button className="mt-5 w-full rounded-sm bg-[oklch(0.7_0.18_40)] py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105">
            PLACE ORDER
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Safe & secure payments · Easy returns
          </p>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
