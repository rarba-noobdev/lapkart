import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Package, ShoppingBag, Users, IndianRupee, Plus, Loader2, ShieldAlert, Upload, ImageIcon } from "lucide-react";
import { formatINR } from "@/lib/catalog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — LapKart" }] }),
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
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto max-w-md px-4 py-20 text-center">
          <ShieldAlert className="mx-auto size-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold">Admin Access Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account does not have admin privileges. Contact support to request access.</p>
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
    { label: "Revenue", value: formatINR(stats.revenue), icon: IndianRupee, color: "from-emerald-500 to-teal-600" },
    { label: "Orders", value: stats.orders, icon: ShoppingBag, color: "from-blue-500 to-indigo-600" },
    { label: "Products", value: stats.products, icon: Package, color: "from-purple-500 to-pink-600" },
    { label: "Users", value: stats.users || "—", icon: Users, color: "from-orange-500 to-red-600" },
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`rounded-lg bg-gradient-to-br ${t.color} p-4 text-white shadow-lg`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase opacity-80">{t.label}</p>
                <t.icon className="size-5 opacity-80" />
              </div>
              <p className="mt-2 text-2xl font-bold">{t.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Products ({products.length})</h2>
              <button onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"><Plus className="size-3" /> Add</button>
            </div>
            {showAdd && (
              <form onSubmit={addProduct} className="mb-4 grid gap-2 rounded-md border border-border bg-muted/50 p-3">
                <input required name="title" placeholder="Title" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input required name="brand" placeholder="Brand" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                  <input required name="category" placeholder="Category slug" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-border bg-background px-2 py-2 text-xs hover:border-primary">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="size-12 rounded object-contain" />
                  ) : (
                    <div className="grid size-12 place-items-center rounded bg-muted"><ImageIcon className="size-5 text-muted-foreground" /></div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-1 font-semibold text-primary"><Upload className="size-3" /> {imageFile ? "Change image" : "Upload product image"}</div>
                    <p className="truncate text-[11px] text-muted-foreground">{imageFile?.name ?? "PNG, JPG up to 5MB"}</p>
                  </div>
                  <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input required name="price" type="number" placeholder="Price" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                  <input required name="mrp" type="number" placeholder="MRP" className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                  <input required name="stock" type="number" placeholder="Stock" defaultValue={25} className="rounded border border-border bg-background px-2 py-1.5 text-sm" />
                </div>
                <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 rounded bg-primary py-1.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? <><Loader2 className="size-3 animate-spin" /> {uploading ? "Uploading…" : "Saving…"}</> : "Save product"}</button>
              </form>
            )}
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Title</th><th>Stock</th><th>Price</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-t border-border"><td className="py-1.5 line-clamp-1">{p.title}</td><td>{p.stock}</td><td className="font-semibold">{formatINR(Number(p.price))}</td></tr>
                  ))}
                  {products.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No products yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-3 font-bold">Recent Orders ({orders.length})</h2>
            <div className="max-h-80 overflow-y-auto">
              {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
                <ul className="divide-y divide-border">
                  {orders.slice(0, 20).map((o) => (
                    <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-semibold">#{o.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{o.shipping_name} · <span className="capitalize text-success">{o.status}</span></p>
                      </div>
                      <p className="font-bold">{formatINR(Number(o.total))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 rounded-md border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
          <Users className="mr-1 inline size-3" /> To grant admin access to a user, run in Cloud SQL editor:
          <code className="ml-1 rounded bg-muted px-1 text-foreground">INSERT INTO user_roles (user_id, role) VALUES ('&lt;user-uuid&gt;', 'admin');</code>
        </p>
      </div>
      <Footer />
    </div>
  );
}
