import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, Package, Truck } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { apiBase } from "@/lib/api-base";
import { useAuth } from "@/lib/auth";
import { formatINR } from "@/lib/catalog";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";

export const Route = createFileRoute("/_authenticated/order/$id")({
  head: () => ({ meta: [{ title: "Order confirmed - lapkart" }] }),
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
  shipping_courier_name: string | null;
  shipping_expected_delivery_date: string | null;
  shipping_route_distance_meters: number | null;
  shipping_route_duration_seconds: number | null;
  shipping_service_type: string;
  created_at: string;
};

type Item = {
  id: string;
  title: string;
  image: string;
  brand: string;
  price: number;
  qty: number;
};

type TrackingActivity = {
  date: string | null;
  status: string | null;
  activity: string | null;
  location: string | null;
};

type ShipmentTracking = {
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
} | null;

type OrderTrackingResponse = {
  order: OrderRow;
  items: Item[];
  shipment: ShipmentTracking;
  error?: string;
};

function OrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, role, session } = useAuth();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [shipment, setShipment] = useState<ShipmentTracking>(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!user?.id || !session?.access_token) {
      setOrder(null);
      setItems([]);
      setShipment(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/orders/${id}/tracking`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = (await response.json()) as OrderTrackingResponse;

      if (!response.ok || !data.order) {
        setOrder(null);
        setItems([]);
        setShipment(null);
        setLoading(false);
        return;
      }

      setOrder(data.order);
      setItems(data.items ?? []);
      setShipment(data.shipment ?? null);
      setLoading(false);
    } catch {
      setOrder(null);
      setItems([]);
      setShipment(null);
      setLoading(false);
    }
  }, [id, session?.access_token, user?.id]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const realtimeTargets = useMemo(
    () =>
      user?.id
        ? [
            { table: "orders" as const, filter: `id=eq.${id}` },
            { table: "order_items" as const, filter: `order_id=eq.${id}` },
            { table: "shipments" as const, filter: `order_id=eq.${id}` },
            { table: "shipment_events" as const },
          ]
        : [],
    [id, user?.id],
  );

  useRealtimeRefresh({
    channelName: `order-detail:${id}`,
    enabled: Boolean(user?.id),
    onRefresh: loadOrder,
    targets: realtimeTargets,
  });

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
          <p className="text-label-small text-[var(--accent-crimson)]">Not found</p>
          <h1 className="mt-3 font-display text-title-h3">Order not found</h1>
          <Link
            to="/"
            className="button button-primary mt-6 inline-flex h-10 items-center gap-2 rounded-md px-5 text-label-medium"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const liveTracking = shipment?.trackingActivities ?? [];
  const currentShipmentLabel =
    shipment?.status?.replaceAll("_", " ") || order.status.replaceAll("_", " ");
  const shipmentNote = shipment?.expectedDeliveryDate
    ? `Expected ${shipment.expectedDeliveryDate}`
    : order.shipping_expected_delivery_date
      ? `Expected ${order.shipping_expected_delivery_date}`
      : shipment?.trackingActivities[0]?.activity || "Carrier update pending";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, rotate: -10 }}
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
          <span className="text-label-small text-[var(--heat-100)]">Order confirmed</span>
          <h1 className="mt-2 font-display text-title-h2 text-foreground">
            Thank you for your order
          </h1>
          <p className="mt-3 text-body-large text-[var(--black-alpha-56)]">
            <span className="text-mono-small text-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="mx-2">/</span>
            Paid <span className="font-medium text-foreground">{formatINR(order.total)}</span>
          </p>
        </motion.div>

        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              label: "Confirmed",
              note: "Just now",
              active: true,
              current: true,
            },
            {
              icon: Package,
              label: "Packed",
              note: shipment?.awbCode ? `AWB ${shipment.awbCode}` : "Within 24h",
              active: Boolean(shipment?.awbCode),
              current: !shipment?.trackingActivities.length && Boolean(shipment?.awbCode),
            },
            {
              icon: Truck,
              label: shipment?.trackingActivities.length ? "Live tracking" : "On the way",
              note: shipmentNote,
              active: Boolean(shipment),
              current: Boolean(shipment?.trackingActivities.length),
            },
          ].map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
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
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    {step.note}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="mb-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
              Shipping to
            </h2>
            <p className="text-label-medium text-foreground">{order.shipping_name}</p>
            <p className="mt-1 text-body-small leading-relaxed text-[var(--black-alpha-72)]">
              {order.shipping_address}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="mb-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
              Delivery estimate
            </h2>
            <p className="text-label-medium text-foreground">
              {shipment?.courierName || order.shipping_courier_name || "Courier assignment pending"}
            </p>
            <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">{shipmentNote}</p>
            {order.shipping_route_distance_meters !== null && (
              <div className="mt-1 space-y-1 text-body-small text-[var(--black-alpha-56)]">
                <p>{(order.shipping_route_distance_meters / 1000).toFixed(1)} km road route</p>
                {order.shipping_route_duration_seconds !== null && (
                  <p>
                    {Math.max(1, Math.round(order.shipping_route_duration_seconds / 60))} min
                    estimated drive time
                  </p>
                )}
              </div>
            )}
            {shipment?.trackingUrl && (
              <a
                href={shipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-label-small text-[var(--heat-100)] hover:underline"
              >
                Open courier tracking <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="mb-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
              Payment
            </h2>
            <p className="text-label-medium text-foreground">{formatINR(order.total)}</p>
            <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
              {order.payment_status.replaceAll("_", " ")}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-[var(--border-muted)] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
                Tracking timeline
              </h2>
              <p className="mt-2 text-label-medium text-foreground">{currentShipmentLabel}</p>
            </div>
            {shipment?.awbCode && (
              <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-56)]">
                AWB {shipment.awbCode}
              </div>
            )}
          </div>
          {liveTracking.length === 0 ? (
            <div className="mt-5 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-56)]">
              Live courier events will appear here after shipment creation and carrier scans.
            </div>
          ) : (
            <ol className="mt-5 space-y-3">
              {liveTracking.map((activity, index) => (
                <li
                  key={`${activity.date ?? "unknown"}-${index}`}
                  className="flex gap-4 rounded-md border border-[var(--border-faint)] p-4"
                >
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--heat-8)] text-[var(--heat-100)]">
                    <Truck className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-label-small text-foreground">
                      {activity.activity || activity.status || "Tracking update"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {[activity.location, activity.date].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-[var(--border-muted)] bg-white p-6">
          <h2 className="mb-4 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
            Items ({items.length})
          </h2>
          <ul className="divide-y divide-[var(--border-faint)]">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <img
                  src={item.image}
                  alt=""
                  className="size-16 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-label-small text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    {item.brand} / qty {item.qty}
                  </p>
                </div>
                <p className="text-label-medium font-medium text-foreground">
                  {formatINR(item.price * item.qty)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/orders"
            className="button button-primary inline-flex h-11 items-center gap-2 rounded-md px-5 text-label-medium"
          >
            View all orders <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/products"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-5 text-label-medium text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
          >
            Continue shopping
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
