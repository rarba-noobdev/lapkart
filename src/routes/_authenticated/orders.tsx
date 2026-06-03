import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Loader2, Package } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/catalog";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My orders - lapkart" }] }),
  component: OrdersPage,
});

type OrderRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  shipping_address: string;
};

function OrdersPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders((data as OrderRow[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const realtimeTargets = useMemo(
    () => (user?.id ? [{ table: "orders" as const, filter: `user_id=eq.${user.id}` }] : []),
    [user?.id],
  );

  useRealtimeRefresh({
    channelName: `orders-page:${user?.id ?? "guest"}`,
    enabled: Boolean(user?.id),
    onRefresh: loadOrders,
    targets: realtimeTargets,
  });

  const statusColor = (status: string) =>
    status === "confirmed"
      ? "var(--accent-forest)"
      : status === "shipped"
        ? "var(--accent-bluetron)"
        : status === "delivered"
          ? "var(--accent-forest)"
          : status === "cancelled"
            ? "var(--accent-crimson)"
            : "var(--heat-100)";

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

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <span className="text-label-small text-[var(--heat-100)]">Orders</span>
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
            <p className="mt-4 text-label-small text-[var(--heat-100)]">No orders yet</p>
            <p className="mt-2 text-label-large text-foreground">
              Your purchase history will appear here.
            </p>
            <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">
              Once you check out, tracking and totals show up on this page.
            </p>
            <Link
              to="/products"
              className="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-label-medium"
            >
              Start shopping <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order, index) => (
              <motion.li
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  to="/order/$id"
                  params={{ id: order.id }}
                  className="group flex items-center gap-5 rounded-lg border border-[var(--border-muted)] bg-white p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-[var(--heat-20)] hover:shadow-[0_12px_24px_-12px_var(--heat-20)]"
                >
                  <div className="grid size-11 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--heat-4)] text-[var(--heat-100)]">
                    <Package className="size-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                      order id
                    </p>
                    <p className="mt-0.5 text-label-medium text-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-mono-x-small uppercase tracking-wider">
                      <span className="text-[var(--black-alpha-48)]">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="size-1 rounded-full bg-[var(--black-alpha-24)]" />
                      <span style={{ color: statusColor(order.status) }}>{order.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                      total
                    </p>
                    <p className="mt-0.5 font-display text-[20px] font-medium text-foreground">
                      {formatINR(order.total)}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-[var(--black-alpha-32)] transition-[transform,color] group-hover:translate-x-1 group-hover:text-[var(--heat-100)]" />
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
