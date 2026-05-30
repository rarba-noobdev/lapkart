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
  head: () => ({ meta: [{ title: "Vendor — lapkart" }] }),
  component: VendorPage,
});

function VendorPage() {
  const [products, setProducts] = useState<Array<{ id: string; title: string; brand: string; price: number; stock: number; image: string }>>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("products")
      .select("id,title,brand,price,stock,image,images")
      .order("created_at", { ascending: false })
      .limit(50);
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
    if (error) return toast.error(error.message + " — Note: only admins can list. Vendor onboarding coming soon.");
    toast.success("Product submitted");
    (e.currentTarget as HTMLFormElement).reset();
    load();
  };

  const inputCls =
    "w-full h-10 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)] focus:shadow-[0_0_0_3px_var(--heat-12)] transition-all placeholder:text-[var(--black-alpha-32)]";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Hero card */}
          <div className="relative rounded-xl border border-[var(--border-muted)] bg-[var(--accent-black)] p-8 text-white overflow-hidden grain">
            <div className="pointer-events-none absolute -top-20 -right-10 h-[260px] w-[260px] rounded-full bg-[var(--heat-100)] opacity-25 blur-[100px]" />
            <div className="relative flex items-start gap-4">
              <div className="grid size-12 place-items-center rounded-md bg-[var(--heat-100)] shadow-[0_4px_16px_0_var(--heat-40)]">
                <Store className="size-5" strokeWidth={2.2} />
              </div>
              <div>
                <span className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-200)]">
                  vendor / portal
                </span>
                <h1 className="mt-1 font-display text-title-h3 text-white">List inventory on lapkart</h1>
                <p className="mt-2 text-body-medium text-white/65 max-w-md">
                  Submit components for review. Once approved, they appear in the marketplace.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
          <form onSubmit={submit} className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <h2 className="text-label-x-large text-foreground">Add product</h2>
            <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              submission_form
            </p>

            <div className="mt-5 space-y-3">
              <input required name="title" placeholder="Title (e.g. Kingston 8GB DDR4 RAM)" className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <input required name="brand" placeholder="Brand" className={inputCls} />
                <input required name="category" placeholder="Category (ram/ssd/…)" className={inputCls} />
              </div>
              <input required name="image" placeholder="Image URL" className={inputCls} />
              <div className="grid grid-cols-3 gap-3">
                <input required name="price" type="number" placeholder="Price ₹" className={inputCls} />
                <input required name="mrp" type="number" placeholder="MRP ₹" className={inputCls} />
                <input required name="stock" type="number" defaultValue={10} placeholder="Stock" className={inputCls} />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="button button-primary mt-2 flex w-full items-center justify-center gap-2 rounded-md h-11 text-label-medium disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Submit product</>}
              </button>
            </div>
          </form>

          <aside className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">marketplace</p>
            <h2 className="mt-1 text-label-x-large text-foreground">
              Live catalog <span className="text-[var(--black-alpha-40)] text-mono-medium">({products.length})</span>
            </h2>
            <ul className="mt-5 max-h-[28rem] space-y-2 overflow-y-auto">
              {products.length === 0 ? (
                <p className="py-6 text-center text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                  no_products_listed
                </p>
              ) : (
                products.map((p) => (
                  <li key={p.id} className="flex gap-3 rounded-md border border-[var(--border-faint)] p-2 hover:border-[var(--heat-20)] hover:bg-[var(--heat-4)] transition-all">
                    <img src={(p.images?.[0]) ?? p.image} alt="" className="size-12 rounded bg-[var(--background-lighter)] object-contain" />
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-1 text-label-small text-foreground">{p.title}</p>
                      <p className="mt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                        {p.brand} · stock {p.stock}
                      </p>
                    </div>
                    <p className="text-label-small font-medium text-foreground">{formatINR(Number(p.price))}</p>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
}
