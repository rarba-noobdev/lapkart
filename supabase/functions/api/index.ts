import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import { z } from "npm:zod@3.24.2";
import { config } from "./config.ts";
import { autocompleteOlaPlaces, getOlaDeliveryRoute, reverseGeocodeOlaPlace } from "./ola-maps.ts";
import { createRazorpayOrder, createRazorpayRefund, verifyRazorpaySignature } from "./payments.ts";
import {
  assignShiprocketAwb,
  createShiprocketOrder,
  createShiprocketReturnOrder,
  generateShiprocketLabels,
  generateShiprocketManifest,
  getShiprocketDeliveryQuotes,
  getShiprocketPickupLocations,
  getShiprocketToken,
  getShiprocketTracking,
  getShiprocketWalletBalance,
  requestShiprocketPickup,
  toShiprocketOrderPayload,
  toShiprocketReturnOrderPayload,
  type ShiprocketPickupAddress,
} from "./shiprocket.ts";

const supabaseAdmin =
  config.supabaseUrl && config.supabaseServiceRoleKey
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

type CheckoutProductRow = {
  id: string;
  title: string;
  brand: string;
  image: string;
  images: string[] | null;
  price: number | string;
  stock: number | null;
  status: string | null;
  weight_kg: number | string | null;
  local_delivery_eligible?: boolean | null;
  cod_eligible?: boolean | null;
};

type CheckoutOrderItem = {
  productId: string;
  title: string;
  image: string;
  brand: string;
  price: number;
  qty: number;
};

type AppliedCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
};

type CourierQuote = Awaited<ReturnType<typeof getShiprocketDeliveryQuotes>>[number];

type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;

type CheckoutSummary = {
  items: CheckoutOrderItem[];
  subtotal: number;
  shipping: number;
  discountTotal: number;
  total: number;
  amountPaise: number;
  coupon: AppliedCoupon | null;
  cod: {
    eligible: boolean;
    reason: string | null;
    cap: number;
  };
  deliveryPromise: {
    label: string;
    detail: string;
    serviceType: "quick" | "standard";
  };
  deliveryPromiseSnapshot: Record<string, unknown>;
  deliveryEstimate: {
    dispatch: {
      pickupLocation: string;
      pincode: string;
    };
    route: Awaited<ReturnType<typeof getOlaDeliveryRoute>>;
    couriers: CourierQuote[];
    generatedAt: string;
  };
  selectedCourier: CourierQuote;
};

type PendingCheckout = CheckoutSummary & {
  userId: string;
  userEmail: string | null;
  address: CheckoutAddress;
  saveAddress: boolean;
  createdAt: number;
};

type LoadedCheckoutSession = {
  checkout: PendingCheckout;
  orderId: string | null;
  status: string;
};

type OrderItemWithSku = {
  id: string;
  order_id: string;
  title: string;
  image: string;
  brand: string;
  qty: number;
  price?: number | null;
  product_id?: string | null;
  sku: string | null;
};

const apiRateLimit = { limit: 180, windowMs: 60_000 };
const paymentRateLimit = { limit: 24, windowMs: 60_000 };
const mapRateLimit = { limit: 48, windowMs: 60_000 };
const uploadRateLimit = { limit: 12, windowMs: 60_000 };
const webhookRateLimit = { limit: 120, windowMs: 60_000 };
const checkoutSessionTtlMs = 20 * 60_000;
const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

const nullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value.length > 0 ? value : null;
    });

const productCategorySlugs = [
  "ram",
  "ssd",
  "motherboards",
  "batteries",
  "displays",
  "keyboards",
  "processors",
  "cooling",
  "chargers",
  "wifi_cards",
  "dc_jacks",
  "bottom_cases",
  "palmrests",
  "hinges",
  "speakers",
  "hdd_boards",
] as const;

const fraudScoreSchema = z.object({
  failedPayments: z.number().optional(),
  orderValue: z.number().optional(),
  accountAgeDays: z.number().optional(),
});

const createShiprocketShipmentSchema = z.object({
  orderId: z.string().uuid(),
  pickupLocation: z.string().trim().min(1).optional(),
  package: z
    .object({
      weightKg: z.number().positive().optional(),
      lengthCm: z.number().positive().optional(),
      breadthCm: z.number().positive().optional(),
      heightCm: z.number().positive().optional(),
    })
    .optional(),
});

const assignAwbSchema = z.object({
  shipmentId: z.string().uuid(),
  courierId: z.number().int().positive().optional(),
});

const shipmentIdSchema = z.object({
  shipmentId: z.string().uuid(),
});

const labelsSchema = z.object({
  shipmentIds: z.array(z.string().uuid()).min(1).max(50),
});

const bulkFulfillmentSchema = z.object({
  action: z.enum([
    "create_orders",
    "assign_awb",
    "schedule_pickup",
    "generate_labels",
    "refresh_tracking",
  ]),
  orderIds: z.array(z.string().uuid()).max(50).optional().default([]),
  shipmentIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

const reversePickupSchema = z.object({
  returnRequestId: z.string().uuid(),
  package: z
    .object({
      weightKg: z.number().positive().optional(),
      lengthCm: z.number().positive().optional(),
      breadthCm: z.number().positive().optional(),
      heightCm: z.number().positive().optional(),
    })
    .optional(),
});

const productIdParamSchema = z.object({ productId: z.string().uuid() });
const userIdParamSchema = z.object({ userId: z.string().uuid() });
const orderIdParamSchema = z.object({ orderId: z.string().uuid() });

const productUpsertSchema = z.object({
  title: z.string().trim().min(4).max(200),
  brand: z.string().trim().min(2).max(80),
  category: z.enum(productCategorySlugs),
  description: nullableTrimmedString(2000),
  image: z.string().trim().min(1).max(1200),
  images: z.array(z.string().trim().min(1).max(1200)).max(12).optional().default([]),
  price: z.coerce.number().nonnegative().max(10_000_000),
  mrp: z.coerce.number().nonnegative().max(10_000_000),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  status: z.enum(["active", "draft", "archived"]).optional().default("active"),
  sku: nullableTrimmedString(120),
  sourceUrl: nullableTrimmedString(1200),
  compatibility: nullableTrimmedString(500),
  warranty: nullableTrimmedString(120),
  highlights: z.array(z.string().trim().min(1).max(160)).max(12).optional().default([]),
  searchKeywords: z.array(z.string().trim().min(1).max(80)).max(24).optional().default([]),
  weightKg: z.coerce.number().positive().max(500).nullable().optional(),
  lengthCm: z.coerce.number().positive().max(500).nullable().optional(),
  breadthCm: z.coerce.number().positive().max(500).nullable().optional(),
  heightCm: z.coerce.number().positive().max(500).nullable().optional(),
  authenticityGrade: z
    .enum(["oem", "compatible", "refurbished", "open_box"])
    .optional()
    .default("compatible"),
  conditionGrade: z.enum(["new", "open_box", "refurbished", "used"]).optional().default("new"),
  hsnCode: nullableTrimmedString(30),
  gstRate: z.coerce.number().min(0).max(28).optional().default(18),
  doaPolicyDays: z.coerce.number().int().min(0).max(30).optional().default(7),
  localDeliveryEligible: z.boolean().optional().default(true),
  codEligible: z.boolean().optional().default(true),
});

const productUpdateSchema = productUpsertSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one product field must be provided");

const adminUserUpdateSchema = z
  .object({
    role: z.enum(["admin", "user"]).optional(),
    fullName: nullableTrimmedString(160),
    phone: nullableTrimmedString(30),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one user field must be provided");

const orderStatusSchema = z.enum([
  "pending",
  "processing",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
]);

const paymentStatusSchema = z.enum([
  "pending",
  "paid",
  "cod_pending",
  "cod_cancelled",
  "failed",
  "partially_refunded",
  "refunded",
]);

const adminOrderUpdateSchema = z
  .object({
    status: orderStatusSchema.optional(),
    paymentStatus: paymentStatusSchema.optional(),
    reason: z.string().trim().min(12).max(500),
  })
  .refine(
    (value) => value.status !== undefined || value.paymentStatus !== undefined,
    "Order status or payment status must be provided",
  );

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);
const autocompleteQuerySchema = z.object({
  input: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .transform((value) => value.slice(0, 160)),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});
const reverseGeocodeQuerySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
const deliveryEstimateQuerySchema = reverseGeocodeQuerySchema.extend({
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
  weightKg: z.coerce.number().positive().max(100).optional(),
  declaredValue: z.coerce.number().nonnegative().max(10_000_000).optional(),
});

const checkoutItemSchema = z.object({
  id: z.string().uuid(),
  qty: z.number().int().min(1).max(20),
});

const checkoutAddressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(30)
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "A 10 digit phone number is required",
    ),
  email: z.string().trim().max(160).optional().default(""),
  line1: z.string().trim().min(6).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  locationSource: z.string().trim().max(60).nullable().optional(),
  olaPlaceId: z.string().trim().max(200).nullable().optional(),
  formattedAddress: z.string().trim().max(500).optional().default(""),
});

const checkoutCreatePaymentOrderSchema = z.object({
  items: z.array(checkoutItemSchema).min(1).max(50),
  address: checkoutAddressSchema,
  selectedQuoteId: z.string().trim().min(1).max(120).nullable().optional(),
  saveAddress: z.boolean().optional().default(true),
  couponCode: z.string().trim().max(40).optional().default(""),
});

const checkoutCompletePaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
});

const businessAccountSchema = z.object({
  shopName: z.string().trim().min(2).max(160),
  gstin: z
    .string()
    .trim()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, "GSTIN format is invalid")
    .nullable()
    .optional(),
  businessPhone: nullableTrimmedString(30),
  billingEmail: z.string().trim().email().max(160).nullable().optional(),
  billingAddress: nullableTrimmedString(500),
  city: nullableTrimmedString(80),
  state: nullableTrimmedString(80),
  pincode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/)
    .nullable()
    .optional(),
});

const productQuestionSchema = z.object({
  productId: z.string().uuid(),
  question: z.string().trim().min(3).max(800),
});

const adminQuestionUpdateSchema = z.object({
  answer: z.string().trim().max(2000).optional(),
  status: z.enum(["pending", "published", "rejected"]).optional(),
});

const cancellationRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

const returnRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  conditionNotes: z.string().trim().max(1000).optional().default(""),
  photos: z.array(z.string().trim().url()).max(6).optional().default([]),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        qty: z.number().int().positive().max(20),
        reason: z.string().trim().max(500).optional().default(""),
      }),
    )
    .min(1)
    .max(50),
});

const adminWorkflowActionSchema = z.object({
  action: z.enum(["approve", "reject", "receive", "close"]),
  note: z.string().trim().max(1000).optional().default(""),
});

const adminRefundSchema = z.object({
  orderId: z.string().uuid(),
  cancellationRequestId: z.string().uuid().optional(),
  returnRequestId: z.string().uuid().optional(),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  reason: z.string().trim().min(12).max(500),
  speed: z.enum(["normal", "optimum"]).optional().default("normal"),
});

const wishlistRequestSchema = z.object({
  productId: z.string().uuid(),
});

const productReviewSchema = z.object({
  productId: z.string().uuid(),
  orderId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional().default(""),
  body: z.string().trim().min(3).max(2000),
});

const stockNotificationSchema = z.object({
  productId: z.string().uuid(),
  email: z.string().trim().email().max(160),
});

const couponWriteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .transform((value) => value.toUpperCase()),
  description: z.string().trim().max(300).optional().default(""),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().positive().max(100_000),
  minimumSubtotal: z.coerce.number().min(0).max(10_000_000).optional().default(0),
  maxDiscount: z.coerce.number().positive().max(10_000_000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().max(1_000_000).nullable().optional(),
  perUserLimit: z.coerce.number().int().positive().max(100).optional().default(1),
  active: z.boolean().optional().default(true),
});

const couponPatchSchema = couponWriteSchema.partial();

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrencyForError(value: number) {
  return `INR ${roundMoney(value).toFixed(2)}`;
}

function scoreFraud(input: z.infer<typeof fraudScoreSchema>) {
  let score = 5;
  if ((input.failedPayments ?? 0) >= 3) score += 35;
  if ((input.orderValue ?? 0) > 75_000) score += 20;
  if ((input.accountAgeDays ?? 0) < 7) score += 15;
  return {
    score,
    risk: score > 60 ? "high" : score > 30 ? "medium" : "low",
  };
}

function buildDeliveryPromiseSnapshot(summary: CheckoutSummary, products: CheckoutProductRow[]) {
  const selectedCourier = summary.selectedCourier;
  const stockStatus = products.every((product) => Number(product.stock ?? 0) > 0)
    ? "all_items_in_stock"
    : "stock_needs_review";
  const routeMinutes = Math.ceil(summary.deliveryEstimate.route.durationSeconds / 60);
  const dispatchQueue =
    selectedCourier.serviceType === "quick"
      ? "quick_lane_after_awb_assignment"
      : "standard_pickup_after_awb_assignment";

  return {
    mode: "single_origin",
    source: "checkout_preview",
    generatedAt: summary.deliveryEstimate.generatedAt,
    stockStatus,
    dispatchQueue,
    dispatch: summary.deliveryEstimate.dispatch,
    route: {
      distanceMeters: summary.deliveryEstimate.route.distanceMeters,
      durationSeconds: summary.deliveryEstimate.route.durationSeconds,
      durationMinutes: routeMinutes,
    },
    selectedCourier: {
      quoteId: selectedCourier.quoteId,
      courierCompanyId: selectedCourier.courierCompanyId,
      courierName: selectedCourier.courierName,
      serviceType: selectedCourier.serviceType,
      rate: selectedCourier.rate,
      etd: selectedCourier.etd,
      etdHours: selectedCourier.etdHours,
      expectedDeliveryDate: selectedCourier.expectedDeliveryDate,
    },
    customerMessage:
      selectedCourier.serviceType === "quick"
        ? `ASAP from LapKart dispatch, expected within ${Math.max(
            1,
            Math.ceil(selectedCourier.etdHours || 3),
          )} hour(s) after packing.`
        : `Standard courier from LapKart dispatch, expected ${selectedCourier.etd || "as quoted by courier"}.`,
    limitations: [
      "No multi-zone or hub inventory is configured yet.",
      "Promise is calculated from the configured LapKart pickup origin, live route, stock, and Shiprocket quote.",
    ],
  };
}

function trimApiPath(pathname: string) {
  return (
    pathname
      .replace(/^\/functions\/v1\/api/, "")
      .replace(/^\/api/, "")
      .replace(/\/+$/, "") || "/"
  );
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allowedOrigin = origin && config.webOrigins.includes(origin) ? origin : null;
  return {
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info, x-lapkart-logistics-token",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
      ...headers,
    },
  });
}

function text(req: Request, status: number, body: string, headers?: Record<string, string>) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...corsHeaders(req),
      ...headers,
    },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInvoiceHtml({
  order,
  items,
  invoiceNumber,
}: {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  invoiceNumber: string;
}) {
  const rows = items
    .map((item) => {
      const qty = Number(item.qty ?? 0);
      const unit = Number(item.price ?? item.unit_price ?? 0);
      const lineTotal = roundMoney(qty * unit);
      return `<tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.brand)}</td>
        <td class="num">${qty}</td>
        <td class="num">INR ${unit.toFixed(2)}</td>
        <td class="num">INR ${lineTotal.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(invoiceNumber)} - LapKart invoice</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    h1 { font-size: 28px; margin: 0; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px; text-align: left; vertical-align: top; }
    th { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; }
    .num { text-align: right; }
    .totals { margin-left: auto; margin-top: 20px; width: 320px; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand { border-top: 2px solid #111; font-weight: 700; font-size: 18px; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Print or save PDF</button>
  <header>
    <div>
      <h1>LapKart</h1>
      <p>Genuine laptop parts marketplace</p>
    </div>
    <div>
      <p><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</p>
      <p><strong>Order:</strong> #${escapeHtml(String(order.id ?? "").slice(0, 8))}</p>
      <p><strong>Date:</strong> ${escapeHtml(new Date(String(order.created_at)).toLocaleDateString("en-IN"))}</p>
    </div>
  </header>
  <h2>Bill To / Ship To</h2>
  <p>${escapeHtml(order.shipping_name)}</p>
  <p>${escapeHtml(order.shipping_address)}</p>
  <p>${escapeHtml(order.shipping_phone)}</p>
  <table>
    <thead>
      <tr><th>Item</th><th>Brand</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="totals">
    <div><span>Subtotal</span><span>INR ${Number(order.subtotal ?? 0).toFixed(2)}</span></div>
    <div><span>Shipping</span><span>INR ${Number(order.shipping ?? 0).toFixed(2)}</span></div>
    <div><span>Discount${order.coupon_code ? ` (${escapeHtml(order.coupon_code)})` : ""}</span><span>- INR ${Number(order.discount_total ?? 0).toFixed(2)}</span></div>
    <div class="grand"><span>Total paid</span><span>INR ${Number(order.total ?? 0).toFixed(2)}</span></div>
  </section>
</body>
</html>`;
}

function getSupabaseAdmin() {
  if (!supabaseAdmin) throw new HttpError(503, "Supabase service credentials are not configured");
  return supabaseAdmin;
}

function getBearerToken(req: Request) {
  return req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

async function requireUser(req: Request) {
  const adminDb = getSupabaseAdmin();
  const token = getBearerToken(req);
  if (!token) throw new HttpError(401, "Authorization bearer token is required");
  const { data, error } = await adminDb.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid authorization token");
  return { id: data.user.id, email: data.user.email ?? null } satisfies AuthenticatedUser;
}

async function requireAdmin(req: Request) {
  const adminDb = getSupabaseAdmin();
  const user = await requireUser(req);
  const { data: roleRow, error: roleError } = await adminDb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) throw roleError;
  if (roleRow?.role !== "admin") throw new HttpError(403, "Admin role is required");
  return user;
}

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function enforceRateLimit(
  req: Request,
  name: string,
  configValue: { limit: number; windowMs: number },
) {
  const key = `${name}:${getClientIp(req)}`;
  const now = Date.now();
  const current = rateLimitBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + configValue.windowMs });
    return;
  }
  if (current.count >= configValue.limit) {
    throw new HttpError(429, "Too many requests");
  }
  current.count += 1;
}

function isRazorpayAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode =
    "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
  return statusCode === 401;
}

function requireLivePaymentEnvironment() {
  if (config.razorpayKeyId.startsWith("rzp_test_") && !config.allowShiprocketWithTestPayments) {
    throw new HttpError(
      409,
      "Shiprocket fulfillment is blocked while Razorpay is configured in test mode. Switch to live keys or explicitly allow test fulfillment in backend env.",
    );
  }
}

function normalizeShipmentStatus(status: string) {
  const value = status.toLowerCase();
  if (value.includes("delivered") && value.includes("rto")) return "rto_delivered";
  if (value.includes("rto")) return "rto_initiated";
  if (value.includes("out") && value.includes("delivery")) return "out_for_delivery";
  if (value.includes("delivered")) return "delivered";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("return")) return "returned";
  if (value.includes("lost")) return "lost";
  if (value.includes("damage")) return "damaged";
  if (value.includes("pickup")) return "pickup_scheduled";
  if (value.includes("shipped")) return "shipped";
  if (value.includes("transit") || value.includes("manifest") || value.includes("assigned")) {
    return "in_transit";
  }
  return "in_transit";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toDateOnly(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function firstString(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value : null;
}

function getAwbData(response: Record<string, unknown>) {
  const nestedResponse = asRecord(response.response);
  return Object.keys(asRecord(nestedResponse.data)).length
    ? asRecord(nestedResponse.data)
    : nestedResponse;
}

function getPickupData(response: Record<string, unknown>) {
  const nestedResponse = asRecord(response.response);
  return Object.keys(nestedResponse).length ? nestedResponse : response;
}

function trackingActivities(payload: unknown) {
  const trackingData = asRecord(asRecord(payload).tracking_data);
  const activities = Array.isArray(trackingData.shipment_track_activities)
    ? trackingData.shipment_track_activities
    : [];
  return activities.slice(0, 8).map((activity) => {
    const row = asRecord(activity);
    return {
      date: firstString(row.date),
      status: firstString(row.status),
      activity: firstString(row.activity),
      location: firstString(row.location),
    };
  });
}

function normalizeTrackingActivity(activity: Record<string, unknown>) {
  return {
    date: firstString(activity.date, activity.status_time, activity.received_at),
    status: firstString(activity.status),
    activity: firstString(activity.activity, activity.message, activity.status),
    location: firstString(activity.location),
  };
}

function groupShipmentEvents(
  events: Array<{
    shipment_id: string | null;
    status: string | null;
    status_time: string | null;
    location: string | null;
    message: string | null;
    received_at: string | null;
  }>,
) {
  const grouped = new Map<string, ReturnType<typeof normalizeTrackingActivity>[]>();
  for (const event of events) {
    if (!event.shipment_id) continue;
    const items = grouped.get(event.shipment_id) ?? [];
    items.push(
      normalizeTrackingActivity({
        date: event.status_time,
        status: event.status,
        activity: event.message,
        location: event.location,
        received_at: event.received_at,
      }),
    );
    grouped.set(event.shipment_id, items);
  }
  return grouped;
}

async function refreshShiprocketTracking(shipment: Record<string, unknown>) {
  const adminDb = getSupabaseAdmin();
  const shiprocketShipmentId = Number(shipment.shiprocket_shipment_id);
  if (!Number.isFinite(shiprocketShipmentId)) {
    throw new Error("Shipment does not have a Shiprocket shipment id");
  }

  const response = await getShiprocketTracking(shiprocketShipmentId);
  const trackingData = asRecord(response.tracking_data);
  const shipmentTrack = Array.isArray(trackingData.shipment_track)
    ? asRecord(trackingData.shipment_track[0])
    : {};
  const currentStatus = firstString(shipmentTrack.current_status, trackingData.current_status);
  const awbCode = firstString(shipmentTrack.awb_code, shipment.awb_code);
  const trackingUrl = firstString(trackingData.track_url, shipment.tracking_url);
  const updates: Record<string, unknown> = {
    raw_payload: response,
    last_status_at: new Date().toISOString(),
  };
  if (currentStatus) updates.status = normalizeShipmentStatus(currentStatus);
  if (awbCode) updates.awb_code = awbCode;
  if (trackingUrl) updates.tracking_url = trackingUrl;
  const expectedDeliveryDate = toDateOnly(shipmentTrack.edd ?? trackingData.etd);
  if (expectedDeliveryDate) updates.expected_delivery_date = expectedDeliveryDate;

  const { data: updatedShipment, error } = await adminDb
    .from("shipments")
    .update(updates)
    .eq("id", String(shipment.id))
    .select("*")
    .single();
  if (error) throw error;

  return { shipment: updatedShipment, tracking: response };
}

async function createShiprocketShipmentForOrder(
  adminDb: ReturnType<typeof getSupabaseAdmin>,
  input: z.infer<typeof createShiprocketShipmentSchema>,
) {
  const { data: order, error: orderError } = await adminDb
    .from("orders")
    .select("*")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new HttpError(404, "Order not found");
  if (
    ["cancelled", "cancellation_requested", "return_requested", "refunded"].includes(
      String(order.status ?? "").toLowerCase(),
    )
  ) {
    throw new HttpError(409, "This order is not eligible for shipment creation");
  }
  const items = await getOrderItemsWithSku([input.orderId]);
  if (!items.length) throw new HttpError(400, "Order has no items");
  const { data: existingShipment, error: existingShipmentError } = await adminDb
    .from("shipments")
    .select("*")
    .eq("order_id", input.orderId)
    .eq("provider", "shiprocket")
    .eq("shipping_direction", "outbound")
    .maybeSingle();
  if (existingShipmentError) throw existingShipmentError;
  if (existingShipment) {
    throw new HttpError(409, "Shiprocket shipment already exists for this order");
  }
  const payload = toShiprocketOrderPayload({
    order,
    items,
    package: input.package,
    pickupLocation: input.pickupLocation,
  });
  const { data: pickupLocation, error: pickupLocationError } = await adminDb
    .from("shipping_pickup_locations")
    .select("id")
    .eq("provider", "shiprocket")
    .eq("pickup_location", payload.pickup_location)
    .eq("is_active", true)
    .maybeSingle();
  if (pickupLocationError) throw pickupLocationError;
  if (!pickupLocation) {
    throw new HttpError(400, "Shiprocket pickup location is not synced or active");
  }
  const response = await createShiprocketOrder(payload);
  const shiprocketOrderId = Number(response.order_id ?? response.orderId);
  const shiprocketShipmentId = Number(response.shipment_id ?? response.shipmentId);
  const { data: shipment, error: shipmentError } = await adminDb
    .from("shipments")
    .insert({
      order_id: input.orderId,
      provider: "shiprocket",
      pickup_location_id: pickupLocation.id,
      shipping_direction: "outbound",
      shipping_service_type: order.shipping_service_type ?? "standard",
      status: shiprocketShipmentId ? "created" : "pending",
      shiprocket_order_id: Number.isFinite(shiprocketOrderId) ? shiprocketOrderId : null,
      shiprocket_shipment_id: Number.isFinite(shiprocketShipmentId) ? shiprocketShipmentId : null,
      shiprocket_channel_order_id: String(order.id),
      courier_company_id: order.shipping_courier_company_id ?? null,
      courier_name: order.shipping_courier_name ?? null,
      shipping_charge: order.shipping_charge_estimate ?? 0,
      expected_delivery_date: order.shipping_expected_delivery_date ?? null,
      request_payload: payload,
      raw_create_response: response,
      raw_payload: response,
    })
    .select("*")
    .single();
  if (shipmentError) throw shipmentError;
  await adminDb.from("shipment_packages").insert({
    shipment_id: shipment.id,
    package_number: 1,
    weight_kg: payload.weight,
    length_cm: payload.length,
    breadth_cm: payload.breadth,
    height_cm: payload.height,
    declared_value: payload.sub_total,
    item_count: payload.order_items.reduce((sum, item) => sum + item.units, 0),
    sku_summary: payload.order_items
      .map((item) => item.sku)
      .join(", ")
      .slice(0, 500),
    order_item_ids: items.map((item) => item.id),
    raw_payload: payload,
  });

  return { shipment, shiprocket: response };
}

async function syncShiprocketPickupLocations(addresses: ShiprocketPickupAddress[]) {
  const adminDb = getSupabaseAdmin();
  if (!addresses.length) return;

  const primaryIndex = Math.max(
    0,
    addresses.findIndex((address) => Number(address.is_primary_location) === 1),
  );
  const rows = addresses
    .filter((address) => String(address.pickup_location ?? "").trim())
    .map((address, index) => ({
      provider: "shiprocket",
      pickup_location: String(address.pickup_location),
      provider_location_id: address.id ? String(address.id) : null,
      contact_name: firstString(address.name, address.contact_name),
      email: firstString(address.email),
      phone: firstString(address.phone),
      address_line1: firstString(address.address, address.address_line1),
      address_line2: firstString(address.address_2, address.address_line2),
      city: firstString(address.city),
      state: firstString(address.state),
      country: firstString(address.country) ?? "India",
      pincode: firstString(address.pin_code, address.pincode) ?? "",
      latitude: Number.isFinite(Number(address.lat)) ? Number(address.lat) : null,
      longitude: Number.isFinite(Number(address.long)) ? Number(address.long) : null,
      is_default: index === primaryIndex,
      is_active: Number(address.status ?? 1) !== 0,
      raw_payload: address,
    }));

  if (!rows.length) return;
  const { error: resetError } = await adminDb
    .from("shipping_pickup_locations")
    .update({ is_default: false })
    .eq("provider", "shiprocket");
  if (resetError) throw resetError;

  const { error } = await adminDb
    .from("shipping_pickup_locations")
    .upsert(rows, { onConflict: "provider,pickup_location" });
  if (error) throw error;
}

async function getOrderItemsWithSku(orderIds: string[]) {
  const adminDb = getSupabaseAdmin();
  if (orderIds.length === 0) return [] as OrderItemWithSku[];

  const { data: items, error: itemsError } = await adminDb
    .from("order_items")
    .select("id,order_id,title,image,brand,qty,price,product_id")
    .in("order_id", orderIds);
  if (itemsError) throw itemsError;

  const productIds = [
    ...new Set(
      (items ?? [])
        .map((item) => item.product_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const { data: products, error: productsError } = productIds.length
    ? await adminDb.from("products").select("id,sku").in("id", productIds)
    : { data: [], error: null };
  if (productsError) throw productsError;

  const skuByProductId = new Map(
    (products ?? []).map((product) => [product.id, product.sku ?? null]),
  );
  return ((items ?? []) as Array<Record<string, unknown>>).map((item) => ({
    id: String(item.id ?? crypto.randomUUID()),
    order_id: String(item.order_id ?? ""),
    title: String(item.title ?? "Item"),
    image: String(item.image ?? ""),
    brand: String(item.brand ?? ""),
    qty: Number(item.qty ?? 0),
    price: item.price === undefined || item.price === null ? null : Number(item.price),
    product_id: firstString(item.product_id),
    sku: firstString(skuByProductId.get(String(item.product_id ?? ""))),
  }));
}

function toFulfillmentShipment(
  shipment: Record<string, unknown> | undefined,
  shipmentEvents?: ReturnType<typeof normalizeTrackingActivity>[],
) {
  if (!shipment) return null;
  return {
    id: shipment.id,
    shippingServiceType: shipment.shipping_service_type,
    status: shipment.status,
    shiprocketShipmentId: shipment.shiprocket_shipment_id,
    awbCode: shipment.awb_code,
    courierName: shipment.courier_name,
    pickupScheduledDate: shipment.pickup_scheduled_date,
    expectedDeliveryDate: shipment.expected_delivery_date,
    trackingUrl: shipment.tracking_url,
    manifestUrl: shipment.manifest_url,
    labelUrl: shipment.label_url,
    trackingActivities:
      shipmentEvents && shipmentEvents.length > 0
        ? shipmentEvents.slice(0, 8)
        : trackingActivities(shipment.raw_payload),
  };
}

async function sendBackInStockEmail(input: {
  to: string;
  productTitle: string;
  productUrl: string;
}) {
  if (!config.resendApiKey || !config.notificationEmailFrom) return null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.notificationEmailFrom,
      to: [input.to],
      subject: `${input.productTitle} is back in stock`,
      html: `
        <p>${input.productTitle} is available again on LapKart.</p>
        <p><a href="${input.productUrl}">Open product</a></p>
      `,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(firstString(asRecord(data).message) ?? "Back-in-stock email failed");
  }
  return { provider: "resend", response: data };
}

async function sendBackInStockWhatsapp(input: {
  phone: string | null;
  productTitle: string;
  productUrl: string;
}) {
  if (
    !input.phone ||
    !config.whatsappAccessToken ||
    !config.whatsappPhoneNumberId ||
    !config.whatsappBackInStockTemplate
  ) {
    return null;
  }
  const phone = input.phone.replace(/\D/g, "");
  if (phone.length < 10) return null;
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${config.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.startsWith("91") ? phone : `91${phone.slice(-10)}`,
        type: "template",
        template: {
          name: config.whatsappBackInStockTemplate,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: input.productTitle },
                { type: "text", text: input.productUrl },
              ],
            },
          ],
        },
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(firstString(asRecord(asRecord(data).error).message) ?? "WhatsApp send failed");
  }
  return { provider: "whatsapp", response: data };
}

async function sendStockNotificationEvent(eventId: string) {
  const adminDb = getSupabaseAdmin();
  const { data: event, error: eventError } = await adminDb
    .from("stock_notification_events")
    .select("*,products(id,title,brand)")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) throw new HttpError(404, "Stock notification event not found");
  if (event.status !== "pending" && event.status !== "failed") {
    throw new HttpError(409, "Only pending or failed notifications can be sent");
  }

  const product = asRecord(event.products);
  const productTitle = firstString(product.title) ?? "Your saved LapKart part";
  const origin =
    config.webOrigins.find((value) => value.startsWith("https://")) ?? config.webOrigins[0];
  const productUrl = `${origin?.replace(/\/$/, "") ?? "https://lapkart-five.vercel.app"}/product/${event.product_id}`;
  let phone: string | null = null;
  if (event.user_id) {
    const { data: profile } = await adminDb
      .from("profiles")
      .select("phone")
      .eq("id", event.user_id)
      .maybeSingle();
    phone = firstString(profile?.phone);
  }

  const deliveries = (
    await Promise.all([
      sendBackInStockEmail({ to: String(event.email), productTitle, productUrl }),
      sendBackInStockWhatsapp({ phone, productTitle, productUrl }),
    ])
  ).filter(Boolean);

  if (!deliveries.length) {
    throw new HttpError(
      503,
      "No back-in-stock delivery provider is configured. Add RESEND_API_KEY/NOTIFICATION_EMAIL_FROM or WhatsApp Cloud API env vars.",
    );
  }

  const { data: updatedEvent, error: updateError } = await adminDb
    .from("stock_notification_events")
    .update({
      status: "sent",
      processed_at: new Date().toISOString(),
      payload: {
        ...asRecord(event.payload),
        deliveries,
        productUrl,
      },
    })
    .eq("id", eventId)
    .select("*")
    .single();
  if (updateError) throw updateError;
  return updatedEvent;
}

async function storeCheckoutSession(razorpayOrderId: string, checkout: PendingCheckout) {
  const adminDb = getSupabaseAdmin();
  const { error } = await adminDb.from("checkout_sessions").insert({
    user_id: checkout.userId,
    razorpay_order_id: razorpayOrderId,
    amount_paise: checkout.amountPaise,
    currency: "INR",
    subtotal: checkout.subtotal,
    shipping: checkout.shipping,
    discount_total: checkout.discountTotal,
    total: checkout.total,
    coupon_id: checkout.coupon?.id ?? null,
    coupon_code: checkout.coupon?.code ?? null,
    coupon_snapshot: checkout.coupon,
    items: checkout.items,
    address: checkout.address,
    delivery_estimate: checkout.deliveryEstimate,
    selected_courier: checkout.selectedCourier,
    save_address: checkout.saveAddress,
    status: "pending",
    expires_at: new Date(checkout.createdAt + checkoutSessionTtlMs).toISOString(),
  });
  if (error) console.warn("Could not persist checkout session", error.message);
}

