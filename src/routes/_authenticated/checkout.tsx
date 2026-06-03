import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/DashboardShell";
import { CheckoutCartSkeleton } from "@/components/LoadingSkeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DeliveryMapPicker,
  type DeliveryPin,
  type ResolvedDeliveryAddress,
} from "@/components/DeliveryMapPicker";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/catalog";
import { cart, useCartState } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth";
import { useProductsByIds } from "@/lib/products-db";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  LocateFixed,
  MapPin,
  Package,
  Route as RouteIcon,
  ShieldCheck,
  Timer,
  Truck,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
  }
}

type RazorpayCheckout = {
  open: () => void;
  on?: (
    event: "payment.failed",
    handler: (response: { error?: { description?: string; reason?: string } }) => void,
  ) => void;
};

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

type BackendCheckoutOrderResponse = {
  razorpayOrder: {
    order_id: string;
    amount: number;
    currency: string;
  };
  summary: {
    subtotal: number;
    shipping: number;
    total: number;
    amountPaise: number;
    deliveryEstimate: DeliveryEstimate;
    selectedCourier: CourierQuote;
  };
  error?: string;
};

type BackendCheckoutCompleteResponse = {
  verified?: boolean;
  orderId?: string;
  error?: string;
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

const stepConfig = [
  { label: "Cart", icon: Package },
  { label: "Address", icon: MapPin },
  { label: "Shipping", icon: Truck },
  { label: "Payment", icon: Wallet },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout - LapKart" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, session, role } = useAuth();
  const { items, isHydrated: isCartHydrated } = useCartState();
  const { data: products = [], isLoading: productsLoading } = useProductsByIds(
    items.map((item) => item.id),
  );
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
      .filter((row): row is { product: NonNullable<typeof row.product>; qty: number } =>
        Boolean(row.product),
      );
  }, [items, products]);

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const selectedCourier =
    deliveryEstimate?.couriers.find((courier) => courier.quoteId === selectedQuoteId) ?? null;
  const shipping =
    subtotal === 0
      ? 0
      : selectedCourier
        ? subtotal > 999
          ? 0
          : selectedCourier.rate
        : subtotal > 999
          ? 0
          : 49;
  const total = subtotal + shipping;
  const cartLoading = !isCartHydrated || (items.length > 0 && productsLoading);
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
      ? {
          latitude: address.latitude as number,
          longitude: address.longitude as number,
          source: address.locationSource,
        }
      : null;
  const activeStep = useMemo(() => {
    if (orderId) return 3;
    if (selectedCourier && !estimateLoading) return 2;
    if (hasValidAddress) return 1;
    return 0;
  }, [orderId, selectedCourier, estimateLoading, hasValidAddress]);

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
          locationSource:
            current.locationSource ?? (data.location_source as DeliveryPin["source"] | null),
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
      setEstimateLoading(false);
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
        const response = await fetch(url, {
          signal: controller.signal,
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        const data = (await response.json()) as DeliveryEstimate & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not calculate delivery estimate");
        setDeliveryEstimate(data);
        setSelectedQuoteId((current) => {
          if (data.couriers.some((courier) => courier.quoteId === current)) return current;
          return (
            data.couriers.find((courier) => courier.recommended)?.quoteId ??
            data.couriers[0]?.quoteId ??
            null
          );
        });
        if (data.couriers.length === 0) {
          setEstimateError(
            "No standard or Shiprocket Quick courier currently services this location",
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setDeliveryEstimate(null);
        setSelectedQuoteId(null);
        setEstimateError(
          error instanceof Error ? error.message : "Could not calculate delivery estimate",
        );
      } finally {
        if (!controller.signal.aborted) setEstimateLoading(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    address.latitude,
    address.longitude,
    address.pincode,
    hasDeliveryPin,
    rows.length,
    session?.access_token,
    subtotal,
  ]);

  const pay = async () => {
    setError(null);
    if (!user) {
      toast.error("Sign in before checkout");
      return;
    }
    if (!session?.access_token) {
      toast.error("Sign in again before checkout");
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
      const orderResponse = await fetch(`${apiBase}/checkout/create-payment-order`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          items: rows.map(({ product, qty }) => ({ id: product.id, qty })),
          address,
          selectedQuoteId,
          saveAddress,
        }),
      });
      const orderResponseBody = (await orderResponse
        .json()
        .catch(() => null)) as BackendCheckoutOrderResponse | null;
      if (!orderResponse.ok) {
        throw new Error(orderResponseBody?.error ?? "Could not create Razorpay order");
      }
      if (!orderResponseBody?.razorpayOrder.order_id) {
        throw new Error("Razorpay order response was incomplete");
      }
      setDeliveryEstimate(orderResponseBody.summary.deliveryEstimate);
      setSelectedQuoteId(orderResponseBody.summary.selectedCourier.quoteId);

      const checkout = new window.Razorpay!({
        key: razorpayKey,
        amount: orderResponseBody.razorpayOrder.amount,
        currency: orderResponseBody.razorpayOrder.currency,
        name: "LapKart",
        description:
          rows.length > 0 ? `${rows.length} laptop marketplace item(s)` : "LapKart test payment",
        order_id: orderResponseBody.razorpayOrder.order_id,
        prefill: {
          name: address.fullName.trim(),
          email: address.email.trim() || user.email || "",
          contact: address.phone.replace(/\D/g, "").slice(-10),
        },
        theme: { color: "#fa5d19" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.info("Payment cancelled");
          },
        },
        handler: async (response) => {
          try {
            const completeResponse = await fetch(`${apiBase}/checkout/complete-payment`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const completed = (await completeResponse
              .json()
              .catch(() => null)) as BackendCheckoutCompleteResponse | null;
            if (!completeResponse.ok || !completed?.verified || !completed.orderId) {
              throw new Error(completed?.error ?? "Could not complete paid order");
            }
            setOrderId(completed.orderId);
            cart.clear();
            toast.success("Order placed and payment verified");
            navigate({ to: "/order/$id", params: { id: completed.orderId } });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Could not place order";
            setError(message);
            toast.error(message);
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.on?.("payment.failed", (response) => {
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

  return (
    <DashboardShell
      eyebrow="secure checkout"
      title="Checkout"
      description="Complete your order with secure Razorpay payment and real-time delivery estimates."
    >
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-7xl"
      >
        <motion.div variants={itemVariants} className="mb-10">
          <StepIndicator steps={stepConfig} activeIndex={activeStep} />
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <motion.div variants={containerVariants} className="space-y-8">
            {/* Delivery Address */}
            <motion.section
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-white shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--heat-100)] text-white">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <h2 className="text-label-large text-foreground">Delivery Address</h2>
                  <p className="text-body-small text-[var(--black-alpha-48)]">
                    Where should we ship your order?
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <InputField label="Full name" icon={null}>
                    <input
                      value={address.fullName}
                      onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                      className="input-field"
                      placeholder="John Doe"
                    />
                  </InputField>
                  <InputField label="Phone" icon={null}>
                    <input
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                      inputMode="tel"
                      className="input-field"
                      placeholder="+91 98765 43210"
                    />
                  </InputField>
                  <InputField label="Email" icon={null}>
                    <input
                      value={address.email}
                      onChange={(e) => setAddress({ ...address, email: e.target.value })}
                      type="email"
                      className="input-field"
                      placeholder="john@example.com"
                    />
                  </InputField>
                  <InputField label="Pincode" icon={null}>
                    <input
                      value={address.pincode}
                      onChange={(e) =>
                        setAddress({
                          ...address,
                          pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                        })
                      }
                      inputMode="numeric"
                      maxLength={6}
                      className="input-field"
                      placeholder="560001"
                    />
                  </InputField>
                  <InputField label="Address line 1" wide icon={null}>
                    <input
                      value={address.line1}
                      onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                      className="input-field"
                      placeholder="Street address, apartment, building"
                    />
                  </InputField>
                  <InputField label="Address line 2" wide icon={null}>
                    <input
                      value={address.line2}
                      onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                      className="input-field"
                      placeholder="Landmark, floor, suite (optional)"
                    />
                  </InputField>
                  <InputField label="City" icon={null}>
                    <input
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      className="input-field"
                      placeholder="Bangalore"
                    />
                  </InputField>
                  <InputField label="State" icon={null}>
                    <select
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      className="input-field appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                    >
                      {indianStates.map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </InputField>
                </div>
                <label className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3 transition-colors hover:border-[var(--heat-40)]">
                  <input
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="size-5 accent-[var(--heat-100)]"
                  />
                  <span className="text-body-small text-[var(--black-alpha-72)]">
                    Save this address for future orders
                  </span>
                </label>
              </div>
            </motion.section>

            {/* Delivery Pin & Courier */}
            <motion.section
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-white shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--heat-100)] text-white">
                  <LocateFixed className="size-4" />
                </div>
                <div>
                  <h2 className="text-label-large text-foreground">Delivery Pin</h2>
                  <p className="text-body-small text-[var(--black-alpha-48)]">
                    Pin your location for accurate courier quotes
                  </p>
                </div>
              </div>
              <div className="p-6">
                <DeliveryMapPicker
                  value={deliveryPin}
                  addressLabel={
                    hasValidAddress
                      ? `${address.city}, ${address.state} ${address.pincode}`
                      : "delivery pin"
                  }
                  authToken={session?.access_token}
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
              </div>
            </motion.section>

            {/* Payment Methods */}
            <motion.section
              variants={itemVariants}
              className="overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-white shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-faint)] bg-[var(--background-lighter)] px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--heat-100)] text-white">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <h2 className="text-label-large text-foreground">Payment</h2>
                  <p className="text-body-small text-[var(--black-alpha-48)]">
                    Secure checkout powered by Razorpay
                  </p>
                </div>
              </div>
              <div className="p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    "UPI",
                    "Cards",
                    "Net Banking",
                    "EMI",
                    "GPay",
                    "PhonePe",
                    "Paytm",
                    "Wallets",
                  ].map((method, i) => (
                    <motion.div
                      key={method}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] px-4 py-3 transition-[border-color,background-color,box-shadow] hover:border-[var(--heat-40)] hover:bg-[var(--heat-4)] hover:shadow-[var(--shadow-card)]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--heat-100)] shadow-sm transition-colors group-hover:bg-[var(--heat-100)] group-hover:text-white">
                        <Wallet className="size-4" />
                      </div>
                      <span className="text-label-small text-foreground">{method}</span>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-[var(--heat-20)] bg-[var(--heat-4)] px-4 py-3">
                  <ShieldCheck className="size-4 text-[var(--heat-100)]" />
                  <span className="text-body-small text-[var(--black-alpha-72)]">
                    All transactions are encrypted and verified by Razorpay.
                  </span>
                </div>
              </div>
            </motion.section>
          </motion.div>

          {/* Order Summary Sidebar */}
          <motion.aside variants={itemVariants} className="h-fit space-y-6">
            <div className="sticky top-6 overflow-hidden rounded-2xl border border-[var(--border-faint)] bg-white shadow-[var(--shadow-card)]">
              <div className="border-b border-[var(--border-faint)] bg-gradient-to-r from-[var(--heat-100)] to-[var(--heat-200)] px-6 py-4">
                <p className="text-mono-x-small uppercase tracking-[0.2em] text-white/80">
                  Order Summary
                </p>
                {cartLoading ? (
                  <Skeleton className="mt-2 h-7 w-28 bg-white/20" />
                ) : (
                  <h2 className="mt-1 font-display text-title-h5 text-white">{formatINR(total)}</h2>
                )}
              </div>

              <div className="p-6">
                {/* Cart items */}
                <div className="space-y-4">
                  {cartLoading ? (
                    <CheckoutCartSkeleton />
                  ) : (
                    <>
                      <AnimatePresence mode="popLayout">
                        {rows.map(({ product, qty }) => (
                          <motion.div
                            key={product.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-start gap-3"
                          >
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)]">
                              {product.images?.[0] || product.image ? (
                                <img
                                  src={product.images?.[0] ?? product.image}
                                  alt={product.title}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="size-5 text-[var(--black-alpha-24)]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-label-small text-foreground">
                                {product.title}
                              </p>
                              <p className="mt-0.5 text-body-small text-[var(--black-alpha-48)]">
                                {product.brand}
                              </p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-label-small text-foreground">
                                  {formatINR(product.price)}
                                </span>
                                <span className="rounded-sm bg-[var(--background-lighter)] px-1.5 py-0.5 text-mono-x-small text-[var(--black-alpha-48)]">
                                  x{qty}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {rows.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-muted)] py-8 text-center">
                          <Package className="size-8 text-[var(--black-alpha-16)]" />
                          <p className="mt-2 text-body-small text-[var(--black-alpha-48)]">
                            Your cart is empty
                          </p>
                          <Link
                            to="/products"
                            className="mt-3 inline-flex items-center gap-1 text-label-small text-[var(--heat-100)] hover:underline"
                          >
                            Browse products <ChevronRight className="size-3" />
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {cartLoading ? (
                  <div className="mt-5 space-y-3 border-t border-[var(--border-faint)] pt-5">
                    <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
                    <Skeleton className="h-4 w-full bg-[var(--black-alpha-8)]" />
                    <Skeleton className="h-7 w-full bg-[var(--black-alpha-8)]" />
                  </div>
                ) : (
                  <>
                    <div className="mt-5 space-y-2 border-t border-[var(--border-faint)] pt-5">
                      <SummaryRow label="Subtotal" value={formatINR(subtotal)} />
                      <SummaryRow
                        label="Shipping"
                        value={shipping === 0 ? "FREE" : formatINR(shipping)}
                        highlight={shipping === 0}
                      />
                      <SummaryRow label="Taxes" value="Included" />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--border-faint)] pt-4">
                      <span className="text-label-medium text-foreground">Total</span>
                      <motion.span
                        key={total}
                        initial={{ scale: 1.1, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="font-display text-title-h5 text-foreground"
                      >
                        {formatINR(total)}
                      </motion.span>
                    </div>
                  </>
                )}

                {selectedCourier && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 overflow-hidden rounded-xl border border-[var(--heat-20)] bg-gradient-to-br from-[var(--heat-4)] to-white p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Truck className="size-4 text-[var(--heat-100)]" />
                      <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--heat-100)]">
                        Delivery Estimate
                      </p>
                    </div>
                    <p className="mt-2 text-label-small text-foreground">
                      {selectedCourier.courierName}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-64)]">
                      Expected{" "}
                      {selectedCourier.etd || `${selectedCourier.estimatedDeliveryDays} day(s)`}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <RouteIcon className="size-3.5 text-[var(--black-alpha-48)]" />
                      <span className="text-mono-x-small text-[var(--black-alpha-48)]">
                        {deliveryEstimate?.route.readableDistance || "—"} ·{" "}
                        {deliveryEstimate?.route.readableDuration || "—"}
                      </span>
                    </div>
                  </motion.div>
                )}

                <div className="mt-4 rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
                    <p className="text-body-small text-[var(--black-alpha-72)]">
                      {hasValidAddress
                        ? `${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.state} ${address.pincode}`
                        : "Complete delivery address to proceed."}
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-body-small text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={pay}
                  disabled={
                    cartLoading ||
                    busy ||
                    Boolean(orderId) ||
                    rows.length === 0 ||
                    estimateLoading ||
                    !selectedCourier
                  }
                  className="button button-primary mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-label-medium disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  {orderId ? "Order placed" : `Pay ${formatINR(total)}`}
                </motion.button>

                {orderId && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/10 p-3 text-body-small text-[var(--accent-forest)]"
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    Payment successful. Redirecting to order details…
                  </motion.div>
                )}
              </div>
            </div>
          </motion.aside>
        </div>
      </motion.div>
    </DashboardShell>
  );
}

function StepIndicator({
  steps,
  activeIndex,
}: {
  steps: { label: string; icon: React.ElementType }[];
  activeIndex: number;
}) {
  return (
    <div className="relative">
      <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-[var(--border-faint)] md:block" />
      <div className="relative grid grid-cols-4 gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i <= activeIndex;
          const isCurrent = i === activeIndex;
          return (
            <motion.div
              key={step.label}
              className="relative flex flex-col items-center"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <motion.div
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                }}
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 shadow-sm transition-colors ${
                  isActive
                    ? "border-[var(--heat-100)] bg-[var(--heat-100)] text-white"
                    : "border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-48)]"
                }`}
              >
                {isActive && i < activeIndex ? (
                  <Check className="size-5" />
                ) : (
                  <Icon className="size-5" />
                )}
              </motion.div>
              <span
                className={`mt-2 text-mono-x-small uppercase tracking-[0.14em] ${
                  isActive ? "text-[var(--heat-100)]" : "text-[var(--black-alpha-48)]"
                }`}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function InputField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <label className={`group ${wide ? "md:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-label-x-small text-[var(--black-alpha-56)]">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-body-small text-[var(--black-alpha-64)]">{label}</span>
      <span
        className={`text-label-small ${highlight ? "text-[var(--accent-forest)]" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
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
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-64)]">
        <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
        Checking route and courier ETDs
      </div>
    );
  }

  if (error) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-body-small text-destructive"
      >
        {error}
      </motion.p>
    );
  }

  if (!estimate) {
    return (
      <p className="mt-5 rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-64)]">
        Confirm a delivery pin and pincode to check courier availability.
      </p>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mt-5 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
        >
          <div className="flex items-center gap-2">
            <RouteIcon className="size-4 text-[var(--heat-100)]" />
            <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">
              Road Distance
            </p>
          </div>
          <p className="mt-2 font-display text-title-h5 text-foreground">
            {estimate.route.readableDistance ||
              `${(estimate.route.distanceMeters / 1000).toFixed(1)} km`}
          </p>
        </motion.div>
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
        >
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-[var(--heat-100)]" />
            <p className="text-mono-x-small uppercase tracking-[0.14em] text-[var(--black-alpha-48)]">
              Route Time
            </p>
          </div>
          <p className="mt-2 font-display text-title-h5 text-foreground">
            {estimate.route.readableDuration ||
              `${Math.ceil(estimate.route.durationSeconds / 60)} min`}
          </p>
        </motion.div>
      </div>
      <div className="space-y-2">
        {estimate.couriers.map((courier, i) => {
          const selected = courier.quoteId === selectedQuoteId;
          return (
            <motion.button
              key={courier.quoteId}
              type="button"
              onClick={() => onSelect(courier.quoteId)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`group flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] ${
                selected
                  ? "border-[var(--heat-100)] bg-gradient-to-r from-[var(--heat-4)] to-white shadow-[var(--shadow-card)]"
                  : "border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)] hover:shadow-[var(--shadow-card)]"
              }`}
            >
              <span className="flex min-w-0 gap-3">
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    selected
                      ? "border-[var(--heat-100)] bg-[var(--heat-100)] text-white"
                      : "border-[var(--black-alpha-24)]"
                  }`}
                >
                  {selected && <Check className="size-3" />}
                </div>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-label-small text-foreground">{courier.courierName}</span>
                    {courier.recommended && (
                      <span className="rounded-sm bg-[var(--heat-12)] px-2 py-0.5 text-mono-x-small uppercase text-[var(--heat-100)]">
                        Recommended
                      </span>
                    )}
                    {courier.serviceType === "quick" && (
                      <span className="rounded-sm bg-[var(--accent-forest)]/10 px-2 py-0.5 text-mono-x-small uppercase text-[var(--accent-forest)]">
                        Quick
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-body-small text-[var(--black-alpha-56)]">
                    {courier.mode} · Expected{" "}
                    {courier.etd || `${courier.estimatedDeliveryDays} day(s)`}
                    {courier.rating ? ` · ${courier.rating} rating` : ""}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-label-small text-foreground">
                {formatINR(courier.rate)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
