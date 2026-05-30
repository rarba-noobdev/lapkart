import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { Loader2, Package, ChevronRight, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My orders — lapkart" }] }),
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

  const statusColor = (s: string) =>
    s === "confirmed" ? "var(--accent-forest)" :
    s === "shipped" ? "var(--accent-bluetron)" :
    s === "delivered" ? "var(--accent-forest)" :
    s === "cancelled" ? "var(--accent-crimson)" : "var(--heat-100)";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">orders</span>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">My orders</h1>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-16 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full border border-[var(--border-muted)] bg-[var(--background-lighter)]">
              <Package className="size-6 text-[var(--black-alpha-48)]" strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">empty_state</p>
            <p className="mt-2 text-label-large text-foreground">No orders yet</p>
            <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">Your purchase history will appear here.</p>
            <Link to="/products" className="button button-primary mt-6 inline-flex items-center gap-2 rounded-md px-5 h-10 text-label-medium">
              Start shopping <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o, i) => (
              <motion.li
                key={o.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to="/order/$id"
                  params={{ id: o.id }}
                  className="group flex items-center gap-5 rounded-lg border border-[var(--border-muted)] bg-white p-5 transition-all duration-300 hover:border-[var(--heat-20)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_var(--heat-20)]"
                >
                  <div className="grid size-11 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--heat-4)] text-[var(--heat-100)]">
                    <Package className="size-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                      order id
                    </p>
                    <p className="mt-0.5 text-label-medium text-foreground">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 text-mono-x-small uppercase tracking-wider">
                      <span className="text-[var(--black-alpha-48)]">
                        {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      <span className="size-1 rounded-full bg-[var(--black-alpha-24)]" />
                      <span style={{ color: statusColor(o.status) }}>
                        ● {o.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">total</p>
                    <p className="mt-0.5 font-display text-[20px] font-medium text-foreground">{formatINR(o.total)}</p>
                  </div>
                  <ChevronRight className="size-5 text-[var(--black-alpha-32)] transition-all group-hover:translate-x-1 group-hover:text-[var(--heat-100)]" />
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
