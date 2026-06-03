import "dotenv/config";

const defaultWebOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

export const config = {
  port: Number(process.env.PORT ?? 8080),
  webOrigins: (process.env.WEB_ORIGIN ?? defaultWebOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  shiprocketBaseUrl: process.env.SHIPROCKET_BASE_URL ?? "https://apiv2.shiprocket.in/v1/external",
  shiprocketEmail: process.env.SHIPROCKET_EMAIL ?? "",
  shiprocketPassword: process.env.SHIPROCKET_PASSWORD ?? "",
  shiprocketPickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION ?? "",
  shiprocketWebhookToken: process.env.SHIPROCKET_WEBHOOK_TOKEN ?? "",
  shiprocketDefaultWeightKg: Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG ?? 0.5),
  shiprocketDefaultLengthCm: Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM ?? 20),
  shiprocketDefaultBreadthCm: Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM ?? 15),
  shiprocketDefaultHeightCm: Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM ?? 5),
  allowShiprocketWithTestPayments: process.env.ALLOW_SHIPROCKET_WITH_TEST_PAYMENTS === "true",
  lapkartDispatchPincode: process.env.LAPKART_DISPATCH_PINCODE ?? "",
  lapkartDispatchLatitude: Number(process.env.LAPKART_DISPATCH_LATITUDE ?? NaN),
  lapkartDispatchLongitude: Number(process.env.LAPKART_DISPATCH_LONGITUDE ?? NaN),
  olaMapsApiKey: process.env.OLA_MAPS_API_KEY ?? "",
  olaMapsClientId: process.env.OLA_MAPS_CLIENT_ID ?? "",
  olaMapsClientSecret: process.env.OLA_MAPS_CLIENT_SECRET ?? "",
};
