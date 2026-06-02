import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/catalog";
import { analyticsSeries, commerceModules, rolePanels } from "@/lib/marketplace";
import { CheckCircle2, ExternalLink, Loader2, MapPin, PackagePlus, RefreshCw, Send, Truck, WalletCards } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

type TrackingActivity = {
  date: string | null;
  status: string | null;
  activity: string | null;
  location: string | null;
};

type FulfillmentShipment = {
  id: string;
  shippingServiceType: "standard" | "quick";
  status: string;
  shiprocketShipmentId: number | null;
  awbCode: string | null;
  courierName: string | null;
  pickupScheduledDate: string | null;
  expectedDeliveryDate: string | null;
  trackingUrl: string | null;
  manifestUrl: string | null;
  labelUrl: string | null;
  trackingActivities: TrackingActivity[];
};

type FulfillmentOrder = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  shippingName: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingServiceType: "standard" | "quick";
  shipment: FulfillmentShipment | null;
};

type ShiprocketAccount = {
  walletBalance: number;
  configuredPickupLocation: string;
  pickupLocationVerified: boolean;
  pickupLocations: Array<{
    pickupLocation: string | null;
    pincode: string | null;
    city: string | null;
    state: string | null;
    primary: boolean;
    active: boolean;
  }>;
};

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard - LapKart" },
      { name: "description", content: "Manage users, products, orders, payments, refunds, analytics, and reports." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <DashboardShell
      eyebrow="admin command center"
      title="LapKart operations cockpit"
      description="Marketplace controls for revenue, orders, users, products, payments, refunds, stock, and reports."
    >
      <KpiGrid />
      <FulfillmentQueue />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Revenue and order trend">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsSeries}>
                <defs>
                  <linearGradient id="lapkartRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="url(#lapkartRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Admin queues">
          <div className="space-y-3">
            {["Review 18 product updates", "Check 42 open orders", "Review 7 refunds", "Resolve 4 payment alerts"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-[var(--border-faint)] p-3">
                <span className="text-label-small">{item}</span>
                <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">live</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Role management">
          <div className="grid gap-3 sm:grid-cols-2">
            {rolePanels.map(({ role, title, icon: Icon, metrics }) => (
              <div key={role} className="rounded-md border border-[var(--border-faint)] p-4">
                <Icon className="size-5 text-[var(--heat-100)]" />
                <p className="mt-3 text-label-medium">{role}</p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{title}</p>
                <p className="mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{metrics.join(" / ")}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Operations map">
          <div className="space-y-3">
            {commerceModules.map(({ title, body, icon: Icon }) => (
              <div key={title} className="flex gap-3 rounded-md border border-[var(--border-faint)] p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
                <div>
                  <p className="text-label-small">{title}</p>
                  <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Catalog controls">
          <div className="space-y-3">
            {["Publish approved SKUs", "Update stock counts", "Review price changes", "Audit low-stock categories"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-[var(--border-faint)] p-3">
                <span className="text-label-small">{item}</span>
                <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">admin</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Role controls">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Allowed roles", "admin / user"],
              ["Signup default", "user"],
              ["Client role edits", "blocked"],
              ["Admin promotion", "database only"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{label}</p>
                <p className="mt-2 font-display text-[28px] leading-none">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}

function FulfillmentQueue() {
  const { session } = useAuth();
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [account, setAccount] = useState<ShiprocketAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit) => {
    if (!session?.access_token) throw new Error("Sign in again to use admin fulfillment");
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
    });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Fulfillment request failed");
    return data;
  }, [session?.access_token]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [accountResponse, queueResponse] = await Promise.all([
        request<ShiprocketAccount>("/shiprocket/account"),
        request<{ orders: FulfillmentOrder[] }>("/admin/fulfillment/orders"),
      ]);
      setAccount(accountResponse);
      setOrders(queueResponse.orders);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load Shiprocket fulfillment");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = async (key: string, path: string, options?: RequestInit) => {
    try {
      setActiveAction(key);
      await request(path, options);
      toast.success("Shiprocket fulfillment updated");
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Fulfillment action failed";
      setError(message);
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <Panel title="Shiprocket fulfillment" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <StatusTile
            icon={WalletCards}
            label="Wallet balance"
            value={account ? formatINR(account.walletBalance) : "Loading"}
            warning={Boolean(account && account.walletBalance <= 0)}
          />
          <StatusTile
            icon={MapPin}
            label="Pickup location"
            value={account?.configuredPickupLocation || "Loading"}
            warning={Boolean(account && !account.pickupLocationVerified)}
          />
          <StatusTile
            icon={Truck}
            label="Order queue"
            value={`${orders.length} order${orders.length === 1 ? "" : "s"}`}
          />
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title="Refresh fulfillment queue"
          className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--border-muted)] text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--border-faint)] text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              <th className="px-3 py-3 font-normal">Order</th>
              <th className="px-3 py-3 font-normal">Delivery</th>
              <th className="px-3 py-3 font-normal">Shipment</th>
              <th className="px-3 py-3 font-normal">Tracking</th>
              <th className="px-3 py-3 font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <FulfillmentRow
                key={order.id}
                order={order}
                activeAction={activeAction}
                runAction={runAction}
              />
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && (
          <p className="py-8 text-center text-body-small text-[var(--black-alpha-56)]">No paid orders are waiting for fulfillment.</p>
        )}
        {loading && orders.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-8 text-body-small text-[var(--black-alpha-56)]">
            <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
            Loading Shiprocket queue
          </div>
        )}
      </div>
    </Panel>
  );
}

function FulfillmentRow({
  order,
  activeAction,
  runAction,
}: {
  order: FulfillmentOrder;
  activeAction: string | null;
  runAction: (key: string, path: string, options?: RequestInit) => Promise<void>;
}) {
  const shipment = order.shipment;
  const serviceType = shipment?.shippingServiceType ?? order.shippingServiceType ?? "standard";
  const createKey = `${order.id}:create`;
  const awbKey = `${order.id}:awb`;
  const pickupKey = `${order.id}:pickup`;
  const trackingKey = `${order.id}:tracking`;
  const busy = activeAction?.startsWith(order.id);
  const latestTracking = shipment?.trackingActivities[0];

  return (
    <tr className="border-b border-[var(--border-faint)] align-top last:border-b-0">
      <td className="px-3 py-4">
        <p className="text-label-small text-foreground">#{order.id.slice(0, 8)}</p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{order.shippingName || "Customer"}</p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{formatINR(Number(order.total ?? 0))}</p>
      </td>
      <td className="px-3 py-4">
        <p className="text-label-small capitalize text-foreground">{serviceType}</p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
          {[order.shippingCity, order.shippingState, order.shippingPincode].filter(Boolean).join(", ") || "Address pending"}
        </p>
      </td>
      <td className="px-3 py-4">
        <p className="text-label-small capitalize text-foreground">{shipment?.status?.replaceAll("_", " ") || "Not created"}</p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
          {shipment?.awbCode ? `AWB ${shipment.awbCode}` : "AWB pending"}
        </p>
        {shipment?.courierName && <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{shipment.courierName}</p>}
      </td>
      <td className="px-3 py-4">
        <p className="max-w-[240px] text-body-small text-[var(--black-alpha-72)]">
          {latestTracking?.activity || latestTracking?.status || "Tracking starts after AWB assignment"}
        </p>
        {latestTracking?.location && <p className="mt-1 text-body-small text-[var(--black-alpha-48)]">{latestTracking.location}</p>}
        {shipment?.trackingUrl && (
          <a
            href={shipment.trackingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-label-small text-[var(--heat-100)] hover:underline"
          >
            Live tracking <ExternalLink className="size-3" />
          </a>
        )}
      </td>
      <td className="px-3 py-4">
        <div className="flex max-w-[300px] flex-wrap gap-2">
          {!shipment && (
            <ActionButton
              icon={PackagePlus}
              label="Create shipment"
              loading={activeAction === createKey}
              disabled={busy}
              onClick={() => void runAction(createKey, "/shipments/shiprocket/create", postJson({ orderId: order.id }))}
            />
          )}
          {shipment && !shipment.awbCode && (
            <ActionButton
              icon={Send}
              label={serviceType === "quick" ? "Assign AWB and rider" : "Assign AWB"}
              loading={activeAction === awbKey}
              disabled={busy}
              onClick={() => void runAction(awbKey, "/shipments/shiprocket/assign-awb", postJson({ shipmentId: shipment.id }))}
            />
          )}
          {shipment?.awbCode && serviceType === "standard" && !shipment.pickupScheduledDate && (
            <ActionButton
              icon={Truck}
              label="Schedule pickup"
              loading={activeAction === pickupKey}
              disabled={busy}
              onClick={() => void runAction(pickupKey, "/shipments/shiprocket/pickup", postJson({ shipmentId: shipment.id }))}
            />
          )}
          {shipment?.shiprocketShipmentId && (
            <ActionButton
              icon={RefreshCw}
              label="Refresh tracking"
              loading={activeAction === trackingKey}
              disabled={busy}
              onClick={() => void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)}
            />
          )}
          {shipment?.manifestUrl && (
            <a
              href={shipment.manifestUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-muted)] px-3 text-label-small text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            >
              <CheckCircle2 className="size-4" />
              Manifest
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={`min-w-[150px] rounded-md border p-3 ${warning ? "border-red-500/20 bg-red-50" : "border-[var(--border-faint)] bg-[var(--background-lighter)]"}`}>
      <Icon className={`size-4 ${warning ? "text-red-700" : "text-[var(--heat-100)]"}`} />
      <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{label}</p>
      <p className="mt-1 text-label-small text-foreground">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof Truck;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--heat-100)] px-3 text-label-small text-white transition-colors hover:bg-[var(--heat-80)] disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </button>
  );
}

function postJson(body: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body),
  };
}
