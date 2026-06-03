import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { apiBase } from "@/lib/api-base";
import { categories, formatINR } from "@/lib/catalog";
import { getAuthorizationHeaders } from "@/lib/supabase-auth";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Truck,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const categoryOptions = categories.map((category) => ({
  value: category.slug,
  label: category.name,
}));
const defaultCategory = categoryOptions[0]?.value ?? "";
const categoryNameBySlug = new Map(categories.map((category) => [category.slug, category.name]));

type TrackingActivity = {
  date: string | null;
  status: string | null;
  activity: string | null;
  location: string | null;
};

type FulfillmentShipment = {
  id: string;
  shippingServiceType: "standard" | "quick";
  status: string;
  shiprocketShipmentId: number | null;
  awbCode: string | null;
  courierName: string | null;
  pickupScheduledDate: string | null;
  expectedDeliveryDate: string | null;
  trackingUrl: string | null;
  manifestUrl: string | null;
  labelUrl: string | null;
  trackingActivities: TrackingActivity[];
};

type FulfillmentOrder = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  shippingName: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingServiceType: "standard" | "quick";
  items: Array<{
    id: string;
    title: string;
    image: string;
    brand: string;
    qty: number;
    sku: string | null;
  }>;
  shipment: FulfillmentShipment | null;
};

type ShiprocketAccount = {
  walletBalance: number;
  configuredPickupLocation: string;
  pickupLocationVerified: boolean;
  pickupLocations: Array<{
    pickupLocation: string | null;
    pincode: string | null;
    city: string | null;
    state: string | null;
    primary: boolean;
    active: boolean;
  }>;
};

type AdminAnalytics = {
  orders: number;
  products: number;
  users: number;
  revenue: number;
  deliveredOrders: number;
  pendingFulfillment: number;
  monthlySeries: Array<{
    month: string;
    orders: number;
    revenue: number;
  }>;
  recentOrders: Array<{
    id: string;
    createdAt: string;
    total: number;
    status: string;
    shippingName: string | null;
  }>;
};

type AdminView = "overview" | "catalog" | "orders" | "users";

type AdminProduct = {
  id: string;
  title: string;
  brand: string;
  category: string;
  description: string | null;
  image: string;
  images: string[] | null;
  price: number;
  mrp: number;
  stock: number;
  status: string;
  sku: string | null;
  source_url: string | null;
  compatibility: string | null;
  warranty: string | null;
  highlights: string[] | null;
  search_keywords: string[] | null;
  weight_kg: number | null;
  length_cm: number | null;
  breadth_cm: number | null;
  height_cm: number | null;
  updated_at: string;
};

type ProductEditorState = {
  id: string | null;
  title: string;
  brand: string;
  category: string;
  description: string;
  image: string;
  imagesText: string;
  price: string;
  mrp: string;
  stock: string;
  status: "active" | "draft" | "archived";
  sku: string;
  sourceUrl: string;
  compatibility: string;
  warranty: string;
  highlightsText: string;
  searchKeywordsText: string;
  weightKg: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
};

type AdminUserRecord = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  role: "admin" | "user";
  fullName: string | null;
  phone: string | null;
  orderCount: number;
  totalSpent: number;
};

type UserEditorState = {
  id: string | null;
  role: "admin" | "user";
  fullName: string;
  phone: string;
};

type AdminOrderRecord = {
  id: string;
  userId: string;
  userEmail: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shipping: number;
  total: number;
  shippingName: string | null;
  shippingPhone: string | null;
  shippingEmail: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingServiceType: "standard" | "quick";
  shippingCourierName: string | null;
  itemSummary: string;
  shipment: {
    status: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
    expectedDeliveryDate: string | null;
  } | null;
  payment: {
    status: string;
    providerPaymentId: string | null;
    providerOrderId: string | null;
  } | null;
};

type OrderEditorState = {
  id: string | null;
  status: string;
  paymentStatus: string;
  shippingServiceType: "standard" | "quick";
  shippingName: string;
  shippingPhone: string;
  shippingEmail: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
};

async function requestAdminApi<T>(_accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthorizationHeaders()),
      ...init?.headers,
    },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Admin request failed");
  return data;
}

function emptyProductEditor(): ProductEditorState {
  return {
    id: null,
    title: "",
    brand: "",
    category: defaultCategory,
    description: "",
    image: "",
    imagesText: "",
    price: "",
    mrp: "",
    stock: "0",
    status: "draft",
    sku: "",
    sourceUrl: "",
    compatibility: "",
    warranty: "",
    highlightsText: "",
    searchKeywordsText: "",
    weightKg: "",
    lengthCm: "",
    breadthCm: "",
    heightCm: "",
  };
}

function mapProductToEditor(product: AdminProduct): ProductEditorState {
  return {
    id: product.id,
    title: product.title,
    brand: product.brand,
    category: categoryNameBySlug.has(product.category) ? product.category : defaultCategory,
    description: product.description ?? "",
    image: product.image,
    imagesText: (product.images ?? []).join("\n"),
    price: String(Number(product.price ?? 0)),
    mrp: String(Number(product.mrp ?? 0)),
    stock: String(Number(product.stock ?? 0)),
    status: (["active", "draft", "archived"].includes(product.status)
      ? product.status
      : "active") as ProductEditorState["status"],
    sku: product.sku ?? "",
    sourceUrl: product.source_url ?? "",
    compatibility: product.compatibility ?? "",
    warranty: product.warranty ?? "",
    highlightsText: (product.highlights ?? []).join("\n"),
    searchKeywordsText: (product.search_keywords ?? []).join("\n"),
    weightKg: product.weight_kg === null ? "" : String(product.weight_kg),
    lengthCm: product.length_cm === null ? "" : String(product.length_cm),
    breadthCm: product.breadth_cm === null ? "" : String(product.breadth_cm),
    heightCm: product.height_cm === null ? "" : String(product.height_cm),
  };
}

