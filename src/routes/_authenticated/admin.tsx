import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { apiBase } from "@/lib/api-base";
import { categories, formatINR } from "@/lib/catalog";
import { getAuthorizationHeaders } from "@/lib/supabase-auth";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import { SmartTime } from "@/components/SmartTime";

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
  BadgePercent,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  MessageSquare,
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
  AlertTriangle,
  Ban,
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
  periodReports: Array<{
    id: "daily" | "weekly" | "monthly";
    label: string;
    orders: number;
    revenue: number;
    averageOrderValue: number;
    cancellations: number;
    returns: number;
    refunds: number;
    refundAmount: number;
  }>;
  cancellationReport: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    refunded: number;
    cancelledOrders: number;
    latest: Array<{
      id: string;
      orderId: string;
      status: string;
      reason: string | null;
      requestedAt: string;
    }>;
  };
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

type AdminView = "overview" | "catalog" | "orders" | "users" | "promos" | "support";

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
  authenticity_grade: "oem" | "compatible" | "refurbished" | "open_box" | null;
  condition_grade: "new" | "open_box" | "refurbished" | "used" | null;
  hsn_code: string | null;
  gst_rate: number | null;
  doa_policy_days: number | null;
  local_delivery_eligible: boolean | null;
  cod_eligible: boolean | null;
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
  authenticityGrade: "oem" | "compatible" | "refurbished" | "open_box";
  conditionGrade: "new" | "open_box" | "refurbished" | "used";
  hsnCode: string;
  gstRate: string;
  doaPolicyDays: string;
  localDeliveryEligible: boolean;
  codEligible: boolean;
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

type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumSubtotal: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  usedCount: number;
  discountGiven: number;
};

type CouponEditorState = {
  id: string | null;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  minimumSubtotal: string;
  maxDiscount: string;
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  active: boolean;
};

type AdminProductQuestion = {
  id: string;
  question: string;
  answer: string | null;
  status: "pending" | "published" | "rejected";
  created_at: string;
  answered_at: string | null;
  products: {
    id: string;
    title: string;
    brand: string;
    image: string;
  } | null;
};

type AdminStockNotificationEvent = {
  id: string;
  email: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
  products: {
    id: string;
    title: string;
    brand: string;
    image: string;
  } | null;
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
  items: Array<{
    id: string;
    title: string;
    image: string | null;
    brand: string | null;
    qty: number;
    price: number;
  }>;
  shipment: {
    status: string;
    awbCode: string | null;
    courierName: string | null;
    trackingUrl: string | null;
    expectedDeliveryDate: string | null;
  } | null;
  payment: {
    id: string;
    provider: string;
    status: string;
    amount: number;
    providerPaymentId: string | null;
    providerOrderId: string | null;
  } | null;
  cancellationRequest: {
    id: string;
    status: string;
    reason: string;
    admin_note: string | null;
    requested_at: string;
    resolved_at: string | null;
    refund_id: string | null;
  } | null;
  returnRequest: {
    id: string;
    status: string;
    reason: string;
    admin_note: string | null;
    requested_at: string;
    resolved_at: string | null;
    received_at: string | null;
    reverse_shipment_id: string | null;
    refund_id: string | null;
  } | null;
  refund: {
    id: string;
    amount: number;
    status: string;
    provider_refund_id: string | null;
    created_at: string;
    cancellation_request_id: string | null;
    return_request_id: string | null;
  } | null;
  refunds: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    speed: "normal" | "optimum";
    providerRefundId: string | null;
    createdAt: string;
    processedAt: string | null;
    cancellationRequestId: string | null;
    returnRequestId: string | null;
  }>;
  refundSummary: {
    paidAmount: number;
    refundedAmount: number;
    refundableAmount: number;
  };
  invoice: {
    invoice_number: string;
    invoice_url: string | null;
    status: string;
    generated_at: string;
  } | null;
  adminEvents: Array<{
    id: string;
    eventType: string;
    reason: string;
    createdAt: string;
    adminUserId: string | null;
    adminEmail: string | null;
    fromState: Record<string, unknown>;
    toState: Record<string, unknown>;
  }>;
};

type OrderEditorState = {
  id: string | null;
  status: string;
  paymentStatus: string;
  reason: string;
};

type RefundEditorState = {
  amount: string;
  reason: string;
  speed: "normal" | "optimum";
  cancellationRequestId: string | null;
  returnRequestId: string | null;
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
    authenticityGrade: "compatible",
    conditionGrade: "new",
    hsnCode: "",
    gstRate: "18",
    doaPolicyDays: "7",
    localDeliveryEligible: true,
    codEligible: true,
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
    authenticityGrade: product.authenticity_grade ?? "compatible",
    conditionGrade: product.condition_grade ?? "new",
    hsnCode: product.hsn_code ?? "",
    gstRate: product.gst_rate === null ? "18" : String(product.gst_rate),
    doaPolicyDays: product.doa_policy_days === null ? "7" : String(product.doa_policy_days),
    localDeliveryEligible: product.local_delivery_eligible !== false,
    codEligible: product.cod_eligible !== false,
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

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function emptyCouponEditor(): CouponEditorState {
  return {
    id: null,
    code: "",
    description: "",
    discountType: "percent",
    discountValue: "",
    minimumSubtotal: "0",
    maxDiscount: "",
    startsAt: "",
    endsAt: "",
    usageLimit: "",
    perUserLimit: "1",
    active: true,
  };
}

function mapCouponToEditor(coupon: AdminCoupon): CouponEditorState {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    minimumSubtotal: String(coupon.minimumSubtotal),
    maxDiscount: coupon.maxDiscount === null ? "" : String(coupon.maxDiscount),
    startsAt: toDateTimeInput(coupon.startsAt),
    endsAt: toDateTimeInput(coupon.endsAt),
    usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
    perUserLimit: String(coupon.perUserLimit),
    active: coupon.active,
  };
}

function emptyOrderEditor(): OrderEditorState {
  return {
    id: null,
    status: "confirmed",
    paymentStatus: "paid",
    reason: "",
  };
}

function mapOrderToEditor(order: AdminOrderRecord): OrderEditorState {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    reason: "",
  };
}

function emptyRefundEditor(): RefundEditorState {
  return {
    amount: "",
    reason: "",
    speed: "normal",
    cancellationRequestId: null,
    returnRequestId: null,
  };
}

function mapOrderToRefundEditor(order: AdminOrderRecord): RefundEditorState {
  return {
    amount:
      order.refundSummary.refundableAmount > 0 ? String(order.refundSummary.refundableAmount) : "",
    reason: "",
    speed: "normal",
    cancellationRequestId:
      order.cancellationRequest &&
      ["approved", "refund_pending"].includes(order.cancellationRequest.status) &&
      !order.cancellationRequest.refund_id
        ? order.cancellationRequest.id
        : null,
    returnRequestId:
      order.returnRequest &&
      ["received", "refund_pending"].includes(order.returnRequest.status) &&
      !order.returnRequest.refund_id
        ? order.returnRequest.id
        : null,
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const terminalOrderStatuses = new Set(["cancelled", "refunded", "returned"]);
const terminalPaymentStatuses = new Set(["refunded", "cod_cancelled"]);
const manualOrderStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];
const manualOrderStatusValues = new Set(manualOrderStatusOptions.map((option) => option.value));
const paymentStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "cod_pending", label: "COD Pending" },
  { value: "cod_cancelled", label: "COD Cancelled" },
  { value: "failed", label: "Failed" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "refunded", label: "Refunded" },
];
const blockedFulfillmentStatuses = new Set([
  "cancelled",
  "cancellation_requested",
  "return_requested",
  "refunded",
]);

