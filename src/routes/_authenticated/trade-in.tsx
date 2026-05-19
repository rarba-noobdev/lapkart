import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { aiTradeInValuation } from "@/lib/ai.functions";
import { Recycle, Loader2, Sparkles, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trade-in")({
  head: () => ({ meta: [{ title: "Trade-In — LapKart" }] }),
  component: TradeInPage,
});

function TradeInPage() {
  const { user } = useAuth();
  const valuate = useServerFn(aiTradeInValuation);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ value: number; reasoning: string } | null>(null);
  const [form, setForm] = useState({
    brand: "",
    model: "",
    age_years: 2,
    condition: "good",
    ram_gb: 8,
    storage_gb: 256,
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await valuate({ data: form });
      setResult(r);
      await supabase.from("trade_in_requests").insert({
        ...form,
        user_id: user.id,
        estimated_value: r.value,
      });
      toast.success("Valuation saved");
    } catch (err) {
      toast.error("Could not get valuation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-gradient-to-br from-[oklch(0.55_0.18_150)] to-[oklch(0.45_0.2_180)] p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <Recycle className="size-8" />
            <div>
              <h1 className="font-display text-2xl font-bold">Trade-In Your Old Laptop</h1>
              <p className="text-sm opacity-90">Get an AI-powered instant valuation in INR</p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={submit} className="mt-5 space-y-4 rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Brand" value={form.brand} onChange={set("brand")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <input required placeholder="Model" value={form.model} onChange={set("model")} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <label className="text-xs text-muted-foreground">Age (years)
              <input type="number" min={0} max={15} value={form.age_years} onChange={set("age_years")} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">Condition
              <select value={form.condition} onChange={set("condition")} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor (not working)</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">RAM (GB)
              <input type="number" min={2} value={form.ram_gb} onChange={set("ram_gb")} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-muted-foreground">Storage (GB)
              <input type="number" min={32} value={form.storage_gb} onChange={set("storage_gb")} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <textarea placeholder="Any notes (dents, missing keys, etc.)" value={form.notes} onChange={set("notes")} rows={2} className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:col-span-2" />
          </div>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary to-[oklch(0.5_0.18_265)] py-3 font-bold text-primary-foreground disabled:opacity-50">
            {busy ? <Loader2 className="size-5 animate-spin" /> : <><Sparkles className="size-4" /> GET AI VALUATION</>}
          </button>
        </form>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-5 rounded-lg bg-gradient-to-br from-success/20 to-primary/10 p-6 text-center shadow-lg"
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estimated Trade-In Value</p>
              <div className="mt-2 flex items-center justify-center font-display text-5xl font-bold text-primary">
                <IndianRupee className="size-9" />{result.value.toLocaleString("en-IN")}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{result.reasoning}</p>
              <p className="mt-2 text-xs text-muted-foreground">Final value confirmed after physical inspection.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Footer />
    </div>
  );
}
