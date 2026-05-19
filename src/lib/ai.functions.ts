import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(messages: Array<{ role: string; content: string }>, opts?: { json?: boolean }) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export const aiChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Array<{ role: string; content: string }> }) => d)
  .handler(async ({ data }) => {
    const sys = {
      role: "system",
      content:
        "You are LapKart Assistant — an expert on laptop spare parts, components, repairs, and compatibility (RAM, SSD, batteries, displays, keyboards, chargers, motherboards). Answer concisely in 1-3 short paragraphs. If asked about a specific laptop model, recommend compatible parts. Mention LapKart product categories when relevant.",
    };
    const reply = await callAI([sys, ...data.messages]);
    return { reply };
  });

export const aiTradeInValuation = createServerFn({ method: "POST" })
  .inputValidator((d: { brand: string; model: string; age_years: number; condition: string; ram_gb?: number; storage_gb?: number }) => d)
  .handler(async ({ data }) => {
    const prompt = `Estimate a fair trade-in value in Indian Rupees (INR) for a used laptop. Return ONLY valid JSON like {"value": 12500, "reasoning": "short one-line reasoning"}.
Laptop: ${data.brand} ${data.model}
Age: ${data.age_years} years
Condition: ${data.condition}
RAM: ${data.ram_gb ?? "unknown"} GB
Storage: ${data.storage_gb ?? "unknown"} GB`;
    const out = await callAI(
      [{ role: "user", content: prompt }],
      { json: true },
    );
    try {
      const parsed = JSON.parse(out);
      return { value: Number(parsed.value) || 0, reasoning: String(parsed.reasoning || "") };
    } catch {
      return { value: 0, reasoning: "Could not estimate. Please try again." };
    }
  });
