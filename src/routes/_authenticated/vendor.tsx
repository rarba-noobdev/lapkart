import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Store, Plus, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor Portal — LapKart" }] }),
  component: VendorPage,
});

function VendorPage() {
  const [products, setProducts] = useState<Array<{ id: string; title: string; brand: string; price: number; stock: number; image: string }>>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("products").select("id,title,brand,price,stock,image").order("created_at", { ascending: false }).limit(50);
    setProducts((data as typeof products) ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      title: String(fd.get("title")),
      brand: String(fd.get("brand")),
      category: String(fd.get("category")),
      image: String(fd.get("image")),
      price: Number(fd.get("price")),
      mrp: Number(fd.get("mrp")),
      stock: Number(fd.get("stock")),
    });
    setBusy(false);
    if (error) return toast.error(error.message + " — Note: only admins can list products. Vendor onboarding coming soon.");
    toast.success("Product submitted");
    (e.currentTarget as HTMLFormElement).reset();
    load();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-lg bg-gradient-to-br from-[oklch(0.55_0.2_30)] to-[oklch(0.45_0.22_15)] p-6 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <Store className="size-8" />
              <div>
                <h1 className="font-display text-2xl font-bold">Vendor Portal</h1>
                <p className="text-sm opacity-90">List your laptop parts inventory on LapKart</p>
              </div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3 rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-bold">Add Product</h2>
            <input required name="title" placeholder="Title (e.g. Kingston 8GB DDR4 RAM)" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input required name="brand" placeholder="Brand" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input required name="category" placeholder="Category (ram/ssd/...)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <input required name="image" placeholder="Image URL" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <input required name="price" type="number" placeholder="Price" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input required name="mrp" type="number" placeholder="MRP" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              <input required name="stock" type="number" defaultValue={10} placeholder="Stock" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Submit Product</>}
            </button>
          </form>
        </motion.div>

        <aside className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-bold">Marketplace ({products.length})</h2>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {products.map((p) => (
              <li key={p.id} className="flex gap-2 rounded border border-border p-2">
                <img src={p.image} alt="" className="size-12 rounded object-contain" />
                <div className="flex-1 text-xs">
                  <p className="line-clamp-1 font-semibold">{p.title}</p>
                  <p className="text-muted-foreground">{p.brand} · Stock {p.stock}</p>
                </div>
                <p className="text-xs font-bold">{formatINR(Number(p.price))}</p>
              </li>
            ))}
            {products.length === 0 && <p className="text-sm text-muted-foreground">No products listed.</p>}
          </ul>
        </aside>
      </div>
      <Footer />
    </div>
  );
}
