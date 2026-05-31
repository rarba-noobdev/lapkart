import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import { detectComponentFromImage, detectProductFromImage, generateProductCopy, scoreFraud } from "./ai.js";
import { config } from "./config.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "./payments.js";
import { supabaseAdmin } from "./supabase.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(helmet());
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 180 }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "lapkart-ai-api" });
});

app.post("/ai/detect-product", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "image is required" });
    const prediction = await detectProductFromImage(req.file);
    if (!supabaseAdmin) return res.json({ prediction, record: null });
    const { data, error } = await supabaseAdmin.from("ai_predictions").insert({
      prediction_type: "product_image",
      input_url: null,
      output: prediction,
      confidence: Number.parseFloat(prediction.confidence),
    }).select().single();
    if (error) throw error;
    res.json({ prediction, record: data });
  } catch (error) {
    next(error);
  }
});

app.post("/components/detect", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "image is required" });
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });

    const folder = z.enum(["uploads/products", "uploads/components", "uploads/vendors"])
      .default("uploads/components")
      .parse(req.body.folder || "uploads/components");
    const userId = z.string().uuid().optional().safeParse(req.body.user_id).success ? req.body.user_id : null;
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;

    const uploadResult = await supabaseAdmin.storage.from("product-images").upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });
    if (uploadResult.error) throw uploadResult.error;

    const { data: publicUrl } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);
    const detection = await detectComponentFromImage(req.file);
    const insertResult = await supabaseAdmin
      .from("component_detections")
      .insert({
        user_id: userId,
        image_url: publicUrl.publicUrl,
        component_name: detection.component_name,
        category: detection.category,
        brand: detection.brand,
        model_number: detection.model_number,
        specifications: detection.specifications,
        condition: detection.condition,
        confidence_score: detection.confidence_score,
        ocr_text: detection.ocr_text,
        tags: detection.tags,
        keywords: detection.keywords,
        compatible_models: detection.compatible_models,
        similar_products: detection.similar_products,
        product_title: detection.product_title,
        product_description: detection.product_description,
        seo_tags: detection.seo_tags,
        status: "draft",
      })
      .select()
      .single();
    if (insertResult.error) throw insertResult.error;

    res.json({ detection: insertResult.data });
  } catch (error) {
    next(error);
  }
});

app.patch("/components/detections/:id", async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });
    const id = z.string().uuid().parse(req.params.id);
    const body = z.object({
      component_name: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      model_number: z.string().optional(),
      specifications: z.record(z.string()).optional(),
      condition: z.string().optional(),
      confidence_score: z.number().optional(),
      ocr_text: z.string().optional(),
      tags: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      product_title: z.string().optional(),
      product_description: z.string().optional(),
      seo_tags: z.array(z.string()).optional(),
      status: z.string().optional(),
    }).parse(req.body);
    const { data, error } = await supabaseAdmin
      .from("component_detections")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    res.json({ detection: data });
  } catch (error) {
    next(error);
  }
});

app.post("/components/detections/:id/create-product", async (req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });
    const id = z.string().uuid().parse(req.params.id);
    const { data: detection, error } = await supabaseAdmin.from("component_detections").select("*").eq("id", id).single();
    if (error) throw error;

    const price = Number(req.body.price ?? 999);
    const mrp = Number(req.body.mrp ?? Math.round(price * 1.25));
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert({
        title: detection.product_title ?? detection.component_name,
        brand: detection.brand ?? "LAPKART",
        category: String(detection.category ?? "components").toLowerCase().replace(/\s+/g, "_"),
        image: detection.image_url,
        images: [detection.image_url],
        description: detection.product_description,
        price,
        mrp,
        stock: Number(req.body.stock ?? 1),
        compatibility: Array.isArray(detection.compatible_models) ? detection.compatible_models.join(", ") : "",
        warranty: "AI verified listing - warranty assigned after approval",
        highlights: Array.isArray(detection.tags) ? detection.tags.slice(0, 5) : [],
        ai_tags: detection.seo_tags ?? detection.tags ?? [],
        search_keywords: detection.keywords ?? detection.tags ?? [],
        status: "pending_approval",
      })
      .select()
      .single();
    if (productError) throw productError;
    await supabaseAdmin
      .from("component_detections")
      .update({
        status: "product_created",
        product_id: product.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    res.json({ product });
  } catch (error) {
    next(error);
  }
});

app.get("/components/detections", async (_req, res, next) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });
    const { data, error } = await supabaseAdmin
      .from("component_detections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ detections: data });
  } catch (error) {
    next(error);
  }
});

app.post("/ai/product-copy", async (req, res) => {
  const input = z.object({ name: z.string(), brand: z.string().optional(), category: z.string().optional() }).parse(req.body);
  res.json(generateProductCopy(input));
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

function isRazorpayAuthError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const statusCode = "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : undefined;
  const httpStatusCode = "httpStatusCode" in error ? Number((error as { httpStatusCode?: unknown }).httpStatusCode) : undefined;
  return statusCode === 401 || httpStatusCode === 401;
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

app.post("/storage/upload/:bucket", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    if (!supabaseAdmin) return res.status(503).json({ error: "Supabase service credentials are not configured" });
    const bucket = z.enum(["products", "users", "vendors", "invoices", "reviews", "repair_requests"]).parse(req.params.bucket);
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

app.get("/admin/analytics", async (_req, res, next) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase service credentials are not configured");
    const [orders, products, vendors] = await Promise.all([
      supabaseAdmin.from("orders").select("id,total_amount,status", { count: "exact", head: false }).limit(100),
      supabaseAdmin.from("products").select("id,stock", { count: "exact", head: false }).limit(100),
      supabaseAdmin.from("vendors").select("id,status", { count: "exact", head: false }).limit(100),
    ]);
    res.json({
      orders: orders.count ?? 0,
      products: products.count ?? 0,
      vendors: vendors.count ?? 0,
      revenue: orders.data?.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0) ?? 0,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`LAPKART AI API listening on ${config.port}`);
});
