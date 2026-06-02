import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, Panel } from "@/components/DashboardShell";
import {
  DeliveryMapPicker,
  type DeliveryPin,
  type ResolvedDeliveryAddress,
} from "@/components/DeliveryMapPicker";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { cart, useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth";
import { useProductsByIds } from "@/lib/products-db";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  LocateFixed,
  MapPin,
  PackageCheck,
  Route as RouteIcon,
  ShieldCheck,
  Timer,
  Truck,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
};

type CourierQuote = {
  quoteId: string;
  courierCompanyId: number | null;
  courierName: string;
  rate: number;
  rating: number;
  etd: string;
  expectedDeliveryDate: string | null;
  estimatedDeliveryDays: number;
  etdHours: number;
  mode: string;
  recommended: boolean;
  serviceType: "standard" | "quick";
};

type DeliveryEstimate = {
  dispatch: {
    pickupLocation: string;
    pincode: string;
  };
  route: {
    distanceMeters: number;
    durationSeconds: number;
    readableDistance: string;
    readableDuration: string;
  };
  couriers: CourierQuote[];
  generatedAt: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";
const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID ?? "";

const indianStates = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Maharashtra",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout - LapKart" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const items = useCart();
  const { data: products = [] } = useProductsByIds(items.map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    email: "",
    line1: "",
    line2: "",
    city: "",
    state: "Karnataka",
    pincode: "",
    latitude: null as number | null,
    longitude: null as number | null,
    locationSource: null as DeliveryPin["source"] | null,
    olaPlaceId: null as string | null,
    formattedAddress: "",
  });

  const rows = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return items
      .map((item) => ({ product: byId.get(item.id), qty: item.qty }))
      .filter((row): row is { product: NonNullable<typeof row.product>; qty: number } => Boolean(row.product));
  }, [items, products]);

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;
  const amountPaise = Math.round(total * 100);
  const hasValidAddress =
    address.fullName.trim().length > 1 &&
    address.line1.trim().length > 5 &&
    address.city.trim().length > 1 &&
    address.state.trim().length > 1 &&
    /^[0-9]{6}$/.test(address.pincode.trim()) &&
    address.phone.replace(/\D/g, "").length >= 10;
  const hasDeliveryPin = address.latitude !== null && address.longitude !== null;
  const deliveryPin =
    hasDeliveryPin && address.locationSource
      ? { latitude: address.latitude as number, longitude: address.longitude as number, source: address.locationSource }
      : null;
  const selectedCourier =
    deliveryEstimate?.couriers.find((courier) => courier.quoteId === selectedQuoteId) ?? null;

  useEffect(() => {
    if (!user) return;
    setAddress((current) => ({
      ...current,
      fullName: current.fullName || user.user_metadata?.full_name || "",
      email: current.email || user.email || "",
    }));

    supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setAddress((current) => ({
          ...current,
          fullName: current.fullName || data.full_name,
          phone: current.phone || data.phone,
          line1: current.line1 || data.line1,
          line2: current.line2 || data.line2 || "",
          city: current.city || data.city,
          state: current.state || data.state,
          pincode: current.pincode || data.pincode,
          latitude: current.latitude ?? data.latitude,
          longitude: current.longitude ?? data.longitude,
          locationSource: current.locationSource ?? (data.location_source as DeliveryPin["source"] | null),
          olaPlaceId: current.olaPlaceId ?? data.ola_place_id,
          formattedAddress: current.formattedAddress || data.formatted_address || "",
        }));
      });
  }, [user]);

  useEffect(() => {
    if (!hasDeliveryPin || !/^[0-9]{6}$/.test(address.pincode.trim()) || rows.length === 0) {
      setDeliveryEstimate(null);
      setSelectedQuoteId(null);
      setEstimateError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setEstimateLoading(true);
        setEstimateError(null);
        const url = new URL(`${apiBase}/maps/delivery-estimate`);
        url.searchParams.set("latitude", String(address.latitude));
        url.searchParams.set("longitude", String(address.longitude));
        url.searchParams.set("pincode", address.pincode.trim());
        url.searchParams.set("declaredValue", String(subtotal));
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json() as DeliveryEstimate & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not calculate delivery estimate");
        setDeliveryEstimate(data);
        setSelectedQuoteId((current) => {
          if (data.couriers.some((courier) => courier.quoteId === current)) return current;
          return data.couriers.find((courier) => courier.recommended)?.quoteId
            ?? data.couriers[0]?.quoteId
            ?? null;
        });
        if (data.couriers.length === 0) {
          setEstimateError("No standard or Shiprocket Quick courier currently services this location");
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setDeliveryEstimate(null);
        setSelectedQuoteId(null);
        setEstimateError(error instanceof Error ? error.message : "Could not calculate delivery estimate");
      } finally {
        if (!controller.signal.aborted) setEstimateLoading(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address.latitude, address.longitude, address.pincode, rows.length, subtotal]);

  const pay = async () => {
    setError(null);
    if (!user) {
      toast.error("Sign in before checkout");
      return;
    }
    if (rows.length === 0) {
      toast.error("Add at least one item to your cart");
      return;
    }
    if (!hasValidAddress) {
      toast.error("Complete delivery location before payment");
      return;
    }
    if (!hasDeliveryPin) {
      toast.error("Confirm the delivery pin before payment");
      return;
    }
    if (!deliveryEstimate || !selectedCourier) {
      toast.error("Select an available delivery estimate before payment");
      return;
    }
    if (!razorpayKey) {
      toast.error("Razorpay key is missing. Restart Vite after updating .env.");
      return;
    }
    setBusy(true);
    try {
      await loadRazorpay();
      const orderResponse = await fetch(`${apiBase}/api/create-order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `lk_${Date.now()}`,
        }),
      });
      const orderResponseBody = await orderResponse.json().catch(() => null) as
        | { order_id: string; amount: number; currency: string; error?: string }
        | null;
      if (!orderResponse.ok) {
        throw new Error(orderResponseBody?.error ?? "Could not create Razorpay order");
      }
      if (!orderResponseBody?.order_id) {
        throw new Error("Razorpay order response was incomplete");
      }

      const checkout = new window.Razorpay!({
        key: razorpayKey,
        amount: orderResponseBody.amount,
        currency: orderResponseBody.currency,
        name: "LapKart",
        description: rows.length > 0 ? `${rows.length} laptop marketplace item(s)` : "LapKart test payment",
        order_id: orderResponseBody.order_id,
        prefill: {
          name: address.fullName.trim(),
          email: address.email.trim() || user.email || "",
          contact: address.phone.replace(/\D/g, "").slice(-10),
        },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.info("Payment cancelled");
          },
        },
        handler: async (response) => {
          try {
            const verifyResponse = await fetch(`${apiBase}/api/verify-payment`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verified = await verifyResponse.json().catch(() => null) as { verified?: boolean; error?: string } | null;
            if (!verifyResponse.ok || !verified?.verified) {
              throw new Error(verified?.error ?? "Razorpay signature verification failed");
            }
            const createdOrderId = await placeOrder({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setOrderId(createdOrderId);
            cart.clear();
            toast.success("Order placed and payment verified");
            navigate({ to: "/order/$id", params: { id: createdOrderId } });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not place order";
            setError(message);
            toast.error(message);
          } finally {
            setBusy(false);
          }
        },
      });
      (checkout as any).on?.("payment.failed", (response: { error?: { description?: string; reason?: string } }) => {
        const message = response.error?.description ?? response.error?.reason ?? "Payment failed";
        setError(message);
        toast.error(message);
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setBusy(false);
      const message = error instanceof Error ? error.message : "Payment failed";
      setError(message);
      toast.error(message);
    }
  };

  const placeOrder = async (payment: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => {
    if (!user) throw new Error("Sign in before checkout");
    const createdOrderId = crypto.randomUUID();
    const shippingAddress = [
      address.line1.trim(),
      address.line2.trim(),
      `${address.city.trim()}, ${address.state.trim()} ${address.pincode.trim()}`,
      "India",
    ].filter(Boolean).join("\n");

    const { error: orderError } = await supabase.from("orders").insert({
      id: createdOrderId,
      user_id: user.id,
      status: "confirmed",
      payment_status: "paid",
      payment_method: "razorpay",
      subtotal,
      shipping,
      total,
      shipping_name: address.fullName.trim(),
      shipping_phone: address.phone.replace(/\D/g, "").slice(-10),
      shipping_email: address.email.trim() || user.email || null,
      shipping_address: shippingAddress,
      shipping_line1: address.line1.trim(),
      shipping_line2: address.line2.trim() || null,
      shipping_city: address.city.trim(),
      shipping_state: address.state.trim(),
      shipping_pincode: address.pincode.trim(),
      shipping_country: "India",
      shipping_latitude: address.latitude,
      shipping_longitude: address.longitude,
      shipping_location_source: address.locationSource,
      shipping_place_id: address.olaPlaceId,
      shipping_formatted_address: address.formattedAddress || null,
      shipping_route_distance_meters: deliveryEstimate?.route.distanceMeters ?? null,
      shipping_route_duration_seconds: deliveryEstimate?.route.durationSeconds ?? null,
      shipping_estimate: deliveryEstimate ?? {},
      shipping_courier_company_id: selectedCourier?.courierCompanyId ?? null,
      shipping_courier_name: selectedCourier?.courierName ?? null,
      shipping_service_type: selectedCourier?.serviceType ?? "standard",
      shipping_expected_delivery_date: selectedCourier?.expectedDeliveryDate ?? null,
      shipping_charge_estimate: selectedCourier?.rate ?? null,
      tracking: [
        {
          label: "Order placed",
          at: new Date().toISOString(),
          razorpay_order_id: payment.razorpayOrderId,
          razorpay_payment_id: payment.razorpayPaymentId,
        },
      ],
    });
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      rows.map(({ product, qty }) => ({
        order_id: createdOrderId,
        product_id: product.id,
        title: product.title,
        image: product.images?.[0] ?? product.image,
        brand: product.brand,
        price: product.price,
        unit_price: product.price,
        qty,
      })),
    );
    if (itemsError) throw itemsError;

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: createdOrderId,
      provider: "razorpay",
      method: "test",
      amount: total,
      status: "paid",
      provider_order_id: payment.razorpayOrderId,
      provider_payment_id: payment.razorpayPaymentId,
      provider_signature: payment.razorpaySignature,
      raw_payload: payment,
    });
    if (paymentError) throw paymentError;

    if (saveAddress) {
      await supabase.from("addresses").insert({
        user_id: user.id,
        full_name: address.fullName.trim(),
        phone: address.phone.replace(/\D/g, "").slice(-10),
        line1: address.line1.trim(),
        line2: address.line2.trim() || null,
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
        latitude: address.latitude,
        longitude: address.longitude,
        location_source: address.locationSource,
        ola_place_id: address.olaPlaceId,
        formatted_address: address.formattedAddress || null,
        is_default: true,
      });
    }

    return createdOrderId;
  };

  const steps = [
    ["Cart total", PackageCheck],
    ["Razorpay checkout", CreditCard],
    ["Signature verified", ShieldCheck],
    ["Delivery quote", RouteIcon],
    ["Order placed", Truck],
  ] as const;

  return (
    <DashboardShell
      eyebrow="secure checkout"
      title="Delivery and Razorpay"
      description="Select delivery location, pay with the configured Razorpay test key, then create a real LapKart order after signature verification."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Panel title="Delivery location">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <input
                value={address.fullName}
                onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="Phone">
              <input
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                inputMode="tel"
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="Email">
              <input
                value={address.email}
                onChange={(e) => setAddress({ ...address, email: e.target.value })}
                type="email"
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="Pincode">
              <input
                value={address.pincode}
                onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                inputMode="numeric"
                maxLength={6}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="Address line 1" wide>
              <input
                value={address.line1}
                onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="Address line 2" wide>
              <input
                value={address.line2}
                onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="City">
              <input
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              />
            </Field>
            <Field label="State">
              <select
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)]"
              >
                {indianStates.map((state) => <option key={state}>{state}</option>)}
              </select>
            </Field>
          </div>
          <label className="mt-5 flex items-center gap-2 text-body-small text-[var(--black-alpha-72)]">
            <input
              type="checkbox"
              checked={saveAddress}
              onChange={(e) => setSaveAddress(e.target.checked)}
              className="size-4 accent-[var(--heat-100)]"
            />
            Save this location for future orders
          </label>
        </Panel>

        <Panel title="Delivery pin">
          <DeliveryMapPicker
            value={deliveryPin}
            addressLabel={hasValidAddress ? `${address.city}, ${address.state} ${address.pincode}` : "delivery pin"}
            onChange={(pin) =>
              setAddress((current) => ({
                ...current,
                latitude: pin.latitude,
                longitude: pin.longitude,
                locationSource: pin.source,
              }))
            }
            onAddressResolved={(resolved: ResolvedDeliveryAddress) =>
              setAddress((current) => ({
                ...current,
                line1: resolved.line1 || current.line1,
                line2: resolved.line2 || current.line2,
                city: resolved.city || current.city,
                state: resolved.state || current.state,
                pincode: resolved.pincode || current.pincode,
                latitude: resolved.latitude ?? current.latitude,
                longitude: resolved.longitude ?? current.longitude,
                olaPlaceId: resolved.placeId,
                formattedAddress: resolved.formattedAddress,
              }))
            }
          />
          <DeliveryQuotePicker
            estimate={deliveryEstimate}
            error={estimateError}
            loading={estimateLoading}
            selectedQuoteId={selectedQuoteId}
            onSelect={setSelectedQuoteId}
          />
        </Panel>

        <Panel title="Payment flow">
          <div className="grid gap-4 md:grid-cols-5">
            {steps.map(([label, Icon], index) => (
              <div key={label} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <Icon className="size-5 text-[var(--heat-100)]" />
                <p className="mt-4 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">step {index + 1}</p>
                <p className="mt-1 text-label-medium">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-[var(--border-faint)] bg-white p-5">
            <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
              Razorpay supports
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {["UPI", "GPay", "PhonePe", "Paytm", "Cards", "EMI", "Net Banking"].map((method) => (
                <div key={method} className="rounded-md border border-[var(--border-faint)] p-3 text-label-small">
                  {method}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <aside className="h-fit rounded-lg border border-[var(--border-faint)] bg-white p-6">
          <p className="text-mono-x-small uppercase tracking-[0.2em] text-[var(--heat-100)]">test mode</p>
          <h2 className="mt-2 font-display text-title-h4 text-foreground">{formatINR(total)}</h2>
          <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
            {rows.length > 0 ? `${rows.length} cart item(s), including delivery.` : "Your cart is empty."}
          </p>
          <div className="mt-5 space-y-3 border-t border-[var(--border-faint)] pt-5 text-body-small">
            <SummaryRow label="Subtotal" value={formatINR(subtotal)} />
            <SummaryRow label="Delivery" value={shipping === 0 ? "FREE" : formatINR(shipping)} />
            <SummaryRow label="Total" value={formatINR(total)} strong />
          </div>
          {selectedCourier && (
            <div className="mt-5 rounded-md border border-[var(--heat-20)] bg-[var(--heat-4)] p-3">
              <p className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--heat-100)]">delivery estimate</p>
              <p className="mt-1 text-label-small text-foreground">{selectedCourier.courierName}</p>
              <p className="mt-1 text-body-small text-[var(--black-alpha-64)]">
                Expected {selectedCourier.etd || `${selectedCourier.estimatedDeliveryDays} day(s)`}
              </p>
            </div>
          )}
          <div className="mt-5 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
              <p className="text-body-small text-[var(--black-alpha-72)]">
                {hasValidAddress
                  ? `${address.city}, ${address.state} ${address.pincode}${hasDeliveryPin ? ` · ${address.latitude}, ${address.longitude}` : ""}`
                  : "Complete delivery location before payment."}
              </p>
            </div>
          </div>
          {error && (
            <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={pay}
            disabled={busy || Boolean(orderId) || rows.length === 0 || estimateLoading || !selectedCourier}
            className="button button-primary mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md text-label-medium disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {orderId ? "Order placed" : "Pay and place order"}
          </button>
          {rows.length === 0 && (
            <Link to="/products" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border-muted)] h-11 text-label-medium">
              <LocateFixed className="size-4" /> Select products
            </Link>
          )}
          {orderId && (
            <p className="mt-4 rounded-md border border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/10 p-3 text-body-small text-[var(--accent-forest)]">
              Payment success. Order created in Supabase.
            </p>
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

function DeliveryQuotePicker({
  estimate,
  error,
  loading,
  selectedQuoteId,
  onSelect,
}: {
  estimate: DeliveryEstimate | null;
  error: string | null;
  loading: boolean;
  selectedQuoteId: string | null;
  onSelect: (quoteId: string) => void;
}) {
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-64)]">
        <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
        Checking route and courier ETDs
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-4 text-body-small text-red-700">
        {error}
      </p>
    );
  }

  if (!estimate) {
    return (
      <p className="mt-4 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-64)]">
        Confirm a delivery pin and pincode to check courier availability.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
          <RouteIcon className="size-4 text-[var(--heat-100)]" />
          <p className="mt-2 text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">road distance</p>
          <p className="mt-1 text-label-medium text-foreground">
            {estimate.route.readableDistance || `${(estimate.route.distanceMeters / 1000).toFixed(1)} km`}
          </p>
        </div>
        <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
          <Timer className="size-4 text-[var(--heat-100)]" />
          <p className="mt-2 text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">route time</p>
          <p className="mt-1 text-label-medium text-foreground">
            {estimate.route.readableDuration || `${Math.ceil(estimate.route.durationSeconds / 60)} min`}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {estimate.couriers.map((courier) => {
          const selected = courier.quoteId === selectedQuoteId;
          return (
            <button
              key={courier.quoteId}
              type="button"
              onClick={() => onSelect(courier.quoteId)}
              className={`flex w-full items-start justify-between gap-4 rounded-md border p-3 text-left transition-colors ${
                selected
                  ? "border-[var(--heat-100)] bg-[var(--heat-4)]"
                  : "border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)]"
              }`}
            >
              <span className="flex min-w-0 gap-3">
                <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${selected ? "text-[var(--heat-100)]" : "text-[var(--black-alpha-24)]"}`} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label-small text-foreground">{courier.courierName}</span>
                    {courier.recommended && (
                      <span className="rounded-sm bg-[var(--heat-12)] px-1.5 py-0.5 text-mono-x-small uppercase text-[var(--heat-100)]">
                        recommended
                      </span>
                    )}
                    {courier.serviceType === "quick" && (
                      <span className="rounded-sm bg-[var(--accent-forest)]/10 px-1.5 py-0.5 text-mono-x-small uppercase text-[var(--accent-forest)]">
                        quick
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-body-small text-[var(--black-alpha-56)]">
                    {courier.mode} / expected {courier.etd || `${courier.estimatedDeliveryDays} day(s)`}
                    {courier.rating ? ` / rating ${courier.rating}` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-label-small text-foreground">{formatINR(courier.rate)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "md:col-span-2" : undefined}>
      <span className="mb-1.5 block text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-48)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-label-medium text-foreground" : "text-[var(--black-alpha-64)]"}>{label}</span>
      <span className={strong ? "font-display text-title-h5 text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}
