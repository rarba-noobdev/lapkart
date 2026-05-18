import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { Loader2, Package, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My Orders — LapKart" }] }),
  component: OrdersPage,
});

type OrderRow = { id: string; total: number; status: string; created_at: string; shipping_address: string };

function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("orders").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold">My Orders</h1>
        {loading ? (
          <div className="grid place-items-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-lg bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <Package className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-3 font-semibold">No orders yet</p>
            <Link to="/products" className="mt-4 inline-block rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Start shopping</Link>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {orders.map((o, i) => (
              <motion.li
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-4 rounded-lg bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <Package className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Order #{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · <span className="capitalize text-success">{o.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatINR(o.total)}</p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
      <Footer />
    </div>
  );
}
