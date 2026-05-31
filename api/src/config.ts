import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8080),
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:5173",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  openAiKey: process.env.OPENAI_API_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  huggingFaceKey: process.env.HUGGINGFACE_API_KEY ?? "",
};