async function loadCheckoutSession(razorpayOrderId: string): Promise<LoadedCheckoutSession | null> {
  const adminDb = getSupabaseAdmin();
  const { data, error } = await adminDb
    .from("checkout_sessions")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();
  if (error) {
    console.warn("Could not load checkout session", error.message);
    return null;
  }
  if (!data) return null;

  const status = String(data.status ?? "pending");
  const orderId = typeof data.order_id === "string" ? data.order_id : null;
  const expiresAt = new Date(String(data.expires_at ?? "")).getTime();
  if (status !== "paid" && Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    await adminDb
      .from("checkout_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("razorpay_order_id", razorpayOrderId);
    return null;
  }

  return {
    checkout: {
      userId: String(data.user_id),
      userEmail: null,
      items: data.items as CheckoutOrderItem[],
      subtotal: Number(data.subtotal),
      shipping: Number(data.shipping),
      discountTotal: Number(data.discount_total ?? 0),
      total: Number(data.total),
      amountPaise: Number(data.amount_paise),
      coupon: data.coupon_snapshot as AppliedCoupon | null,
      deliveryEstimate: data.delivery_estimate as PendingCheckout["deliveryEstimate"],
      selectedCourier: data.selected_courier as CourierQuote,
      address: data.address as CheckoutAddress,
      saveAddress: Boolean(data.save_address),
      createdAt: new Date(String(data.created_at)).getTime(),
    },
    orderId,
    status,
  };
}

async function markCheckoutSessionProcessing(razorpayOrderId: string) {
  const adminDb = getSupabaseAdmin();
  const { data, error } = await adminDb
    .from("checkout_sessions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("Could not mark checkout session processing", error.message);
    return true;
  }
  return Boolean(data);
}

async function markCheckoutSessionPaid(razorpayOrderId: string, orderId: string) {
  const adminDb = getSupabaseAdmin();
  const { error } = await adminDb
    .from("checkout_sessions")
    .update({ status: "paid", order_id: orderId, updated_at: new Date().toISOString() })
    .eq("razorpay_order_id", razorpayOrderId);
  if (error) console.warn("Could not mark checkout session paid", error.message);
}

function isShipmentStarted(shipment: Record<string, unknown> | null | undefined) {
  if (!shipment) return false;
  const status = String(shipment.status ?? "").toLowerCase();
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
  ].includes(status);
}

function canRequestCancellation(
  order: Record<string, unknown>,
  shipment?: Record<string, unknown> | null,
) {
  const orderStatus = String(order.status ?? "").toLowerCase();
  const paymentStatus = String(order.payment_status ?? "").toLowerCase();
  if (!["paid", "cod_pending"].includes(paymentStatus)) return false;
  if (
    [
      "cancellation_requested",
      "cancelled",
      "return_requested",
      "return_approved",
      "return_received",
      "returned",
      "delivered",
      "refunded",
    ].includes(orderStatus)
  ) {
    return false;
  }
  return !isShipmentStarted(shipment);
}

function canRequestReturn(
  order: Record<string, unknown>,
  shipment?: Record<string, unknown> | null,
) {
  const orderStatus = String(order.status ?? "").toLowerCase();
  const shipmentStatus = String(shipment?.status ?? "").toLowerCase();
  if (
    [
      "return_requested",
      "return_approved",
      "return_received",
      "returned",
      "refunded",
      "cancelled",
    ].includes(orderStatus)
  ) {
    return false;
  }
  if (orderStatus !== "delivered" && shipmentStatus !== "delivered") return false;
  const deliveredAt = new Date(
    String(
      shipment?.actual_delivery_at ??
        shipment?.updated_at ??
        order.updated_at ??
        order.created_at ??
        "",
    ),
  ).getTime();
  if (!Number.isFinite(deliveredAt)) return true;
  return Date.now() - deliveredAt <= 7 * 24 * 60 * 60 * 1000;
}

function toPaise(amount: number) {
  return Math.round(amount * 100);
}

function invoiceNumberForOrder(orderId: string) {
  return `LK-${new Date().getFullYear()}-${orderId.slice(0, 8).toUpperCase()}`;
}

function assertUploadIsSafeImage(file: File) {
  if (!allowedImageMimeTypes.has(file.type)) {
    throw new HttpError(400, "Only JPEG, PNG, WebP, or AVIF images are allowed");
  }
}

function normalizeCheckoutItems(items: Array<z.infer<typeof checkoutItemSchema>>) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    const qty = (quantities.get(item.id) ?? 0) + item.qty;
    if (qty > 20) throw new HttpError(400, "A single product cannot exceed 20 units per checkout");
    quantities.set(item.id, qty);
  }
  return [...quantities.entries()].map(([id, qty]) => ({ id, qty }));
}

function phoneDigits(phone: string) {
  const value = phone.replace(/\D/g, "").slice(-10);
  if (value.length !== 10) throw new HttpError(400, "A valid 10 digit phone number is required");
  return value;
}

function getProductImage(product: CheckoutProductRow) {
  return product.images?.[0] ?? product.image;
}