function isTerminalOrder(order: Pick<AdminOrderRecord, "status" | "paymentStatus">) {
  return (
    terminalOrderStatuses.has(order.status.toLowerCase()) ||
    terminalPaymentStatuses.has(order.paymentStatus.toLowerCase())
  );
}

function isCancelledOrder(order: Pick<AdminOrderRecord, "status">) {
  return order.status.toLowerCase() === "cancelled";
}

function statusTone(value: string): "heat" | "warning" | "neutral" | "danger" | "success" {
  const normalized = value.toLowerCase();
  if (
    ["cancelled", "failed", "rejected", "cod_cancelled"].some((state) => normalized.includes(state))
  ) {
    return "danger";
  }
  if (normalized.includes("partially_refunded")) return "warning";
  if (
    ["paid", "delivered", "completed", "approved", "sent", "processed", "refunded"].some((state) =>
      normalized.includes(state),
    )
  ) {
    return "success";
  }
  if (
    ["pending", "requested", "return", "refund", "pickup"].some((state) =>
      normalized.includes(state),
    )
  ) {
    return "warning";
  }
  return "neutral";
}

function adminShipmentStarted(order: AdminOrderRecord) {
  const shipmentStatus = String(order.shipment?.status ?? "").toLowerCase();
  return [
    "awb_assigned",
    "pickup_scheduled",
    "label_generated",
    "manifest_generated",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "returned",
    "rto_initiated",
    "rto_delivered",
  ].includes(shipmentStatus);
}

function canTransitionManualOrderStatusClient(order: AdminOrderRecord, nextStatus: string) {
  const currentStatus = order.status.toLowerCase();
  if (currentStatus === nextStatus) return true;
  const progressiveStates = [
    "pending",
    "processing",
    "confirmed",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];
  const currentIndex = progressiveStates.indexOf(currentStatus);
  const nextIndex = progressiveStates.indexOf(nextStatus);
  if (nextStatus === "cancelled") return !adminShipmentStarted(order);
  if (nextStatus === "returned") return currentStatus === "delivered";
  if (currentIndex === -1 || nextIndex === -1) return false;
  return nextIndex > currentIndex;
}

function adminReasonRequired(nextStatus: string) {
  return ["cancelled", "returned"].includes(nextStatus);
}

function orderCanCreateShipment(order: FulfillmentOrder) {
  return !order.shipment && !blockedFulfillmentStatuses.has(order.status.toLowerCase());
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
      { table: "order_cancellation_requests" as const },
      { table: "return_requests" as const },
      { table: "refunds" as const },
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
        <AdminCommandCenter
          analytics={analytics}
          kpis={kpis}
          onOpenOrders={() => setView("orders")}
        />
      ) : null}

      <AdminTabs active={view} onChange={setView} />

      {view === "overview" && (
        <>
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
          <FulfillmentQueue />
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
      {view === "promos" && session?.access_token && (
        <CouponsManager accessToken={session.access_token} />
      )}
      {view === "support" && session?.access_token && (
        <SupportManager accessToken={session.access_token} />
      )}
    </DashboardShell>
  );
}

