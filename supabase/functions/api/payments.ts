import { config } from "./config.ts";

function encodeBase64(value: string) {
  return btoa(value);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(digest));
}

function timingSafeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export async function createRazorpayOrder(amountPaise: number, receipt: string, currency = "INR") {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBase64(`${config.razorpayKeyId}:${config.razorpayKeySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      payment_capture: 1,
    }),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const description =
      typeof data.error === "object" && data.error && "description" in data.error
        ? String((data.error as { description?: unknown }).description)
        : null;
    const message = description || `Razorpay request failed with HTTP ${response.status}`;
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  return {
    order_id: String(data.id ?? ""),
    amount: Number(data.amount ?? amountPaise),
    currency: String(data.currency ?? currency),
  };
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountPaise: number;
  speed?: "normal" | "optimum";
  notes?: Record<string, string>;
}) {
  if (!config.razorpayKeyId || !config.razorpayKeySecret) {
    throw new Error("Razorpay credentials are not configured");
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBase64(`${config.razorpayKeyId}:${config.razorpayKeySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        speed: input.speed ?? "normal",
        notes: input.notes ?? {},
      }),
    },
  );

  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const description =
      typeof data.error === "object" && data.error && "description" in data.error
        ? String((data.error as { description?: unknown }).description)
        : null;
    const message = description || `Razorpay refund failed with HTTP ${response.status}`;
    const error = new Error(message) as Error & { statusCode?: number };
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

export async function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!config.razorpayKeySecret) {
    throw new Error("Razorpay credentials are not configured");
  }
  const body = `${input.orderId}|${input.paymentId}`;
  const expected = await hmacSha256Hex(config.razorpayKeySecret, body);
  return timingSafeEqualHex(expected, input.signature);
}
