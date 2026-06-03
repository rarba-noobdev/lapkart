import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { CreditCard, Loader2, MapPin, PackageCheck, ShoppingBag, UserRound } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Customer dashboard - LapKart" }] }),
  component: CustomerDashboard,
});

type DashboardOrder = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type DashboardAddress = {
  id: string;
  city: string;
  state: string;
  is_default: boolean;
};

type DashboardPayment = {
  id: string;
  amount: number;
  order_id: string;
  provider_payment_id: string | null;
  created_at: string;
};

type DashboardProfile = {
  full_name: string | null;
  phone: string | null;
};

function CustomerDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [addresses, setAddresses] = useState<DashboardAddress[]>([]);
  const [payments, setPayments] = useState<DashboardPayment[]>([]);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setAddresses([]);
      setPayments([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    const [{ data: ordersData }, { data: addressData }, { data: profileData }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,total,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("addresses")
        .select("id,city,state,is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false }),
      supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
    ]);

    const orderIds = ((ordersData as DashboardOrder[] | null) ?? []).map((order) => order.id);
    const { data: paymentData } = orderIds.length
      ? await supabase
          .from("payments")
          .select("id,amount,provider_payment_id,created_at,order_id")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    setOrders((ordersData as DashboardOrder[]) ?? []);
    setAddresses((addressData as DashboardAddress[]) ?? []);
    setPayments((paymentData as DashboardPayment[]) ?? []);
    setProfile((profileData as DashboardProfile | null) ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const realtimeTargets = useMemo(
    () =>
      user?.id
        ? [
            { table: "orders" as const, filter: `user_id=eq.${user.id}` },
            { table: "addresses" as const, filter: `user_id=eq.${user.id}` },
            { table: "payments" as const },
            { table: "profiles" as const, filter: `id=eq.${user.id}` },
          ]
        : [],
    [user?.id],
  );

  useRealtimeRefresh({
    channelName: `customer-dashboard:${user?.id ?? "guest"}`,
    enabled: Boolean(user?.id),
    onRefresh: loadDashboard,
    targets: realtimeTargets,
  });

  const activeOrders = orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status.toLowerCase()),
  ).length;
  const deliveredOrders = orders.filter(
    (order) => order.status.toLowerCase() === "delivered",
  ).length;
  const totalSpent = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;

  const kpis = [
    {
      icon: PackageCheck,
      label: "Orders",
      value: String(orders.length),
      trend: `${activeOrders} active`,
    },
    {
      icon: MapPin,
      label: "Saved addresses",
      value: String(addresses.length),
      trend: defaultAddress ? `${defaultAddress.city}, ${defaultAddress.state}` : "none saved",
    },
    {
      icon: CreditCard,
      label: "Payments",
      value: String(payments.length),
      trend: totalSpent > 0 ? formatINR(totalSpent) : "no payments",
    },
    {
      icon: UserRound,
      label: "Profile",
      value: profile?.full_name || user?.email?.split("@")[0] || "Customer",
      trend: profile?.phone || user?.email || "complete profile",
    },
  ];

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
    <DashboardShell
      eyebrow="customer hub"
      title="Orders, addresses, payments, and profile"
      description="Live account state from your current orders, saved delivery addresses, payments, and profile."
    >
      {loading ? (
        <div className="grid place-items-center rounded-lg border border-[var(--border-faint)] bg-white p-12">
          <Loader2 className="size-5 animate-spin text-[var(--heat-100)]" />
        </div>
      ) : (
        <>
          <KpiGrid items={kpis} />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Panel title="Recent order activity">
              {orders.length === 0 ? (
                <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-56)]">
                  Your first order will show up here as soon as checkout completes.
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map((order) => (
                    <Link
                      key={order.id}
                      to="/order/$id"
                      params={{ id: order.id }}
                      className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-faint)] p-3 transition-colors hover:border-[var(--heat-20)]"
                    >
                      <div className="min-w-0">
                        <p className="text-label-small text-foreground">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                          {new Date(order.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-label-small text-foreground">{formatINR(order.total)}</p>
                        <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">
                          {order.status.replaceAll("_", " ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title="Account summary">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    Delivered
                  </p>
                  <p className="mt-2 font-display text-[28px] leading-none text-foreground">
                    {deliveredOrders}
                  </p>
                </div>
                <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    Default address
                  </p>
                  <p className="mt-2 text-label-small text-foreground">
                    {defaultAddress
                      ? `${defaultAddress.city}, ${defaultAddress.state}`
                      : "Add your first address"}
                  </p>
                </div>
                <Link
                  to="/products"
                  className="rounded-md border border-[var(--border-faint)] bg-white p-4 transition-colors hover:border-[var(--heat-20)]"
                >
                  <ShoppingBag className="size-4 text-[var(--heat-100)]" />
                  <p className="mt-3 text-label-small text-foreground">Continue shopping</p>
                </Link>
                <Link
                  to="/orders"
                  className="rounded-md border border-[var(--border-faint)] bg-white p-4 transition-colors hover:border-[var(--heat-20)]"
                >
                  <PackageCheck className="size-4 text-[var(--heat-100)]" />
                  <p className="mt-3 text-label-small text-foreground">Track all orders</p>
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