function emptyUserEditor(): UserEditorState {
  return { id: null, role: "user", fullName: "", phone: "" };
}

function mapUserToEditor(user: AdminUserRecord): UserEditorState {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName ?? "",
    phone: user.phone ?? "",
  };
}

function emptyOrderEditor(): OrderEditorState {
  return {
    id: null,
    status: "confirmed",
    paymentStatus: "paid",
    shippingServiceType: "standard",
    shippingName: "",
    shippingPhone: "",
    shippingEmail: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPincode: "",
  };
}

function mapOrderToEditor(order: AdminOrderRecord): OrderEditorState {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shippingServiceType: order.shippingServiceType,
    shippingName: order.shippingName ?? "",
    shippingPhone: order.shippingPhone ?? "",
    shippingEmail: order.shippingEmail ?? "",
    shippingLine1: order.shippingLine1 ?? "",
    shippingLine2: order.shippingLine2 ?? "",
    shippingCity: order.shippingCity ?? "",
    shippingState: order.shippingState ?? "",
    shippingPincode: order.shippingPincode ?? "",
  };
}

function parseLines(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function payloadNumber(input: string) {
  const value = input.trim();
  if (!value) return null;
  return Number(value);
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard - LapKart" },
      {
        name: "description",
        content: "Manage catalog, users, orders, analytics, and fulfillment.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { role, session, loading: authLoading } = useAuth();
  const [view, setView] = useState<AdminView>("overview");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && role && role !== "admin") {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, navigate, role]);

  const loadAnalytics = useCallback(async () => {
    if (!session?.access_token || role !== "admin") return;
    try {
      setLoading(true);
      const response = await requestAdminApi<AdminAnalytics>(
        session.access_token,
        "/admin/analytics",
      );
      setAnalytics(response);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not load admin analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [role, session?.access_token]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const realtimeTargets = useMemo(
    () => [
      { table: "orders" as const },
      { table: "products" as const },
      { table: "profiles" as const },
      { table: "payments" as const },
      { table: "shipments" as const },
    ],
    [],
  );

  useRealtimeRefresh({
    channelName: `admin-analytics:${session?.user.id ?? "unknown"}`,
    enabled: role === "admin" && Boolean(session?.access_token),
    onRefresh: loadAnalytics,
    targets: realtimeTargets,
    debounceMs: 220,
  });

  if (authLoading || role === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <Loader2 className="size-5 animate-spin text-[var(--heat-100)]" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <p className="text-body-medium text-[var(--black-alpha-56)]">
          Redirecting to your account.
        </p>
      </div>
    );
  }

  const kpis = analytics
    ? [
        {
          icon: BarChart3,
          label: "Revenue",
          value: formatINR(analytics.revenue),
          trend: `${analytics.orders} orders`,
        },
        {
          icon: Package,
          label: "Catalog items",
          value: String(analytics.products),
          trend: "live count",
        },
        { icon: Users, label: "Customers", value: String(analytics.users), trend: "profiles" },
        {
          icon: ShieldCheck,
          label: "Pending fulfillment",
          value: String(analytics.pendingFulfillment),
          trend: `${analytics.deliveredOrders} delivered`,
        },
      ]
    : [];

  return (
    <DashboardShell
      eyebrow="admin command center"
      title="LapKart operations cockpit"
      description="Live catalog, user, order, payment, and fulfillment control without leaving the app."
    >
      {error && (
        <p className="mb-6 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
          {error}
        </p>
      )}
      {loading && !analytics ? (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-[var(--border-faint)] bg-white p-10 text-body-small text-[var(--black-alpha-56)]">
          <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
          Loading live admin metrics
        </div>
      ) : analytics ? (
        <KpiGrid items={kpis} />
      ) : null}

      <AdminTabs active={view} onChange={setView} />

      {view === "overview" && (
        <>
          <FulfillmentQueue />
          {analytics && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
              <Panel title="Revenue and order trend">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.monthlySeries}>
                      <defs>
                        <linearGradient id="lapkartRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--heat-100)" stopOpacity={0.34} />
                          <stop offset="95%" stopColor="var(--heat-100)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--heat-100)"
                        fill="url(#lapkartRevenue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Recent paid orders">
                <div className="space-y-3">
                  {analytics.recentOrders.length === 0 && (
                    <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-56)]">
                      No paid orders have been created yet.
                    </div>
                  )}
                  {analytics.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-[var(--border-faint)] p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-label-small text-foreground">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                          {order.shippingName || "Customer"} /{" "}
                          {new Date(order.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-label-small text-foreground">{formatINR(order.total)}</p>
                        <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">
                          {order.status.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          )}
        </>
      )}

      {view === "catalog" && session?.access_token && (
        <CatalogManager accessToken={session.access_token} />
      )}
      {view === "orders" && session?.access_token && (
        <OrdersManager accessToken={session.access_token} />
      )}
      {view === "users" && session?.access_token && (
        <UsersManager accessToken={session.access_token} />
      )}
    </DashboardShell>
  );
}

function AdminTabs({
  active,
  onChange,
}: {
  active: AdminView;
  onChange: (view: AdminView) => void;
}) {
  const items: Array<{ id: AdminView; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "catalog", label: "Catalog" },
    { id: "orders", label: "Orders" },
    { id: "users", label: "Users" },
  ];

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`inline-flex h-10 items-center rounded-md border px-4 text-label-small transition-colors ${
            active === item.id
              ? "border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]"
              : "border-[var(--border-muted)] bg-white text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CatalogManager({ accessToken }: { accessToken: string }) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [editor, setEditor] = useState<ProductEditorState>(emptyProductEditor());

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestAdminApi<{ products: AdminProduct[] }>(
        accessToken,
        "/admin/products",
      );
      setProducts(response.products);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load products");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useRealtimeRefresh({
    channelName: "admin-catalog",
    enabled: Boolean(accessToken),
    onRefresh: loadProducts,
    targets: [{ table: "products" as const }],
    debounceMs: 240,
  });

  useEffect(() => {
    if (!products.length) {
      if (selectedId !== "new") {
        setSelectedId(null);
        setEditor(emptyProductEditor());
      }
      return;
    }

    if (selectedId === "new") return;

    const selected = products.find((product) => product.id === selectedId) ?? products[0];
    setSelectedId(selected.id);
    setEditor(mapProductToEditor(selected));
  }, [products, selectedId]);

  const filtered = products.filter((product) =>
    `${product.title} ${product.brand} ${product.category} ${product.sku ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const beginCreate = () => {
    setSelectedId("new");
    setEditor(emptyProductEditor());
  };

  const selectProduct = (product: AdminProduct) => {
    setSelectedId(product.id);
    setEditor(mapProductToEditor(product));
  };

  const saveProduct = async () => {
    try {
      setSaving(true);
      const payload = {
        title: editor.title,
        brand: editor.brand,
        category: editor.category,
        description: editor.description,
        image: editor.image,
        images: parseLines(editor.imagesText),
        price: Number(editor.price),
        mrp: Number(editor.mrp),
        stock: Number(editor.stock),
        status: editor.status,
        sku: editor.sku,
        sourceUrl: editor.sourceUrl,
        compatibility: editor.compatibility,
        warranty: editor.warranty,
        highlights: parseLines(editor.highlightsText),
        searchKeywords: parseLines(editor.searchKeywordsText),
        weightKg: payloadNumber(editor.weightKg),
        lengthCm: payloadNumber(editor.lengthCm),
        breadthCm: payloadNumber(editor.breadthCm),
        heightCm: payloadNumber(editor.heightCm),
      };

      if (selectedId === "new" || !editor.id) {
        const response = await requestAdminApi<{ product: AdminProduct }>(
          accessToken,
          "/admin/products",
          postJson(payload),
        );
        toast.success("Product created");
        setSelectedId(response.product.id);
        setEditor(mapProductToEditor(response.product));
      } else {
        const response = await requestAdminApi<{ product: AdminProduct }>(
          accessToken,
          `/admin/products/${editor.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        toast.success("Product updated");
        setEditor(mapProductToEditor(response.product));
      }

      await loadProducts();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!editor.id) return;
    try {
      setDeleting(true);
      const response = await requestAdminApi<{
        archived?: boolean;
        deleted?: boolean;
        message?: string;
      }>(accessToken, `/admin/products/${editor.id}`, { method: "DELETE" });
      toast.success(
        response.message ?? (response.archived ? "Product archived" : "Product deleted"),
      );
      setSelectedId(null);
      setEditor(emptyProductEditor());
      await loadProducts();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Could not remove product",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Panel title="Catalog records" className="xl:sticky xl:top-24 xl:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search title, brand, category, SKU"
          />
          <button
            type="button"
            onClick={beginCreate}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)]"
          >
            <Plus className="size-4" />
            New product
          </button>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
            <span>{filtered.length} records</span>
            <span>Live catalog</span>
          </div>
          <div className="max-h-[calc(100vh-290px)] min-h-[320px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                selected={product.id === selectedId}
                onSelect={() => selectProduct(product)}
              />
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <EmptyState message="No products match the current search." />
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-body-small text-[var(--black-alpha-56)]">
              <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
              Loading catalog
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <Panel title={selectedId === "new" ? "Create product" : "Edit product"}>
        <ProductEditorPreview editor={editor} mode={selectedId === "new" ? "create" : "edit"} />

        <div className="space-y-5">
          <FormSection title="Product identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <TextInput
                  value={editor.title}
                  onChange={(value) => setEditor((current) => ({ ...current, title: value }))}
                />
              </Field>
              <Field label="Brand">
                <TextInput
                  value={editor.brand}
                  onChange={(value) => setEditor((current) => ({ ...current, brand: value }))}
                />
              </Field>
              <Field label="Category">
                <SelectInput
                  value={editor.category}
                  onChange={(value) => setEditor((current) => ({ ...current, category: value }))}
                  options={categoryOptions}
                />
              </Field>
              <Field label="SKU">
                <TextInput
                  value={editor.sku}
                  onChange={(value) => setEditor((current) => ({ ...current, sku: value }))}
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <TextAreaInput
                  value={editor.description}
                  onChange={(value) => setEditor((current) => ({ ...current, description: value }))}
                  rows={4}
                />
              </Field>
              <Field label="Compatibility" className="sm:col-span-2">
                <TextInput
                  value={editor.compatibility}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, compatibility: value }))
                  }
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Pricing and availability">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Price">
                <TextInput
                  value={editor.price}
                  onChange={(value) => setEditor((current) => ({ ...current, price: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="MRP">
                <TextInput
                  value={editor.mrp}
                  onChange={(value) => setEditor((current) => ({ ...current, mrp: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Stock">
                <TextInput
                  value={editor.stock}
                  onChange={(value) => setEditor((current) => ({ ...current, stock: value }))}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Status">
                <SelectInput
                  value={editor.status}
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      status: value as ProductEditorState["status"],
                    }))
                  }
                  options={[
                    { value: "active", label: "Active" },
                    { value: "draft", label: "Draft" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Media and references">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary image URL" className="sm:col-span-2">
                <TextInput
                  value={editor.image}
                  onChange={(value) => setEditor((current) => ({ ...current, image: value }))}
                />
              </Field>
              <Field label="Gallery image URLs" className="sm:col-span-2">
                <TextAreaInput
                  value={editor.imagesText}
                  onChange={(value) => setEditor((current) => ({ ...current, imagesText: value }))}
                  rows={4}
                />
              </Field>
              <Field label="Source URL" className="sm:col-span-2">
                <TextInput
                  value={editor.sourceUrl}
                  onChange={(value) => setEditor((current) => ({ ...current, sourceUrl: value }))}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Shipping and merchandising">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Warranty">
                <TextInput
                  value={editor.warranty}
                  onChange={(value) => setEditor((current) => ({ ...current, warranty: value }))}
                />
              </Field>
              <Field label="Weight (kg)">
                <TextInput
                  value={editor.weightKg}
                  onChange={(value) => setEditor((current) => ({ ...current, weightKg: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Length (cm)">
                <TextInput
                  value={editor.lengthCm}
                  onChange={(value) => setEditor((current) => ({ ...current, lengthCm: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Breadth (cm)">
                <TextInput
                  value={editor.breadthCm}
                  onChange={(value) => setEditor((current) => ({ ...current, breadthCm: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Height (cm)">
                <TextInput
                  value={editor.heightCm}
                  onChange={(value) => setEditor((current) => ({ ...current, heightCm: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="Highlights" className="sm:col-span-2 xl:col-span-4">
                <TextAreaInput
                  value={editor.highlightsText}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, highlightsText: value }))
                  }
                  rows={5}
                />
              </Field>
              <Field label="Search keywords" className="sm:col-span-2 xl:col-span-4">
                <TextAreaInput
                  value={editor.searchKeywordsText}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, searchKeywordsText: value }))
                  }
                  rows={4}
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <div className="sticky bottom-0 -mx-6 mt-6 flex flex-wrap gap-3 border-t border-[var(--border-faint)] bg-white/95 px-6 py-4 backdrop-blur">
          <button
            type="button"
            onClick={() => void saveProduct()}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {selectedId === "new" ? "Create product" : "Save product"}
          </button>
          {editor.id && (
            <button
              type="button"
              onClick={() => void deleteProduct()}
              disabled={deleting}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-50 px-4 text-label-small text-red-700 transition-colors hover:border-red-500/40 disabled:opacity-60"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete or archive
            </button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function CatalogProductCard({
  product,
  selected,
  onSelect,
}: {
  product: AdminProduct;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-[var(--heat-100)] bg-[var(--heat-4)]"
          : "border-[var(--border-faint)] bg-white hover:border-[var(--heat-20)] hover:bg-[var(--background-lighter)]"
      }`}
    >
      <img
        src={product.image}
        alt={product.title}
        className="size-16 shrink-0 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-1.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-label-small text-foreground">{product.title}</p>
          <p className="shrink-0 text-label-small text-foreground">
            {formatINR(Number(product.price ?? 0))}
          </p>
        </div>
        <p className="mt-1 truncate text-body-small text-[var(--black-alpha-56)]">
          {product.brand} / {categoryNameBySlug.get(product.category) ?? product.category}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge value={product.status} accent="neutral" />
          <span className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
            Stock {product.stock}
          </span>
          {product.sku && (
            <span className="truncate text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              SKU {product.sku}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ProductEditorPreview({
  editor,
  mode,
}: {
  editor: ProductEditorState;
  mode: "create" | "edit";
}) {
  const categoryLabel = categoryNameBySlug.get(editor.category) ?? "Category pending";
  const price = Number(editor.price || 0);
  const mrp = Number(editor.mrp || 0);

  return (
    <div className="mb-5 grid gap-4 rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 lg:grid-cols-[120px_1fr_auto] lg:items-center">
      {editor.image ? (
        <img
          src={editor.image}
          alt={editor.title || "Product preview"}
          className="size-28 rounded-md border border-[var(--border-faint)] bg-white object-contain p-2"
        />
      ) : (
        <div className="grid size-28 place-items-center rounded-md border border-[var(--border-faint)] bg-white text-[var(--black-alpha-40)]">
          <Package className="size-8" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={mode === "create" ? "new_product" : editor.status} />
          <StatusBadge value={categoryLabel} accent="neutral" />
        </div>
        <p className="mt-3 line-clamp-2 text-label-large text-foreground">
          {editor.title || "Untitled product"}
        </p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
          {editor.brand || "Brand pending"} / SKU {editor.sku || "pending"}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[260px] lg:grid-cols-1 xl:grid-cols-3">
        <InfoTile label="Price" value={formatINR(price)} />
        <InfoTile label="MRP" value={formatINR(mrp)} />
        <InfoTile label="Stock" value={editor.stock || "0"} />
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-faint)] bg-white p-4">
      <p className="text-label-medium text-foreground">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OrdersManager({ accessToken }: { accessToken: string }) {
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<OrderEditorState>(emptyOrderEditor());

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestAdminApi<{ orders: AdminOrderRecord[] }>(
        accessToken,
        "/admin/orders",
      );
      setOrders(response.orders);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load orders");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useRealtimeRefresh({
    channelName: "admin-orders",
    enabled: Boolean(accessToken),
    onRefresh: loadOrders,
    targets: [
      { table: "orders" as const },
      { table: "payments" as const },
      { table: "shipments" as const },
      { table: "order_items" as const },
    ],
    debounceMs: 240,
  });

  useEffect(() => {
    if (!orders.length) {
      setSelectedId(null);
      setEditor(emptyOrderEditor());
      return;
    }
    const selected = orders.find((order) => order.id === selectedId) ?? orders[0];
    setSelectedId(selected.id);
    setEditor(mapOrderToEditor(selected));
  }, [orders, selectedId]);

  const filtered = orders.filter((order) =>
    `${order.id} ${order.userEmail ?? ""} ${order.shippingName ?? ""} ${order.shippingCity ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

  const saveOrder = async () => {
    if (!editor.id) return;
    try {
      setSaving(true);
      await requestAdminApi<{ order: unknown }>(accessToken, `/admin/orders/${editor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: editor.status,
          paymentStatus: editor.paymentStatus,
          shippingServiceType: editor.shippingServiceType,
          shippingName: editor.shippingName,
          shippingPhone: editor.shippingPhone,
          shippingEmail: editor.shippingEmail,
          shippingLine1: editor.shippingLine1,
          shippingLine2: editor.shippingLine2,
          shippingCity: editor.shippingCity,
          shippingState: editor.shippingState,
          shippingPincode: editor.shippingPincode,
        }),
      });
      toast.success("Order updated");
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not update order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel title="Recent orders">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search order, customer, or city"
        />
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                <th className="px-3 py-3 font-normal">Order</th>
                <th className="px-3 py-3 font-normal">Customer</th>
                <th className="px-3 py-3 font-normal">Shipment</th>
                <th className="px-3 py-3 font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className={`cursor-pointer border-b border-[var(--border-faint)] align-top transition-colors hover:bg-[var(--heat-4)] ${
                    order.id === selectedId ? "bg-[var(--heat-4)]" : ""
                  }`}
                  onClick={() => {
                    setSelectedId(order.id);
                    setEditor(mapOrderToEditor(order));
                  }}
                >
                  <td className="px-3 py-4">
                    <p className="text-label-small text-foreground">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <StatusBadge value={order.status} />
                      <StatusBadge value={order.paymentStatus} accent="neutral" />
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <p className="text-body-small text-foreground">
                      {order.shippingName || order.userEmail || "Customer"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {order.userEmail || "Email not captured"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {[order.shippingCity, order.shippingState, order.shippingPincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <p className="text-body-small text-foreground">
                      {order.shipment?.courierName ||
                        order.shippingCourierName ||
                        "Shipment pending"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {order.shipment?.awbCode
                        ? `AWB ${order.shipment.awbCode}`
                        : order.shippingServiceType}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-label-small text-foreground">
                    {formatINR(order.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <EmptyState message="No orders match the current search." />
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-body-small text-[var(--black-alpha-56)]">
              <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
              Loading orders
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Edit order">
        {selectedOrder ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order status">
                <TextInput
                  value={editor.status}
                  onChange={(value) => setEditor((current) => ({ ...current, status: value }))}
                />
              </Field>
              <Field label="Payment status">
                <TextInput
                  value={editor.paymentStatus}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, paymentStatus: value }))
                  }
                />
              </Field>
              <Field label="Shipping service type">
                <SelectInput
                  value={editor.shippingServiceType}
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      shippingServiceType: value as "standard" | "quick",
                    }))
                  }
                  options={[
                    { value: "standard", label: "Standard" },
                    { value: "quick", label: "Quick" },
                  ]}
                />
              </Field>
              <Field label="Customer email">
                <TextInput
                  value={editor.shippingEmail}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingEmail: value }))
                  }
                />
              </Field>
              <Field label="Customer name">
                <TextInput
                  value={editor.shippingName}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingName: value }))
                  }
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  value={editor.shippingPhone}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingPhone: value }))
                  }
                />
              </Field>
              <Field label="Address line 1" className="sm:col-span-2">
                <TextInput
                  value={editor.shippingLine1}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingLine1: value }))
                  }
                />
              </Field>
              <Field label="Address line 2" className="sm:col-span-2">
                <TextInput
                  value={editor.shippingLine2}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingLine2: value }))
                  }
                />
              </Field>
              <Field label="City">
                <TextInput
                  value={editor.shippingCity}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingCity: value }))
                  }
                />
              </Field>
              <Field label="State">
                <TextInput
                  value={editor.shippingState}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingState: value }))
                  }
                />
              </Field>
              <Field label="Pincode">
                <TextInput
                  value={editor.shippingPincode}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, shippingPincode: value }))
                  }
                  inputMode="numeric"
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Payment method" value={selectedOrder.paymentMethod} />
              <InfoTile label="Items" value={selectedOrder.itemSummary || "No item summary"} />
              <InfoTile
                label="Shipment"
                value={selectedOrder.shipment?.status || "Shipment not created"}
              />
              <InfoTile label="Total" value={formatINR(selectedOrder.total)} />
            </div>

            {selectedOrder.shipment?.trackingUrl && (
              <a
                href={selectedOrder.shipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-label-small text-[var(--heat-100)] hover:underline"
              >
                Live tracking <ExternalLink className="size-3" />
              </a>
            )}

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void saveOrder()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save order
              </button>
            </div>
          </>
        ) : (
          <EmptyState message="Select an order to edit it." />
        )}
      </Panel>
    </div>
  );
}

function UsersManager({ accessToken }: { accessToken: string }) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<UserEditorState>(emptyUserEditor());

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestAdminApi<{ users: AdminUserRecord[] }>(
        accessToken,
        "/admin/users",
      );
      setUsers(response.users);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useRealtimeRefresh({
    channelName: "admin-users",
    enabled: Boolean(accessToken),
    onRefresh: loadUsers,
    targets: [
      { table: "profiles" as const },
      { table: "user_roles" as const },
      { table: "orders" as const },
    ],
    debounceMs: 240,
  });

  useEffect(() => {
    if (!users.length) {
      setSelectedId(null);
      setEditor(emptyUserEditor());
      return;
    }
    const selected = users.find((user) => user.id === selectedId) ?? users[0];
    setSelectedId(selected.id);
    setEditor(mapUserToEditor(selected));
  }, [selectedId, users]);

  const filtered = users.filter((user) =>
    `${user.email ?? ""} ${user.fullName ?? ""} ${user.phone ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedUser = users.find((user) => user.id === selectedId) ?? null;

  const saveUser = async () => {
    if (!editor.id) return;
    try {
      setSaving(true);
      await requestAdminApi<{ user: unknown }>(accessToken, `/admin/users/${editor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: editor.role,
          fullName: editor.fullName,
          phone: editor.phone,
        }),
      });
      toast.success("User updated");
      await loadUsers();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not update user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel title="Account directory">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, or phone"
        />
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                <th className="px-3 py-3 font-normal">User</th>
                <th className="px-3 py-3 font-normal">Role</th>
                <th className="px-3 py-3 font-normal">Orders</th>
                <th className="px-3 py-3 font-normal">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className={`cursor-pointer border-b border-[var(--border-faint)] align-top transition-colors hover:bg-[var(--heat-4)] ${
                    user.id === selectedId ? "bg-[var(--heat-4)]" : ""
                  }`}
                  onClick={() => {
                    setSelectedId(user.id);
                    setEditor(mapUserToEditor(user));
                  }}
                >
                  <td className="px-3 py-4">
                    <p className="text-label-small text-foreground">
                      {user.fullName || user.email || "Unnamed account"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {user.email || "No email"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {user.phone || "No phone"}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge
                      value={user.role}
                      accent={user.role === "admin" ? "warning" : "neutral"}
                    />
                  </td>
                  <td className="px-3 py-4 text-label-small text-foreground">{user.orderCount}</td>
                  <td className="px-3 py-4 text-label-small text-foreground">
                    {formatINR(user.totalSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <EmptyState message="No users match the current search." />
          )}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-body-small text-[var(--black-alpha-56)]">
              <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
              Loading accounts
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
              {error}
            </p>
          )}
        </div>
      </Panel>

      <Panel title="Edit account">
        {selectedUser ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role">
                <SelectInput
                  value={editor.role}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, role: value as "admin" | "user" }))
                  }
                  options={[
                    { value: "user", label: "User" },
                    { value: "admin", label: "Admin" },
                  ]}
                />
              </Field>
              <Field label="Full name">
                <TextInput
                  value={editor.fullName}
                  onChange={(value) => setEditor((current) => ({ ...current, fullName: value }))}
                />
              </Field>
              <Field label="Phone" className="sm:col-span-2">
                <TextInput
                  value={editor.phone}
                  onChange={(value) => setEditor((current) => ({ ...current, phone: value }))}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoTile label="Email" value={selectedUser.email || "No email"} />
              <InfoTile
                label="Joined"
                value={
                  selectedUser.createdAt
                    ? new Date(selectedUser.createdAt).toLocaleDateString("en-IN")
                    : "Unknown"
                }
              />
              <InfoTile label="Orders" value={String(selectedUser.orderCount)} />
              <InfoTile label="Total spent" value={formatINR(selectedUser.totalSpent)} />
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => void saveUser()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save account
              </button>
            </div>
          </>
        ) : (
          <EmptyState message="Select a user to edit it." />
        )}
      </Panel>
    </div>
  );
}

function FulfillmentQueue() {
  const { role, session } = useAuth();
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [account, setAccount] = useState<ShiprocketAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit) => {
      if (!session?.access_token) throw new Error("Sign in again to use admin fulfillment");
      return requestAdminApi<T>(session.access_token, path, init);
    },
    [session?.access_token],
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [accountResponse, queueResponse] = await Promise.all([
        request<ShiprocketAccount>("/shiprocket/account"),
        request<{ orders: FulfillmentOrder[] }>("/admin/fulfillment/orders"),
      ]);
      setAccount(accountResponse);
      setOrders(queueResponse.orders);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load Shiprocket fulfillment",
      );
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const realtimeTargets = useMemo(
    () => [
      { table: "orders" as const },
      { table: "shipments" as const },
      { table: "shipping_pickup_locations" as const },
      { table: "shipment_events" as const },
    ],
    [],
  );

  useRealtimeRefresh({
    channelName: `admin-fulfillment:${session?.user.id ?? "unknown"}`,
    enabled: role === "admin" && Boolean(session?.access_token),
    onRefresh: refresh,
    targets: realtimeTargets,
    debounceMs: 240,
  });

  const runAction = async (key: string, path: string, options?: RequestInit) => {
    try {
      setActiveAction(key);
      await request(path, options);
      toast.success("Shiprocket fulfillment updated");
      await refresh();
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Fulfillment action failed";
      setError(message);
      toast.error(message);
    } finally {
      setActiveAction(null);
    }
  };

  const detailOrder = orders.find((order) => order.id === detailOrderId) ?? null;

  return (
    <>
      <Panel title="Shiprocket fulfillment" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <StatusTile
              icon={WalletCards}
              label="Wallet balance"
              value={account ? formatINR(account.walletBalance) : "Loading"}
              warning={Boolean(account && account.walletBalance <= 0)}
            />
            <StatusTile
              icon={MapPin}
              label="Pickup location"
              value={account?.configuredPickupLocation || "Loading"}
              warning={Boolean(account && !account.pickupLocationVerified)}
            />
            <StatusTile
              icon={Truck}
              label="Order queue"
              value={`${orders.length} order${orders.length === 1 ? "" : "s"}`}
            />
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh fulfillment queue"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[var(--border-muted)] text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)] disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border-faint)] text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                <th className="px-3 py-3 font-normal">Order</th>
                <th className="px-3 py-3 font-normal">Delivery</th>
                <th className="px-3 py-3 font-normal">Shipment</th>
                <th className="px-3 py-3 font-normal">Tracking</th>
                <th className="px-3 py-3 font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <FulfillmentRow
                  key={order.id}
                  order={order}
                  onOpenDetails={() => setDetailOrderId(order.id)}
                  activeAction={activeAction}
                  runAction={runAction}
                />
              ))}
            </tbody>
          </table>
          {!loading && orders.length === 0 && (
            <p className="py-8 text-center text-body-small text-[var(--black-alpha-56)]">
              No paid orders are waiting for fulfillment.
            </p>
          )}
          {loading && orders.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-body-small text-[var(--black-alpha-56)]">
              <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
              Loading Shiprocket queue
            </div>
          )}
        </div>
      </Panel>
      {detailOrder && (
        <FulfillmentOrderDialog
          order={detailOrder}
          activeAction={activeAction}
          runAction={runAction}
          onClose={() => setDetailOrderId(null)}
        />
      )}
    </>
  );
}

function FulfillmentRow({
  order,
  onOpenDetails,
  activeAction,
  runAction,
}: {
  order: FulfillmentOrder;
  onOpenDetails: () => void;
  activeAction: string | null;
  runAction: (key: string, path: string, options?: RequestInit) => Promise<void>;
}) {
  const shipment = order.shipment;
  const serviceType = shipment?.shippingServiceType ?? order.shippingServiceType ?? "standard";
  const createKey = `${order.id}:create`;
  const awbKey = `${order.id}:awb`;
  const pickupKey = `${order.id}:pickup`;
  const trackingKey = `${order.id}:tracking`;
  const busy = activeAction?.startsWith(order.id);
  const latestTracking = shipment?.trackingActivities[0];

  return (
    <tr
      onClick={onOpenDetails}
      className="cursor-pointer border-b border-[var(--border-faint)] align-top transition-colors last:border-b-0 hover:bg-[var(--background-lighter)]"
    >
      <td className="px-3 py-4">
        <div className="group text-left">
          <div className="flex items-center gap-2">
            <p className="text-label-small text-foreground">#{order.id.slice(0, 8)}</p>
            <ChevronRight className="size-4 text-[var(--black-alpha-32)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--heat-100)]" />
          </div>
          <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
            {order.shippingName || "Customer"}
          </p>
          <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
            {formatINR(Number(order.total ?? 0))}
          </p>
          <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </p>
        </div>
      </td>
      <td className="px-3 py-4">
        <p className="text-label-small capitalize text-foreground">{serviceType}</p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
          {[order.shippingCity, order.shippingState, order.shippingPincode]
            .filter(Boolean)
            .join(", ") || "Address pending"}
        </p>
      </td>
      <td className="px-3 py-4">
        <p className="text-label-small capitalize text-foreground">
          {shipment?.status?.replaceAll("_", " ") || "Not created"}
        </p>
        <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
          {shipment?.awbCode ? `AWB ${shipment.awbCode}` : "AWB pending"}
        </p>
        {shipment?.courierName && (
          <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
            {shipment.courierName}
          </p>
        )}
      </td>
      <td className="px-3 py-4">
        <p className="max-w-[240px] text-body-small text-[var(--black-alpha-72)]">
          {latestTracking?.activity ||
            latestTracking?.status ||
            "Tracking starts after AWB assignment"}
        </p>
        {latestTracking?.location && (
          <p className="mt-1 text-body-small text-[var(--black-alpha-48)]">
            {latestTracking.location}
          </p>
        )}
        {shipment?.trackingUrl && (
          <a
            href={shipment.trackingUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-2 inline-flex items-center gap-1 text-label-small text-[var(--heat-100)] hover:underline"
          >
            Live tracking <ExternalLink className="size-3" />
          </a>
        )}
      </td>
      <td className="px-3 py-4">
        <div className="flex max-w-[300px] flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetails();
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-muted)] px-3 text-label-small text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
          >
            <Eye className="size-4" />
            View details
          </button>
          {!shipment && (
            <ActionButton
              icon={PackagePlus}
              label="Create shipment"
              loading={activeAction === createKey}
              disabled={busy}
              onClick={() =>
                void runAction(
                  createKey,
                  "/shipments/shiprocket/create",
                  postJson({ orderId: order.id }),
                )
              }
            />
          )}
          {shipment && !shipment.awbCode && (
            <ActionButton
              icon={Send}
              label={serviceType === "quick" ? "Assign AWB and rider" : "Assign AWB"}
              loading={activeAction === awbKey}
              disabled={busy}
              onClick={() =>
                void runAction(
                  awbKey,
                  "/shipments/shiprocket/assign-awb",
                  postJson({ shipmentId: shipment.id }),
                )
              }
            />
          )}
          {shipment?.awbCode && serviceType === "standard" && !shipment.pickupScheduledDate && (
            <ActionButton
              icon={Truck}
              label="Schedule pickup"
              loading={activeAction === pickupKey}
              disabled={busy}
              onClick={() =>
                void runAction(
                  pickupKey,
                  "/shipments/shiprocket/pickup",
                  postJson({ shipmentId: shipment.id }),
                )
              }
            />
          )}
          {shipment?.shiprocketShipmentId && (
            <ActionButton
              icon={RefreshCw}
              label="Refresh tracking"
              loading={activeAction === trackingKey}
              disabled={busy}
              onClick={() =>
                void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)
              }
            />
          )}
          {shipment?.manifestUrl && (
            <a
              href={shipment.manifestUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-muted)] px-3 text-label-small text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            >
              <CheckCircle2 className="size-4" />
              Manifest
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

function FulfillmentOrderDialog({
  order,
  activeAction,
  runAction,
  onClose,
}: {
  order: FulfillmentOrder;
  activeAction: string | null;
  runAction: (key: string, path: string, options?: RequestInit) => Promise<void>;
  onClose: () => void;
}) {
  const shipment = order.shipment;
  const serviceType = shipment?.shippingServiceType ?? order.shippingServiceType ?? "standard";
  const createKey = `${order.id}:create`;
  const awbKey = `${order.id}:awb`;
  const pickupKey = `${order.id}:pickup`;
  const trackingKey = `${order.id}:tracking`;
  const busy = activeAction?.startsWith(order.id) ?? false;
  const latestTracking = shipment?.trackingActivities[0] ?? null;
  const deliveryLine =
    [order.shippingCity, order.shippingState, order.shippingPincode].filter(Boolean).join(", ") ||
    "Address pending";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fulfillment-order-title"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-48px)] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-[0_24px_80px_-36px_rgba(0,0,0,0.55)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-faint)] px-5 py-4">
          <div>
            <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
              Fulfillment detail
            </p>
            <h2 id="fulfillment-order-title" className="mt-1 text-title-h5 text-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </h2>
            <p className="mt-1 text-body-small text-[var(--black-alpha-64)]">
              {order.shippingName || "Customer"} / {formatINR(Number(order.total ?? 0))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge value={serviceType} accent="neutral" />
            <StatusBadge value={shipment?.status || "not_created"} />
            <button
              type="button"
              onClick={onClose}
              title="Close order details"
              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--border-muted)] text-[var(--black-alpha-64)] transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-[var(--border-faint)] p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-label-large text-foreground">Pack list</p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                  Verify product image, SKU, brand, and quantity before creating shipment.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-faint)] px-3 py-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-56)]">
                <ClipboardList className="size-3.5 text-[var(--heat-100)]" />
                {order.items.length} item{order.items.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-4 divide-y divide-[var(--border-faint)] rounded-lg border border-[var(--border-faint)]">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 sm:grid-cols-[88px_1fr_auto] sm:items-center"
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="size-24 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] object-contain p-2"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-label-medium text-foreground">{item.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                      <span>{item.brand || "Brand pending"}</span>
                      <span>SKU {item.sku || "pending"}</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-[var(--border-faint)] px-3 py-2 text-center">
                    <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                      Qty
                    </p>
                    <p className="text-label-large text-foreground">{item.qty}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 bg-[var(--background-lighter)] p-5">
            <div className="rounded-lg border border-[var(--border-faint)] bg-white p-4">
              <div className="flex items-center gap-2 text-label-small text-foreground">
                <MapPin className="size-4 text-[var(--heat-100)]" />
                Delivery
              </div>
              <p className="mt-3 text-body-small text-[var(--black-alpha-72)]">{deliveryLine}</p>
              <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                Service {serviceType}
              </p>
            </div>

            <div className="rounded-lg border border-[var(--border-faint)] bg-white p-4">
              <div className="flex items-center gap-2 text-label-small text-foreground">
                <Package className="size-4 text-[var(--heat-100)]" />
                Shipment
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <InfoTile
                  label="Status"
                  value={shipment?.status?.replaceAll("_", " ") || "Not created"}
                />
                <InfoTile label="AWB" value={shipment?.awbCode || "Pending"} />
                <InfoTile label="Courier" value={shipment?.courierName || "Pending"} />
                <InfoTile label="Pickup" value={shipment?.pickupScheduledDate || "Not scheduled"} />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--border-faint)] bg-white p-4">
              <div className="flex items-center gap-2 text-label-small text-foreground">
                <Truck className="size-4 text-[var(--heat-100)]" />
                Tracking
              </div>
              <p className="mt-3 text-body-small text-[var(--black-alpha-72)]">
                {latestTracking?.activity ||
                  latestTracking?.status ||
                  "Tracking starts after AWB assignment"}
              </p>
              {latestTracking?.location && (
                <p className="mt-1 text-body-small text-[var(--black-alpha-48)]">
                  {latestTracking.location}
                </p>
              )}
              {shipment?.trackingUrl && (
                <a
                  href={shipment.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-label-small text-[var(--heat-100)] hover:underline"
                >
                  Open live tracking <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            <div className="rounded-lg border border-[var(--heat-20)] bg-white p-4">
              <p className="text-label-small text-foreground">Fulfillment actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!shipment && (
                  <ActionButton
                    icon={PackagePlus}
                    label="Create shipment"
                    loading={activeAction === createKey}
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        createKey,
                        "/shipments/shiprocket/create",
                        postJson({ orderId: order.id }),
                      )
                    }
                  />
                )}
                {shipment && !shipment.awbCode && (
                  <ActionButton
                    icon={Send}
                    label={serviceType === "quick" ? "Assign AWB and rider" : "Assign AWB"}
                    loading={activeAction === awbKey}
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        awbKey,
                        "/shipments/shiprocket/assign-awb",
                        postJson({ shipmentId: shipment.id }),
                      )
                    }
                  />
                )}
                {shipment?.awbCode &&
                  serviceType === "standard" &&
                  !shipment.pickupScheduledDate && (
                    <ActionButton
                      icon={Truck}
                      label="Schedule pickup"
                      loading={activeAction === pickupKey}
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          pickupKey,
                          "/shipments/shiprocket/pickup",
                          postJson({ shipmentId: shipment.id }),
                        )
                      }
                    />
                  )}
                {shipment?.shiprocketShipmentId && (
                  <ActionButton
                    icon={RefreshCw}
                    label="Refresh tracking"
                    loading={activeAction === trackingKey}
                    disabled={busy}
                    onClick={() =>
                      void runAction(trackingKey, `/shipments/shiprocket/${shipment.id}/tracking`)
                    }
                  />
                )}
                {shipment?.manifestUrl && (
                  <a
                    href={shipment.manifestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-muted)] px-3 text-label-small text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
                  >
                    <CheckCircle2 className="size-4" />
                    Open manifest
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  warning = false,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`min-w-[150px] rounded-md border p-3 ${warning ? "border-red-500/20 bg-red-50" : "border-[var(--border-faint)] bg-[var(--background-lighter)]"}`}
    >
      <Icon className={`size-4 ${warning ? "text-red-700" : "text-[var(--heat-100)]"}`} />
      <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {label}
      </p>
      <p className="mt-1 text-label-small text-foreground">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof Truck;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--heat-100)] px-3 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:opacity-60"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </button>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex h-11 min-w-[240px] flex-1 items-center overflow-hidden rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] px-3">
      <Search className="size-4 text-[var(--black-alpha-40)]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full flex-1 bg-transparent px-3 text-body-medium placeholder:text-[var(--black-alpha-48)]"
      />
    </label>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode={inputMode}
      className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground"
    />
  );
}

function TextAreaInput({
  value,
  onChange,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      className="w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-3 text-body-medium text-foreground"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({
  value,
  accent = "heat",
}: {
  value: string;
  accent?: "heat" | "warning" | "neutral";
}) {
  const classes =
    accent === "warning"
      ? "border border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]"
      : accent === "neutral"
        ? "border border-[var(--border-faint)] bg-[var(--background-lighter)] text-[var(--black-alpha-64)]"
        : "border border-[var(--heat-20)] bg-[var(--heat-8)] text-[var(--heat-100)]";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-mono-x-small uppercase tracking-wider ${classes}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
      <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {label}
      </p>
      <p className="mt-2 text-label-small text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4 text-body-small text-[var(--black-alpha-56)]">
      {message}
    </div>
  );
}

function postJson(body: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body),
  };
}
