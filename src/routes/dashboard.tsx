import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { apiBase } from "@/lib/api-base";
import { formatINR } from "@/lib/catalog";
import { getAuthorizationHeaders } from "@/lib/supabase-auth";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  Building2,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  Save,
  ShoppingBag,
  UserRound,
} from "lucide-react";

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

type BusinessAccount = {
  id: string;
  shop_name: string;
  gstin: string | null;
  business_phone: string | null;
  billing_email: string | null;
  billing_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  verification_status: "pending" | "verified" | "rejected";
  pro_tier: "standard" | "silver" | "gold" | "platinum";
};

type BusinessForm = {
  shopName: string;
  gstin: string;
  businessPhone: string;
  billingEmail: string;
  billingAddress: string;
  city: string;
  state: string;
  pincode: string;
};

function CustomerDashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [addresses, setAddresses] = useState<DashboardAddress[]>([]);
  const [payments, setPayments] = useState<DashboardPayment[]>([]);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [businessAccount, setBusinessAccount] = useState<BusinessAccount | null>(null);
  const [businessForm, setBusinessForm] = useState<BusinessForm>({
    shopName: "",
    gstin: "",
    businessPhone: "",
    billingEmail: "",
    billingAddress: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [loading, setLoading] = useState(true);
  const [businessSaving, setBusinessSaving] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setOrders([]);
      setAddresses([]);
      setPayments([]);
      setProfile(null);
      setLoading(false);
      return;
    }

    const [{ data: ordersData }, { data: addressData }, { data: profileData }, businessResponse] =
      await Promise.all([
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
        fetch(`${apiBase}/account/business`, { headers: await getAuthorizationHeaders() })
          .then((response) => response.json())
          .catch(() => ({ account: null })),
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
    const account = (businessResponse as { account?: BusinessAccount | null }).account ?? null;
    setBusinessAccount(account);
    setBusinessForm({
      shopName: account?.shop_name ?? "",
      gstin: account?.gstin ?? "",
      businessPhone: account?.business_phone ?? "",
      billingEmail: account?.billing_email ?? user.email ?? "",
      billingAddress: account?.billing_address ?? "",
      city: account?.city ?? "",
      state: account?.state ?? "",
      pincode: account?.pincode ?? "",
    });
    setLoading(false);
  }, [user?.email, user?.id]);

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
            { table: "business_accounts" as const, filter: `user_id=eq.${user.id}` },
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

  const saveBusinessAccount = async () => {
    if (!user?.id) return;
    setBusinessSaving(true);
    try {
      const response = await fetch(`${apiBase}/account/business`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthorizationHeaders()),
        },
        body: JSON.stringify(businessForm),
      });
      const data = (await response.json().catch(() => null)) as {
        account?: BusinessAccount;
        error?: string;
      } | null;
      if (!response.ok || !data?.account) {
        throw new Error(data?.error ?? "Could not save business account");
      }
      setBusinessAccount(data.account);
      await loadDashboard();
      toast.success("Business account submitted");
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Could not save business account",
      );
    } finally {
      setBusinessSaving(false);
    }
  };

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
          <Panel title="Business account" className="mt-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-[var(--heat-8)] text-[var(--heat-100)]">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-label-medium text-foreground">Pro buyer details</p>
                  <p className="text-body-small text-[var(--black-alpha-56)]">
                    Add shop and GST details for future business pricing and invoices.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-64)]">
                {businessAccount
                  ? `${businessAccount.verification_status} / ${businessAccount.pro_tier}`
                  : "not submitted"}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <BusinessInput
                label="Shop name"
                value={businessForm.shopName}
                onChange={(shopName) => setBusinessForm((current) => ({ ...current, shopName }))}
              />
              <BusinessInput
                label="GSTIN"
                value={businessForm.gstin}
                onChange={(gstin) =>
                  setBusinessForm((current) => ({ ...current, gstin: gstin.toUpperCase() }))
                }
              />
              <BusinessInput
                label="Business phone"
                value={businessForm.businessPhone}
                onChange={(businessPhone) =>
                  setBusinessForm((current) => ({ ...current, businessPhone }))
                }
              />
              <BusinessInput
                label="Billing email"
                value={businessForm.billingEmail}
                onChange={(billingEmail) =>
                  setBusinessForm((current) => ({ ...current, billingEmail }))
                }
              />
              <BusinessInput
                label="Billing address"
                value={businessForm.billingAddress}
                onChange={(billingAddress) =>
                  setBusinessForm((current) => ({ ...current, billingAddress }))
                }
                className="md:col-span-2"
              />
              <BusinessInput
                label="City"
                value={businessForm.city}
                onChange={(city) => setBusinessForm((current) => ({ ...current, city }))}
              />
              <BusinessInput
                label="State"
                value={businessForm.state}
                onChange={(state) => setBusinessForm((current) => ({ ...current, state }))}
              />
              <BusinessInput
                label="Pincode"
                value={businessForm.pincode}
                onChange={(pincode) =>
                  setBusinessForm((current) => ({
                    ...current,
                    pincode: pincode.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => void saveBusinessAccount()}
              disabled={businessSaving || businessForm.shopName.trim().length < 2}
              className="button button-primary mt-5 inline-flex h-10 items-center gap-2 rounded-md px-4 text-label-small disabled:opacity-60"
            >
              {businessSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save business account
            </button>
          </Panel>
        </>
      )}
    </DashboardShell>
  );
}

function BusinessInput({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground outline-none focus:border-[var(--heat-100)]"
      />
    </label>
  );
}
