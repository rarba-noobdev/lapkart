import { config } from "./config.js";

type ShiprocketLoginResponse = {
  token?: string;
};

type ShiprocketOrderItem = {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount: number;
  tax: number;
  hsn: string;
};

type ShiprocketCreateOrderPayload = {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: ShiprocketOrderItem[];
  payment_method: "Prepaid" | "COD";
  shipping_charges: number;
  giftwrap_charges: number;
  transaction_charges: number;
  total_discount: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
  latitude?: number;
  longitude?: number;
  shipping_method?: "HL";
};

type ShiprocketAwbPayload = {
  shipment_id: number;
  courier_id?: number;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function ensureShiprocketConfig() {
  if (!config.shiprocketEmail || !config.shiprocketPassword) {
    throw new Error("Shiprocket credentials are not configured");
  }
}

function pathUrl(path: string) {
  return `${config.shiprocketBaseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function parseShiprocketResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message?: unknown }).message)
        : `Shiprocket request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function getShiprocketToken({ forceRefresh = false } = {}) {
  ensureShiprocketConfig();

  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetch(pathUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.shiprocketEmail,
      password: config.shiprocketPassword,
    }),
  });

  const data = await parseShiprocketResponse<ShiprocketLoginResponse>(response);
  if (!data.token) throw new Error("Shiprocket login did not return a token");

  tokenCache = {
    token: data.token,
    expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000,
  };

  return data.token;
}

export async function shiprocketRequest<T>(path: string, init: RequestInit = {}) {
  const token = await getShiprocketToken();
  const response = await fetch(pathUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  return parseShiprocketResponse<T>(response);
}

export async function createShiprocketOrder(payload: ShiprocketCreateOrderPayload) {
  return shiprocketRequest<Record<string, unknown>>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function assignShiprocketAwb(payload: ShiprocketAwbPayload) {
  return shiprocketRequest<Record<string, unknown>>("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateShiprocketLabels(shipmentIds: number[]) {
  return shiprocketRequest<Record<string, unknown>>("/courier/generate/label", {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentIds }),
  });
}

export async function getShiprocketServiceability(input: {
  deliveryPincode: string;
  pickupPincode?: string;
  weightKg?: number;
  declaredValue?: number;
}) {
  const pickupPincode = input.pickupPincode ?? config.lapkartDispatchPincode;
  if (!/^[0-9]{6}$/.test(pickupPincode)) {
    throw new Error("LapKart dispatch pincode is not configured");
  }

  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: input.deliveryPincode,
    cod: "0",
    weight: String(input.weightKg ?? config.shiprocketDefaultWeightKg),
    length: String(config.shiprocketDefaultLengthCm),
    breadth: String(config.shiprocketDefaultBreadthCm),
    height: String(config.shiprocketDefaultHeightCm),
    declared_value: String(input.declaredValue ?? 0),
  });
  const data = await shiprocketRequest<{
    data?: {
      available_courier_companies?: Array<Record<string, unknown>>;
      recommended_courier_company_id?: number;
      shiprocket_recommended_courier_id?: number;
    };
  }>(`/courier/serviceability/?${params.toString()}`);
  const recommendedId =
    data.data?.recommended_courier_company_id ?? data.data?.shiprocket_recommended_courier_id ?? null;

  const toDateOnly = (value: unknown) => {
    const date = new Date(String(value ?? ""));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  };

  return (data.data?.available_courier_companies ?? [])
    .filter((courier) => Number(courier.blocked ?? 0) === 0)
    .map((courier) => ({
      quoteId: `standard:${Number(courier.courier_company_id)}`,
      courierCompanyId: Number(courier.courier_company_id),
      courierName: String(courier.courier_name ?? "Courier"),
      rate: Number(courier.rate ?? courier.freight_charge ?? 0),
      rating: Number(courier.rating ?? 0),
      etd: String(courier.etd ?? ""),
      expectedDeliveryDate: toDateOnly(courier.etd),
      estimatedDeliveryDays: Number(courier.estimated_delivery_days ?? 0),
      etdHours: Number(courier.etd_hours ?? 0),
      mode: courier.is_surface ? "Surface" : "Air",
      recommended: Number(courier.courier_company_id) === recommendedId,
      serviceType: "standard" as const,
    }))
    .filter((courier) => Number.isFinite(courier.courierCompanyId))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.etdHours - b.etdHours || a.rate - b.rate)
    .slice(0, 5);
}

