import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cart, useCart } from "@/lib/cart-store";
import { formatINR, getProduct } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, CreditCard, Truck, ShieldCheck, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — LapKart" }] }),
  component: Checkout,
});

function Checkout() {
  const items = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: user?.user_metadata?.full_name || "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  const rows = items
    .map((i) => ({ p: getProduct(i.id), qty: i.qty }))
    .filter((r): r is { p: NonNullable<ReturnType<typeof getProduct>>; qty: number } => !!r.p);

  const subtotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const shipping = subtotal > 999 || subtotal === 0 ? 0 : 49;
  const total = subtotal + shipping;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const placeOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (rows.length === 0) return toast.error("Cart is empty");
    if (!user) return;
    setBusy(true);
    try {
      const addressLine = [form.line1, form.line2, form.city, form.state, form.pincode]
        .filter(Boolean)
        .join(", ");

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          shipping,
          total,
          shipping_name: form.full_name,
          shipping_phone: form.phone,
          shipping_address: addressLine,
          payment_method: "mock",
          payment_status: "paid",
          status: "confirmed",
        })
        .select("id")
        .single();
      if (error) throw error;

      const itemsPayload = rows.map((r) => ({
        order_id: order.id,
        title: r.p.title,
        image: r.p.image,
        brand: r.p.brand,
        price: r.p.price,
        qty: r.qty,
      }));
      const { error: itErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itErr) throw itErr;

      // also save address (best effort)
      await supabase.from("addresses").insert({
        user_id: user.id,
        full_name: form.full_name,
        phone: form.phone,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      });

      cart.clear();
      toast.success("Order placed!");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={placeOrder}
          className="space-y-4"
        >
          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 flex items-center gap-2 font-bold"><MapPin className="size-4 text-primary" /> Shipping Address</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="Full name" value={form.full_name} onChange={set("full_name")} className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
              <input required placeholder="Phone (10 digits)" value={form.phone} onChange={set("phone")} pattern="[0-9]{10}" className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
              <input required placeholder="Address line 1" value={form.line1} onChange={set("line1")} className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
              <input placeholder="Address line 2 (optional)" value={form.line2} onChange={set("line2")} className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:col-span-2" />
              <input required placeholder="City" value={form.city} onChange={set("city")} className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input required placeholder="State" value={form.state} onChange={set("state")} className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              <input required placeholder="Pincode" value={form.pincode} onChange={set("pincode")} pattern="[0-9]{6}" className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          </div>

          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><CreditCard className="size-4 text-primary" /> Payment</h2>
            <label className="flex items-start gap-3 rounded-md border-2 border-primary bg-primary/5 p-3">
              <input type="radio" defaultChecked className="mt-1" />
              <div>
                <p className="font-semibold">Mock Payment (Demo)</p>
                <p className="text-xs text-muted-foreground">Click Place Order to simulate a successful payment. Real Stripe coming soon.</p>
              </div>
            </label>
          </div>

          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 font-bold">Items ({rows.length})</h2>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.p.id} className="flex gap-3 py-3">
                  <img src={r.p.image} alt="" className="size-14 rounded bg-white object-contain p-1" />
                  <div className="flex-1 text-sm">
                    <p className="line-clamp-1 font-medium">{r.p.title}</p>
                    <p className="text-xs text-muted-foreground">{r.p.brand} · Qty {r.qty}</p>
                  </div>
                  <p className="text-sm font-bold">{formatINR(r.p.price * r.qty)}</p>
                </li>
              ))}
            </ul>
          </div>

          <button type="submit" disabled={busy || rows.length === 0} className="hidden w-full rounded-sm bg-[oklch(0.7_0.18_40)] py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-50 lg:block">
            {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : `PLACE ORDER · ${formatINR(total)}`}
          </button>
        </motion.form>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">Price Details</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd className={shipping === 0 ? "text-success" : ""}>{shipping === 0 ? "FREE" : formatINR(shipping)}</dd></div>
              <div className="border-t border-dashed border-border pt-3" />
              <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatINR(total)}</dd></div>
            </dl>
            <button form="" onClick={placeOrder as unknown as React.MouseEventHandler<HTMLButtonElement>} disabled={busy || rows.length === 0} className="mt-5 w-full rounded-sm bg-[oklch(0.7_0.18_40)] py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-50 lg:hidden">
              {busy ? <Loader2 className="mx-auto size-4 animate-spin" /> : "PLACE ORDER"}
            </button>
          </div>
          <div className="rounded-lg bg-card p-4 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 py-1"><Truck className="size-4 text-primary" /> Free delivery on orders above ₹999</div>
            <div className="flex items-center gap-2 py-1"><ShieldCheck className="size-4 text-primary" /> 100% genuine, tested parts</div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
