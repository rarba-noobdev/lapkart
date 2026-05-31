import crypto from "node:crypto";
import Razorpay from "razorpay";
import { config } from "./config.js";

export const razorpay =
  config.razorpayKeyId && config.razorpayKeySecret
    ? new Razorpay({ key_id: config.razorpayKeyId, key_secret: config.razorpayKeySecret })
    : null;

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
};

export async function createRazorpayOrder(amountPaise: number, receipt: string, currency = "INR") {
  if (!razorpay) {
    throw new Error("Razorpay credentials are not configured");
  }

  const order = (await razorpay.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    payment_capture: true,
  })) as RazorpayOrderResponse;

  return {
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
  };
}

export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  if (!config.razorpayKeySecret) {
    throw new Error("Razorpay credentials are not configured");
  }
  const body = `${input.orderId}|${input.paymentId}`;
  const expected = crypto.createHmac("sha256", config.razorpayKeySecret).update(body).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(input.signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}