function AdminCommandCenter({
  analytics,
  kpis,
  onOpenOrders,
}: {
  analytics: AdminAnalytics;
  kpis: ComponentProps<typeof KpiGrid>["items"];
  onOpenOrders: () => void;
}) {
  return (
    <section className="space-y-5">
      <KpiGrid items={kpis} />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-[var(--border-faint)] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-title-h5 text-foreground">Operating reports</h2>
              <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                Daily, weekly, and monthly order health from the current database.
              </p>
            </div>
            <span className="rounded-full border border-[var(--border-faint)] bg-[var(--background-lighter)] px-3 py-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-56)]">
              live
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {analytics.periodReports.map((report) => (
              <div
                key={report.id}
                className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-label-small text-foreground">{report.label}</p>
                    <p className="mt-1 text-title-h5 text-foreground">
                      {formatINR(report.revenue)}
                    </p>
                  </div>
                  <StatusBadge value={`${report.orders} orders`} accent="neutral" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-body-small">
                  <ReportMetric label="AOV" value={formatINR(report.averageOrderValue)} />
                  <ReportMetric label="Refunds" value={`${report.refunds}`} />
                  <ReportMetric label="Cancels" value={`${report.cancellations}`} />
                  <ReportMetric label="Returns" value={`${report.returns}`} />
                </div>
                {report.refundAmount > 0 && (
                  <p className="mt-3 text-body-small text-[var(--black-alpha-56)]">
                    {formatINR(report.refundAmount)} refunded
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border-faint)] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-title-h5 text-foreground">Cancellation watch</h2>
              <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                Requests, rejected cases, and refund completion.
              </p>
            </div>
            <StatusBadge
              value={`${analytics.cancellationReport.pending} pending`}
              accent={analytics.cancellationReport.pending > 0 ? "warning" : "success"}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <InfoTile label="Requests" value={String(analytics.cancellationReport.total)} />
            <InfoTile
              label="Cancelled orders"
              value={String(analytics.cancellationReport.cancelledOrders)}
            />
            <InfoTile label="Approved" value={String(analytics.cancellationReport.approved)} />
            <InfoTile label="Refunded" value={String(analytics.cancellationReport.refunded)} />
          </div>

          <div className="mt-4 space-y-2">
            {analytics.cancellationReport.latest.length === 0 ? (
              <div className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 text-body-small text-[var(--black-alpha-56)]">
                No cancellation requests yet.
              </div>
            ) : (
              analytics.cancellationReport.latest.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  onClick={onOpenOrders}
                  className="w-full rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3 text-left transition-colors hover:border-[var(--heat-40)]"
                  title="Open orders"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label-small text-foreground">
                        #{request.orderId.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="mt-1 line-clamp-1 text-body-small text-[var(--black-alpha-56)]">
                        {request.reason || "No customer reason captured"}
                      </p>
                    </div>
                    <StatusBadge value={request.status} accent={statusTone(request.status)} />
                  </div>
                  <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    <SmartTime date={request.requestedAt} />
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
        {label}
      </p>
      <p className="mt-1 text-label-small text-foreground">{value}</p>
    </div>
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
    { id: "overview", label: "Dashboard" },
    { id: "catalog", label: "Catalog" },
    { id: "orders", label: "Orders" },
    { id: "users", label: "Users" },
    { id: "promos", label: "Promos" },
    { id: "support", label: "Support" },
  ];

  return (
    <div className="sticky top-0 z-20 -mx-4 mt-6 border-y border-[var(--border-faint)] bg-[var(--background-base)]/95 px-4 py-3 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`inline-flex h-10 shrink-0 items-center rounded-md border px-4 text-label-small transition-colors ${
              active === item.id
                ? "border-[var(--heat-100)] bg-[var(--heat-8)] text-[var(--heat-100)]"
                : "border-[var(--border-muted)] bg-white text-foreground hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
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
        authenticityGrade: editor.authenticityGrade,
        conditionGrade: editor.conditionGrade,
        hsnCode: editor.hsnCode,
        gstRate: payloadNumber(editor.gstRate) ?? 18,
        doaPolicyDays: payloadNumber(editor.doaPolicyDays) ?? 7,
        localDeliveryEligible: editor.localDeliveryEligible,
        codEligible: editor.codEligible,
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

          <FormSection title="Trust, tax, and checkout rules">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Authenticity">
                <SelectInput
                  value={editor.authenticityGrade}
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      authenticityGrade: value as ProductEditorState["authenticityGrade"],
                    }))
                  }
                  options={[
                    { value: "oem", label: "OEM" },
                    { value: "compatible", label: "Compatible" },
                    { value: "refurbished", label: "Refurbished" },
                    { value: "open_box", label: "Open box" },
                  ]}
                />
              </Field>
              <Field label="Condition">
                <SelectInput
                  value={editor.conditionGrade}
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      conditionGrade: value as ProductEditorState["conditionGrade"],
                    }))
                  }
                  options={[
                    { value: "new", label: "New" },
                    { value: "open_box", label: "Open box" },
                    { value: "refurbished", label: "Refurbished" },
                    { value: "used", label: "Used" },
                  ]}
                />
              </Field>
              <Field label="HSN code">
                <TextInput
                  value={editor.hsnCode}
                  onChange={(value) => setEditor((current) => ({ ...current, hsnCode: value }))}
                />
              </Field>
              <Field label="GST rate">
                <TextInput
                  value={editor.gstRate}
                  onChange={(value) => setEditor((current) => ({ ...current, gstRate: value }))}
                  inputMode="decimal"
                />
              </Field>
              <Field label="DOA days">
                <TextInput
                  value={editor.doaPolicyDays}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, doaPolicyDays: value }))
                  }
                  inputMode="numeric"
                />
              </Field>
              <Field label="Local delivery">
                <SelectInput
                  value={editor.localDeliveryEligible ? "yes" : "no"}
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      localDeliveryEligible: value === "yes",
                    }))
                  }
                  options={[
                    { value: "yes", label: "Eligible" },
                    { value: "no", label: "Not eligible" },
                  ]}
                />
              </Field>
              <Field label="COD">
                <SelectInput
                  value={editor.codEligible ? "yes" : "no"}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, codEligible: value === "yes" }))
                  }
                  options={[
                    { value: "yes", label: "Eligible" },
                    { value: "no", label: "Prepaid only" },
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

function CouponsManager({ accessToken }: { accessToken: string }) {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [editor, setEditor] = useState<CouponEditorState>(emptyCouponEditor());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await requestAdminApi<{ coupons: AdminCoupon[] }>(
        accessToken,
        "/admin/coupons",
      );
      setCoupons(response.coupons);
      setError(null);
      setSelectedId((current) => {
        if (current === "new") return current;
        return response.coupons.some((coupon) => coupon.id === current)
          ? current
          : (response.coupons[0]?.id ?? null);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load coupons");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  useEffect(() => {
    if (selectedId === "new") {
      setEditor(emptyCouponEditor());
      return;
    }
    const coupon = coupons.find((item) => item.id === selectedId);
    if (coupon) setEditor(mapCouponToEditor(coupon));
  }, [coupons, selectedId]);

  const realtimeTargets = useMemo(
    () => [{ table: "coupons" as const }, { table: "coupon_redemptions" as const }],
    [],
  );

  useRealtimeRefresh({
    channelName: "admin-coupons",
    enabled: Boolean(accessToken),
    onRefresh: loadCoupons,
    targets: realtimeTargets,
    debounceMs: 220,
  });

  const saveCoupon = async () => {
    if (!editor.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: editor.code.trim().toUpperCase(),
        description: editor.description.trim(),
        discountType: editor.discountType,
        discountValue: Number(editor.discountValue),
        minimumSubtotal: Number(editor.minimumSubtotal || 0),
        maxDiscount: editor.maxDiscount ? Number(editor.maxDiscount) : null,
        startsAt: fromDateTimeInput(editor.startsAt),
        endsAt: fromDateTimeInput(editor.endsAt),
        usageLimit: editor.usageLimit ? Number(editor.usageLimit) : null,
        perUserLimit: Number(editor.perUserLimit || 1),
        active: editor.active,
      };
      if (editor.id) {
        await requestAdminApi(accessToken, `/admin/coupons/${editor.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        const response = await requestAdminApi<{ coupon: { id: string } }>(
          accessToken,
          "/admin/coupons",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        setSelectedId(response.coupon.id);
      }
      toast.success("Coupon saved");
      await loadCoupons();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not save coupon");
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async () => {
    if (!editor.id) return;
    setDeleting(true);
    try {
      await requestAdminApi(accessToken, `/admin/coupons/${editor.id}`, { method: "DELETE" });
      toast.success("Coupon removed or deactivated");
      setSelectedId(null);
      await loadCoupons();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not remove coupon");
    } finally {
      setDeleting(false);
    }
  };

  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedId) ?? null;

  return (
    <Panel
      className="mt-6"
      title="Promotions"
      action={
        <button
          type="button"
          onClick={() => setSelectedId("new")}
          className="button button-primary inline-flex h-9 items-center gap-2 rounded-md px-3 text-label-small"
        >
          <Plus className="size-4" />
          New coupon
        </button>
      }
    >
      {error && (
        <p className="mb-4 rounded-md border border-red-500/20 bg-red-50 p-3 text-body-small text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)]">
          <div className="grid grid-cols-[1fr_auto_auto] border-b border-[var(--border-faint)] px-4 py-3 text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-48)]">
            <span>Code</span>
            <span>Used</span>
            <span>Status</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-body-small text-[var(--black-alpha-56)]">
              <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
              Loading coupons
            </div>
          ) : coupons.length === 0 ? (
            <div className="p-8 text-body-small text-[var(--black-alpha-56)]">
              No coupons have been created yet.
            </div>
          ) : (
            coupons.map((coupon) => (
              <button
                key={coupon.id}
                type="button"
                onClick={() => setSelectedId(coupon.id)}
                className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[var(--border-faint)] px-4 py-3 text-left transition-colors last:border-b-0 ${
                  selectedId === coupon.id
                    ? "bg-[var(--heat-4)] text-[var(--heat-100)]"
                    : "bg-white text-foreground hover:bg-[var(--background-lighter)]"
                }`}
              >
                <span>
                  <span className="flex items-center gap-2 text-label-small">
                    <BadgePercent className="size-4" />
                    {coupon.code}
                  </span>
                  <span className="mt-1 block text-body-small text-[var(--black-alpha-56)]">
                    {coupon.discountType === "percent"
                      ? `${coupon.discountValue}% off`
                      : `${formatINR(coupon.discountValue)} off`}
                  </span>
                </span>
                <span className="text-label-small">{coupon.usedCount}</span>
                <span
                  className={`rounded-full px-2 py-1 text-mono-x-small uppercase tracking-wider ${
                    coupon.active
                      ? "bg-[var(--accent-forest)]/10 text-[var(--accent-forest)]"
                      : "bg-[var(--black-alpha-8)] text-[var(--black-alpha-48)]"
                  }`}
                >
                  {coupon.active ? "Active" : "Off"}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="rounded-lg border border-[var(--border-muted)] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
                {editor.id ? "Edit coupon" : "Create coupon"}
              </p>
              <h3 className="mt-1 text-title-h5 text-foreground">
                {editor.code || "New campaign"}
              </h3>
            </div>
            {selectedCoupon && (
              <div className="text-right text-body-small text-[var(--black-alpha-56)]">
                <p>{selectedCoupon.usedCount} redemptions</p>
                <p>{formatINR(selectedCoupon.discountGiven)} discounts</p>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Code">
              <TextInput
                value={editor.code}
                onChange={(value) =>
                  setEditor((current) => ({ ...current, code: value.toUpperCase() }))
                }
              />
            </Field>
            <Field label="Discount type">
              <SelectInput
                value={editor.discountType}
                onChange={(value) =>
                  setEditor((current) => ({
                    ...current,
                    discountType: value as CouponEditorState["discountType"],
                  }))
                }
                options={[
                  { value: "percent", label: "Percent" },
                  { value: "fixed", label: "Fixed amount" },
                ]}
              />
            </Field>
            <Field
              label={editor.discountType === "percent" ? "Discount percent" : "Discount amount"}
            >
              <TextInput
                value={editor.discountValue}
                onChange={(value) => setEditor((current) => ({ ...current, discountValue: value }))}
                type="number"
              />
            </Field>
            <Field label="Minimum subtotal">
              <TextInput
                value={editor.minimumSubtotal}
                onChange={(value) =>
                  setEditor((current) => ({ ...current, minimumSubtotal: value }))
                }
                type="number"
              />
            </Field>
            <Field label="Max discount">
              <TextInput
                value={editor.maxDiscount}
                onChange={(value) => setEditor((current) => ({ ...current, maxDiscount: value }))}
                type="number"
              />
            </Field>
            <Field label="Total usage limit">
              <TextInput
                value={editor.usageLimit}
                onChange={(value) => setEditor((current) => ({ ...current, usageLimit: value }))}
                type="number"
              />
            </Field>
            <Field label="Per user limit">
              <TextInput
                value={editor.perUserLimit}
                onChange={(value) => setEditor((current) => ({ ...current, perUserLimit: value }))}
                type="number"
              />
            </Field>
            <Field label="Status">
              <SelectInput
                value={editor.active ? "active" : "inactive"}
                onChange={(value) =>
                  setEditor((current) => ({ ...current, active: value === "active" }))
                }
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </Field>
            <Field label="Starts at">
              <TextInput
                value={editor.startsAt}
                onChange={(value) => setEditor((current) => ({ ...current, startsAt: value }))}
                type="datetime-local"
              />
            </Field>
            <Field label="Ends at">
              <TextInput
                value={editor.endsAt}
                onChange={(value) => setEditor((current) => ({ ...current, endsAt: value }))}
                type="datetime-local"
              />
            </Field>
          </div>
          <Field label="Description" className="mt-4">
            <TextAreaInput
              value={editor.description}
              onChange={(value) => setEditor((current) => ({ ...current, description: value }))}
              rows={3}
            />
          </Field>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveCoupon()}
              disabled={saving}
              className="button button-primary inline-flex h-10 items-center gap-2 rounded-md px-4 text-label-small disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save coupon
            </button>
            {editor.id && (
              <button
                type="button"
                onClick={() => void deleteCoupon()}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-50 px-4 text-label-small text-red-700 transition-colors hover:border-red-500/40 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SupportManager({ accessToken }: { accessToken: string }) {
  const [questions, setQuestions] = useState<AdminProductQuestion[]>([]);
  const [events, setEvents] = useState<AdminStockNotificationEvent[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadSupport = useCallback(async () => {
    try {
      const [questionResponse, eventResponse] = await Promise.all([
        requestAdminApi<{ questions: AdminProductQuestion[] }>(
          accessToken,
          "/admin/product-questions",
        ),
        requestAdminApi<{ events: AdminStockNotificationEvent[] }>(
          accessToken,
          "/admin/stock-notification-events",
        ),
      ]);
      setQuestions(questionResponse.questions);
      setEvents(eventResponse.events);
      setAnswers((current) => {
        const next = { ...current };
        for (const question of questionResponse.questions) {
          if (next[question.id] === undefined) next[question.id] = question.answer ?? "";
        }
        return next;
      });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not load support");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadSupport();
  }, [loadSupport]);

  useRealtimeRefresh({
    channelName: "admin-support",
    onRefresh: loadSupport,
    targets: [
      { table: "product_questions" },
      { table: "stock_notification_events" },
      { table: "products" },
    ],
  });

  const updateQuestion = async (questionId: string, status: AdminProductQuestion["status"]) => {
    try {
      await requestAdminApi<{ question: AdminProductQuestion }>(
        accessToken,
        `/admin/product-questions/${questionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            answer: answers[questionId]?.trim() || undefined,
          }),
        },
      );
      toast.success(status === "published" ? "Answer published" : "Question updated");
      await loadSupport();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Could not update question",
      );
    }
  };

  const updateStockEvent = async (
    eventId: string,
    status: AdminStockNotificationEvent["status"],
  ) => {
    try {
      await requestAdminApi<{ event: AdminStockNotificationEvent }>(
        accessToken,
        `/admin/stock-notification-events/${eventId}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      toast.success("Stock notification updated");
      await loadSupport();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Could not update notification",
      );
    }
  };

  const sendStockEvent = async (eventId: string) => {
    try {
      await requestAdminApi<{ event: AdminStockNotificationEvent }>(
        accessToken,
        `/admin/stock-notification-events/${eventId}/send`,
        { method: "POST" },
      );
      toast.success("Back-in-stock notification sent");
      await loadSupport();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : "Could not send back-in-stock notification",
      );
    }
  };

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <Panel title="Product questions">
        {loading ? (
          <LoadingInline label="Loading product questions" />
        ) : questions.length === 0 ? (
          <EmptyState message="No product questions are waiting for admin review." />
        ) : (
          <div className="space-y-3">
            {questions.map((question) => (
              <div key={question.id} className="rounded-lg border border-[var(--border-faint)] p-4">
                <div className="flex gap-3">
                  <ProductThumb
                    src={question.products?.image}
                    alt={question.products?.title ?? "Product"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-label-small text-foreground">
                        {question.products?.title ?? "Deleted product"}
                      </p>
                      <StatusBadge value={question.status} accent="neutral" />
                    </div>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {question.products?.brand ?? "Unknown brand"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-body-small text-foreground">Q: {question.question}</p>
                <textarea
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                  }
                  rows={3}
                  aria-label="Product question answer"
                  placeholder="Answer with exact compatibility, condition, or packing details"
                  className="mt-3 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-2 text-body-small focus-visible:border-[var(--heat-100)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--heat-12)]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void updateQuestion(question.id, "published")}
                    className="button button-primary inline-flex h-9 items-center gap-2 rounded-md px-3 text-label-small"
                  >
                    <MessageSquare className="size-4" />
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateQuestion(question.id, "rejected")}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-3 text-label-small text-foreground hover:border-[var(--heat-40)]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Back-in-stock outbox">
        {loading ? (
          <LoadingInline label="Loading notification events" />
        ) : events.length === 0 ? (
          <EmptyState message="No stock notification events have been queued." />
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-[var(--border-faint)] p-4">
                <div className="flex gap-3">
                  <ProductThumb src={event.products?.image} alt={event.products?.title ?? ""} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="truncate text-label-small text-foreground">
                        {event.products?.title ?? String(event.payload.title ?? "Product")}
                      </p>
                      <StatusBadge value={event.status} accent="neutral" />
                    </div>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {event.email}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                  Queued {<SmartTime date={event.created_at} />}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void sendStockEvent(event.id)}
                    disabled={!["pending", "failed"].includes(event.status)}
                    className="button button-primary inline-flex h-9 items-center gap-2 rounded-md px-3 text-label-small"
                  >
                    <Send className="size-4" />
                    Send now
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStockEvent(event.id, "sent")}
                    className="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-label-small text-foreground hover:border-[var(--heat-40)]"
                  >
                    Mark sent
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStockEvent(event.id, "failed")}
                    className="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-label-small text-foreground hover:border-[var(--heat-40)]"
                  >
                    Failed
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStockEvent(event.id, "cancelled")}
                    className="inline-flex h-9 items-center rounded-md border border-[var(--border-muted)] bg-white px-3 text-label-small text-foreground hover:border-[var(--heat-40)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
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
  const [refundEditor, setRefundEditor] = useState<RefundEditorState>(emptyRefundEditor());
  const [workflowAction, setWorkflowAction] = useState<string | null>(null);
  const [refundSaving, setRefundSaving] = useState(false);

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
      { table: "order_cancellation_requests" as const },
      { table: "return_requests" as const },
      { table: "refunds" as const },
      { table: "order_invoices" as const },
      { table: "admin_order_events" as const },
    ],
    debounceMs: 240,
  });

  useEffect(() => {
    if (!orders.length) {
      setSelectedId(null);
      setEditor(emptyOrderEditor());
      setRefundEditor(emptyRefundEditor());
      return;
    }
    const selected = orders.find((order) => order.id === selectedId) ?? orders[0];
    setSelectedId(selected.id);
    setEditor(mapOrderToEditor(selected));
    setRefundEditor(mapOrderToRefundEditor(selected));
  }, [orders, selectedId]);

  const filtered = orders.filter((order) =>
    `${order.id} ${order.userEmail ?? ""} ${order.shippingName ?? ""} ${order.shippingCity ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;
  const selectedOrderLocked = selectedOrder ? isTerminalOrder(selectedOrder) : false;
  const refundableAmount = selectedOrder?.refundSummary.refundableAmount ?? 0;
  const reasonRequiredForEdit = adminReasonRequired(editor.status);
  const allowedOrderStatusOptions = selectedOrder
    ? manualOrderStatusOptions.map((option) => ({
        ...option,
        disabled: !canTransitionManualOrderStatusClient(selectedOrder, option.value),
      }))
    : manualOrderStatusOptions;

  const saveOrder = async () => {
    if (!editor.id) return;
    if (selectedOrderLocked) {
      toast.error("Terminal orders are locked. Change them manually in the database if needed.");
      return;
    }
    if (selectedOrder && !canTransitionManualOrderStatusClient(selectedOrder, editor.status)) {
      toast.error("That order transition is not allowed anymore");
      return;
    }
    if (reasonRequiredForEdit && editor.reason.trim().length < 12) {
      toast.error("Add a clear cancellation or return reason before saving");
      return;
    }
    const payload: Record<string, unknown> = {};
    if (selectedOrder && editor.status !== selectedOrder.status) {
      if (!manualOrderStatusValues.has(editor.status)) {
        toast.error("This order status is controlled by a workflow action");
        return;
      }
      payload.status = editor.status;
    }
    if (selectedOrder && editor.paymentStatus !== selectedOrder.paymentStatus) {
      payload.paymentStatus = editor.paymentStatus;
    }
    if (editor.reason.trim()) payload.reason = editor.reason;
    if (!("status" in payload) && !("paymentStatus" in payload)) {
      toast.error("Change order status or payment status before saving");
      return;
    }
    try {
      setSaving(true);
      await requestAdminApi<{ order: unknown }>(accessToken, `/admin/orders/${editor.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Order updated");
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not update order");
    } finally {
      setSaving(false);
    }
  };

  const manualCancelOrder = async () => {
    if (!editor.id || !selectedOrder) return;
    if (selectedOrderLocked) {
      toast.error("This order is already locked");
      return;
    }
    if (adminShipmentStarted(selectedOrder) || selectedOrder.status.toLowerCase() === "shipped") {
      toast.error("Shipped orders cannot be cancelled from the admin editor");
      return;
    }
    if (editor.reason.trim().length < 12) {
      toast.error("Add the cancellation reason first");
      return;
    }
    setEditor((current) => ({
      ...current,
      status: "cancelled",
      paymentStatus: current.paymentStatus === "paid" ? "failed" : current.paymentStatus,
    }));
    try {
      setSaving(true);
      await requestAdminApi<{ order: unknown }>(accessToken, `/admin/orders/${editor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "cancelled",
          paymentStatus: editor.paymentStatus === "paid" ? "failed" : editor.paymentStatus,
          reason: editor.reason,
        }),
      });
      toast.success("Order cancelled");
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not cancel order");
    } finally {
      setSaving(false);
    }
  };

  const runWorkflowAction = async (
    key: string,
    path: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    try {
      setWorkflowAction(key);
      await requestAdminApi<unknown>(accessToken, path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(successMessage);
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Workflow action failed");
    } finally {
      setWorkflowAction(null);
    }
  };

  const prepareRefund = ({
    amount,
    reason,
    cancellationRequestId = null,
    returnRequestId = null,
  }: {
    amount?: number;
    reason: string;
    cancellationRequestId?: string | null;
    returnRequestId?: string | null;
  }) => {
    setRefundEditor({
      amount: String(roundMoney(Math.min(amount ?? refundableAmount, refundableAmount))),
      reason: reason.slice(0, 500),
      speed: "normal",
      cancellationRequestId,
      returnRequestId,
    });
    toast.info("Refund form prepared. Review the amount and reason before creating it.");
  };

  const createRefund = async () => {
    if (!selectedOrder) return;
    const amount = Number(refundEditor.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid refund amount");
      return;
    }
    if (amount > refundableAmount) {
      toast.error(`Refund cannot exceed ${formatINR(refundableAmount)} remaining`);
      return;
    }
    if (refundEditor.reason.trim().length < 12) {
      toast.error("Add a clear refund reason before creating the refund");
      return;
    }
    try {
      setRefundSaving(true);
      await requestAdminApi<unknown>(accessToken, "/admin/refunds", {
        method: "POST",
        body: JSON.stringify({
          orderId: selectedOrder.id,
          amount,
          reason: refundEditor.reason,
          speed: refundEditor.speed,
          cancellationRequestId: refundEditor.cancellationRequestId ?? undefined,
          returnRequestId: refundEditor.returnRequestId ?? undefined,
        }),
      });
      toast.success("Refund created");
      await loadOrders();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not create refund");
    } finally {
      setRefundSaving(false);
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
        <div className="mt-5 space-y-3">
          {filtered.map((order) => {
            const selected = order.id === selectedId;
            const cancelled = isCancelledOrder(order);
            const locked = isTerminalOrder(order);
            return (
              <button
                key={order.id}
                type="button"
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selected
                    ? "border-[var(--heat-100)] bg-[var(--heat-4)]"
                    : cancelled
                      ? "border-red-200 bg-red-50/55 hover:border-red-300"
                      : "border-[var(--border-faint)] bg-white hover:border-[var(--heat-40)] hover:bg-[var(--background-lighter)]"
                }`}
                onClick={() => {
                  setSelectedId(order.id);
                  setEditor(mapOrderToEditor(order));
                  setRefundEditor(mapOrderToRefundEditor(order));
                }}
              >
                <div className="grid gap-4 xl:grid-cols-[1.05fr_1.25fr_0.9fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-label-medium text-foreground">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      {locked && <Ban className="size-4 text-red-600" aria-label="Locked order" />}
                    </div>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      Placed <SmartTime date={order.createdAt} />
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge value={order.status} accent={statusTone(order.status)} />
                      <StatusBadge
                        value={order.paymentStatus}
                        accent={statusTone(order.paymentStatus)}
                      />
                      {order.cancellationRequest && (
                        <StatusBadge
                          value={`cancel ${order.cancellationRequest.status}`}
                          accent={statusTone(order.cancellationRequest.status)}
                        />
                      )}
                      {order.refund && (
                        <StatusBadge
                          value={`refund ${order.refund.status}`}
                          accent={statusTone(order.refund.status)}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-label-small text-foreground">
                      {order.shippingName || order.userEmail || "Customer"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {order.userEmail || "Email not captured"}
                    </p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {[order.shippingCity, order.shippingState, order.shippingPincode]
                        .filter(Boolean)
                        .join(", ") || "Address pending"}
                    </p>
                  </div>

                  <div>
                    <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                      Ordered
                    </p>
                    <div className="mt-2 space-y-1">
                      {order.items.slice(0, 3).map((item) => (
                        <p key={item.id} className="line-clamp-1 text-body-small text-foreground">
                          {item.title}{" "}
                          <span className="text-[var(--black-alpha-48)]">x{item.qty}</span>
                        </p>
                      ))}
                      {order.items.length > 3 && (
                        <p className="text-body-small text-[var(--black-alpha-56)]">
                          +{order.items.length - 3} more item
                          {order.items.length - 3 === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="xl:text-right">
                    <p className="text-label-large text-foreground">{formatINR(order.total)}</p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {order.shipment?.awbCode
                        ? `AWB ${order.shipment.awbCode}`
                        : order.shipment?.courierName ||
                          order.shippingCourierName ||
                          "Shipment pending"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
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
            {selectedOrderLocked && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <Ban className="mt-0.5 size-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-label-small text-red-800">Terminal order locked</p>
                    <p className="mt-1 text-body-small text-red-700">
                      This order is {selectedOrder.status.replaceAll("_", " ")} with payment{" "}
                      {selectedOrder.paymentStatus.replaceAll("_", " ")}. Status, payment, service,
                      and address edits are disabled in the admin app. Use the database only for an
                      exceptional correction.
                    </p>
                    {selectedOrder.cancellationRequest?.reason && (
                      <p className="mt-2 text-body-small text-red-800">
                        Cancellation reason: {selectedOrder.cancellationRequest.reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <InfoTile label="Order" value={`#${selectedOrder.id.slice(0, 8).toUpperCase()}`} />
              <InfoTile label="Customer" value={selectedOrder.shippingName || "Customer"} />
              <InfoTile label="Total" value={formatINR(selectedOrder.total)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order status">
                <SelectInput
                  value={editor.status}
                  onChange={(value) => setEditor((current) => ({ ...current, status: value }))}
                  disabled={selectedOrderLocked}
                  options={
                    manualOrderStatusValues.has(editor.status)
                      ? allowedOrderStatusOptions
                      : [
                          {
                            value: editor.status,
                            label: `${editor.status.replaceAll("_", " ")} (workflow state)`,
                            disabled: true,
                          },
                          ...allowedOrderStatusOptions,
                        ]
                  }
                />
              </Field>
              <Field label="Payment status">
                <SelectInput
                  value={editor.paymentStatus}
                  disabled={selectedOrderLocked}
                  onChange={(value) =>
                    setEditor((current) => ({ ...current, paymentStatus: value }))
                  }
                  options={paymentStatusOptions}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
              {reasonRequiredForEdit ? (
                <Field label="Reason for change">
                  <TextAreaInput
                    value={editor.reason}
                    disabled={selectedOrderLocked}
                    onChange={(value) => setEditor((current) => ({ ...current, reason: value }))}
                    rows={3}
                    placeholder="Required. Example: Customer called support and asked to cancel before packing."
                  />
                </Field>
              ) : (
                <p className="text-body-small text-[var(--black-alpha-56)]">
                  Routine order and payment state changes are saved directly. Cancellation and
                  return transitions still require a reason.
                </p>
              )}
              <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
                Manual edits are limited to order/payment state. Customer cancellation and return
                request states are handled through the workflow cards below.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveOrder()}
                  disabled={
                    saving ||
                    selectedOrderLocked ||
                    (reasonRequiredForEdit && editor.reason.trim().length < 12)
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {reasonRequiredForEdit ? "Save with reason" : "Save change"}
                </button>
                <button
                  type="button"
                  onClick={() => void manualCancelOrder()}
                  disabled={
                    saving ||
                    selectedOrderLocked ||
                    adminShipmentStarted(selectedOrder) ||
                    editor.reason.trim().length < 12
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-label-small text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Ban className="size-4" />
                  Cancel order
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border-faint)] bg-white p-4">
              <p className="text-label-small text-foreground">Customer and delivery</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <InfoTile label="Email" value={selectedOrder.shippingEmail || "Not captured"} />
                <InfoTile label="Phone" value={selectedOrder.shippingPhone || "Not captured"} />
                <InfoTile
                  label="Delivery service"
                  value={selectedOrder.shippingServiceType.replaceAll("_", " ")}
                />
                <InfoTile
                  label="Courier"
                  value={
                    selectedOrder.shipment?.courierName ||
                    selectedOrder.shippingCourierName ||
                    "Not assigned"
                  }
                />
                <InfoTile
                  label="Address"
                  value={
                    [
                      selectedOrder.shippingLine1,
                      selectedOrder.shippingLine2,
                      selectedOrder.shippingCity,
                      selectedOrder.shippingState,
                      selectedOrder.shippingPincode,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Address pending"
                  }
                />
                <InfoTile label="Items" value={selectedOrder.itemSummary || "No item summary"} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoTile
                label="Placed"
                value={<SmartTime date={selectedOrder.createdAt} showFull />}
              />
              <InfoTile
                label="Last updated"
                value={<SmartTime date={selectedOrder.updatedAt} showFull />}
              />
              <InfoTile label="Payment method" value={selectedOrder.paymentMethod} />
              <InfoTile
                label="Shipment"
                value={selectedOrder.shipment?.status || "Shipment not created"}
              />
              <InfoTile label="Total" value={formatINR(selectedOrder.total)} />
              <InfoTile
                label="Invoice"
                value={selectedOrder.invoice?.invoice_number || "Not generated"}
              />
              <InfoTile
                label="Refund"
                value={`${formatINR(selectedOrder.refundSummary.refundedAmount)} / ${formatINR(
                  selectedOrder.refundSummary.paidAmount,
                )}`}
              />
            </div>

            <div className="mt-5 rounded-lg border border-[var(--border-faint)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-label-small text-foreground">Refund handling</p>
                  <p className="mt-1 max-w-2xl text-body-small text-[var(--black-alpha-56)]">
                    Refunds are created against the captured payment. Partial refunds keep the
                    payment as partially refunded until the remaining balance reaches zero.
                  </p>
                </div>
                <StatusBadge
                  value={`${formatINR(refundableAmount)} refundable`}
                  accent={refundableAmount > 0 ? "warning" : "success"}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <InfoTile label="Paid" value={formatINR(selectedOrder.refundSummary.paidAmount)} />
                <InfoTile
                  label="Refunded"
                  value={formatINR(selectedOrder.refundSummary.refundedAmount)}
                />
                <InfoTile label="Remaining" value={formatINR(refundableAmount)} />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr]">
                <Field label="Refund amount">
                  <TextInput
                    value={refundEditor.amount}
                    type="number"
                    inputMode="decimal"
                    disabled={refundSaving || refundableAmount <= 0}
                    onChange={(value) =>
                      setRefundEditor((current) => ({ ...current, amount: value }))
                    }
                  />
                </Field>
                <Field label="Refund speed">
                  <SelectInput
                    value={refundEditor.speed}
                    disabled={refundSaving || refundableAmount <= 0}
                    onChange={(value) =>
                      setRefundEditor((current) => ({
                        ...current,
                        speed: value === "optimum" ? "optimum" : "normal",
                      }))
                    }
                    options={[
                      { value: "normal", label: "Normal" },
                      { value: "optimum", label: "Optimum / instant if available" },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Refund reason" className="mt-4">
                <TextAreaInput
                  value={refundEditor.reason}
                  disabled={refundSaving || refundableAmount <= 0}
                  onChange={(value) =>
                    setRefundEditor((current) => ({ ...current, reason: value }))
                  }
                  rows={3}
                  placeholder="Required. Example: Customer cancellation approved before packing, refunding full prepaid amount."
                />
              </Field>

              {(refundEditor.cancellationRequestId || refundEditor.returnRequestId) && (
                <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
                  Linked to{" "}
                  {refundEditor.cancellationRequestId ? "cancellation request" : "return request"}.
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void createRefund()}
                  disabled={
                    refundSaving ||
                    refundableAmount <= 0 ||
                    refundEditor.reason.trim().length < 12 ||
                    Number(refundEditor.amount) <= 0
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--heat-100)] px-4 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {refundSaving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <WalletCards className="size-4" />
                  )}
                  Create refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundEditor(mapOrderToRefundEditor(selectedOrder))}
                  disabled={refundSaving}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small text-foreground transition-colors hover:bg-[var(--background-lighter)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  Reset
                </button>
              </div>

              {selectedOrder.refunds.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                    Refund history
                  </p>
                  {selectedOrder.refunds.map((refund) => (
                    <div
                      key={refund.id}
                      className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-label-small text-foreground">
                            {formatINR(refund.amount)} · {refund.speed}
                          </p>
                          <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">
                            {refund.reason || "No reason captured"}
                          </p>
                        </div>
                        <StatusBadge value={refund.status} accent={statusTone(refund.status)} />
                      </div>
                      <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                        Created <SmartTime date={refund.createdAt} />
                        {refund.processedAt ? (
                          <>
                            {" "}
                            · Processed <SmartTime date={refund.processedAt} />
                          </>
                        ) : null}
                        {refund.providerRefundId ? ` · ${refund.providerRefundId}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(selectedOrder.cancellationRequest || selectedOrder.returnRequest) && (
              <div className="mt-5 rounded-lg border border-[var(--heat-20)] bg-[var(--heat-4)] p-4">
                <p className="text-label-small text-foreground">Self-service workflow</p>
                {selectedOrder.cancellationRequest && (
                  <div className="mt-4 rounded-md border border-[var(--border-faint)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          Cancellation
                        </p>
                        <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">
                          {selectedOrder.cancellationRequest.reason}
                        </p>
                        <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          Requested{" "}
                          <SmartTime date={selectedOrder.cancellationRequest.requested_at} />
                        </p>
                        {selectedOrder.cancellationRequest.resolved_at && (
                          <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                            Resolved{" "}
                            <SmartTime date={selectedOrder.cancellationRequest.resolved_at} />
                          </p>
                        )}
                        <StatusBadge value={selectedOrder.cancellationRequest.status} />
                        {adminShipmentStarted(selectedOrder) &&
                          selectedOrder.cancellationRequest.status === "pending" && (
                            <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">
                              Shipping has started, so this request can no longer be approved as a
                              cancellation.
                            </p>
                          )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedOrder.cancellationRequest.status === "pending" && (
                          <>
                            <WorkflowButton
                              label="Approve"
                              loading={workflowAction === "cancel-approve"}
                              disabled={adminShipmentStarted(selectedOrder)}
                              onClick={() =>
                                void runWorkflowAction(
                                  "cancel-approve",
                                  `/admin/cancellation-requests/${selectedOrder.cancellationRequest?.id}`,
                                  { action: "approve", note: "Approved from admin order panel" },
                                  "Cancellation approved",
                                )
                              }
                            />
                            <WorkflowButton
                              label="Reject"
                              loading={workflowAction === "cancel-reject"}
                              onClick={() =>
                                void runWorkflowAction(
                                  "cancel-reject",
                                  `/admin/cancellation-requests/${selectedOrder.cancellationRequest?.id}`,
                                  { action: "reject", note: "Rejected from admin order panel" },
                                  "Cancellation rejected",
                                )
                              }
                            />
                          </>
                        )}
                        {["approved", "refund_pending"].includes(
                          selectedOrder.cancellationRequest.status,
                        ) &&
                          !selectedOrder.cancellationRequest.refund_id && (
                            <WorkflowButton
                              label="Prepare refund"
                              loading={false}
                              disabled={refundableAmount <= 0}
                              onClick={() => {
                                if (!selectedOrder.cancellationRequest) return;
                                prepareRefund({
                                  amount: refundableAmount,
                                  cancellationRequestId: selectedOrder.cancellationRequest.id,
                                  reason: `Approved cancellation: ${selectedOrder.cancellationRequest.reason}`,
                                });
                              }}
                            />
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedOrder.returnRequest && (
                  <div className="mt-4 rounded-md border border-[var(--border-faint)] bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          Return
                        </p>
                        <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">
                          {selectedOrder.returnRequest.reason}
                        </p>
                        <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          Requested <SmartTime date={selectedOrder.returnRequest.requested_at} />
                        </p>
                        {selectedOrder.returnRequest.received_at && (
                          <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                            Received <SmartTime date={selectedOrder.returnRequest.received_at} />
                          </p>
                        )}
                        {selectedOrder.returnRequest.reverse_shipment_id && (
                          <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                            Reverse pickup #
                            {selectedOrder.returnRequest.reverse_shipment_id.slice(0, 8)}
                          </p>
                        )}
                        {selectedOrder.returnRequest.resolved_at && (
                          <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                            Resolved <SmartTime date={selectedOrder.returnRequest.resolved_at} />
                          </p>
                        )}
                        <StatusBadge value={selectedOrder.returnRequest.status} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedOrder.returnRequest.status === "pending" && (
                          <>
                            <WorkflowButton
                              label="Approve"
                              loading={workflowAction === "return-approve"}
                              onClick={() =>
                                void runWorkflowAction(
                                  "return-approve",
                                  `/admin/return-requests/${selectedOrder.returnRequest?.id}`,
                                  { action: "approve", note: "Approved from admin order panel" },
                                  "Return approved",
                                )
                              }
                            />
                            <WorkflowButton
                              label="Reject"
                              loading={workflowAction === "return-reject"}
                              onClick={() =>
                                void runWorkflowAction(
                                  "return-reject",
                                  `/admin/return-requests/${selectedOrder.returnRequest?.id}`,
                                  { action: "reject", note: "Rejected from admin order panel" },
                                  "Return rejected",
                                )
                              }
                            />
                          </>
                        )}
                        {selectedOrder.returnRequest.status === "approved" &&
                          !selectedOrder.returnRequest.reverse_shipment_id && (
                            <WorkflowButton
                              label="Create reverse pickup"
                              loading={workflowAction === "return-pickup"}
                              onClick={() =>
                                void runWorkflowAction(
                                  "return-pickup",
                                  "/shipments/shiprocket/return",
                                  { returnRequestId: selectedOrder.returnRequest?.id },
                                  "Reverse pickup created",
                                )
                              }
                            />
                          )}
                        {["approved", "reverse_pickup_scheduled"].includes(
                          selectedOrder.returnRequest.status,
                        ) && (
                          <WorkflowButton
                            label="Mark received"
                            loading={workflowAction === "return-receive"}
                            onClick={() =>
                              void runWorkflowAction(
                                "return-receive",
                                `/admin/return-requests/${selectedOrder.returnRequest?.id}`,
                                { action: "receive", note: "Returned item received" },
                                "Return marked received",
                              )
                            }
                          />
                        )}
                        {["received", "refund_pending"].includes(
                          selectedOrder.returnRequest.status,
                        ) &&
                          !selectedOrder.returnRequest.refund_id && (
                            <WorkflowButton
                              label="Prepare refund"
                              loading={false}
                              disabled={refundableAmount <= 0}
                              onClick={() => {
                                if (!selectedOrder.returnRequest) return;
                                prepareRefund({
                                  amount: refundableAmount,
                                  returnRequestId: selectedOrder.returnRequest.id,
                                  reason: `Approved return after receipt: ${selectedOrder.returnRequest.reason}`,
                                });
                              }}
                            />
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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

            {selectedOrder.adminEvents.length > 0 && (
              <div className="mt-5 rounded-lg border border-[var(--border-faint)] bg-white p-4">
                <p className="text-label-small text-foreground">Admin history</p>
                <div className="mt-3 space-y-3">
                  {selectedOrder.adminEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-label-small text-foreground">
                            {event.eventType.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-body-small text-[var(--black-alpha-72)]">
                            {event.reason}
                          </p>
                        </div>
                        <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                          <SmartTime date={event.createdAt} />
                        </p>
                      </div>
                      <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
                        {event.adminEmail || "Admin"} changed{" "}
                        {Object.keys(event.toState ?? {}).join(", ") || "order fields"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  selectedUser.createdAt ? (
                    <SmartTime date={selectedUser.createdAt} showFull />
                  ) : (
                    "Unknown"
                  )
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
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

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
  const selectedOrderSet = new Set(selectedOrderIds);
  const selectableOrderIds = orders.map((order) => order.id);
  const selectedOrders = orders.filter((order) => selectedOrderSet.has(order.id));
  const selectedShipmentIds = selectedOrders
    .map((order) => order.shipment?.id)
    .filter((id): id is string => Boolean(id));
  const selectedOrdersWithoutShipment = selectedOrders.filter((order) => !order.shipment);
  const allVisibleOrdersSelected =
    selectableOrderIds.length > 0 &&
    selectableOrderIds.every((orderId) => selectedOrderSet.has(orderId));
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  };
  const toggleAllVisibleOrders = () => {
    setSelectedOrderIds(allVisibleOrdersSelected ? [] : selectableOrderIds);
  };
  const runBulkCreateShipments = async () => {
    if (!selectedOrderIds.length) {
      toast.error("Select orders first");
      return;
    }
    const creatableOrderIds = selectedOrders
      .filter((order) => orderCanCreateShipment(order))
      .map((order) => order.id);
    if (!creatableOrderIds.length) {
      toast.error("Selected orders already have shipments or are not eligible");
      return;
    }
    await runAction(
      "bulk:create_orders",
      "/shipments/shiprocket/bulk",
      postJson({ action: "create_orders", orderIds: creatableOrderIds }),
    );
    setSelectedOrderIds([]);
  };
  const runBulkAction = async (
    action: "assign_awb" | "schedule_pickup" | "generate_labels" | "refresh_tracking",
  ) => {
    if (!selectedShipmentIds.length) {
      toast.error("Select orders that already have shipments");
      return;
    }
    await runAction(
      `bulk:${action}`,
      "/shipments/shiprocket/bulk",
      postJson({ action, shipmentIds: selectedShipmentIds }),
    );
    setSelectedOrderIds([]);
  };

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

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)] p-3">
          <span className="mr-1 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
            {selectedOrderIds.length} selected / {selectedOrdersWithoutShipment.length} need
            shipment
          </span>
          <ActionButton
            icon={PackagePlus}
            label="Bulk create shipments"
            loading={activeAction === "bulk:create_orders"}
            disabled={!selectedOrderIds.length || Boolean(activeAction)}
            onClick={() => void runBulkCreateShipments()}
          />
          <ActionButton
            icon={Send}
            label="Bulk AWB"
            loading={activeAction === "bulk:assign_awb"}
            disabled={!selectedShipmentIds.length || Boolean(activeAction)}
            onClick={() => void runBulkAction("assign_awb")}
          />
          <ActionButton
            icon={Truck}
            label="Bulk pickup"
            loading={activeAction === "bulk:schedule_pickup"}
            disabled={!selectedShipmentIds.length || Boolean(activeAction)}
            onClick={() => void runBulkAction("schedule_pickup")}
          />
          <ActionButton
            icon={CheckCircle2}
            label="Bulk labels"
            loading={activeAction === "bulk:generate_labels"}
            disabled={!selectedShipmentIds.length || Boolean(activeAction)}
            onClick={() => void runBulkAction("generate_labels")}
          />
          <ActionButton
            icon={RefreshCw}
            label="Bulk tracking"
            loading={activeAction === "bulk:refresh_tracking"}
            disabled={!selectedShipmentIds.length || Boolean(activeAction)}
            onClick={() => void runBulkAction("refresh_tracking")}
          />
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
                <th className="w-10 px-3 py-3 font-normal">
                  <input
                    type="checkbox"
                    checked={allVisibleOrdersSelected}
                    onChange={toggleAllVisibleOrders}
                    aria-label="Select all visible orders"
                    className="size-4 accent-[var(--heat-100)]"
                  />
                </th>
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
                  selected={selectedOrderSet.has(order.id)}
                  onToggleSelected={() => toggleOrderSelection(order.id)}
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
  selected,
  onToggleSelected,
}: {
  order: FulfillmentOrder;
  onOpenDetails: () => void;
  activeAction: string | null;
  runAction: (key: string, path: string, options?: RequestInit) => Promise<void>;
  selected: boolean;
  onToggleSelected?: () => void;
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
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => {
            event.stopPropagation();
            onToggleSelected?.();
          }}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select order ${order.id.slice(0, 8)}`}
          className="size-4 accent-[var(--heat-100)]"
        />
      </td>
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
          <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
            Placed <SmartTime date={order.createdAt} />
          </p>
          <p className="mt-2 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">
            {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 space-y-1">
            {order.items.slice(0, 2).map((item) => (
              <p
                key={item.id}
                className="line-clamp-1 text-body-small text-[var(--black-alpha-72)]"
              >
                {item.title} x{item.qty}
              </p>
            ))}
          </div>
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

function WorkflowButton({
  label,
  loading,
  disabled = false,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--heat-100)] px-3 text-label-small text-white transition-colors hover:bg-[var(--heat-200)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
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
        name="adminSearch"
        autoComplete="off"
        aria-label={placeholder}
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
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputMode={inputMode}
      disabled={disabled}
      className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground disabled:cursor-not-allowed disabled:bg-[var(--background-lighter)] disabled:text-[var(--black-alpha-48)]"
    />
  );
}

function TextAreaInput({
  value,
  onChange,
  rows,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-[var(--border-muted)] bg-white px-3 py-3 text-body-medium text-foreground placeholder:text-[var(--black-alpha-40)] disabled:cursor-not-allowed disabled:bg-[var(--background-lighter)] disabled:text-[var(--black-alpha-48)]"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-11 w-full rounded-md border border-[var(--border-muted)] bg-white px-3 text-body-medium text-foreground disabled:cursor-not-allowed disabled:bg-[var(--background-lighter)] disabled:text-[var(--black-alpha-48)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
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
  accent?: "heat" | "warning" | "neutral" | "danger" | "success";
}) {
  const classes =
    accent === "warning"
      ? "border border-[var(--accent-honey)]/30 bg-amber-50 text-[var(--accent-honey)]"
      : accent === "danger"
        ? "border border-red-200 bg-red-50 text-red-700"
        : accent === "success"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
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

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
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

function LoadingInline({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-6 text-body-small text-[var(--black-alpha-56)]">
      <Loader2 className="size-4 animate-spin text-[var(--heat-100)]" />
      {label}
    </div>
  );
}

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)]">
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain p-1" loading="lazy" />
      ) : (
        <Package className="size-5 text-[var(--black-alpha-32)]" />
      )}
    </div>
  );
}

function postJson(body: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    body: JSON.stringify(body),
  };
}
