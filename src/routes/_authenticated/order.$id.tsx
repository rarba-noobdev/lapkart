import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { CheckCircle2, Package, Truck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/order/$id")({
  head: () => ({ meta: [{ title: "Order Confirmed — LapKart" }] }),
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
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (!order) {
    return (
      <div className="min-h-screen"><Header /><div className="container mx-auto px-4 py-20 text-center"><h1 className="text-2xl font-bold">Order not found</h1><Link to="/" className="mt-4 inline-block text-primary">Go home</Link></div></div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto grid size-20 place-items-center rounded-full bg-success text-success-foreground shadow-lg"
        >
          <CheckCircle2 className="size-12" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 text-center"
        >
          <h1 className="font-display text-3xl font-bold">Order placed successfully!</h1>
          <p className="mt-1 text-muted-foreground">Order #{order.id.slice(0, 8).toUpperCase()} · Paid {formatINR(order.total)}</p>
        </motion.div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: CheckCircle2, label: "Confirmed", active: true },
            { icon: Package, label: "Packed", active: false },
            { icon: Truck, label: "On the way", active: false },
          ].map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`rounded-lg border bg-card p-4 text-center shadow-[var(--shadow-card)] ${step.active ? "border-success" : "border-border opacity-60"}`}
            >
              <step.icon className={`mx-auto size-6 ${step.active ? "text-success" : "text-muted-foreground"}`} />
              <p className="mt-2 text-sm font-semibold">{step.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-bold">Shipping to</h2>
          <p className="text-sm">{order.shipping_name}</p>
          <p className="text-sm text-muted-foreground">{order.shipping_address}</p>
        </div>

        <div className="mt-4 rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-bold">Items</h2>
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex gap-3 py-3">
                <img src={it.image} alt="" className="size-16 rounded bg-white object-contain p-1" />
                <div className="flex-1 text-sm">
                  <p className="line-clamp-1 font-medium">{it.title}</p>
                  <p className="text-xs text-muted-foreground">{it.brand} · Qty {it.qty}</p>
                </div>
                <p className="text-sm font-bold">{formatINR(it.price * it.qty)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/orders" className="rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110">View my orders</Link>
          <Link to="/products" className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-bold hover:bg-muted">Continue shopping</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
