import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { CheckCircle2, Package, Truck, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/order/$id")({
  head: () => ({ meta: [{ title: "Order confirmed — lapkart" }] }),
  component: OrderPage,
});

type OrderRow = {
  id: string;
  total: number;
  subtotal: number;
  shipping: number;
  status: string;
  payment_status: string;
  shipping_name: string;
  shipping_address: string;
  created_at: string;
};
type Item = { id: string; title: string; image: string; brand: string; price: number; qty: number };

function OrderPage() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: it }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);
      setOrder(o as OrderRow | null);
      setItems((it as Item[]) ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
      </div>
    );
  }
  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto px-4 py-24 text-center">
          <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--accent-crimson)]">404 / not_found</p>
          <h1 className="mt-3 font-display text-title-h3">Order not found</h1>
          <Link to="/" className="button button-primary mt-6 inline-flex items-center gap-2 rounded-md px-5 h-10 text-label-medium">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-[var(--heat-100)] text-white shadow-[0_20px_50px_-20px_var(--heat-100)] animate-heat-glow"
        >
          <CheckCircle2 className="size-10" strokeWidth={2} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-center"
        >
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">order confirmed</span>
          <h1 className="mt-2 font-display text-title-h2 text-foreground">Thank you for your order</h1>
          <p className="mt-3 text-body-large text-[var(--black-alpha-56)]">
            <span className="text-mono-small text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
            <span className="mx-2">·</span>
            Paid <span className="font-medium text-foreground">{formatINR(order.total)}</span>
          </p>
        </motion.div>

        {/* Tracking timeline */}
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            { icon: CheckCircle2, label: "Confirmed", note: "Just now", active: true, current: true },
            { icon: Package, label: "Packed", note: "Within 24h", active: false, current: false },
            { icon: Truck, label: "On the way", note: "48h est.", active: false, current: false },
          ].map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`relative rounded-lg border p-5 ${
                step.current
                  ? "border-[var(--heat-100)] bg-[var(--heat-4)]"
                  : step.active
                    ? "border-[var(--border-muted)] bg-white"
                    : "border-[var(--border-faint)] bg-white opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-9 place-items-center rounded-md ${
                    step.current
                      ? "bg-[var(--heat-100)] text-white shadow-[0_2px_8px_0_var(--heat-40)]"
                      : "bg-[var(--background-lighter)] text-[var(--black-alpha-48)]"
                  }`}
                >
                  <step.icon className="size-4" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-label-small text-foreground">{step.label}</p>
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{step.note}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="mb-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">Shipping to</h2>
            <p className="text-label-medium text-foreground">{order.shipping_name}</p>
            <p className="mt-1 text-body-small text-[var(--black-alpha-72)] leading-relaxed">{order.shipping_address}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="mb-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">Payment</h2>
            <p className="text-label-medium text-foreground">{formatINR(order.total)}</p>
            <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
              ● paid · mock_demo
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[var(--border-muted)] bg-white p-6">
          <h2 className="mb-4 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
            Items ({items.length})
          </h2>
          <ul className="divide-y divide-[var(--border-faint)]">
            {items.map((it) => (
              <li key={it.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <img src={it.image} alt="" className="size-16 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-1 text-label-small text-foreground">{it.title}</p>
                  <p className="mt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    {it.brand} · qty {it.qty}
                  </p>
                </div>
                <p className="text-label-medium font-medium text-foreground">{formatINR(it.price * it.qty)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/orders" className="button button-primary inline-flex items-center gap-2 rounded-md px-5 h-11 text-label-medium">
            View all orders <ArrowRight className="size-4" />
          </Link>
          <Link to="/products" className="inline-flex items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-5 h-11 text-label-medium text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] transition-colors">
            Continue shopping
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
