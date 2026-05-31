import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, Panel } from "@/components/DashboardShell";
import { formatINR } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { useProductsByIds } from "@/lib/products-db";
import { CreditCard, FileText, Loader2, PackageCheck, ShieldCheck, Truck } from "lucide-react";

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

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";
const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID ?? "";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout - LAPKART AI" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const items = useCart();
  const { data: products = [] } = useProductsByIds(items.map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return items
      .map((item) => ({ product: byId.get(item.id), qty: item.qty }))
      .filter((row): row is { product: NonNullable<typeof row.product>; qty: number } => Boolean(row.product));
  }, [items, products]);

  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.qty, 0);
  const total = subtotal > 0 ? subtotal : 999;
  const amountPaise = Math.round(total * 100);

  const pay = async () => {
    setError(null);
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
          receipt: `lapkart_${Date.now()}`,
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
        name: "LAPKART AI",
        description: rows.length > 0 ? `${rows.length} laptop marketplace item(s)` : "LAPKART AI test payment",
        order_id: orderResponseBody.order_id,
        prefill: {
          name: "LAPKART Test Customer",
          email: "customer@lapkart.ai",
          contact: "9999999999",
        },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            toast.info("Payment cancelled");
          },
        },
        handler: async (response) => {
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
          setPaid(true);
          toast.success("Razorpay test payment verified");
        },
      });
      (checkout as any).on?.("payment.failed", (response: { error?: { description?: string; reason?: string } }) => {
        const message = response.error?.description ?? response.error?.reason ?? "Payment failed";
        setError(message);
        toast.error(message);
        setBusy(false);
      });
      checkout.open();
      setBusy(false);
    } catch (error) {
      setBusy(false);
      const message = error instanceof Error ? error.message : "Payment failed";
      setError(message);
      toast.error(message);
    }
  };

  const steps = [
    ["Cart total", PackageCheck],
    ["Razorpay checkout", CreditCard],
    ["Signature verified", ShieldCheck],
    ["Invoice ready", FileText],
    ["Delivery assigned", Truck],
  ] as const;

  return (
    <DashboardShell
      eyebrow="secure checkout"
      title="Razorpay test payment"
      description="This checkout creates a Razorpay order on the local API, opens Razorpay Checkout, then verifies the payment signature server-side."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
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
            {rows.length > 0 ? "Calculated from your cart." : "Demo amount because your cart is empty."}
          </p>
          {error && (
            <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
              {error}
            </p>
          )}
          <button
            onClick={pay}
            disabled={busy || paid}
            className="button button-primary mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md text-label-medium disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            {paid ? "Payment verified" : "Pay with Razorpay"}
          </button>
          {paid && (
            <p className="mt-4 rounded-md border border-[var(--accent-forest)]/20 bg-[var(--accent-forest)]/10 p-3 text-body-small text-[var(--accent-forest)]">
              Payment success. Signature verified by the local API.
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
