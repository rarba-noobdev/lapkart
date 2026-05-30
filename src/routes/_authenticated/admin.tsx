import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Package, ShoppingBag, Users, IndianRupee, Plus, Loader2, ShieldAlert, Upload, ImageIcon, ArrowUpRight } from "lucide-react";
import { formatINR } from "@/lib/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — lapkart" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, products: 0, users: 0 });
  const [orders, setOrders] = useState<Array<{ id: string; total: number; status: string; created_at: string; shipping_name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; title: string; brand: string; price: number; stock: number }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const onImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : "");
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [ord, prod] = await Promise.all([
        supabase.from("orders").select("id,total,status,created_at,shipping_name").order("created_at", { ascending: false }),
        supabase.from("products").select("id,title,brand,price,stock").order("created_at", { ascending: false }),
      ]);
      const ordList = (ord.data as typeof orders) ?? [];
      const prodList = (prod.data as typeof products) ?? [];
      setOrders(ordList);
      setProducts(prodList);
      setStats({
        orders: ordList.length,
        revenue: ordList.reduce((s, o) => s + Number(o.total), 0),
        products: prodList.length,
        users: 0,
      });
    })();
  }, [isAdmin]);

  if (isAdmin === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <Loader2 className="size-7 animate-spin text-[var(--heat-100)]" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--background-base)]">
        <Header />
        <div className="container mx-auto max-w-md px-4 py-24 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[var(--accent-crimson)]/30 bg-[var(--accent-crimson)]/8 text-[var(--accent-crimson)]">
            <ShieldAlert className="size-6" />
          </div>
          <p className="mt-4 text-mono-x-small uppercase tracking-[0.22em] text-[var(--accent-crimson)]">403 / forbidden</p>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">Admin access required</h1>
          <p className="mt-3 text-body-medium text-[var(--black-alpha-56)]">
            Your account does not have admin privileges. Contact support to request access.
          </p>
        </div>
      </div>
    );
  }

  const addProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!imageFile) return toast.error("Please choose a product image");
    setBusy(true);
    setUploading(true);
    try {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);

      const { error } = await supabase.from("products").insert({
        title: String(fd.get("title")),
        brand: String(fd.get("brand")),
        category: String(fd.get("category")),
        image: pub.publicUrl,
        price: Number(fd.get("price")),
        mrp: Number(fd.get("mrp")),
        stock: Number(fd.get("stock")),
      });
      if (error) throw error;
      toast.success("Product added");
      setShowAdd(false);
      form.reset();
      setImageFile(null);
      setImagePreview("");
      const { data } = await supabase.from("products").select("id,title,brand,price,stock").order("created_at", { ascending: false });
      setProducts((data as typeof products) ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setBusy(false);
      setUploading(false);
    }
  };

  const tiles = [
    { label: "Revenue", value: formatINR(stats.revenue), icon: IndianRupee, hint: "lifetime" },
    { label: "Orders", value: stats.orders, icon: ShoppingBag, hint: "total" },
    { label: "Products", value: stats.products, icon: Package, hint: "in catalog" },
    { label: "Users", value: stats.users || "—", icon: Users, hint: "registered" },
  ];

  const inputCls = "w-full h-10 rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium outline-none focus:border-[var(--heat-100)] focus:shadow-[0_0_0_3px_var(--heat-12)] transition-all placeholder:text-[var(--black-alpha-32)]";

  return (
    <div className="min-h-screen bg-[var(--background-base)]">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-2 text-mono-x-small uppercase tracking-[0.22em] text-[var(--heat-100)]">
              <LayoutDashboard className="size-3" /> admin / dashboard
            </span>
            <h1 className="mt-2 font-display text-title-h3 text-foreground">
              Welcome back, <span className="text-[var(--heat-100)]">{user?.user_metadata?.full_name?.split(" ")[0] || "admin"}</span>
            </h1>
            <p className="mt-1 text-body-medium text-[var(--black-alpha-56)]">
              Manage your catalog, orders and customers.
            </p>
          </div>
          <span className="text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
            ● live · production
          </span>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-lg border border-[var(--border-muted)] bg-white p-5 overflow-hidden group hover:border-[var(--heat-20)] transition-colors"
            >
              <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-[var(--heat-100)] opacity-0 group-hover:opacity-[0.06] blur-2xl transition-opacity duration-500" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                    {t.label}
                  </p>
                  <p className="mt-2 font-display text-[32px] font-medium leading-none text-foreground">
                    {t.value}
                  </p>
                  <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-40)]">
                    {t.hint}
                  </p>
                </div>
                <div className="grid size-9 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--heat-4)] text-[var(--heat-100)]">
                  <t.icon className="size-4" strokeWidth={2.2} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* Products */}
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">catalog</p>
                <h2 className="mt-1 text-label-x-large text-foreground">
                  Products <span className="text-[var(--black-alpha-40)] text-mono-medium">({products.length})</span>
                </h2>
              </div>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="button button-primary inline-flex items-center gap-1.5 rounded-md px-3 h-9 text-label-small"
              >
                <Plus className="size-3.5" /> Add product
              </button>
            </div>

            {showAdd && (
              <form onSubmit={addProduct} className="mb-5 grid gap-3 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <input required name="title" placeholder="Product title" className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input required name="brand" placeholder="Brand" className={inputCls} />
                  <input required name="category" placeholder="Category slug" className={inputCls} />
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--border-muted)] bg-white p-3 hover:border-[var(--heat-100)] transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="size-14 rounded-md border border-[var(--border-faint)] object-contain" />
                  ) : (
                    <div className="grid size-14 place-items-center rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)]">
                      <ImageIcon className="size-5 text-[var(--black-alpha-32)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-label-small text-[var(--heat-100)]">
                      <Upload className="size-3.5" /> {imageFile ? "Change image" : "Upload product image"}
                    </div>
                    <p className="mt-0.5 truncate text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                      {imageFile?.name ?? "PNG / JPG · up to 5MB"}
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <input required name="price" type="number" placeholder="Price ₹" className={inputCls} />
                  <input required name="mrp" type="number" placeholder="MRP ₹" className={inputCls} />
                  <input required name="stock" type="number" placeholder="Stock" defaultValue={25} className={inputCls} />
                </div>
                <button type="submit" disabled={busy} className="button button-primary flex items-center justify-center gap-2 rounded-md h-10 text-label-medium disabled:opacity-50">
                  {busy ? <><Loader2 className="size-4 animate-spin" /> {uploading ? "Uploading…" : "Saving…"}</> : "Save product"}
                </button>
              </form>
            )}

            <div className="max-h-80 overflow-y-auto">
              {products.length === 0 ? (
                <p className="py-8 text-center text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                  no_products_yet
                </p>
              ) : (
                <table className="w-full text-body-small">
                  <thead>
                    <tr className="text-left text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)] border-b border-[var(--border-faint)]">
                      <th className="py-2 font-normal">Title</th>
                      <th className="py-2 font-normal w-16">Stock</th>
                      <th className="py-2 font-normal text-right w-24">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border-faint)] last:border-0 hover:bg-[var(--heat-4)] transition-colors">
                        <td className="py-2.5 line-clamp-1 text-foreground">{p.title}</td>
                        <td className="py-2.5 text-mono-small text-foreground">{p.stock}</td>
                        <td className="py-2.5 text-right text-label-small font-medium text-foreground">{formatINR(Number(p.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Orders */}
          <div className="rounded-lg border border-[var(--border-muted)] bg-white p-6">
            <div className="mb-5">
              <p className="text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-48)]">activity</p>
              <h2 className="mt-1 text-label-x-large text-foreground">
                Recent orders <span className="text-[var(--black-alpha-40)] text-mono-medium">({orders.length})</span>
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {orders.length === 0 ? (
                <p className="py-8 text-center text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                  no_orders_yet
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-faint)]">
                  {orders.slice(0, 20).map((o) => (
                    <li key={o.id} className="group flex items-center justify-between py-3">
                      <div>
                        <p className="text-mono-small text-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                        <p className="mt-0.5 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          {o.shipping_name} · <span className="text-[var(--accent-forest)]">● {o.status}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-label-medium font-medium text-foreground">{formatINR(Number(o.total))}</p>
                        <ArrowUpRight className="size-4 text-[var(--black-alpha-32)] group-hover:text-[var(--heat-100)] transition-colors" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-[var(--border-muted)] bg-white p-4 text-body-small text-[var(--black-alpha-72)]">
          <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">tip · sql_console</span>
          <p className="mt-1">
            To grant admin access to a user, run in Supabase SQL editor:
            <code className="ml-1.5 rounded bg-[var(--background-lighter)] px-1.5 py-0.5 text-mono-x-small text-foreground border border-[var(--border-faint)]">
              INSERT INTO user_roles (user_id, role) VALUES ('&lt;uuid&gt;', 'admin');
            </code>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
