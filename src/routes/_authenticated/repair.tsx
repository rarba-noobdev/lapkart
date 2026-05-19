import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Wrench, Loader2, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/repair")({
  head: () => ({ meta: [{ title: "Book a Repair — LapKart" }] }),
  component: RepairPage,
});

const SERVICES = [
  { id: "screen", label: "Screen Replacement", from: 2500 },
  { id: "battery", label: "Battery Replacement", from: 1800 },
  { id: "keyboard", label: "Keyboard Repair", from: 1200 },
  { id: "motherboard", label: "Motherboard Repair", from: 4500 },
  { id: "cleaning", label: "Cleaning Service", from: 499 },
  { id: "other", label: "Other Issue", from: 0 },
];

function RepairPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<Array<{ id: string; laptop_brand: string; laptop_model: string; service_type: string; status: string; created_at: string }>>([]);
  const [form, setForm] = useState({
    laptop_brand: "",
    laptop_model: "",
    service_type: "screen",
    issue_description: "",
    contact_phone: "",
    preferred_date: "",
  });

  useEffect(() => {
    supabase.from("repair_bookings").select("id,laptop_brand,laptop_model,service_type,status,created_at").order("created_at", { ascending: false }).then(({ data }) => {
      setBookings((data as typeof bookings) ?? []);
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const svc = SERVICES.find((s) => s.id === form.service_type);
    const { error } = await supabase.from("repair_bookings").insert({
      ...form,
      user_id: user.id,
      preferred_date: form.preferred_date || null,
      estimated_cost: svc?.from || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Repair booked! We'll contact you soon.");
    navigate({ to: "/repair" });
    // refresh
    const { data } = await supabase.from("repair_bookings").select("id,laptop_brand,laptop_model,service_type,status,created_at").order("created_at", { ascending: false });
    setBookings((data as typeof bookings) ?? []);
    setForm({ laptop_brand: "", laptop_model: "", service_type: "screen", issue_description: "", contact_phone: "", preferred_date: "" });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-primary to-[oklch(0.5_0.18_265)] p-6 text-primary-foreground shadow-lg">
            <div className="flex items-center gap-3">
              <Wrench className="size-8" />
              <div>
                <h1 className="font-display text-2xl font-bold">Book a Repair</h1>
                <p className="text-sm opacity-90">Expert technicians · Genuine parts · 30-day warranty</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 font-bold">Laptop & Service Details</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="Brand (e.g. HP, Dell)" value={form.laptop_brand} onChange={set("laptop_brand")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input required placeholder="Model (e.g. 15s-fq5007tu)" value={form.laptop_model} onChange={set("laptop_model")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <select value={form.service_type} onChange={set("service_type")} className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2">
                {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}{s.from > 0 ? ` — from ₹${s.from}` : ""}</option>)}
              </select>
              <textarea placeholder="Describe the issue..." value={form.issue_description} onChange={set("issue_description")} rows={3} className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
              <input required placeholder="Contact phone" value={form.contact_phone} onChange={set("contact_phone")} pattern="[0-9]{10}" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input type="date" value={form.preferred_date} onChange={set("preferred_date")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <button type="submit" disabled={busy} className="w-full rounded-md bg-[oklch(0.7_0.18_40)] py-3 font-bold text-white shadow disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : "BOOK REPAIR"}
          </button>
        </motion.form>

        <aside className="space-y-4">
          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><Calendar className="size-4 text-primary" /> My Bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-md border border-border p-3">
                    <p className="font-semibold">{b.laptop_brand} {b.laptop_model}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.service_type} · <span className="text-success">{b.status}</span></p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg bg-card p-4 text-xs text-muted-foreground shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-2 py-1"><CheckCircle2 className="size-4 text-success" /> Free diagnosis</div>
            <div className="flex items-center gap-2 py-1"><CheckCircle2 className="size-4 text-success" /> Genuine spare parts</div>
            <div className="flex items-center gap-2 py-1"><CheckCircle2 className="size-4 text-success" /> 30-day service warranty</div>
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
