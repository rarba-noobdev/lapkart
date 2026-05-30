import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cart, useCart } from "@/lib/cart-store";
import { formatINR } from "@/lib/catalog";
import { useProductsByIds } from "@/lib/products-db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, CreditCard, Truck, ShieldCheck, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout — lapkart" }] }),
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

  const { data: prods = [] } = useProductsByIds(items.map((i) => i.id));
  const byId = new Map(prods.map((p) => [p.id, p]));
  const rows = items
    .map((i) => ({ p: byId.get(i.id), qty: i.qty }))
    .filter((r): r is { p: NonNullable<typeof r.p>; qty: number } => !!r.p);

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
        image: (r.p.images?.[0]) ?? r.p.image,
        brand: r.p.brand,
        price: r.p.price,
        qty: r.qty,
      }));
      const { error: itErr } = await supabase.from("order_items").insert(itemsPayload);
      if (itErr) throw itErr;

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
      toast.success("Order placed");
      navigate({ to: "/order/$id", params: { id: order.id } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full h-11 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground outline-none focus:border-[var(--heat-100)] focus:shadow-[0_0_0_3px_var(--heat-12)] transition-all placeholder:text-[var(--black-alpha-32)]";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">checkout</span>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">Confirm your order</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={placeOrder}
            id="checkout-form"
            className="space-y-5"
          >
            <Card>
              <CardTitle icon={MapPin}>Shipping address</CardTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required placeholder="Full name" value={form.full_name} onChange={set("full_name")} className={`${inputCls} sm:col-span-2`} />
                <input required placeholder="Phone (10 digits)" value={form.phone} onChange={set("phone")} pattern="[0-9]{10}" className={`${inputCls} sm:col-span-2`} />
                <input required placeholder="Address line 1" value={form.line1} onChange={set("line1")} className={`${inputCls} sm:col-span-2`} />
                <input placeholder="Address line 2 (optional)" value={form.line2} onChange={set("line2")} className={`${inputCls} sm:col-span-2`} />
                <input required placeholder="City" value={form.city} onChange={set("city")} className={inputCls} />
                <input required placeholder="State" value={form.state} onChange={set("state")} className={inputCls} />
                <input required placeholder="Pincode" value={form.pincode} onChange={set("pincode")} pattern="[0-9]{6}" className={`${inputCls} sm:col-span-2`} />
              </div>
            </Card>

            <Card>
              <CardTitle icon={CreditCard}>Payment</CardTitle>
              <label className="flex items-start gap-3 rounded-md border border-[var(--heat-100)] bg-[var(--heat-4)] p-4">
                <input type="radio" defaultChecked className="mt-1 accent-[var(--heat-100)]" />
                <div>
                  <p className="text-label-medium text-foreground">Mock payment <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)] ml-1">demo</span></p>
                  <p className="mt-0.5 text-body-small text-[var(--black-alpha-56)]">
                    Click place order to simulate payment. Real Stripe integration coming soon.
                  </p>
                </div>
              </label>
            </Card>

            <Card>
              <CardTitle>Items ({rows.length})</CardTitle>
              <ul className="divide-y divide-[var(--border-faint)]">
                {rows.map((r) => (
                  <li key={r.p.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <img src={(r.p.images?.[0]) ?? r.p.image} alt="" className="size-14 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-1 text-label-small text-foreground">{r.p.title}</p>
                      <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)] mt-0.5">
                        {r.p.brand} · qty {r.qty}
                      </p>
                    </div>
                    <p className="text-label-medium font-medium">{formatINR(r.p.price * r.qty)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.form>

          <aside className="h-fit space-y-4 lg:sticky lg:top-28">
            <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
              <h2 className="mb-5 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">
                Price details
              </h2>
              <dl className="space-y-3 text-body-medium">
                <Line k="Subtotal" v={formatINR(subtotal)} />
                <Line
                  k="Delivery"
                  v={shipping === 0 ? "FREE" : formatINR(shipping)}
                  accent={shipping === 0}
                />
                <div className="border-t border-dashed border-[var(--border-muted)] pt-3 mt-3 flex justify-between items-baseline">
                  <dt className="text-label-large text-foreground">Total</dt>
                  <dd className="font-display text-title-h4 text-foreground">{formatINR(total)}</dd>
                </div>
              </dl>
              <button
                type="submit"
                form="checkout-form"
                disabled={busy || rows.length === 0}
                className="button button-primary mt-5 flex w-full items-center justify-center gap-2 rounded-md h-12 text-label-medium disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <>Place order <ArrowRight className="size-4" /></>}
              </button>
            </div>
            <div className="rounded-lg border border-[var(--border-faint)] bg-white p-5 space-y-3 text-body-small text-[var(--black-alpha-72)]">
              <div className="flex items-center gap-2.5">
                <Truck className="size-4 text-[var(--heat-100)]" /> Free delivery on orders ₹999+
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-4 text-[var(--heat-100)]" /> 100% genuine, tested parts
              </div>
            </div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">{children}</div>;
}

function CardTitle({ icon: Icon, children }: { icon?: typeof MapPin; children: React.ReactNode }) {
  return (
    <h2 className="mb-5 flex items-center gap-2 text-label-large text-foreground">
      {Icon && <Icon className="size-4 text-[var(--heat-100)]" />}
      {children}
    </h2>
  );
}

function Line({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--black-alpha-72)]">{k}</dt>
      <dd className={accent ? "text-[var(--accent-forest)]" : "text-foreground"}>{v}</dd>
    </div>
  );
}
