export type Category = {
  slug: string;
  name: string;
  image?: string;
};

export const categories: Category[] = [
  { slug: "ram", name: "RAM" },
  { slug: "ssd", name: "SSD" },
  { slug: "motherboards", name: "Motherboards" },
  { slug: "batteries", name: "Batteries" },
  { slug: "displays", name: "Displays" },
  { slug: "keyboards", name: "Keyboards" },
  { slug: "processors", name: "Processors" },
  { slug: "cooling", name: "Cooling Fans" },
  { slug: "chargers", name: "Chargers" },
  { slug: "wifi_cards", name: "WiFi Cards" },
  { slug: "dc_jacks", name: "DC Power Jacks" },
  { slug: "bottom_cases", name: "Bottom Cases" },
  { slug: "palmrests", name: "Palmrests" },
  { slug: "hinges", name: "Hinges" },
  { slug: "speakers", name: "Speakers" },
  { slug: "hdd_boards", name: "HDD Boards" },
];

export type Product = {
  id: string;
  title: string;
  brand: string;
  category: string;
  image: string;
  images?: string[];
  source_url?: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  stock: number;
  compatibility: string;
  warranty: string;
  highlights: string[];
};

export function discountPct(p: Pick<Product, "price" | "mrp">) {
  if (!p.mrp || p.mrp <= p.price) return 0;
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

export function formatINR(n: number) {
  return "\u20B9" + Math.round(n).toLocaleString("en-IN");
}
