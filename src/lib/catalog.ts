import ram from "@/assets/cat-ram.jpg";
import ssd from "@/assets/cat-ssd.jpg";
import mobo from "@/assets/cat-mobo.jpg";
import battery from "@/assets/cat-battery.jpg";
import display from "@/assets/cat-display.jpg";
import keyboard from "@/assets/cat-keyboard.jpg";
import cpu from "@/assets/cat-cpu.jpg";
import fan from "@/assets/cat-fan.jpg";
import charger from "@/assets/cat-charger.jpg";

export type Category = {
  slug: string;
  name: string;
  image?: string;
};

export const categories: Category[] = [
  { slug: "ram", name: "RAM", image: ram },
  { slug: "ssd", name: "SSD", image: ssd },
  { slug: "motherboards", name: "Motherboards", image: mobo },
  { slug: "batteries", name: "Batteries", image: battery },
  { slug: "displays", name: "Displays", image: display },
  { slug: "keyboards", name: "Keyboards", image: keyboard },
  { slug: "processors", name: "Processors", image: cpu },
  { slug: "cooling", name: "Cooling Fans", image: fan },
  { slug: "chargers", name: "Chargers", image: charger },
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
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
