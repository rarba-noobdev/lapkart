import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import { config } from "./config.js";
import { autocompleteOlaPlaces, getOlaDeliveryRoute, reverseGeocodeOlaPlace } from "./ola-maps.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "./payments.js";
import { scoreFraud } from "./risk.js";
import {
  assignShiprocketAwb,
  createShiprocketOrder,
  generateShiprocketLabels,
  generateShiprocketManifest,
  getShiprocketPickupLocations,
  getShiprocketDeliveryQuotes,
  getShiprocketTracking,
  getShiprocketToken,
  getShiprocketWalletBalance,
  requestShiprocketPickup,
  type ShiprocketPickupAddress,
  toShiprocketOrderPayload,
} from "./shiprocket.js";
import { supabaseAdmin } from "./supabase.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(helmet());
app.use(cors({ origin: config.webOrigins, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lapkart-api" });
});

app.post("/fraud/score", async (req, res) => {
  const input = z.object({
    failedPayments: z.number().optional(),
    orderValue: z.number().optional(),
    accountAgeDays: z.number().optional(),
  }).parse(req.body);
  res.json(scoreFraud(input));
});

const createOrderBodySchema = z.object({
  amount: z.number().int().min(100),
  currency: z.string().trim().min(3).max(3).default("INR"),
  receipt: z.string().trim().min(3),
});

const verifyPaymentBodySchema = z.object({
  order_id: z.string().trim().min(1).optional(),
  payment_id: z.string().trim().min(1).optional(),
  razorpay_signature: z.string().trim().min(1).optional(),
  razorpay_order_id: z.string().trim().min(1).optional(),
  razorpay_payment_id: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  paymentId: z.string().trim().min(1).optional(),
  signature: z.string().trim().min(1).optional(),
  orderRecordId: z.string().uuid().optional(),
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

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);
const autocompleteQuerySchema = z.object({
  input: z.string().trim().min(3).max(500).transform((value) => value.slice(0, 160)),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});
const reverseGeocodeQuerySchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
const deliveryEstimateQuerySchema = reverseGeocodeQuerySchema.extend({
  pincode: z.string().trim().regex(/^[0-9]{6}$/),
  weightKg: z.coerce.number().positive().max(100).optional(),
  declaredValue: z.coerce.number().nonnegative().max(10_000_000).optional(),
});

function isRazorpayAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
  const httpStatusCode = "httpStatusCode" in error ? Number((error as { httpStatusCode?: unknown }).httpStatusCode) : undefined;
  return statusCode === 401 || httpStatusCode === 401;
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
  if (value.includes("transit") || value.includes("manifest") || value.includes("assigned")) return "in_transit";
  return "in_transit";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
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
  return Object.keys(asRecord(nestedResponse.data)).length ? asRecord(nestedResponse.data) : nestedResponse;
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

async function refreshShiprocketTracking(shipment: Record<string, unknown>) {
  if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
  const shiprocketShipmentId = Number(shipment.shiprocket_shipment_id);
  if (!Number.isFinite(shiprocketShipmentId)) {
    throw new Error("Shipment does not have a Shiprocket shipment id");
  }

  const response = await getShiprocketTracking(shiprocketShipmentId);
  const trackingData = asRecord(response.tracking_data);
  const shipmentTrack = Array.isArray(trackingData.shipment_track) ? asRecord(trackingData.shipment_track[0]) : {};
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

  const { data: updatedShipment, error } = await supabaseAdmin
    .from("shipments")
    .update(updates)
    .eq("id", String(shipment.id))
    .select("*")
    .single();
  if (error) throw error;

  return { shipment: updatedShipment, tracking: response };
}

async function syncShiprocketPickupLocations(addresses: ShiprocketPickupAddress[]) {
  if (!supabaseAdmin || !addresses.length) return;

  const primaryIndex = Math.max(0, addresses.findIndex((address) => Number(address.is_primary_location) === 1));
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
  const { error: resetError } = await supabaseAdmin
    .from("shipping_pickup_locations")
    .update({ is_default: false })
    .eq("provider", "shiprocket");
  if (resetError) throw resetError;

  const { error } = await supabaseAdmin
    .from("shipping_pickup_locations")
    .upsert(rows, { onConflict: "provider,pickup_location" });
  if (error) throw error;
}

function toFulfillmentShipment(shipment: Record<string, unknown> | undefined) {
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
    trackingActivities: trackingActivities(shipment.raw_payload),
  };
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    if (!supabaseAdmin) {
      res.status(503).json({ error: "Supabase service credentials are not configured" });
      return;
    }

    const authHeader = req.header("authorization") ?? "";
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) {
      res.status(401).json({ error: "Authorization bearer token is required" });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid authorization token" });
      return;
    }

    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (roleError) throw roleError;
    if (roleRow?.role !== "admin") {
      res.status(403).json({ error: "Admin role is required" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

app.post("/api/create-order", async (req, res) => {
  try {
    const input = createOrderBodySchema.parse(req.body);
    const order = await createRazorpayOrder(input.amount, input.receipt, input.currency);
    res.json(order);
  } catch (error) {
    if (isRazorpayAuthError(error)) {
      res.status(401).json({ error: "Razorpay authentication failed" });
      return;
    }
    if (error instanceof Error && error.message === "Razorpay credentials are not configured") {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not create Razorpay order" });
  }
});

app.post("/payments/razorpay/order", async (req, res) => {
  try {
    const input = createOrderBodySchema.parse({
      amount: req.body.amount ?? req.body.amountPaise,
      currency: req.body.currency,
      receipt: req.body.receipt,
    });
    const order = await createRazorpayOrder(input.amount, input.receipt, input.currency);
    res.json(order);
  } catch (error) {
    if (isRazorpayAuthError(error)) {
      res.status(401).json({ error: "Razorpay authentication failed" });
      return;
    }
    if (error instanceof Error && error.message === "Razorpay credentials are not configured") {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not create Razorpay order" });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const input = verifyPaymentBodySchema.parse(req.body);
    const orderId = input.order_id ?? input.razorpay_order_id ?? input.orderId;
    const paymentId = input.payment_id ?? input.razorpay_payment_id ?? input.paymentId;
    const signature = input.razorpay_signature ?? input.signature;

    if (!orderId || !paymentId || !signature) {
      res.status(400).json({ error: "order_id, payment_id, and razorpay_signature are required" });
      return;
    }

    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });

    if (!verified) {
      res.status(400).json({ error: "Signature verification failed", verified: false });
      return;
    }

    if (input.orderRecordId && supabaseAdmin) {
      await supabaseAdmin.from("payments").insert({
        order_id: input.orderRecordId,
        provider: "razorpay",
        provider_payment_id: paymentId,
        provider_order_id: orderId,
        status: "paid",
      });
    }

    res.json({ verified: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Razorpay credentials are not configured") {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not verify payment" });
  }
});

app.post("/payments/razorpay/verify", async (req, res) => {
  try {
    const input = verifyPaymentBodySchema.parse(req.body);
    const orderId = input.order_id ?? input.razorpay_order_id ?? input.orderId;
    const paymentId = input.payment_id ?? input.razorpay_payment_id ?? input.paymentId;
    const signature = input.razorpay_signature ?? input.signature;

    if (!orderId || !paymentId || !signature) {
      res.status(400).json({ error: "order_id, payment_id, and razorpay_signature are required" });
      return;
    }

    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });

    if (!verified) {
      res.status(400).json({ error: "Signature verification failed", verified: false });
      return;
    }

    if (input.orderRecordId && supabaseAdmin) {
      await supabaseAdmin.from("payments").insert({
        order_id: input.orderRecordId,
        provider: "razorpay",
        provider_payment_id: paymentId,
        provider_order_id: orderId,
        status: "paid",
      });
    }

    res.json({ verified: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Razorpay credentials are not configured") {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not verify payment" });
  }
});

app.get("/maps/autocomplete", async (req, res, next) => {
  try {
    const input = autocompleteQuerySchema.parse(req.query);
    const suggestions = await autocompleteOlaPlaces(
      input.input,
      input.latitude !== undefined && input.longitude !== undefined
        ? { latitude: input.latitude, longitude: input.longitude }
        : undefined,
    );
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
});

app.get("/maps/reverse-geocode", async (req, res, next) => {
  try {
    const input = reverseGeocodeQuerySchema.parse(req.query);
    res.json(await reverseGeocodeOlaPlace(input.latitude, input.longitude));
  } catch (error) {
    next(error);
  }
});

app.get("/maps/delivery-estimate", async (req, res, next) => {
  try {
    const input = deliveryEstimateQuerySchema.parse(req.query);
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
    res.json({
      dispatch: {
        pickupLocation: config.shiprocketPickupLocation,
        pincode: config.lapkartDispatchPincode,
      },
      route,
      couriers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/shiprocket/status", requireAdmin, async (req, res, next) => {
  try {
    const verify = req.query.verify === "1" || req.query.verify === "true";
    if (!verify) {
      res.json({
        configured: Boolean(config.shiprocketEmail && config.shiprocketPassword && config.shiprocketPickupLocation),
        pickupLocationConfigured: Boolean(config.shiprocketPickupLocation),
      });
      return;
    }

    await getShiprocketToken({ forceRefresh: true });
    res.json({ configured: true, authenticated: true });
  } catch (error) {
    next(error);
  }
});

app.get("/shiprocket/account", requireAdmin, async (_req, res, next) => {
  try {
    const [walletBalance, pickupResponse] = await Promise.all([
      getShiprocketWalletBalance(),
      getShiprocketPickupLocations(),
    ]);
    const pickupLocations = pickupResponse.data?.shipping_address ?? [];
    await syncShiprocketPickupLocations(pickupLocations);
    const configuredPickup = pickupLocations.find(
      (location) => String(location.pickup_location ?? "") === config.shiprocketPickupLocation,
    );

    res.json({
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
  } catch (error) {
    next(error);
  }
});

app.get("/admin/fulfillment/orders", requireAdmin, async (_req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,created_at,status,total,shipping_name,shipping_city,shipping_state,shipping_pincode,shipping_service_type")
      .order("created_at", { ascending: false })
      .limit(100);
    if (ordersError) throw ordersError;

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: shipments, error: shipmentsError } = orderIds.length
      ? await supabaseAdmin
          .from("shipments")
          .select("*")
          .in("order_id", orderIds)
          .eq("provider", "shiprocket")
      : { data: [], error: null };
    if (shipmentsError) throw shipmentsError;

    const shipmentsByOrder = new Map((shipments ?? []).map((shipment) => [shipment.order_id, shipment]));
    res.json({
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
        shipment: toFulfillmentShipment(shipmentsByOrder.get(order.id)),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/shipments/shiprocket/create", requireAdmin, async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const input = createShiprocketShipmentSchema.parse(req.body);

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", input.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*, products(sku)")
      .eq("order_id", input.orderId);
    if (itemsError) throw itemsError;
    if (!items?.length) {
      res.status(400).json({ error: "Order has no items" });
      return;
    }

    const { data: existingShipment, error: existingShipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("order_id", input.orderId)
      .eq("provider", "shiprocket")
      .maybeSingle();
    if (existingShipmentError) throw existingShipmentError;
    if (existingShipment) {
      res.status(409).json({ error: "Shiprocket shipment already exists for this order", shipment: existingShipment });
      return;
    }

    const payload = toShiprocketOrderPayload({
      order,
      items: items.map((item) => ({
        ...item,
        sku: Array.isArray(item.products) ? item.products[0]?.sku : item.products?.sku,
      })),
      package: input.package,
      pickupLocation: input.pickupLocation,
    });
    const { data: pickupLocation, error: pickupLocationError } = await supabaseAdmin
      .from("shipping_pickup_locations")
      .select("id")
      .eq("provider", "shiprocket")
      .eq("pickup_location", payload.pickup_location)
      .eq("is_active", true)
      .maybeSingle();
    if (pickupLocationError) throw pickupLocationError;
    if (!pickupLocation) {
      res.status(400).json({ error: "Shiprocket pickup location is not synced or active" });
      return;
    }

    const response = await createShiprocketOrder(payload);
    const shiprocketOrderId = Number(response.order_id ?? response.orderId);
    const shiprocketShipmentId = Number(response.shipment_id ?? response.shipmentId);

    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .insert({
        order_id: input.orderId,
        provider: "shiprocket",
        pickup_location_id: pickupLocation.id,
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

    await supabaseAdmin.from("shipment_packages").insert({
      shipment_id: shipment.id,
      package_number: 1,
      weight_kg: payload.weight,
      length_cm: payload.length,
      breadth_cm: payload.breadth,
      height_cm: payload.height,
      declared_value: payload.sub_total,
      item_count: payload.order_items.reduce((sum, item) => sum + item.units, 0),
      sku_summary: payload.order_items.map((item) => item.sku).join(", ").slice(0, 500),
      order_item_ids: items.map((item) => item.id),
      raw_payload: payload,
    });

    res.json({ shipment, shiprocket: response });
  } catch (error) {
    next(error);
  }
});

app.post("/shipments/shiprocket/assign-awb", requireAdmin, async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const input = assignAwbSchema.parse(req.body);

    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment?.shiprocket_shipment_id) {
      res.status(400).json({ error: "Shipment does not have a Shiprocket shipment id" });
      return;
    }

    const response = await assignShiprocketAwb({
      shipment_id: shipment.shiprocket_shipment_id,
      courier_id: input.courierId ?? shipment.courier_company_id ?? undefined,
    });
    const awbData = getAwbData(response);
    if (Number(response.awb_assign_status ?? 1) !== 1) {
      throw new Error(firstString(awbData.awb_assign_error, response.message) ?? "Shiprocket AWB assignment failed");
    }
    const awbCode = firstString(awbData.awb_code, shipment.awb_code);
    const courierName = firstString(awbData.courier_name, shipment.courier_name);
    const courierCompanyId = Number(awbData.courier_company_id ?? input.courierId ?? shipment.courier_company_id);

    const { data: updatedShipment, error: updateError } = await supabaseAdmin
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

    res.json({
      shipment: tracking?.shipment ?? updatedShipment,
      shiprocket: response,
      tracking: tracking?.tracking ?? null,
      dispatchMode: shipment.shipping_service_type === "quick" ? "quick_rider_requested" : "standard_awb_assigned",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/shipments/shiprocket/pickup", requireAdmin, async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const input = shipmentIdSchema.parse(req.body);
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment?.shiprocket_shipment_id) {
      res.status(400).json({ error: "Shipment does not have a Shiprocket shipment id" });
      return;
    }
    if (shipment.shipping_service_type === "quick") {
      res.status(400).json({ error: "Shiprocket Quick rider assignment is triggered during AWB assignment" });
      return;
    }
    if (!shipment.awb_code) {
      res.status(400).json({ error: "Assign an AWB before scheduling pickup" });
      return;
    }

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
      manifestError = error instanceof Error ? error.message : "Could not generate Shiprocket manifest";
    }
    const manifestUrl = firstString(
      pickupData.manifest_url,
      pickup.manifest_url,
      manifest?.manifest_url,
    );
    const pickupScheduledDate = toDateOnly(
      pickupData.pickup_scheduled_date ?? pickup.pickup_scheduled_date ?? new Date().toISOString(),
    );

    const { data: updatedShipment, error: updateError } = await supabaseAdmin
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

    res.json({ shipment: updatedShipment, pickup, manifest, manifestError });
  } catch (error) {
    next(error);
  }
});

app.get("/shipments/shiprocket/:shipmentId/tracking", requireAdmin, async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const input = shipmentIdSchema.parse(req.params);
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from("shipments")
      .select("*")
      .eq("id", input.shipmentId)
      .maybeSingle();
    if (shipmentError) throw shipmentError;
    if (!shipment) {
      res.status(404).json({ error: "Shipment not found" });
      return;
    }
    res.json(await refreshShiprocketTracking(shipment));
  } catch (error) {
    next(error);
  }
});

app.post("/shipments/shiprocket/labels", requireAdmin, async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const input = labelsSchema.parse(req.body);
    const { data: shipments, error } = await supabaseAdmin
      .from("shipments")
      .select("id,shiprocket_shipment_id")
      .in("id", input.shipmentIds);
    if (error) throw error;

    const shiprocketShipmentIds = (shipments ?? [])
      .map((shipment) => shipment.shiprocket_shipment_id)
      .filter((id): id is number => typeof id === "number");

    if (!shiprocketShipmentIds.length) {
      res.status(400).json({ error: "No Shiprocket shipment ids found" });
      return;
    }

    const response = await generateShiprocketLabels(shiprocketShipmentIds);
    const labelUrl = typeof response.label_url === "string" ? response.label_url : undefined;

    if (labelUrl) {
      await supabaseAdmin
        .from("shipments")
        .update({
          status: "label_generated",
          label_url: labelUrl,
          raw_payload: response,
          last_status_at: new Date().toISOString(),
        })
        .in("id", input.shipmentIds);
    }

    res.json({ shiprocket: response });
  } catch (error) {
    next(error);
  }
});

app.post("/logistics/events", async (req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    if (config.shiprocketWebhookToken) {
      const token = req.header("x-lapkart-logistics-token") ?? req.query.token;
      if (token !== config.shiprocketWebhookToken) {
        res.status(401).json({ error: "Invalid webhook token" });
        return;
      }
    }

    const body = req.body as Record<string, unknown>;
    const awb = String(body.awb ?? body.awb_code ?? body.awbCode ?? "").trim() || null;
    const shiprocketShipmentId = Number(body.shipment_id ?? body.shipmentId);

    let shipmentId: string | null = null;
    if (awb || Number.isFinite(shiprocketShipmentId)) {
      let query = supabaseAdmin.from("shipments").select("id").limit(1);
      if (awb) query = query.eq("awb_code", awb);
      else query = query.eq("shiprocket_shipment_id", shiprocketShipmentId);
      const { data } = await query.maybeSingle();
      shipmentId = data?.id ?? null;
    }

    const status = String(body.current_status ?? body.status ?? body.shipment_status ?? "updated");
    const statusTime = String(body.event_time ?? body.status_time ?? body.updated_at ?? "");

    await supabaseAdmin.from("shipment_events").insert({
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
      await supabaseAdmin
        .from("shipments")
        .update({
          status: normalizeShipmentStatus(status),
          last_status_at: new Date().toISOString(),
          raw_payload: body,
        })
        .eq("id", shipmentId);
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/storage/upload/:bucket", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });
    const bucket = z.enum(["products", "users"]).parse(req.params.bucket);
    const path = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabaseAdmin.storage.from(bucket).upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    res.json({ bucket, path, image_url: data.publicUrl, uploaded_at: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/analytics", requireAdmin, async (_req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const [orders, products, users] = await Promise.all([
      supabaseAdmin.from("orders").select("id,total,status", { count: "exact", head: false }).limit(100),
      supabaseAdmin.from("products").select("id,stock", { count: "exact", head: false }).limit(100),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: false }).limit(100),
    ]);
    res.json({
      orders: orders.count ?? 0,
      products: products.count ?? 0,
      users: users.count ?? 0,
      revenue: orders.data?.reduce((sum, order) => sum + Number(order.total ?? 0), 0) ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Invalid request", issues: error.issues });
    return;
  }
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`LapKart API listening on ${config.port}`);
});
