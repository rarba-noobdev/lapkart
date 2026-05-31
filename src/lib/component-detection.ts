export type ComponentDetection = {
  id: string;
  user_id: string | null;
  product_id: string | null;
  image_url: string;
  component_name: string;
  category: string;
  brand: string;
  model_number: string;
  specifications: Record<string, string>;
  condition: string;
  confidence_score: number;
  ocr_text: string;
  tags: string[];
  keywords: string[];
  compatible_models: string[];
  similar_products: string[];
  product_title: string;
  product_description: string;
  seo_tags: string[];
  status: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export const componentCategories = [
  "Laptop",
  "RAM",
  "SSD",
  "HDD",
  "Motherboard",
  "Processor",
  "Keyboard",
  "Display",
  "Battery",
  "Charger",
  "Cooling Fan",
  "Touchpad",
  "Webcam",
  "Speaker",
  "Laptop Body",
  "Adapter",
  "Graphics Card",
];

export const detectionApiBase = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8080";

export function tagsToText(tags: string[]) {
  return tags.join(", ");
}

export function textToTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function specsToText(specifications: Record<string, string>) {
  return Object.entries(specifications)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

export function textToSpecs(value: string) {
  return Object.fromEntries(
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split(":");
        return [key.trim().toLowerCase().replace(/\s+/g, "_"), rest.join(":").trim()];
      })
      .filter(([key, val]) => key && val),
  );
}