function buildShippingAddress(address: CheckoutAddress) {
  return [
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.pincode}`,
    "India",
  ]
    .filter(Boolean)
    .join("\n");
}

function isChennaiAddress(address: CheckoutAddress) {
  const city = address.city.trim().toLowerCase();
  const state = address.state.trim().toLowerCase();
  const pincode = address.pincode.trim();
  return pincode.startsWith("600") || (city.includes("chennai") && state.includes("tamil"));
}

function getCodIneligibilityReason({
  address,
  total,
  products,
}: {
  address: CheckoutAddress;
  total: number;
  products: CheckoutProductRow[];
}) {
  if (!isChennaiAddress(address)) return "COD is currently limited to Chennai delivery addresses";
  if (total > 4000) return "COD is available only up to INR 4000";
  const codBlockedProduct = products.find((product) => product.cod_eligible === false);
  if (codBlockedProduct) return `${codBlockedProduct.title} is not eligible for COD`;
  return null;
}

async function validateCouponForCheckout({
  userId,
  code,
  subtotal,
}: {
  userId: string;
  code: string;
  subtotal: number;
}): Promise<AppliedCoupon | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) return null;

  const adminDb = getSupabaseAdmin();
  const { data: coupon, error } = await adminDb
    .from("coupons")
    .select(
      "id,code,description,discount_type,discount_value,minimum_subtotal,max_discount,starts_at,ends_at,usage_limit,per_user_limit,active",
    )
    .ilike("code", normalizedCode)
    .maybeSingle();
  if (error) throw error;
  if (!coupon || coupon.active !== true) {
    throw new HttpError(400, "Coupon is not active");
  }

  const now = Date.now();
  const startsAt = coupon.starts_at ? new Date(String(coupon.starts_at)).getTime() : null;
  const endsAt = coupon.ends_at ? new Date(String(coupon.ends_at)).getTime() : null;
  if (startsAt && Number.isFinite(startsAt) && startsAt > now) {
    throw new HttpError(400, "Coupon is not active yet");
  }
  if (endsAt && Number.isFinite(endsAt) && endsAt < now) {
    throw new HttpError(400, "Coupon has expired");
  }

  const minimumSubtotal = Number(coupon.minimum_subtotal ?? 0);
  if (subtotal < minimumSubtotal) {
    throw new HttpError(400, `Coupon requires a subtotal of at least INR ${minimumSubtotal}`);
  }

  if (coupon.usage_limit) {
    const { count, error: usageError } = await adminDb
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if (usageError) throw usageError;
    if ((count ?? 0) >= Number(coupon.usage_limit)) {
      throw new HttpError(400, "Coupon usage limit has been reached");
    }
  }

  const { count: userUsage, error: userUsageError } = await adminDb
    .from("coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", coupon.id)
    .eq("user_id", userId);
  if (userUsageError) throw userUsageError;
  if ((userUsage ?? 0) >= Number(coupon.per_user_limit ?? 1)) {
    throw new HttpError(400, "You have already used this coupon");
  }

  const discountType = coupon.discount_type === "percent" ? "percent" : "fixed";
  const discountValue = Number(coupon.discount_value);
  const rawDiscount = discountType === "percent" ? (subtotal * discountValue) / 100 : discountValue;
  const maxDiscount = coupon.max_discount === null ? null : Number(coupon.max_discount);
  const discountAmount = roundMoney(
    Math.min(subtotal, maxDiscount ? Math.min(rawDiscount, maxDiscount) : rawDiscount),
  );
  if (!Number.isFinite(discountAmount) || discountAmount <= 0) {
    throw new HttpError(400, "Coupon does not apply to this cart");
  }

  return {
    id: String(coupon.id),
    code: String(coupon.code).toUpperCase(),
    description: coupon.description ? String(coupon.description) : null,
    discountType,
    discountValue,
    discountAmount,
  };
}

async function buildCheckoutSummary(
  userId: string,
  input: z.infer<typeof checkoutCreatePaymentOrderSchema>,
) {
  const adminDb = getSupabaseAdmin();
  const items = normalizeCheckoutItems(input.items);
  const productIds = items.map((item) => item.id);
  const { data: products, error } = await adminDb
    .from("products")
    .select(
      "id,title,brand,image,images,price,stock,status,weight_kg,local_delivery_eligible,cod_eligible",
    )
    .in("id", productIds);
  if (error) throw error;

  const productRows = (products as CheckoutProductRow[] | null) ?? [];
  const productsById = new Map(productRows.map((product) => [product.id, product]));
  if (productsById.size !== productIds.length) {
    throw new HttpError(400, "One or more cart items are no longer available");
  }

  const orderItems: CheckoutOrderItem[] = items.map((item) => {
    const product = productsById.get(item.id);
    if (!product) throw new HttpError(400, "One or more cart items are no longer available");
    if (product.status && product.status !== "active") {
      throw new HttpError(400, `${product.title} is not available for checkout`);
    }
    if (typeof product.stock === "number" && product.stock < item.qty) {
      throw new HttpError(400, `${product.title} only has ${product.stock} unit(s) in stock`);
    }
    const price = roundMoney(Number(product.price));
    if (!Number.isFinite(price) || price < 0) {
      throw new HttpError(400, `${product.title} has an invalid price`);
    }
    return {
      productId: product.id,
      title: product.title,
      image: getProductImage(product),
      brand: product.brand,
      price,
      qty: item.qty,
    };
  });

  const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + item.price * item.qty, 0));
  const weightKg = Math.max(
    config.shiprocketDefaultWeightKg,
    roundMoney(
      items.reduce((sum, item) => {
        const product = productsById.get(item.id);
        const weight = Number(product?.weight_kg ?? config.shiprocketDefaultWeightKg);
        return (
          sum +
          (Number.isFinite(weight) && weight > 0 ? weight : config.shiprocketDefaultWeightKg) *
            item.qty
        );
      }, 0),
    ),
  );

  const [route, couriers] = await Promise.all([
    getOlaDeliveryRoute({ latitude: input.address.latitude, longitude: input.address.longitude }),
    getShiprocketDeliveryQuotes({
      deliveryPincode: input.address.pincode,
      deliveryLatitude: input.address.latitude,
      deliveryLongitude: input.address.longitude,
      weightKg,
      declaredValue: subtotal,
    }),
  ]);

  if (!couriers.length)
    throw new HttpError(400, "No courier currently services this delivery location");
  const fallbackCourier = couriers[0];
  if (!fallbackCourier)
    throw new HttpError(400, "No courier currently services this delivery location");
  const selectedCourier =
    couriers.find((courier) => courier.quoteId === input.selectedQuoteId) ??
    couriers.find((courier) => courier.recommended) ??
    fallbackCourier;
  const selectedRate = Number(selectedCourier.rate);
  if (!Number.isFinite(selectedRate) || selectedRate < 0) {
    throw new HttpError(400, "Selected courier returned an invalid shipping rate");
  }

  const coupon = await validateCouponForCheckout({
    userId,
    code: input.couponCode,
    subtotal,
  });
  const discountTotal = coupon?.discountAmount ?? 0;
  const shipping = subtotal > 999 ? 0 : roundMoney(selectedRate);
  const total = roundMoney(Math.max(0, subtotal + shipping - discountTotal));
  const amountPaise = Math.round(total * 100);
  const codReason = getCodIneligibilityReason({
    address: input.address,
    total,
    products: productRows,
  });
  const hasQuickCourier = selectedCourier.serviceType === "quick";
  const deliveryPromise = {
    label: hasQuickCourier ? "ASAP delivery" : "Standard delivery",
    detail: hasQuickCourier
      ? `Expected within ${Math.max(1, Math.ceil(selectedCourier.etdHours || 3))} hour(s)`
      : selectedCourier.etd || `${selectedCourier.estimatedDeliveryDays} day(s)`,
    serviceType: selectedCourier.serviceType,
  } satisfies CheckoutSummary["deliveryPromise"];
  const deliveryEstimate = {
    dispatch: {
      pickupLocation: config.shiprocketPickupLocation,
      pincode: config.lapkartDispatchPincode,
    },
    route,
    couriers,
    generatedAt: new Date().toISOString(),
  };

  return {
    items: orderItems,
    subtotal,
    shipping,
    discountTotal,
    total,
    amountPaise,
    coupon,
    cod: {
      eligible: codReason === null,
      reason: codReason,
      cap: 4000,
    },
    deliveryPromise,
    deliveryEstimate,
    selectedCourier,
    deliveryPromiseSnapshot: buildDeliveryPromiseSnapshot(
      {
        items: orderItems,
        subtotal,
        shipping,
        discountTotal,
        total,
        amountPaise,
        coupon,
        cod: {
          eligible: codReason === null,
          reason: codReason,
          cap: 4000,
        },
        deliveryPromise,
        deliveryPromiseSnapshot: {},
        deliveryEstimate,
        selectedCourier,
      },
      productRows,
    ),
  } satisfies CheckoutSummary;
}

function productPayloadFromInput(
  input: z.infer<typeof productUpsertSchema> | z.infer<typeof productUpdateSchema>,
) {
  const payload: Record<string, unknown> = {};
  if ("title" in input && input.title !== undefined) payload.title = input.title;
  if ("brand" in input && input.brand !== undefined) payload.brand = input.brand;
  if ("category" in input && input.category !== undefined) payload.category = input.category;
  if ("description" in input) payload.description = input.description ?? null;
  if ("image" in input && input.image !== undefined) payload.image = input.image;
  if ("images" in input)
    payload.images = input.images && input.images.length > 0 ? input.images : null;
  if ("price" in input && input.price !== undefined) payload.price = input.price;
  if ("mrp" in input && input.mrp !== undefined) payload.mrp = input.mrp;
  if ("stock" in input && input.stock !== undefined) payload.stock = input.stock;
  if ("status" in input && input.status !== undefined) payload.status = input.status;
  if ("sku" in input) payload.sku = input.sku ?? null;
  if ("sourceUrl" in input) payload.source_url = input.sourceUrl ?? null;
  if ("compatibility" in input) payload.compatibility = input.compatibility ?? null;
  if ("warranty" in input) payload.warranty = input.warranty ?? null;
  if ("highlights" in input)
    payload.highlights = input.highlights && input.highlights.length > 0 ? input.highlights : null;
  if ("searchKeywords" in input) {
    payload.search_keywords =
      input.searchKeywords && input.searchKeywords.length > 0 ? input.searchKeywords : null;
  }
  if ("weightKg" in input) payload.weight_kg = input.weightKg ?? null;
  if ("lengthCm" in input) payload.length_cm = input.lengthCm ?? null;
  if ("breadthCm" in input) payload.breadth_cm = input.breadthCm ?? null;
  if ("heightCm" in input) payload.height_cm = input.heightCm ?? null;
  if ("authenticityGrade" in input && input.authenticityGrade !== undefined) {
    payload.authenticity_grade = input.authenticityGrade;
  }
  if ("conditionGrade" in input && input.conditionGrade !== undefined) {
    payload.condition_grade = input.conditionGrade;
  }
  if ("hsnCode" in input) payload.hsn_code = input.hsnCode ?? null;
  if ("gstRate" in input && input.gstRate !== undefined) payload.gst_rate = input.gstRate;
  if ("doaPolicyDays" in input && input.doaPolicyDays !== undefined) {
    payload.doa_policy_days = input.doaPolicyDays;
  }
  if ("localDeliveryEligible" in input && input.localDeliveryEligible !== undefined) {
    payload.local_delivery_eligible = input.localDeliveryEligible;
  }
  if ("codEligible" in input && input.codEligible !== undefined) {
    payload.cod_eligible = input.codEligible;
  }
  return payload;
}

function couponPayloadFromInput(
  input: z.infer<typeof couponWriteSchema> | z.infer<typeof couponPatchSchema>,
) {
  const payload: Record<string, unknown> = {};
  if ("code" in input && input.code !== undefined) payload.code = input.code;
  if ("description" in input) payload.description = input.description || null;
  if ("discountType" in input && input.discountType !== undefined)
    payload.discount_type = input.discountType;
  if ("discountValue" in input && input.discountValue !== undefined)
    payload.discount_value = input.discountValue;
  if ("minimumSubtotal" in input && input.minimumSubtotal !== undefined) {
    payload.minimum_subtotal = input.minimumSubtotal;
  }
  if ("maxDiscount" in input) payload.max_discount = input.maxDiscount ?? null;
  if ("startsAt" in input) payload.starts_at = input.startsAt || null;
  if ("endsAt" in input) payload.ends_at = input.endsAt || null;
  if ("usageLimit" in input) payload.usage_limit = input.usageLimit ?? null;
  if ("perUserLimit" in input && input.perUserLimit !== undefined)
    payload.per_user_limit = input.perUserLimit;
  if ("active" in input && input.active !== undefined) payload.active = input.active;
  return payload;
}

function parseQueryObject(url: URL) {
  return Object.fromEntries(url.searchParams.entries());
}

function matchRoute(path: string, pattern: RegExp) {
  return pattern.exec(path);
}

async function handle(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  enforceRateLimit(req, "api", apiRateLimit);

  const url = new URL(req.url);
  const path = trimApiPath(url.pathname);

  if (req.method === "GET" && path === "/health") {
    return json(req, 200, { ok: true, service: "lapkart-api" });
  }

  if (req.method === "POST" && path === "/fraud/score") {
    const input = fraudScoreSchema.parse(await req.json());
    return json(req, 200, scoreFraud(input));
  }

  if (req.method === "POST" && ["/api/create-order", "/payments/razorpay/order"].includes(path)) {
    enforceRateLimit(req, "payment", paymentRateLimit);
    return json(req, 410, {
      error: "Use /checkout/create-payment-order so the server can verify cart pricing",
    });
  }

  if (
    req.method === "POST" &&
    ["/api/verify-payment", "/payments/razorpay/verify"].includes(path)
  ) {
    enforceRateLimit(req, "payment", paymentRateLimit);
    return json(req, 410, {
      error: "Use /checkout/complete-payment so the server can create the paid order",
    });
  }

  if (req.method === "POST" && path === "/checkout/preview") {
    enforceRateLimit(req, "payment", paymentRateLimit);
    const user = await requireUser(req);
    const input = checkoutCreatePaymentOrderSchema.parse(await req.json());
    const summary = await buildCheckoutSummary(user.id, input);
    return json(req, 200, { summary });
  }

  if (req.method === "POST" && path === "/checkout/create-cod-order") {
    enforceRateLimit(req, "payment", paymentRateLimit);
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = checkoutCreatePaymentOrderSchema.parse(await req.json());
    const summary = await buildCheckoutSummary(user.id, input);
    if (!summary.cod.eligible) {
      throw new HttpError(400, summary.cod.reason ?? "COD is not available for this order");
    }
    const { count: codOrderCount, error: codCountError } = await adminDb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("payment_method", "cod");
    if (codCountError) throw codCountError;
    if ((codOrderCount ?? 0) >= 3) {
      throw new HttpError(400, "COD is available only for the first three COD orders");
    }

    const codReference = `cod_${crypto.randomUUID()}`;
    await storeCheckoutSession(codReference, {
      ...summary,
      userId: user.id,
      userEmail: user.email,
      address: input.address,
      saveAddress: input.saveAddress,
      createdAt: Date.now(),
    });

    const orderId = crypto.randomUUID();
    const address = input.address;
    const phone = phoneDigits(address.phone);
    const shippingAddress = buildShippingAddress(address);
    const tracking = [
      {
        label: "COD order placed",
        at: new Date().toISOString(),
        cod_reference: codReference,
        verified_by: "server",
      },
    ];

    const { data: completedOrderId, error: completeError } = await adminDb.rpc(
      "complete_checkout_payment",
      {
        p_order_id: orderId,
        p_user_id: user.id,
        p_order_payload: {
          status: "confirmed",
          payment_status: "cod_pending",
          payment_method: "cod",
          subtotal: summary.subtotal,
          shipping: summary.shipping,
          discount_total: summary.discountTotal,
          total: summary.total,
          coupon_id: summary.coupon?.id ?? null,
          coupon_code: summary.coupon?.code ?? null,
          shipping_name: address.fullName,
          shipping_phone: phone,
          shipping_email: address.email || user.email,
          shipping_address: shippingAddress,
          shipping_line1: address.line1,
          shipping_line2: address.line2 || null,
          shipping_city: address.city,
          shipping_state: address.state,
          shipping_pincode: address.pincode,
          shipping_country: "India",
          shipping_latitude: address.latitude,
          shipping_longitude: address.longitude,
          shipping_location_source: address.locationSource ?? null,
          shipping_place_id: address.olaPlaceId ?? null,
          shipping_formatted_address: address.formattedAddress || null,
          shipping_route_distance_meters: summary.deliveryEstimate.route.distanceMeters,
          shipping_route_duration_seconds: summary.deliveryEstimate.route.durationSeconds,
          shipping_estimate: summary.deliveryEstimate,
          delivery_promise_snapshot: summary.deliveryPromiseSnapshot,
          shipping_courier_company_id: summary.selectedCourier.courierCompanyId,
          shipping_courier_name: summary.selectedCourier.courierName,
          shipping_service_type: summary.selectedCourier.serviceType,
          shipping_expected_delivery_date: summary.selectedCourier.expectedDeliveryDate,
          shipping_charge_estimate: summary.selectedCourier.rate,
          tracking,
        },
        p_items: summary.items.map((item) => ({
          product_id: item.productId,
          title: item.title,
          image: item.image,
          brand: item.brand,
          price: item.price,
          unit_price: item.price,
          qty: item.qty,
        })),
        p_payment_payload: {
          provider: "cod",
          method: "cod",
          amount: summary.total,
          status: "pending",
          provider_order_id: codReference,
          provider_payment_id: null,
          provider_signature: null,
          raw_payload: {
            cod_reference: codReference,
            amount: summary.amountPaise,
            coupon: summary.coupon,
          },
        },
        p_address_payload: {
          full_name: address.fullName,
          phone,
          line1: address.line1,
          line2: address.line2 || null,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          latitude: address.latitude,
          longitude: address.longitude,
          location_source: address.locationSource ?? null,
          ola_place_id: address.olaPlaceId ?? null,
          formatted_address: address.formattedAddress || null,
        },
        p_save_address: input.saveAddress,
        p_checkout_session_razorpay_order_id: codReference,
      },
    );
    if (completeError) throw completeError;

    const finalOrderId = String(completedOrderId ?? orderId);
    await markCheckoutSessionPaid(codReference, finalOrderId);
    if (summary.coupon) {
      const { error: redemptionError } = await adminDb.from("coupon_redemptions").insert({
        coupon_id: summary.coupon.id,
        order_id: finalOrderId,
        user_id: user.id,
        discount_amount: summary.discountTotal,
      });
      if (redemptionError && redemptionError.code !== "23505") throw redemptionError;
    }
    await adminDb.from("order_invoices").upsert(
      {
        order_id: finalOrderId,
        invoice_number: invoiceNumberForOrder(finalOrderId),
        status: "generated",
      },
      { onConflict: "order_id" },
    );

    return json(req, 201, { orderId: finalOrderId, summary, codReference });
  }

  if (req.method === "POST" && path === "/checkout/create-payment-order") {
    enforceRateLimit(req, "payment", paymentRateLimit);
    const user = await requireUser(req);
    const input = checkoutCreatePaymentOrderSchema.parse(await req.json());
    const summary = await buildCheckoutSummary(user.id, input);
    const razorpayOrder = await createRazorpayOrder(
      summary.amountPaise,
      `lk_${Date.now()}_${user.id.slice(0, 8)}`,
      "INR",
    );
    await storeCheckoutSession(razorpayOrder.order_id, {
      ...summary,
      userId: user.id,
      userEmail: user.email,
      address: input.address,
      saveAddress: input.saveAddress,
      createdAt: Date.now(),
    });
    return json(req, 200, { razorpayOrder, summary });
  }

  if (req.method === "POST" && path === "/checkout/complete-payment") {
    enforceRateLimit(req, "payment", paymentRateLimit);
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = checkoutCompletePaymentSchema.parse(await req.json());
    const loadedSession = await loadCheckoutSession(input.razorpay_order_id);
    if (!loadedSession) {
      throw new HttpError(409, "Checkout session expired. Please create a new payment order.");
    }
    if (loadedSession.orderId && loadedSession.status === "paid") {
      return json(req, 200, { verified: true, orderId: loadedSession.orderId });
    }
    if (loadedSession.status !== "pending") {
      throw new HttpError(409, "Checkout session is already being processed");
    }
    const checkout = loadedSession.checkout;
    if (checkout.userId !== user.id) {
      throw new HttpError(403, "Checkout session belongs to another user");
    }

    const verified = await verifyRazorpaySignature({
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    if (!verified) throw new HttpError(400, "Razorpay signature verification failed");

    const { data: existingPayment, error: existingPaymentError } = await adminDb
      .from("payments")
      .select("order_id")
      .eq("provider_order_id", input.razorpay_order_id)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;
    if (existingPayment?.order_id) {
      await markCheckoutSessionPaid(input.razorpay_order_id, existingPayment.order_id);
      return json(req, 200, { verified: true, orderId: existingPayment.order_id });
    }

    const locked = await markCheckoutSessionProcessing(input.razorpay_order_id);
    if (!locked) throw new HttpError(409, "Checkout session is already being processed");

    const orderId = crypto.randomUUID();
    const address = checkout.address;
    const phone = phoneDigits(address.phone);
    const shippingAddress = buildShippingAddress(address);
    const tracking = [
      {
        label: "Order placed",
        at: new Date().toISOString(),
        razorpay_order_id: input.razorpay_order_id,
        razorpay_payment_id: input.razorpay_payment_id,
        verified_by: "server",
      },
    ];

    const { data: completedOrderId, error: completeError } = await adminDb.rpc(
      "complete_checkout_payment",
      {
        p_order_id: orderId,
        p_user_id: user.id,
        p_order_payload: {
          status: "confirmed",
          payment_status: "paid",
          payment_method: "razorpay",
          subtotal: checkout.subtotal,
          shipping: checkout.shipping,
          discount_total: checkout.discountTotal,
          total: checkout.total,
          coupon_id: checkout.coupon?.id ?? null,
          coupon_code: checkout.coupon?.code ?? null,
          shipping_name: address.fullName,
          shipping_phone: phone,
          shipping_email: address.email || checkout.userEmail,
          shipping_address: shippingAddress,
          shipping_line1: address.line1,
          shipping_line2: address.line2 || null,
          shipping_city: address.city,
          shipping_state: address.state,
          shipping_pincode: address.pincode,
          shipping_country: "India",
          shipping_latitude: address.latitude,
          shipping_longitude: address.longitude,
          shipping_location_source: address.locationSource ?? null,
          shipping_place_id: address.olaPlaceId ?? null,
          shipping_formatted_address: address.formattedAddress || null,
          shipping_route_distance_meters: checkout.deliveryEstimate.route.distanceMeters,
          shipping_route_duration_seconds: checkout.deliveryEstimate.route.durationSeconds,
          shipping_estimate: checkout.deliveryEstimate,
          delivery_promise_snapshot: checkout.deliveryPromiseSnapshot,
          shipping_courier_company_id: checkout.selectedCourier.courierCompanyId,
          shipping_courier_name: checkout.selectedCourier.courierName,
          shipping_service_type: checkout.selectedCourier.serviceType,
          shipping_expected_delivery_date: checkout.selectedCourier.expectedDeliveryDate,
          shipping_charge_estimate: checkout.selectedCourier.rate,
          tracking,
        },
        p_items: checkout.items.map((item) => ({
          product_id: item.productId,
          title: item.title,
          image: item.image,
          brand: item.brand,
          price: item.price,
          unit_price: item.price,
          qty: item.qty,
        })),
        p_payment_payload: {
          provider: "razorpay",
          method: "razorpay",
          amount: checkout.total,
          status: "paid",
          provider_order_id: input.razorpay_order_id,
          provider_payment_id: input.razorpay_payment_id,
          provider_signature: input.razorpay_signature,
          raw_payload: {
            razorpay_order_id: input.razorpay_order_id,
            razorpay_payment_id: input.razorpay_payment_id,
            amount: checkout.amountPaise,
            coupon: checkout.coupon,
          },
        },
        p_address_payload: {
          full_name: address.fullName,
          phone,
          line1: address.line1,
          line2: address.line2 || null,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          latitude: address.latitude,
          longitude: address.longitude,
          location_source: address.locationSource ?? null,
          ola_place_id: address.olaPlaceId ?? null,
          formatted_address: address.formattedAddress || null,
        },
        p_save_address: checkout.saveAddress,
        p_checkout_session_razorpay_order_id: input.razorpay_order_id,
      },
    );
    if (completeError) throw completeError;

    await markCheckoutSessionPaid(input.razorpay_order_id, String(completedOrderId ?? orderId));
    const finalOrderId = String(completedOrderId ?? orderId);
    if (checkout.coupon) {
      const { error: redemptionError } = await adminDb.from("coupon_redemptions").insert({
        coupon_id: checkout.coupon.id,
        order_id: finalOrderId,
        user_id: user.id,
        discount_amount: checkout.discountTotal,
      });
      if (redemptionError && redemptionError.code !== "23505") throw redemptionError;
    }
    await adminDb.from("order_invoices").upsert(
      {
        order_id: finalOrderId,
        invoice_number: invoiceNumberForOrder(finalOrderId),
        status: "generated",
      },
      { onConflict: "order_id" },
    );
    return json(req, 200, { verified: true, orderId: finalOrderId });
  }

  if (req.method === "GET" && path === "/maps/autocomplete") {
    enforceRateLimit(req, "map", mapRateLimit);
    await requireUser(req);
    const input = autocompleteQuerySchema.parse(parseQueryObject(url));
    const suggestions = await autocompleteOlaPlaces(
      input.input,
      input.latitude !== undefined && input.longitude !== undefined
        ? { latitude: input.latitude, longitude: input.longitude }
        : undefined,
    );
    return json(req, 200, { suggestions });
  }

  if (req.method === "GET" && path === "/maps/reverse-geocode") {
    enforceRateLimit(req, "map", mapRateLimit);
    await requireUser(req);
    const input = reverseGeocodeQuerySchema.parse(parseQueryObject(url));
    return json(req, 200, await reverseGeocodeOlaPlace(input.latitude, input.longitude));
  }

  if (req.method === "GET" && path === "/maps/delivery-estimate") {
    enforceRateLimit(req, "map", mapRateLimit);
    await requireUser(req);
    const input = deliveryEstimateQuerySchema.parse(parseQueryObject(url));
    const [route, couriers] = await Promise.all([
      getOlaDeliveryRoute(input),
      getShiprocketDeliveryQuotes({
        deliveryPincode: input.pincode,
        deliveryLatitude: input.latitude,
        deliveryLongitude: input.longitude,
        weightKg: input.weightKg,
        declaredValue: input.declaredValue,
      }),
    ]);
    return json(req, 200, {
      dispatch: {
        pickupLocation: config.shiprocketPickupLocation,
        pincode: config.lapkartDispatchPincode,
      },
      route,
      couriers,
      generatedAt: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && path === "/shiprocket/status") {
    await requireAdmin(req);
    const verify = url.searchParams.get("verify");
    if (verify !== "1" && verify !== "true") {
      return json(req, 200, {
        configured: Boolean(
          config.shiprocketEmail && config.shiprocketPassword && config.shiprocketPickupLocation,
        ),
        pickupLocationConfigured: Boolean(config.shiprocketPickupLocation),
      });
    }
    await getShiprocketToken({ forceRefresh: true });
    return json(req, 200, { configured: true, authenticated: true });
  }

  if (req.method === "GET" && path === "/shiprocket/account") {
    await requireAdmin(req);
    const [walletBalance, pickupResponse] = await Promise.all([
      getShiprocketWalletBalance(),
      getShiprocketPickupLocations(),
    ]);
    const pickupLocations = pickupResponse.data?.shipping_address ?? [];
    await syncShiprocketPickupLocations(pickupLocations);
    const configuredPickup = pickupLocations.find(
      (location) => String(location.pickup_location ?? "") === config.shiprocketPickupLocation,
    );
    return json(req, 200, {
      walletBalance,
      configuredPickupLocation: config.shiprocketPickupLocation,
      pickupLocationVerified: Boolean(configuredPickup),
      pickupLocations: pickupLocations.map((location) => ({
        id: location.id ?? null,
        pickupLocation: location.pickup_location ?? null,
        pincode: location.pin_code ?? null,
        city: location.city ?? null,
        state: location.state ?? null,
        latitude: location.lat ?? null,
        longitude: location.long ?? null,
        primary: Number(location.is_primary_location) === 1,
        active: Number(location.status ?? 1) !== 0,
      })),
    });
  }

  if (req.method === "GET" && path === "/admin/fulfillment/orders") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { data: orders, error: ordersError } = await adminDb
      .from("orders")
      .select(
        "id,created_at,status,total,shipping_name,shipping_city,shipping_state,shipping_pincode,shipping_service_type",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (ordersError) throw ordersError;

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: shipments, error: shipmentsError } = orderIds.length
      ? await adminDb
          .from("shipments")
          .select("*")
          .in("order_id", orderIds)
          .eq("provider", "shiprocket")
          .eq("shipping_direction", "outbound")
      : { data: [], error: null };
    if (shipmentsError) throw shipmentsError;

    const shipmentIds = (shipments ?? []).map((shipment) => String(shipment.id));
    const { data: events, error: eventsError } = shipmentIds.length
      ? await adminDb
          .from("shipment_events")
          .select("shipment_id,status,status_time,location,message,received_at")
          .in("shipment_id", shipmentIds)
          .order("status_time", { ascending: false })
      : { data: [], error: null };
    if (eventsError) throw eventsError;

    const items = await getOrderItemsWithSku(orderIds);
    const shipmentsByOrder = new Map(
      (shipments ?? []).map((shipment) => [shipment.order_id, shipment]),
    );
    const shipmentEventsByShipment = groupShipmentEvents(events ?? []);
    const itemsByOrder = new Map<
      string,
      Array<{
        id: string;
        title: string;
        image: string;
        brand: string;
        qty: number;
        sku: string | null;
      }>
    >();

    for (const item of items) {
      if (!item.order_id) continue;
      const rows = itemsByOrder.get(item.order_id) ?? [];
      rows.push({
        id: item.id,
        title: item.title,
        image: item.image,
        brand: item.brand,
        qty: item.qty,
        sku: item.sku,
      });
      itemsByOrder.set(item.order_id, rows);
    }

    return json(req, 200, {
      orders: (orders ?? []).map((order) => ({
        id: order.id,
        createdAt: order.created_at,
        status: order.status,
        total: order.total,
        shippingName: order.shipping_name,
        shippingCity: order.shipping_city,
        shippingState: order.shipping_state,
        shippingPincode: order.shipping_pincode,
        shippingServiceType: order.shipping_service_type,
        items: itemsByOrder.get(order.id) ?? [],
        shipment: toFulfillmentShipment(
          shipmentsByOrder.get(order.id),
          shipmentEventsByShipment.get(String(shipmentsByOrder.get(order.id)?.id ?? "")),
        ),
      })),
    });
  }

  const orderTrackingMatch = matchRoute(path, /^\/orders\/([^/]+)\/tracking$/);
  if (req.method === "GET" && orderTrackingMatch) {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { orderId } = orderIdParamSchema.parse({ orderId: orderTrackingMatch[1] });
    const { data: order, error: orderError } = await adminDb
      .from("orders")
      .select(
        "id,user_id,total,subtotal,shipping,discount_total,coupon_code,status,payment_status,shipping_name,shipping_address,shipping_courier_name,shipping_expected_delivery_date,shipping_route_distance_meters,shipping_route_duration_seconds,shipping_service_type,created_at,updated_at",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || String(order.user_id) !== user.id) {
      throw new HttpError(404, "Order not found");
    }
    const [
      { data: items, error: itemsError },
      { data: shipment, error: shipmentError },
      cancellationsResult,
      returnsResult,
      refundsResult,
      invoiceResult,
    ] = await Promise.all([
      adminDb.from("order_items").select("id,title,image,brand,price,qty").eq("order_id", orderId),
      adminDb
        .from("shipments")
        .select("*")
        .eq("order_id", orderId)
        .eq("provider", "shiprocket")
        .eq("shipping_direction", "outbound")
        .maybeSingle(),
      adminDb
        .from("order_cancellation_requests")
        .select("id,status,reason,admin_note,requested_at,resolved_at,refund_id")
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false }),
      adminDb
        .from("return_requests")
        .select(
          "id,status,reason,condition_notes,photos,admin_note,requested_at,resolved_at,received_at,reverse_shipment_id,refund_id",
        )
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false }),
      adminDb
        .from("refunds")
        .select(
          "id,amount,status,speed,provider_refund_id,reason,created_at,processed_at,cancellation_request_id,return_request_id",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
      adminDb
        .from("order_invoices")
        .select("id,invoice_number,invoice_url,status,generated_at")
        .eq("order_id", orderId)
        .maybeSingle(),
    ]);
    if (itemsError) throw itemsError;
    if (shipmentError) throw shipmentError;
    if (cancellationsResult.error) throw cancellationsResult.error;
    if (returnsResult.error) throw returnsResult.error;
    if (refundsResult.error) throw refundsResult.error;
    if (invoiceResult.error) throw invoiceResult.error;
    const { data: events, error: eventsError } = shipment?.id
      ? await adminDb
          .from("shipment_events")
          .select("shipment_id,status,status_time,location,message,received_at")
          .eq("shipment_id", String(shipment.id))
          .order("status_time", { ascending: false })
      : { data: [], error: null };
    if (eventsError) throw eventsError;
    const groupedEvents = groupShipmentEvents(events ?? []);
    return json(req, 200, {
      order: {
        id: order.id,
        total: Number(order.total ?? 0),
        subtotal: Number(order.subtotal ?? 0),
        shipping: Number(order.shipping ?? 0),
        discount_total: Number(order.discount_total ?? 0),
        coupon_code: firstString(order.coupon_code),
        status: String(order.status ?? ""),
        payment_status: String(order.payment_status ?? ""),
        shipping_name: String(order.shipping_name ?? ""),
        shipping_address: String(order.shipping_address ?? ""),
        shipping_courier_name: firstString(order.shipping_courier_name),
        shipping_expected_delivery_date: firstString(order.shipping_expected_delivery_date),
        shipping_route_distance_meters:
          order.shipping_route_distance_meters === null
            ? null
            : Number(order.shipping_route_distance_meters),
        shipping_route_duration_seconds:
          order.shipping_route_duration_seconds === null
            ? null
            : Number(order.shipping_route_duration_seconds),
        shipping_service_type: String(order.shipping_service_type ?? "standard"),
        created_at: String(order.created_at),
      },
      items: (items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        image: item.image,
        brand: item.brand,
        price: Number(item.price ?? 0),
        qty: Number(item.qty ?? 0),
      })),
      shipment: toFulfillmentShipment(
        shipment as Record<string, unknown> | undefined,
        groupedEvents.get(String(shipment?.id ?? "")),
      ),
      cancellationRequests: cancellationsResult.data ?? [],
      returnRequests: returnsResult.data ?? [],
      refunds: refundsResult.data ?? [],
      invoice: invoiceResult.data ?? null,
      capabilities: {
        canCancel: canRequestCancellation(order, shipment as Record<string, unknown> | null),
        canReturn: canRequestReturn(order, shipment as Record<string, unknown> | null),
      },
    });
  }

  const invoiceMatch = matchRoute(path, /^\/orders\/([^/]+)\/invoice$/);
  if (req.method === "GET" && invoiceMatch) {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { orderId } = orderIdParamSchema.parse({ orderId: invoiceMatch[1] });
    const [{ data: order, error: orderError }, { data: items, error: itemsError }, invoiceResult] =
      await Promise.all([
        adminDb
          .from("orders")
          .select(
            "id,user_id,created_at,subtotal,shipping,discount_total,total,coupon_code,shipping_name,shipping_phone,shipping_address",
          )
          .eq("id", orderId)
          .maybeSingle(),
        adminDb
          .from("order_items")
          .select("title,brand,price,unit_price,qty")
          .eq("order_id", orderId),
        adminDb
          .from("order_invoices")
          .select("invoice_number")
          .eq("order_id", orderId)
          .maybeSingle(),
      ]);
    if (orderError) throw orderError;
    if (itemsError) throw itemsError;
    if (invoiceResult.error) throw invoiceResult.error;
    if (!order || String(order.user_id) !== user.id) {
      throw new HttpError(404, "Invoice not found");
    }
    const invoiceNumber =
      typeof invoiceResult.data?.invoice_number === "string"
        ? invoiceResult.data.invoice_number
        : invoiceNumberForOrder(orderId);
    const html = renderInvoiceHtml({
      order: order as Record<string, unknown>,
      items: (items ?? []) as Array<Record<string, unknown>>,
      invoiceNumber,
    });
    return text(req, 200, html, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${invoiceNumber}.html"`,
    });
  }

  const cancellationRequestMatch = matchRoute(path, /^\/orders\/([^/]+)\/cancellation-requests$/);
  if (req.method === "POST" && cancellationRequestMatch) {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { orderId } = orderIdParamSchema.parse({ orderId: cancellationRequestMatch[1] });
    const input = cancellationRequestSchema.parse(await req.json());
    const [{ data: order, error: orderError }, { data: shipment, error: shipmentError }] =
      await Promise.all([
        adminDb.from("orders").select("*").eq("id", orderId).maybeSingle(),
        adminDb.from("shipments").select("*").eq("order_id", orderId).maybeSingle(),
      ]);
    if (orderError) throw orderError;
    if (shipmentError) throw shipmentError;
    if (!order || order.user_id !== user.id) throw new HttpError(404, "Order not found");
    if (!canRequestCancellation(order, shipment)) {
      throw new HttpError(409, "This order can no longer be cancelled from self-service");
    }
    const { data, error } = await adminDb
      .from("order_cancellation_requests")
      .insert({ order_id: orderId, user_id: user.id, reason: input.reason })
      .select("*")
      .single();
    if (error) throw error;
    await adminDb.from("orders").update({ status: "cancellation_requested" }).eq("id", orderId);
    return json(req, 201, { cancellationRequest: data });
  }

  const returnRequestMatch = matchRoute(path, /^\/orders\/([^/]+)\/return-requests$/);
  if (req.method === "POST" && returnRequestMatch) {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { orderId } = orderIdParamSchema.parse({ orderId: returnRequestMatch[1] });
    const input = returnRequestSchema.parse(await req.json());
    const [{ data: order, error: orderError }, { data: shipment, error: shipmentError }] =
      await Promise.all([
        adminDb.from("orders").select("*").eq("id", orderId).maybeSingle(),
        adminDb.from("shipments").select("*").eq("order_id", orderId).maybeSingle(),
      ]);
    if (orderError) throw orderError;
    if (shipmentError) throw shipmentError;
    if (!order || order.user_id !== user.id) throw new HttpError(404, "Order not found");
    if (!canRequestReturn(order, shipment)) {
      throw new HttpError(409, "This order is not currently eligible for return self-service");
    }
    const { data: orderItems, error: itemsError } = await adminDb
      .from("order_items")
      .select("id,qty")
      .eq("order_id", orderId);
    if (itemsError) throw itemsError;
    const qtyByItem = new Map((orderItems ?? []).map((item) => [item.id, Number(item.qty ?? 0)]));
    for (const item of input.items) {
      const purchasedQty = qtyByItem.get(item.orderItemId) ?? 0;
      if (item.qty > purchasedQty)
        throw new HttpError(400, "Return quantity exceeds purchased quantity");
    }
    const { data: returnRequest, error: returnError } = await adminDb
      .from("return_requests")
      .insert({
        order_id: orderId,
        user_id: user.id,
        reason: input.reason,
        condition_notes: input.conditionNotes || null,
        photos: input.photos,
      })
      .select("*")
      .single();
    if (returnError) throw returnError;
    const { error: returnItemsError } = await adminDb.from("return_request_items").insert(
      input.items.map((item) => ({
        return_request_id: returnRequest.id,
        order_item_id: item.orderItemId,
        qty: item.qty,
        reason: item.reason || null,
      })),
    );
    if (returnItemsError) throw returnItemsError;
    await adminDb.from("orders").update({ status: "return_requested" }).eq("id", orderId);
    return json(req, 201, { returnRequest });
  }

  if (req.method === "GET" && path === "/wishlist") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { data, error } = await adminDb
      .from("wishlist_items")
      .select(
        "id,product_id,created_at,products(id,title,brand,category,image,price,mrp,rating,reviews,stock)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return json(req, 200, { items: data ?? [] });
  }

  if (req.method === "POST" && path === "/wishlist") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = wishlistRequestSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("wishlist_items")
      .upsert(
        { user_id: user.id, product_id: input.productId },
        { onConflict: "user_id,product_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { item: data });
  }

  const wishlistDeleteMatch = matchRoute(path, /^\/wishlist\/([^/]+)$/);
  if (req.method === "DELETE" && wishlistDeleteMatch) {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { productId } = productIdParamSchema.parse({ productId: wishlistDeleteMatch[1] });
    const { error } = await adminDb
      .from("wishlist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", productId);
    if (error) throw error;
    return json(req, 200, { deleted: true });
  }

  if (req.method === "POST" && path === "/product-reviews") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = productReviewSchema.parse(await req.json());
    let verifiedPurchase = false;
    if (input.orderId) {
      const [{ data: order }, { data: item }] = await Promise.all([
        adminDb.from("orders").select("id,user_id").eq("id", input.orderId).maybeSingle(),
        adminDb
          .from("order_items")
          .select("id")
          .eq("product_id", input.productId)
          .eq("order_id", input.orderId)
          .maybeSingle(),
      ]);
      verifiedPurchase = Boolean(order?.user_id === user.id && item);
    }
    const { data, error } = await adminDb
      .from("product_reviews")
      .insert({
        user_id: user.id,
        product_id: input.productId,
        order_id: input.orderId ?? null,
        rating: input.rating,
        title: input.title || null,
        body: input.body,
        verified_purchase: verifiedPurchase,
      })
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 201, { review: data });
  }

  if (req.method === "POST" && path === "/stock-notifications") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = stockNotificationSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("stock_notifications")
      .upsert(
        { user_id: user.id, product_id: input.productId, email: input.email, status: "active" },
        { onConflict: "product_id,email" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { notification: data });
  }

  if (req.method === "GET" && path === "/account/business") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const { data, error } = await adminDb
      .from("business_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return json(req, 200, { businessAccount: data ?? null });
  }

  if (req.method === "PATCH" && path === "/account/business") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = businessAccountSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("business_accounts")
      .upsert(
        {
          user_id: user.id,
          shop_name: input.shopName,
          gstin: input.gstin ? input.gstin.toUpperCase() : null,
          business_phone: input.businessPhone ?? null,
          billing_email: input.billingEmail ?? user.email,
          billing_address: input.billingAddress ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          pincode: input.pincode ?? null,
          verification_status: "pending",
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { businessAccount: data });
  }

  const productQuestionsMatch = matchRoute(path, /^\/products\/([^/]+)\/questions$/);
  if (req.method === "GET" && productQuestionsMatch) {
    const adminDb = getSupabaseAdmin();
    const { productId } = productIdParamSchema.parse({ productId: productQuestionsMatch[1] });
    const { data, error } = await adminDb
      .from("product_questions")
      .select("id,question,answer,status,created_at,answered_at")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;
    return json(req, 200, { questions: data ?? [] });
  }

  if (req.method === "POST" && path === "/product-questions") {
    const adminDb = getSupabaseAdmin();
    const user = await requireUser(req);
    const input = productQuestionSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("product_questions")
      .insert({
        product_id: input.productId,
        user_id: user.id,
        question: input.question,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 201, { question: data });
  }

  if (req.method === "GET" && path === "/admin/product-questions") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { data, error } = await adminDb
      .from("product_questions")
      .select("*,products(id,title,image,brand)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return json(req, 200, { questions: data ?? [] });
  }

  const adminQuestionMatch = matchRoute(path, /^\/admin\/product-questions\/([^/]+)$/);
  if (req.method === "PATCH" && adminQuestionMatch) {
    const adminDb = getSupabaseAdmin();
    const adminUser = await requireAdmin(req);
    const { orderId: questionId } = orderIdParamSchema.parse({ orderId: adminQuestionMatch[1] });
    const input = adminQuestionUpdateSchema.parse(await req.json());
    const payload: Record<string, unknown> = {};
    if ("answer" in input) {
      payload.answer = input.answer || null;
      payload.answered_by = adminUser.id;
      payload.answered_at = input.answer ? new Date().toISOString() : null;
    }
    if (input.status) payload.status = input.status;
    if (Object.keys(payload).length === 0) throw new HttpError(400, "No question update supplied");
    const { data, error } = await adminDb
      .from("product_questions")
      .update(payload)
      .eq("id", questionId)
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { question: data });
  }

  if (req.method === "GET" && path === "/admin/stock-notification-events") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { data, error } = await adminDb
      .from("stock_notification_events")
      .select("*,products(id,title,image,brand,stock)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return json(req, 200, { events: data ?? [] });
  }

  const adminStockEventMatch = matchRoute(path, /^\/admin\/stock-notification-events\/([^/]+)$/);
  const adminStockEventSendMatch = matchRoute(
    path,
    /^\/admin\/stock-notification-events\/([^/]+)\/send$/,
  );
  if (req.method === "POST" && adminStockEventSendMatch) {
    await requireAdmin(req);
    const { orderId: eventId } = orderIdParamSchema.parse({
      orderId: adminStockEventSendMatch[1],
    });
    const event = await sendStockNotificationEvent(eventId);
    return json(req, 200, { event });
  }

  if (req.method === "PATCH" && adminStockEventMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { orderId: eventId } = orderIdParamSchema.parse({ orderId: adminStockEventMatch[1] });
    const input = z
      .object({ status: z.enum(["pending", "sent", "failed", "cancelled"]) })
      .parse(await req.json());
    const { data, error } = await adminDb
      .from("stock_notification_events")
      .update({
        status: input.status,
        processed_at: input.status === "pending" ? null : new Date().toISOString(),
      })
      .eq("id", eventId)
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { event: data });
  }

  const adminCancellationMatch = matchRoute(path, /^\/admin\/cancellation-requests\/([^/]+)$/);
  if (req.method === "POST" && adminCancellationMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { orderId: cancellationId } = orderIdParamSchema.parse({
      orderId: adminCancellationMatch[1],
    });
    const input = adminWorkflowActionSchema.parse(await req.json());
    const status =
      input.action === "approve"
        ? "refund_pending"
        : input.action === "reject"
          ? "rejected"
          : "closed";
    const { data: requestRow, error: requestError } = await adminDb
      .from("order_cancellation_requests")
      .update({
        status,
        admin_note: input.note || null,
        resolved_at:
          input.action === "reject" || input.action === "close" ? new Date().toISOString() : null,
      })
      .eq("id", cancellationId)
      .select("*")
      .single();
    if (requestError) throw requestError;
    if (input.action === "approve") {
      await adminDb.from("orders").update({ status: "cancelled" }).eq("id", requestRow.order_id);
    }
    return json(req, 200, { cancellationRequest: requestRow });
  }

  const adminReturnMatch = matchRoute(path, /^\/admin\/return-requests\/([^/]+)$/);
  if (req.method === "POST" && adminReturnMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { orderId: returnRequestId } = orderIdParamSchema.parse({ orderId: adminReturnMatch[1] });
    const input = adminWorkflowActionSchema.parse(await req.json());
    const status =
      input.action === "approve"
        ? "approved"
        : input.action === "reject"
          ? "rejected"
          : input.action === "receive"
            ? "refund_pending"
            : "closed";
    const { data: requestRow, error: requestError } = await adminDb
      .from("return_requests")
      .update({
        status,
        admin_note: input.note || null,
        received_at: input.action === "receive" ? new Date().toISOString() : undefined,
        resolved_at:
          input.action === "reject" || input.action === "close"
            ? new Date().toISOString()
            : undefined,
      })
      .eq("id", returnRequestId)
      .select("*")
      .single();
    if (requestError) throw requestError;
    if (input.action === "approve") {
      await adminDb
        .from("orders")
        .update({ status: "return_approved" })
        .eq("id", requestRow.order_id);
    }
    if (input.action === "receive") {
      await adminDb
        .from("orders")
        .update({ status: "return_received" })
        .eq("id", requestRow.order_id);
    }
    return json(req, 200, { returnRequest: requestRow });
  }

  if (req.method === "POST" && path === "/admin/refunds") {
    const adminDb = getSupabaseAdmin();
    const adminUser = await requireAdmin(req);
    const input = adminRefundSchema.parse(await req.json());
    const [{ data: order, error: orderError }, { data: payment, error: paymentError }] =
      await Promise.all([
        adminDb.from("orders").select("*").eq("id", input.orderId).maybeSingle(),
        adminDb
          .from("payments")
          .select("*")
          .eq("order_id", input.orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (orderError) throw orderError;
    if (paymentError) throw paymentError;
    if (!order) throw new HttpError(404, "Order not found");
    const { data: existingRefunds, error: existingRefundsError } = await adminDb
      .from("refunds")
      .select("amount,status")
      .eq("order_id", input.orderId)
      .not("status", "in", "(failed,cancelled)");
    if (existingRefundsError) throw existingRefundsError;
    const alreadyRefunded = roundMoney(
      (existingRefunds ?? []).reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0),
    );
    const paidAmount = roundMoney(Number(payment?.amount ?? order.total ?? 0));
    const refundableRemaining = roundMoney(Math.max(0, paidAmount - alreadyRefunded));
    const requestedAmount = roundMoney(input.amount ?? refundableRemaining);
    if (requestedAmount <= 0) throw new HttpError(400, "Refund amount must be positive");
    if (refundableRemaining <= 0) {
      throw new HttpError(409, "This order has no refundable balance remaining");
    }
    if (requestedAmount > refundableRemaining) {
      throw new HttpError(
        400,
        `Refund amount cannot exceed remaining refundable balance (${formatCurrencyForError(refundableRemaining)})`,
      );
    }
    if (!payment) throw new HttpError(409, "Order does not have a payment record");
    if (String(payment?.provider ?? "").toLowerCase() === "cod") {
      const { data: refundRow, error: refundInsertError } = await adminDb
        .from("refunds")
        .insert({
          order_id: input.orderId,
          payment_id: payment.id,
          cancellation_request_id: input.cancellationRequestId ?? null,
          return_request_id: input.returnRequestId ?? null,
          provider: "razorpay",
          amount: requestedAmount,
          status: "processed",
          reason: input.reason,
          speed: input.speed,
          requested_by: adminUser.id,
          raw_payload: { provider: "cod", note: "No online payment was captured" },
          processed_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (refundInsertError) throw refundInsertError;
      if (input.cancellationRequestId) {
        await adminDb
          .from("order_cancellation_requests")
          .update({
            status: "closed",
            refund_id: refundRow.id,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", input.cancellationRequestId);
      }
      if (input.returnRequestId) {
        await adminDb
          .from("return_requests")
          .update({
            status: "refunded",
            refund_id: refundRow.id,
            resolved_at: new Date().toISOString(),
          })
          .eq("id", input.returnRequestId);
      }
      await adminDb
        .from("orders")
        .update({ payment_status: "cod_cancelled" })
        .eq("id", input.orderId);
      return json(req, 200, { refund: refundRow, cod: true });
    }
    if (!payment?.provider_payment_id)
      throw new HttpError(409, "Order does not have a Razorpay payment id");
    const { data: refundRow, error: refundInsertError } = await adminDb
      .from("refunds")
      .insert({
        order_id: input.orderId,
        payment_id: payment.id,
        cancellation_request_id: input.cancellationRequestId ?? null,
        return_request_id: input.returnRequestId ?? null,
        amount: requestedAmount,
        status: "pending",
        reason: input.reason,
        speed: input.speed,
        requested_by: adminUser.id,
      })
      .select("*")
      .single();
    if (refundInsertError) throw refundInsertError;
    let providerRefund: Record<string, unknown>;
    try {
      providerRefund = await createRazorpayRefund({
        paymentId: String(payment.provider_payment_id),
        amountPaise: toPaise(requestedAmount),
        speed: input.speed,
        notes: {
          lapkart_order_id: input.orderId,
          lapkart_refund_id: refundRow.id,
          reason: input.reason.slice(0, 256),
        },
      });
    } catch (error) {
      await adminDb
        .from("refunds")
        .update({
          status: "failed",
          raw_payload: {
            error: error instanceof Error ? error.message : String(error),
            failed_at: new Date().toISOString(),
          },
        })
        .eq("id", refundRow.id);
      throw error;
    }
    const providerStatus = String(providerRefund.status ?? "created").toLowerCase();
    const { data: updatedRefund, error: refundUpdateError } = await adminDb
      .from("refunds")
      .update({
        provider_refund_id: firstString(providerRefund.id),
        status: providerStatus === "processed" ? "processed" : "created",
        raw_payload: providerRefund,
        processed_at: providerStatus === "processed" ? new Date().toISOString() : null,
      })
      .eq("id", refundRow.id)
      .select("*")
      .single();
    if (refundUpdateError) throw refundUpdateError;
    const totalRefundedAfterThis = roundMoney(alreadyRefunded + requestedAmount);
    const nextPaymentStatus =
      totalRefundedAfterThis >= paidAmount ? "refunded" : "partially_refunded";
    if (input.cancellationRequestId) {
      await adminDb
        .from("order_cancellation_requests")
        .update({
          status: "refunded",
          refund_id: refundRow.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.cancellationRequestId);
      await adminDb
        .from("orders")
        .update({ payment_status: nextPaymentStatus })
        .eq("id", input.orderId);
    }
    if (input.returnRequestId) {
      await adminDb
        .from("return_requests")
        .update({
          status: "refunded",
          refund_id: refundRow.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.returnRequestId);
      await adminDb
        .from("orders")
        .update({ payment_status: nextPaymentStatus })
        .eq("id", input.orderId);
    }
    if (!input.cancellationRequestId && !input.returnRequestId) {
      await adminDb
        .from("orders")
        .update({ payment_status: nextPaymentStatus })
        .eq("id", input.orderId);
    }
    return json(req, 200, {
      refund: updatedRefund,
      razorpay: providerRefund,
      refundable: {
        paidAmount,
        alreadyRefunded,
        refundedNow: requestedAmount,
        remaining: roundMoney(Math.max(0, paidAmount - totalRefundedAfterThis)),
      },
    });
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/create") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    requireLivePaymentEnvironment();
    const input = createShiprocketShipmentSchema.parse(await req.json());
    const { shipment, shiprocket: response } = await createShiprocketShipmentForOrder(
      adminDb,
      input,
    );
    return json(req, 200, { shipment, shiprocket: response });
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/assign-awb") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    requireLivePaymentEnvironment();
    const input = assignAwbSchema.parse(await req.json());
    const { data: shipment, error: shipmentError } = await adminDb
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment?.shiprocket_shipment_id) {
      throw new HttpError(400, "Shipment does not have a Shiprocket shipment id");
    }
    const response = await assignShiprocketAwb({
      shipment_id: shipment.shiprocket_shipment_id,
      courier_id: input.courierId ?? shipment.courier_company_id ?? undefined,
    });
    const awbData = getAwbData(response);
    if (Number(response.awb_assign_status ?? 1) !== 1) {
      throw new Error(
        firstString(awbData.awb_assign_error, response.message) ??
          "Shiprocket AWB assignment failed",
      );
    }
    const awbCode = firstString(awbData.awb_code, shipment.awb_code);
    const courierName = firstString(awbData.courier_name, shipment.courier_name);
    const courierCompanyId = Number(
      awbData.courier_company_id ?? input.courierId ?? shipment.courier_company_id,
    );
    const { data: updatedShipment, error: updateError } = await adminDb
      .from("shipments")
      .update({
        status: "awb_assigned",
        awb_code: awbCode,
        courier_company_id: Number.isFinite(courierCompanyId) ? courierCompanyId : null,
        courier_name: courierName,
        raw_awb_response: response,
        raw_payload: response,
        last_status_at: new Date().toISOString(),
      })
      .eq("id", input.shipmentId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    let tracking = null;
    if (shipment.shipping_service_type === "quick") {
      try {
        tracking = await refreshShiprocketTracking(updatedShipment);
      } catch {
        tracking = null;
      }
    }
    return json(req, 200, {
      shipment: tracking?.shipment ?? updatedShipment,
      shiprocket: response,
      tracking: tracking?.tracking ?? null,
      dispatchMode:
        shipment.shipping_service_type === "quick"
          ? "quick_rider_requested"
          : "standard_awb_assigned",
    });
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/pickup") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    requireLivePaymentEnvironment();
    const input = shipmentIdSchema.parse(await req.json());
    const { data: shipment, error: shipmentError } = await adminDb
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment?.shiprocket_shipment_id) {
      throw new HttpError(400, "Shipment does not have a Shiprocket shipment id");
    }
    if (shipment.shipping_service_type === "quick") {
      throw new HttpError(
        400,
        "Shiprocket Quick rider assignment is triggered during AWB assignment",
      );
    }
    if (!shipment.awb_code) throw new HttpError(400, "Assign an AWB before scheduling pickup");
    const pickup = await requestShiprocketPickup(shipment.shiprocket_shipment_id);
    if (Number(pickup.pickup_status ?? 1) !== 1) {
      throw new Error(firstString(pickup.message) ?? "Shiprocket pickup scheduling failed");
    }
    const pickupData = getPickupData(pickup);
    let manifest: Record<string, unknown> | null = null;
    let manifestError: string | null = null;
    try {
      manifest = await generateShiprocketManifest([shipment.shiprocket_shipment_id]);
    } catch (error) {
      manifestError =
        error instanceof Error ? error.message : "Could not generate Shiprocket manifest";
    }
    const manifestUrl = firstString(
      pickupData.manifest_url,
      pickup.manifest_url,
      manifest?.manifest_url,
    );
    const pickupScheduledDate = toDateOnly(
      pickupData.pickup_scheduled_date ?? pickup.pickup_scheduled_date ?? new Date().toISOString(),
    );
    const { data: updatedShipment, error: updateError } = await adminDb
      .from("shipments")
      .update({
        status: manifestUrl ? "manifest_generated" : "pickup_scheduled",
        pickup_scheduled_date: pickupScheduledDate,
        manifest_url: manifestUrl,
        raw_payload: { pickup, manifest },
        last_status_at: new Date().toISOString(),
      })
      .eq("id", input.shipmentId)
      .select("*")
      .single();
    if (updateError) throw updateError;
    return json(req, 200, { shipment: updatedShipment, pickup, manifest, manifestError });
  }

  const shipmentTrackingMatch = matchRoute(path, /^\/shipments\/shiprocket\/([^/]+)\/tracking$/);
  if (req.method === "GET" && shipmentTrackingMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const input = shipmentIdSchema.parse({ shipmentId: shipmentTrackingMatch[1] });
    const { data: shipment, error: shipmentError } = await adminDb
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) throw new HttpError(404, "Shipment not found");
    return json(req, 200, await refreshShiprocketTracking(shipment));
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/return") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    requireLivePaymentEnvironment();
    const input = reversePickupSchema.parse(await req.json());
    const { data: returnRequest, error: returnRequestError } = await adminDb
      .from("return_requests")
      .select("*")
      .eq("id", input.returnRequestId)
      .maybeSingle();
    if (returnRequestError) throw returnRequestError;
    if (!returnRequest) throw new HttpError(404, "Return request not found");
    if (!["approved", "reverse_pickup_scheduled"].includes(String(returnRequest.status))) {
      throw new HttpError(409, "Approve the return before creating a reverse pickup");
    }
    if (returnRequest.reverse_shipment_id) {
      const { data: existingShipment, error: existingShipmentError } = await adminDb
        .from("shipments")
        .select("*")
        .eq("id", returnRequest.reverse_shipment_id)
        .maybeSingle();
      if (existingShipmentError) throw existingShipmentError;
      return json(req, 200, { shipment: existingShipment, alreadyCreated: true });
    }

    const [
      { data: order, error: orderError },
      { data: returnItems, error: returnItemsError },
      { data: pickupLocation, error: pickupLocationError },
      { data: latestShipment, error: latestShipmentError },
    ] = await Promise.all([
      adminDb.from("orders").select("*").eq("id", returnRequest.order_id).maybeSingle(),
      adminDb
        .from("return_request_items")
        .select("order_item_id,qty,reason")
        .eq("return_request_id", input.returnRequestId),
      adminDb
        .from("shipping_pickup_locations")
        .select("*")
        .eq("provider", "shiprocket")
        .eq("pickup_location", config.shiprocketPickupLocation)
        .eq("is_active", true)
        .maybeSingle(),
      adminDb
        .from("shipments")
        .select("shipment_number")
        .eq("order_id", returnRequest.order_id)
        .order("shipment_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (orderError) throw orderError;
    if (returnItemsError) throw returnItemsError;
    if (pickupLocationError) throw pickupLocationError;
    if (latestShipmentError) throw latestShipmentError;
    if (!order) throw new HttpError(404, "Return order was not found");
    if (!pickupLocation) throw new HttpError(400, "Shiprocket pickup location is not synced");

    const orderItems = await getOrderItemsWithSku([String(returnRequest.order_id)]);
    const returnQtyByOrderItem = new Map(
      (returnItems ?? []).map((item) => [
        String(item.order_item_id),
        { qty: Number(item.qty ?? 0), reason: firstString(item.reason) },
      ]),
    );
    const selectedItems = orderItems
      .filter((item) => returnQtyByOrderItem.has(item.id))
      .map((item) => {
        const returnItem = returnQtyByOrderItem.get(item.id);
        return {
          ...item,
          return_qty: returnItem?.qty ?? item.qty,
          return_reason: returnItem?.reason ?? firstString(returnRequest.reason),
          product_image: item.image,
        };
      });
    if (!selectedItems.length) throw new HttpError(400, "Return request has no items");

    const payload = toShiprocketReturnOrderPayload({
      order,
      returnRequest,
      items: selectedItems,
      pickupLocation,
      package: input.package,
    });
    const response = await createShiprocketReturnOrder(payload);
    const shiprocketOrderId = Number(response.order_id ?? response.orderId);
    const shiprocketShipmentId = Number(response.shipment_id ?? response.shipmentId);
    const shipmentNumber = Number(latestShipment?.shipment_number ?? 0) + 1;
    const { data: shipment, error: shipmentError } = await adminDb
      .from("shipments")
      .insert({
        order_id: returnRequest.order_id,
        provider: "shiprocket",
        pickup_location_id: pickupLocation.id,
        shipment_number: shipmentNumber,
        shipping_direction: "return",
        return_request_id: returnRequest.id,
        shipping_service_type: "standard",
        status: shiprocketShipmentId ? "created" : "pending",
        shiprocket_order_id: Number.isFinite(shiprocketOrderId) ? shiprocketOrderId : null,
        shiprocket_shipment_id: Number.isFinite(shiprocketShipmentId) ? shiprocketShipmentId : null,
        shiprocket_channel_order_id: payload.order_id,
        request_payload: payload,
        raw_create_response: response,
        raw_payload: response,
      })
      .select("*")
      .single();
    if (shipmentError) throw shipmentError;

    await adminDb.from("shipment_packages").insert({
      shipment_id: shipment.id,
      package_number: 1,
      weight_kg: payload.weight,
      length_cm: payload.length,
      breadth_cm: payload.breadth,
      height_cm: payload.height,
      declared_value: payload.sub_total,
      item_count: payload.order_items.reduce((sum, item) => sum + item.units, 0),
      sku_summary: payload.order_items
        .map((item) => item.sku)
        .join(", ")
        .slice(0, 500),
      order_item_ids: selectedItems.map((item) => item.id),
      raw_payload: payload,
    });

    const { data: updatedReturnRequest, error: updateReturnError } = await adminDb
      .from("return_requests")
      .update({
        status: "reverse_pickup_scheduled",
        reverse_shipment_id: shipment.id,
      })
      .eq("id", input.returnRequestId)
      .select("*")
      .single();
    if (updateReturnError) throw updateReturnError;
    return json(req, 200, { shipment, returnRequest: updatedReturnRequest, shiprocket: response });
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/bulk") {
    const adminDb = getSupabaseAdmin();
    const adminUser = await requireAdmin(req);
    requireLivePaymentEnvironment();
    const input = bulkFulfillmentSchema.parse(await req.json());
    if (input.action === "create_orders" && !input.orderIds.length) {
      throw new HttpError(400, "Select at least one order");
    }
    if (input.action !== "create_orders" && !input.shipmentIds.length) {
      throw new HttpError(400, "Select at least one shipment");
    }
    const batchType =
      input.action === "create_orders"
        ? "create_orders"
        : input.action === "assign_awb"
          ? "assign_awb"
          : input.action === "schedule_pickup"
            ? "schedule_pickup"
            : input.action === "generate_labels"
              ? "generate_labels"
              : "refresh_tracking";
    const { data: batch, error: batchError } = await adminDb
      .from("shipping_batches")
      .insert({
        provider: "shiprocket",
        batch_type: batchType,
        status: "processing",
        requested_by: adminUser.id,
        total_count:
          input.action === "create_orders" ? input.orderIds.length : input.shipmentIds.length,
        request_payload: input,
        started_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (batchError) throw batchError;

    const results: Array<Record<string, unknown>> = [];
    let successCount = 0;
    let failureCount = 0;

    if (input.action === "create_orders") {
      for (const orderId of input.orderIds) {
        try {
          const { shipment, shiprocket } = await createShiprocketShipmentForOrder(adminDb, {
            orderId,
          });
          successCount += 1;
          results.push({ orderId, shipmentId: shipment.id, status: "completed", shiprocket });
          await adminDb.from("shipping_batch_items").insert({
            batch_id: batch.id,
            order_id: orderId,
            shipment_id: shipment.id,
            status: "completed",
            provider_reference: firstString(shipment.shiprocket_shipment_id),
            response_payload: shiprocket,
          });
        } catch (error) {
          failureCount += 1;
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ orderId, status: "failed", error: errorMessage });
          await adminDb.from("shipping_batch_items").insert({
            batch_id: batch.id,
            order_id: orderId,
            status: "failed",
            error_message: errorMessage,
          });
        }
      }

      const finalStatus =
        failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partially_failed";
      const { data: updatedBatch, error: updateBatchError } = await adminDb
        .from("shipping_batches")
        .update({
          status: finalStatus,
          success_count: successCount,
          failure_count: failureCount,
          response_payload: { results },
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch.id)
        .select("*")
        .single();
      if (updateBatchError) throw updateBatchError;
      return json(req, 200, { batch: updatedBatch, results });
    }

    const { data: shipments, error: shipmentsError } = await adminDb
      .from("shipments")
      .select("*")
      .in("id", input.shipmentIds);
    if (shipmentsError) throw shipmentsError;
    const shipmentRows = (shipments ?? []) as Array<Record<string, unknown>>;

    if (input.action === "generate_labels") {
      try {
        const shiprocketShipmentIds = shipmentRows
          .map((shipment) => Number(shipment.shiprocket_shipment_id))
          .filter((id) => Number.isFinite(id));
        if (!shiprocketShipmentIds.length) throw new Error("No Shiprocket shipment ids found");
        const response = await generateShiprocketLabels(shiprocketShipmentIds);
        const labelUrl = firstString(response.label_url);
        if (labelUrl) {
          await adminDb
            .from("shipments")
            .update({
              status: "label_generated",
              label_url: labelUrl,
              raw_payload: response,
              last_status_at: new Date().toISOString(),
            })
            .in("id", input.shipmentIds);
        }
        successCount = shipmentRows.length;
        results.push({ action: input.action, response, labelUrl });
        await adminDb.from("shipping_batch_items").insert(
          shipmentRows.map((shipment) => ({
            batch_id: batch.id,
            order_id: shipment.order_id,
            shipment_id: shipment.id,
            status: "completed",
            provider_reference: firstString(shipment.shiprocket_shipment_id),
            response_payload: response,
          })),
        );
      } catch (error) {
        failureCount = shipmentRows.length;
        results.push({
          action: input.action,
          error: error instanceof Error ? error.message : String(error),
        });
        await adminDb.from("shipping_batch_items").insert(
          shipmentRows.map((shipment) => ({
            batch_id: batch.id,
            order_id: shipment.order_id,
            shipment_id: shipment.id,
            status: "failed",
            error_message: error instanceof Error ? error.message : String(error),
          })),
        );
      }
    } else {
      for (const shipment of shipmentRows) {
        try {
          let response: Record<string, unknown>;
          if (input.action === "assign_awb") {
            const shiprocketShipmentId = Number(shipment.shiprocket_shipment_id);
            if (!Number.isFinite(shiprocketShipmentId)) {
              throw new Error("Shipment does not have a Shiprocket shipment id");
            }
            response = await assignShiprocketAwb({
              shipment_id: shiprocketShipmentId,
              courier_id:
                typeof shipment.courier_company_id === "number"
                  ? shipment.courier_company_id
                  : undefined,
            });
            const awbData = getAwbData(response);
            const awbCode = firstString(awbData.awb_code, shipment.awb_code);
            const courierName = firstString(awbData.courier_name, shipment.courier_name);
            await adminDb
              .from("shipments")
              .update({
                status: "awb_assigned",
                awb_code: awbCode,
                courier_name: courierName,
                raw_awb_response: response,
                raw_payload: response,
                last_status_at: new Date().toISOString(),
              })
              .eq("id", String(shipment.id));
          } else if (input.action === "schedule_pickup") {
            const shiprocketShipmentId = Number(shipment.shiprocket_shipment_id);
            if (!Number.isFinite(shiprocketShipmentId)) {
              throw new Error("Shipment does not have a Shiprocket shipment id");
            }
            if (!shipment.awb_code) throw new Error("Assign AWB before scheduling pickup");
            response = await requestShiprocketPickup(shiprocketShipmentId);
            const pickupData = getPickupData(response);
            await adminDb
              .from("shipments")
              .update({
                status: "pickup_scheduled",
                pickup_scheduled_date: toDateOnly(
                  pickupData.pickup_scheduled_date ?? response.pickup_scheduled_date,
                ),
                raw_payload: response,
                last_status_at: new Date().toISOString(),
              })
              .eq("id", String(shipment.id));
          } else {
            const refreshed = await refreshShiprocketTracking(shipment);
            response = refreshed.tracking;
          }
          successCount += 1;
          results.push({ shipmentId: shipment.id, status: "completed", response });
          await adminDb.from("shipping_batch_items").insert({
            batch_id: batch.id,
            order_id: shipment.order_id,
            shipment_id: shipment.id,
            status: "completed",
            provider_reference: firstString(shipment.shiprocket_shipment_id),
            response_payload: response,
          });
        } catch (error) {
          failureCount += 1;
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ shipmentId: shipment.id, status: "failed", error: errorMessage });
          await adminDb.from("shipping_batch_items").insert({
            batch_id: batch.id,
            order_id: shipment.order_id,
            shipment_id: shipment.id,
            status: "failed",
            error_message: errorMessage,
          });
        }
      }
    }

    const finalStatus =
      failureCount === 0 ? "completed" : successCount === 0 ? "failed" : "partially_failed";
    const { data: updatedBatch, error: updateBatchError } = await adminDb
      .from("shipping_batches")
      .update({
        status: finalStatus,
        success_count: successCount,
        failure_count: failureCount,
        response_payload: { results },
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id)
      .select("*")
      .single();
    if (updateBatchError) throw updateBatchError;
    return json(req, 200, { batch: updatedBatch, results });
  }

  if (req.method === "POST" && path === "/shipments/shiprocket/labels") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const input = labelsSchema.parse(await req.json());
    const { data: shipments, error } = await adminDb
      .from("shipments")
      .select("id,shiprocket_shipment_id")
      .in("id", input.shipmentIds);
    if (error) throw error;
    const shiprocketShipmentIds = (shipments ?? [])
      .map((shipment) => shipment.shiprocket_shipment_id)
      .filter((id): id is number => typeof id === "number");
    if (!shiprocketShipmentIds.length) throw new HttpError(400, "No Shiprocket shipment ids found");
    const response = await generateShiprocketLabels(shiprocketShipmentIds);
    const labelUrl = typeof response.label_url === "string" ? response.label_url : undefined;
    if (labelUrl) {
      await adminDb
        .from("shipments")
        .update({
          status: "label_generated",
          label_url: labelUrl,
          raw_payload: response,
          last_status_at: new Date().toISOString(),
        })
        .in("id", input.shipmentIds);
    }
    return json(req, 200, { shiprocket: response });
  }

  if (req.method === "POST" && path === "/logistics/events") {
    const adminDb = getSupabaseAdmin();
    enforceRateLimit(req, "webhook", webhookRateLimit);
    if (!config.shiprocketWebhookToken) {
      throw new HttpError(
        503,
        "SHIPROCKET_WEBHOOK_TOKEN is required before accepting logistics webhooks",
      );
    }
    const token = req.headers.get("x-lapkart-logistics-token") ?? url.searchParams.get("token");
    if (token !== config.shiprocketWebhookToken) throw new HttpError(401, "Invalid webhook token");
    const body = asRecord(await req.json());
    const awb = String(body.awb ?? body.awb_code ?? body.awbCode ?? "").trim() || null;
    const shiprocketShipmentId = Number(body.shipment_id ?? body.shipmentId);
    let shipmentId: string | null = null;
    if (awb || Number.isFinite(shiprocketShipmentId)) {
      let query = adminDb.from("shipments").select("id").limit(1);
      if (awb) query = query.eq("awb_code", awb);
      else query = query.eq("shiprocket_shipment_id", shiprocketShipmentId);
      const { data } = await query.maybeSingle();
      shipmentId = data?.id ?? null;
    }
    const status = String(body.current_status ?? body.status ?? body.shipment_status ?? "updated");
    const statusTime = String(body.event_time ?? body.status_time ?? body.updated_at ?? "");
    await adminDb.from("shipment_events").insert({
      shipment_id: shipmentId,
      provider: "shiprocket",
      awb_code: awb,
      status,
      status_code: Number.isFinite(Number(body.current_status_id ?? body.status_code))
        ? Number(body.current_status_id ?? body.status_code)
        : null,
      status_time: statusTime ? new Date(statusTime).toISOString() : null,
      location: body.location ? String(body.location) : null,
      message: body.message ? String(body.message) : null,
      raw_payload: body,
    });
    if (shipmentId) {
      await adminDb
        .from("shipments")
        .update({
          status: normalizeShipmentStatus(status),
          last_status_at: new Date().toISOString(),
          raw_payload: body,
        })
        .eq("id", shipmentId);
    }
    return json(req, 200, { ok: true });
  }

  const storageUploadMatch = matchRoute(path, /^\/storage\/upload\/(products|users)$/);
  if (req.method === "POST" && storageUploadMatch) {
    const adminDb = getSupabaseAdmin();
    enforceRateLimit(req, "upload", uploadRateLimit);
    await requireAdmin(req);
    const formData = await req.formData();
    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) throw new HttpError(400, "file is required");
    assertUploadIsSafeImage(fileValue);
    const bucket = storageUploadMatch[1];
    const pathValue = `${Date.now()}-${fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await adminDb.storage.from(bucket).upload(pathValue, fileValue, {
      contentType: fileValue.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = adminDb.storage.from(bucket).getPublicUrl(pathValue);
    return json(req, 200, {
      bucket,
      path: pathValue,
      image_url: data.publicUrl,
      uploaded_at: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && path === "/admin/analytics") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const [orders, products, users] = await Promise.all([
      adminDb.from("orders").select("id,total,status,created_at,shipping_name"),
      adminDb.from("products").select("id,stock", { count: "exact", head: false }).limit(100),
      adminDb.from("profiles").select("id", { count: "exact", head: false }).limit(100),
    ]);
    if (orders.error) throw orders.error;
    if (products.error) throw products.error;
    if (users.error) throw users.error;
    const orderRows = orders.data ?? [];
    const revenue = orderRows.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const deliveredOrders = orderRows.filter(
      (order) => String(order.status ?? "").toLowerCase() === "delivered",
    ).length;
    const pendingFulfillment = orderRows.filter((order) =>
      ["confirmed", "packed", "pending", "processing"].includes(
        String(order.status ?? "").toLowerCase(),
      ),
    ).length;
    const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short" });
    const today = new Date();
    const monthlySeries = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      return { key, month: monthFormatter.format(date), revenue: 0, orders: 0 };
    });
    const monthIndex = new Map(monthlySeries.map((row) => [row.key, row]));
    for (const order of orderRows) {
      const createdAt = new Date(String(order.created_at));
      if (Number.isNaN(createdAt.getTime())) continue;
      const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
      const bucket = monthIndex.get(key);
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue += Number(order.total ?? 0);
    }
    return json(req, 200, {
      orders: orderRows.length,
      products: products.count ?? 0,
      users: users.count ?? 0,
      revenue,
      deliveredOrders,
      pendingFulfillment,
      monthlySeries,
      recentOrders: orderRows
        .slice()
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
        .slice(0, 6)
        .map((order) => ({
          id: order.id,
          createdAt: order.created_at,
          total: Number(order.total ?? 0),
          status: String(order.status ?? "pending"),
          shippingName: order.shipping_name ? String(order.shipping_name) : null,
        })),
    });
  }

  if (req.method === "GET" && path === "/admin/products") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { data, error } = await adminDb
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(250);
    if (error) throw error;
    return json(req, 200, { products: data ?? [] });
  }

  if (req.method === "POST" && path === "/admin/products") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const input = productUpsertSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("products")
      .insert(productPayloadFromInput(input))
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 201, { product: data });
  }

  const productMatch = matchRoute(path, /^\/admin\/products\/([^/]+)$/);
  if (req.method === "PATCH" && productMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { productId } = productIdParamSchema.parse({ productId: productMatch[1] });
    const input = productUpdateSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("products")
      .update(productPayloadFromInput(input))
      .eq("id", productId)
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { product: data });
  }

  if (req.method === "DELETE" && productMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { productId } = productIdParamSchema.parse({ productId: productMatch[1] });
    const { count, error: usageError } = await adminDb
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (usageError) throw usageError;
    if ((count ?? 0) > 0) {
      const { data, error } = await adminDb
        .from("products")
        .update({ status: "archived" })
        .eq("id", productId)
        .select("id,status")
        .single();
      if (error) throw error;
      return json(req, 200, {
        archived: true,
        product: data,
        message: "Product has order history, so it was archived instead of deleted.",
      });
    }
    const { error } = await adminDb.from("products").delete().eq("id", productId);
    if (error) throw error;
    return json(req, 200, { deleted: true, productId });
  }

  if (req.method === "GET" && path === "/admin/coupons") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const [{ data: coupons, error: couponsError }, { data: redemptions, error: redemptionsError }] =
      await Promise.all([
        adminDb.from("coupons").select("*").order("created_at", { ascending: false }),
        adminDb.from("coupon_redemptions").select("coupon_id,discount_amount"),
      ]);
    if (couponsError) throw couponsError;
    if (redemptionsError) throw redemptionsError;
    const usage = new Map<string, { count: number; discount: number }>();
    for (const redemption of redemptions ?? []) {
      const current = usage.get(redemption.coupon_id) ?? { count: 0, discount: 0 };
      current.count += 1;
      current.discount += Number(redemption.discount_amount ?? 0);
      usage.set(redemption.coupon_id, current);
    }
    return json(req, 200, {
      coupons: (coupons ?? []).map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discount_type,
        discountValue: Number(coupon.discount_value ?? 0),
        minimumSubtotal: Number(coupon.minimum_subtotal ?? 0),
        maxDiscount: coupon.max_discount === null ? null : Number(coupon.max_discount),
        startsAt: coupon.starts_at,
        endsAt: coupon.ends_at,
        usageLimit: coupon.usage_limit,
        perUserLimit: coupon.per_user_limit,
        active: coupon.active,
        createdAt: coupon.created_at,
        updatedAt: coupon.updated_at,
        usedCount: usage.get(coupon.id)?.count ?? 0,
        discountGiven: roundMoney(usage.get(coupon.id)?.discount ?? 0),
      })),
    });
  }

  if (req.method === "POST" && path === "/admin/coupons") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const input = couponWriteSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("coupons")
      .insert(couponPayloadFromInput(input))
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 201, { coupon: data });
  }

  const couponMatch = matchRoute(path, /^\/admin\/coupons\/([^/]+)$/);
  if (req.method === "PATCH" && couponMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { couponId } = z
      .object({ couponId: z.string().uuid() })
      .parse({ couponId: couponMatch[1] });
    const input = couponPatchSchema.parse(await req.json());
    const { data, error } = await adminDb
      .from("coupons")
      .update(couponPayloadFromInput(input))
      .eq("id", couponId)
      .select("*")
      .single();
    if (error) throw error;
    return json(req, 200, { coupon: data });
  }

  if (req.method === "DELETE" && couponMatch) {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const { couponId } = z
      .object({ couponId: z.string().uuid() })
      .parse({ couponId: couponMatch[1] });
    const { count, error: usageError } = await adminDb
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", couponId);
    if (usageError) throw usageError;
    if ((count ?? 0) > 0) {
      const { data, error } = await adminDb
        .from("coupons")
        .update({ active: false })
        .eq("id", couponId)
        .select("id,active")
        .single();
      if (error) throw error;
      return json(req, 200, { deactivated: true, coupon: data });
    }
    const { error } = await adminDb.from("coupons").delete().eq("id", couponId);
    if (error) throw error;
    return json(req, 200, { deleted: true, couponId });
  }

  if (req.method === "GET" && path === "/admin/users") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const [
      { data: authUsersData, error: authUsersError },
      profilesResult,
      rolesResult,
      ordersResult,
    ] = await Promise.all([
      adminDb.auth.admin.listUsers({ page: 1, perPage: 200 }),
      adminDb.from("profiles").select("id,full_name,phone,created_at,updated_at"),
      adminDb.from("user_roles").select("user_id,role"),
      adminDb.from("orders").select("user_id,total,created_at"),
    ]);
    if (authUsersError) throw authUsersError;
    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;
    if (ordersResult.error) throw ordersResult.error;
    const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const roles = new Map(
      (rolesResult.data ?? []).map((roleRow) => [roleRow.user_id, roleRow.role]),
    );
    const orderStats = new Map<string, { orderCount: number; totalSpent: number }>();
    for (const order of ordersResult.data ?? []) {
      const stats = orderStats.get(order.user_id) ?? { orderCount: 0, totalSpent: 0 };
      stats.orderCount += 1;
      stats.totalSpent += Number(order.total ?? 0);
      orderStats.set(order.user_id, stats);
    }
    const users = (authUsersData.users ?? [])
      .map((authUser) => {
        const profile = profiles.get(authUser.id);
        const stats = orderStats.get(authUser.id) ?? { orderCount: 0, totalSpent: 0 };
        return {
          id: authUser.id,
          email: authUser.email ?? null,
          createdAt: authUser.created_at ?? profile?.created_at ?? null,
          lastSignInAt: authUser.last_sign_in_at ?? null,
          role: roles.get(authUser.id) ?? "user",
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          orderCount: stats.orderCount,
          totalSpent: stats.totalSpent,
        };
      })
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });
    return json(req, 200, { users });
  }

  const userMatch = matchRoute(path, /^\/admin\/users\/([^/]+)$/);
  if (req.method === "PATCH" && userMatch) {
    const adminDb = getSupabaseAdmin();
    const actor = await requireAdmin(req);
    const { userId } = userIdParamSchema.parse({ userId: userMatch[1] });
    const input = adminUserUpdateSchema.parse(await req.json());
    if (input.role && actor.id === userId && input.role !== "admin") {
      throw new HttpError(400, "Use another admin account before removing your own admin role.");
    }
    if (input.role) {
      const { data: currentRoleRow, error: currentRoleError } = await adminDb
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (currentRoleError) throw currentRoleError;
      if (currentRoleRow?.role === "admin" && input.role !== "admin") {
        const { count, error: adminCountError } = await adminDb
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        if (adminCountError) throw adminCountError;
        if ((count ?? 0) <= 1) throw new HttpError(400, "At least one admin account must remain.");
      }
      const { error: roleUpdateError } = await adminDb
        .from("user_roles")
        .upsert({ user_id: userId, role: input.role }, { onConflict: "user_id" });
      if (roleUpdateError) throw roleUpdateError;
    }
    if ("fullName" in input || "phone" in input) {
      const profilePatch: Record<string, unknown> = { id: userId };
      if ("fullName" in input) profilePatch.full_name = input.fullName ?? null;
      if ("phone" in input) profilePatch.phone = input.phone ?? null;
      const { error: profileError } = await adminDb
        .from("profiles")
        .upsert(profilePatch, { onConflict: "id" });
      if (profileError) throw profileError;
    }
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      adminDb.from("profiles").select("full_name,phone").eq("id", userId).maybeSingle(),
      adminDb.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);
    return json(req, 200, {
      user: {
        id: userId,
        role: roleRow?.role ?? "user",
        fullName: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
      },
    });
  }

  if (req.method === "GET" && path === "/admin/orders") {
    const adminDb = getSupabaseAdmin();
    await requireAdmin(req);
    const [{ data: orders, error: ordersError }, authUsersResult] = await Promise.all([
      adminDb
        .from("orders")
        .select(
          "id,user_id,created_at,updated_at,status,payment_status,payment_method,subtotal,shipping,total,shipping_name,shipping_phone,shipping_email,shipping_line1,shipping_line2,shipping_city,shipping_state,shipping_pincode,shipping_service_type,shipping_courier_name",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      adminDb.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    if (ordersError) throw ordersError;
    if (authUsersResult.error) throw authUsersResult.error;
    const orderIds = (orders ?? []).map((order) => order.id);
    const userEmailById = new Map(
      (authUsersResult.data.users ?? []).map((user) => [user.id, user.email ?? null]),
    );
    const [
      itemsResult,
      shipmentsResult,
      paymentsResult,
      cancellationsResult,
      returnsResult,
      refundsResult,
      invoicesResult,
      eventsResult,
    ] = orderIds.length
      ? await Promise.all([
          adminDb
            .from("order_items")
            .select("id,order_id,title,image,brand,qty,price,unit_price")
            .in("order_id", orderIds),
          adminDb
            .from("shipments")
            .select("order_id,status,awb_code,courier_name,tracking_url,expected_delivery_date")
            .in("order_id", orderIds)
            .eq("shipping_direction", "outbound"),
          adminDb
            .from("payments")
            .select(
              "id,order_id,provider,status,amount,provider_payment_id,provider_order_id,created_at",
            )
            .in("order_id", orderIds),
          adminDb
            .from("order_cancellation_requests")
            .select("id,order_id,status,reason,admin_note,requested_at,resolved_at,refund_id")
            .in("order_id", orderIds)
            .order("requested_at", { ascending: false }),
          adminDb
            .from("return_requests")
            .select(
              "id,order_id,status,reason,admin_note,requested_at,resolved_at,received_at,reverse_shipment_id,refund_id",
            )
            .in("order_id", orderIds)
            .order("requested_at", { ascending: false }),
          adminDb
            .from("refunds")
            .select(
              "id,order_id,amount,status,reason,speed,provider_refund_id,created_at,processed_at,cancellation_request_id,return_request_id",
            )
            .in("order_id", orderIds)
            .order("created_at", { ascending: false }),
          adminDb
            .from("order_invoices")
            .select("order_id,invoice_number,invoice_url,status,generated_at")
            .in("order_id", orderIds),
          adminDb
            .from("admin_order_events")
            .select("id,order_id,admin_user_id,event_type,reason,from_state,to_state,created_at")
            .in("order_id", orderIds)
            .order("created_at", { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ];
    if (itemsResult.error) throw itemsResult.error;
    if (shipmentsResult.error) throw shipmentsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;
    if (cancellationsResult.error) throw cancellationsResult.error;
    if (returnsResult.error) throw returnsResult.error;
    if (refundsResult.error) throw refundsResult.error;
    if (invoicesResult.error) throw invoicesResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const itemSummaryByOrder = new Map<string, string>();
    const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
    for (const item of itemsResult.data ?? []) {
      const existing = itemSummaryByOrder.get(item.order_id) ?? "";
      const nextItem = `${item.title} x${item.qty}`;
      itemSummaryByOrder.set(item.order_id, existing ? `${existing}, ${nextItem}` : nextItem);
      const existingItems = itemsByOrder.get(item.order_id) ?? [];
      existingItems.push(item);
      itemsByOrder.set(item.order_id, existingItems);
    }
    const shipmentByOrder = new Map(
      (shipmentsResult.data ?? []).map((shipment) => [shipment.order_id, shipment]),
    );
    const latestByOrder = <T extends { order_id: string }>(rows: T[]) => {
      const map = new Map<string, T>();
      for (const row of rows) {
        if (!map.has(row.order_id)) map.set(row.order_id, row);
      }
      return map;
    };
    const cancellationByOrder = latestByOrder(
      (cancellationsResult.data ?? []) as Array<{ order_id: string }>,
    );
    const returnByOrder = latestByOrder((returnsResult.data ?? []) as Array<{ order_id: string }>);
    const refundByOrder = latestByOrder((refundsResult.data ?? []) as Array<{ order_id: string }>);
    const refundsByOrder = new Map<string, Array<Record<string, unknown>>>();
    for (const refund of refundsResult.data ?? []) {
      const existing = refundsByOrder.get(refund.order_id) ?? [];
      existing.push(refund);
      refundsByOrder.set(refund.order_id, existing);
    }
    const invoiceByOrder = new Map(
      (invoicesResult.data ?? []).map((invoice) => [invoice.order_id, invoice]),
    );
    const eventsByOrder = new Map<string, Array<Record<string, unknown>>>();
    for (const event of eventsResult.data ?? []) {
      const existing = eventsByOrder.get(event.order_id) ?? [];
      if (existing.length < 8) existing.push(event);
      eventsByOrder.set(event.order_id, existing);
    }
    const paymentByOrder = new Map(
      (paymentsResult.data ?? [])
        .slice()
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
        .map((payment) => [payment.order_id, payment]),
    );
    return json(req, 200, {
      orders: (orders ?? []).map((order) => {
        const shipment = shipmentByOrder.get(order.id);
        const payment = paymentByOrder.get(order.id);
        const refundsForOrder = refundsByOrder.get(order.id) ?? [];
        const activeRefundTotal = refundsForOrder
          .filter((refund) => !["failed", "cancelled"].includes(String(refund.status ?? "")))
          .reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
        const paidAmount = Number(payment?.amount ?? order.total ?? 0);
        return {
          id: order.id,
          userId: order.user_id,
          userEmail: userEmailById.get(order.user_id) ?? order.shipping_email ?? null,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.payment_method,
          subtotal: Number(order.subtotal ?? 0),
          shipping: Number(order.shipping ?? 0),
          total: Number(order.total ?? 0),
          shippingName: order.shipping_name,
          shippingPhone: order.shipping_phone,
          shippingEmail: order.shipping_email,
          shippingLine1: order.shipping_line1,
          shippingLine2: order.shipping_line2,
          shippingCity: order.shipping_city,
          shippingState: order.shipping_state,
          shippingPincode: order.shipping_pincode,
          shippingServiceType: order.shipping_service_type,
          shippingCourierName: order.shipping_courier_name,
          itemSummary: itemSummaryByOrder.get(order.id) ?? "",
          items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            image: item.image,
            brand: item.brand,
            qty: item.qty,
            price: Number(item.price ?? item.unit_price ?? 0),
          })),
          shipment: shipment
            ? {
                status: shipment.status,
                awbCode: shipment.awb_code,
                courierName: shipment.courier_name,
                trackingUrl: shipment.tracking_url,
                expectedDeliveryDate: shipment.expected_delivery_date,
              }
            : null,
          payment: payment
            ? {
                id: payment.id,
                provider: payment.provider,
                status: payment.status,
                amount: Number(payment.amount ?? 0),
                providerPaymentId: payment.provider_payment_id,
                providerOrderId: payment.provider_order_id,
              }
            : null,
          cancellationRequest: cancellationByOrder.get(order.id) ?? null,
          returnRequest: returnByOrder.get(order.id) ?? null,
          refund: refundByOrder.get(order.id) ?? null,
          refunds: refundsForOrder.map((refund) => ({
            id: refund.id,
            amount: Number(refund.amount ?? 0),
            status: refund.status,
            reason: refund.reason,
            speed: refund.speed,
            providerRefundId: refund.provider_refund_id,
            createdAt: refund.created_at,
            processedAt: refund.processed_at,
            cancellationRequestId: refund.cancellation_request_id,
            returnRequestId: refund.return_request_id,
          })),
          refundSummary: {
            paidAmount,
            refundedAmount: roundMoney(activeRefundTotal),
            refundableAmount: roundMoney(Math.max(0, paidAmount - activeRefundTotal)),
          },
          invoice: invoiceByOrder.get(order.id) ?? null,
          adminEvents: (eventsByOrder.get(order.id) ?? []).map((event) => ({
            id: event.id,
            eventType: event.event_type,
            reason: event.reason,
            createdAt: event.created_at,
            adminUserId: event.admin_user_id,
            adminEmail: userEmailById.get(String(event.admin_user_id ?? "")) ?? null,
            fromState: event.from_state,
            toState: event.to_state,
          })),
        };
      }),
    });
  }

  const adminOrderMatch = matchRoute(path, /^\/admin\/orders\/([^/]+)$/);
  if (req.method === "PATCH" && adminOrderMatch) {
    const adminDb = getSupabaseAdmin();
    const adminUser = await requireAdmin(req);
    const { orderId } = orderIdParamSchema.parse({ orderId: adminOrderMatch[1] });
    const input = adminOrderUpdateSchema.parse(await req.json());
    const { data: existingOrder, error: existingOrderError } = await adminDb
      .from("orders")
      .select("id,user_id,status,payment_status")
      .eq("id", orderId)
      .single();
    if (existingOrderError) throw existingOrderError;
    const currentOrderStatus = String(existingOrder.status ?? "").toLowerCase();
    const currentPaymentStatus = String(existingOrder.payment_status ?? "").toLowerCase();
    const isTerminalOrder = ["cancelled", "refunded", "returned"].includes(currentOrderStatus);
    const isTerminalPayment = ["refunded", "cod_cancelled"].includes(currentPaymentStatus);
    if (isTerminalOrder || isTerminalPayment) {
      throw new HttpError(
        409,
        "This order is in a terminal state. Change it manually in the database only if you need an exception.",
      );
    }

    const payload: Record<string, unknown> = {};
    if ("status" in input) payload.status = input.status?.toLowerCase();
    if ("paymentStatus" in input) payload.payment_status = input.paymentStatus?.toLowerCase();
    const changedFields = Object.entries(payload).filter(([key, value]) => {
      const existingValue = (existingOrder as Record<string, unknown>)[key];
      return String(existingValue ?? "") !== String(value ?? "");
    });
    if (!changedFields.length) {
      throw new HttpError(400, "No order fields changed");
    }
    const changedFieldNames = changedFields.map(([key]) => key);
    const eventType = changedFieldNames.includes("status")
      ? payload.status === "cancelled"
        ? "manual_cancel"
        : "manual_update"
      : "payment_update";
    const { data, error } = await adminDb
      .from("orders")
      .update(payload)
      .eq("id", orderId)
      .select("id,status,payment_status,updated_at")
      .single();
    if (error) throw error;
    const { error: eventError } = await adminDb.from("admin_order_events").insert({
      order_id: orderId,
      admin_user_id: adminUser.id,
      event_type: eventType,
      reason: input.reason,
      from_state: Object.fromEntries(
        changedFields.map(([key]) => [
          key,
          (existingOrder as Record<string, unknown>)[key] ?? null,
        ]),
      ),
      to_state: Object.fromEntries(changedFields),
      metadata: {
        changedFields: changedFieldNames,
        source: "admin_order_editor",
      },
    });
    if (eventError) throw eventError;
    if (payload.status === "cancelled") {
      const { data: existingCancellation, error: cancellationLookupError } = await adminDb
        .from("order_cancellation_requests")
        .select("id")
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancellationLookupError) throw cancellationLookupError;
      if (!existingCancellation) {
        const { error: cancellationInsertError } = await adminDb
          .from("order_cancellation_requests")
          .insert({
            order_id: orderId,
            user_id: existingOrder.user_id,
            status: "approved",
            reason: input.reason,
            admin_note: "Manual admin cancellation",
            resolved_at: new Date().toISOString(),
          });
        if (cancellationInsertError) throw cancellationInsertError;
      }
    }
    return json(req, 200, {
      order: {
        id: data.id,
        status: data.status,
        paymentStatus: data.payment_status,
        updatedAt: data.updated_at,
      },
    });
  }

  return json(req, 404, { error: "Not found" });
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(req, 400, { error: "Invalid request", issues: error.issues });
    }
    if (error instanceof HttpError) {
      return json(req, error.statusCode, { error: error.message });
    }
    if (isRazorpayAuthError(error)) {
      return json(req, 401, { error: "Razorpay authentication failed" });
    }
    if (error instanceof Error) {
      console.error(error);
      return json(req, 500, { error: error.message || "Internal server error" });
    }
    return text(req, 500, "Internal server error");
  }
});