export async function getShiprocketQuickServiceability(input: {
  deliveryPincode: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  pickupPincode?: string;
  weightKg?: number;
}) {
  const pickupPincode = input.pickupPincode ?? config.lapkartDispatchPincode;
  if (!/^[0-9]{6}$/.test(pickupPincode)) {
    throw new Error("LapKart dispatch pincode is not configured");
  }
  if (!Number.isFinite(config.lapkartDispatchLatitude) || !Number.isFinite(config.lapkartDispatchLongitude)) {
    throw new Error("LapKart dispatch coordinates are not configured");
  }

  const params = new URLSearchParams({
    pickup_postcode: pickupPincode,
    delivery_postcode: input.deliveryPincode,
    cod: "0",
    weight: String(input.weightKg ?? config.shiprocketDefaultWeightKg),
    is_new_hyperlocal: "1",
    lat_from: String(config.lapkartDispatchLatitude),
    long_from: String(config.lapkartDispatchLongitude),
    lat_to: String(input.deliveryLatitude),
    long_to: String(input.deliveryLongitude),
  });
  const data = await shiprocketRequest<{
    data?: Array<Record<string, unknown>>;
  }>(`/courier/serviceability/?${params.toString()}`);

  return (data.data ?? [])
    .map((courier, index) => ({
      quoteId: `quick:${index}:${String(courier.courier_name ?? "shiprocket-quick")}`,
      courierCompanyId: null,
      courierName: String(courier.courier_name ?? "Shiprocket Quick"),
      rate: Number(courier.rates ?? courier.rate ?? 0),
      rating: 0,
      etd: "Within 3 hours",
      expectedDeliveryDate: null,
      estimatedDeliveryDays: 0,
      etdHours: 3,
      mode: "Hyperlocal",
      recommended: true,
      serviceType: "quick" as const,
    }))
    .filter((courier) => Number.isFinite(courier.rate));
}

export async function getShiprocketDeliveryQuotes(input: {
  deliveryPincode: string;
  deliveryLatitude: number;
  deliveryLongitude: number;
  pickupPincode?: string;
  weightKg?: number;
  declaredValue?: number;
}) {
  const [standardResult, quickResult] = await Promise.allSettled([
    getShiprocketServiceability(input),
    getShiprocketQuickServiceability(input),
  ]);
  const standard = standardResult.status === "fulfilled" ? standardResult.value : [];
  const quick = quickResult.status === "fulfilled" ? quickResult.value : [];

  if (!standard.length && !quick.length && standardResult.status === "rejected" && quickResult.status === "rejected") {
    throw standardResult.reason;
  }

  return [...quick, ...standard];
}

export function toShiprocketOrderPayload(input: {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  package?: {
    weightKg?: number;
    lengthCm?: number;
    breadthCm?: number;
    heightCm?: number;
  };
  pickupLocation?: string;
}): ShiprocketCreateOrderPayload {
  const order = input.order;
  const items = input.items;
  const packageInput = input.package ?? {};
  const isQuick = order.shipping_service_type === "quick";

  const pincode = String(order.shipping_pincode ?? "").trim();
  if (!/^[0-9]{6}$/.test(pincode)) {
    throw new Error("Order needs a valid 6-digit shipping pincode before Shiprocket shipment creation");
  }

  const phone = String(order.shipping_phone ?? "").replace(/\D/g, "");
  if (phone.length < 10) {
    throw new Error("Order needs a valid shipping phone before Shiprocket shipment creation");
  }
  const latitude = Number(order.shipping_latitude);
  const longitude = Number(order.shipping_longitude);
  if (isQuick && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
    throw new Error("Shiprocket Quick order needs delivery coordinates");
  }

  const pickupLocation = input.pickupLocation ?? config.shiprocketPickupLocation;
  if (!pickupLocation) {
    throw new Error("Shiprocket pickup location is not configured");
  }

  const customerName = String(order.shipping_name ?? "LapKart Customer").trim();
  const [firstName, ...lastNameParts] = customerName.split(/\s+/);
  const orderDate = new Date(String(order.created_at ?? new Date().toISOString()))
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  return {
    order_id: String(order.id),
    order_date: orderDate,
    pickup_location: pickupLocation,
    billing_customer_name: firstName || "LapKart",
    billing_last_name: lastNameParts.join(" ") || "Customer",
    billing_address: String(order.shipping_line1 ?? order.shipping_address ?? "").slice(0, 190),
    billing_address_2: String(order.shipping_line2 ?? "").slice(0, 190),
    billing_city: String(order.shipping_city ?? "").trim(),
    billing_pincode: pincode,
    billing_state: String(order.shipping_state ?? "").trim(),
    billing_country: String(order.shipping_country ?? "India").trim(),
    billing_email: String(order.shipping_email ?? "orders@lapkart.local").trim(),
    billing_phone: phone.slice(-10),
    shipping_is_billing: true,
    order_items: items.map((item, index) => ({
      name: String(item.title ?? `LapKart item ${index + 1}`).slice(0, 190),
      sku: String(item.sku ?? item.product_id ?? item.id ?? `LK-${index + 1}`).slice(0, 50),
      units: Number(item.qty ?? 1),
      selling_price: Number(item.unit_price ?? item.price ?? 0),
      discount: 0,
      tax: 0,
      hsn: "",
    })),
    payment_method: String(order.payment_method ?? "").toLowerCase().includes("cod") ? "COD" : "Prepaid",
    shipping_charges: Number(order.shipping ?? 0),
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.subtotal ?? order.total ?? 0),
    length: Number(packageInput.lengthCm ?? config.shiprocketDefaultLengthCm),
    breadth: Number(packageInput.breadthCm ?? config.shiprocketDefaultBreadthCm),
    height: Number(packageInput.heightCm ?? config.shiprocketDefaultHeightCm),
    weight: Number(packageInput.weightKg ?? config.shiprocketDefaultWeightKg),
    ...(isQuick ? { latitude, longitude, shipping_method: "HL" as const } : {}),
  };
}
