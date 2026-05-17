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
  image: string;
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
];

export type Product = {
  id: string;
  title: string;
  brand: string;
  category: string;
  image: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  stock: number;
  compatibility: string;
  warranty: string;
  highlights: string[];
};

const mk = (
  id: string,
  title: string,
  brand: string,
  category: string,
  image: string,
  price: number,
  mrp: number,
  rating: number,
  reviews: number,
  compatibility: string,
  highlights: string[],
): Product => ({
  id,
  title,
  brand,
  category,
  image,
  price,
  mrp,
  rating,
  reviews,
  stock: 25,
  compatibility,
  warranty: "1 Year Manufacturer Warranty",
  highlights,
});

export const products: Product[] = [
  mk("p1", "Crucial 16GB DDR4 3200MHz SODIMM Laptop RAM", "Crucial", "ram", ram, 3499, 5999, 4.5, 1284, "All DDR4 SODIMM laptops",
    ["16GB single stick", "DDR4 3200 MHz", "CL22 latency", "Low power 1.2V"]),
  mk("p2", "Kingston Fury Impact 32GB (2x16) DDR4 SODIMM", "Kingston", "ram", ram, 6999, 10999, 4.6, 902, "Gaming laptops, MacBook Pro 2019",
    ["32GB kit (2x16GB)", "3200 MHz", "Plug & play", "Lifetime warranty"]),
  mk("p3", "Samsung 980 Pro 1TB NVMe Gen4 SSD", "Samsung", "ssd", ssd, 8999, 14999, 4.7, 3421, "M.2 2280 NVMe slot",
    ["7000 MB/s read", "5000 MB/s write", "PCIe Gen 4", "5 year warranty"]),
  mk("p4", "WD Black SN770 500GB NVMe SSD", "Western Digital", "ssd", ssd, 4299, 7499, 4.5, 1850, "M.2 2280 NVMe",
    ["5150 MB/s read", "PCIe Gen 4", "DRAM-less efficient", "Game Mode 2.0"]),
  mk("p5", "Original Motherboard for HP Pavilion 15-CC", "HP", "motherboards", mobo, 12499, 18999, 4.2, 312, "HP Pavilion 15-CC series",
    ["OEM replacement", "Tested working", "Includes thermal pad", "6 month warranty"]),
  mk("p6", "Dell Inspiron 15 3000 Motherboard i5 8th Gen", "Dell", "motherboards", mobo, 14999, 21999, 4.3, 187, "Inspiron 3580/3581/3582",
    ["Intel i5-8265U", "DDR4 support", "Refurbished grade A", "Tested"]),
  mk("p7", "Lenovo ThinkPad T480 Battery 6-Cell 72Wh", "Lenovo", "batteries", battery, 4499, 7299, 4.4, 624, "ThinkPad T480 / T580",
    ["72Wh capacity", "Up to 12 hrs", "Original chemistry", "Smart charging"]),
  mk("p8", "HP Pavilion Battery KI04 41Wh", "HP", "batteries", battery, 2299, 3999, 4.1, 411, "HP Pavilion 14/15/17 (KI04)",
    ["41Wh", "4 cell", "BIS certified", "1 year warranty"]),
  mk("p9", "LG 15.6\" FHD IPS Display Panel 1920x1080", "LG", "displays", display, 5499, 8999, 4.5, 298, "Universal 30-pin eDP laptops",
    ["1920x1080 IPS", "60Hz", "Matte finish", "Anti-glare"]),
  mk("p10", "AUO 14\" FHD Replacement Screen", "AUO", "displays", display, 4799, 7499, 4.3, 211, "Most 14\" eDP slim laptops",
    ["1080p IPS", "Slim 3.2mm", "Wide viewing", "Easy install"]),
  mk("p11", "Dell Latitude 5480 Backlit Keyboard", "Dell", "keyboards", keyboard, 1899, 2999, 4.4, 540, "Latitude 5480 / 5490",
    ["Backlit keys", "US layout", "OEM quality", "Spill resistant"]),
  mk("p12", "Lenovo IdeaPad 330 Keyboard Black", "Lenovo", "keyboards", keyboard, 1299, 1999, 4.2, 388, "IdeaPad 330/320 15\"",
    ["Plug & play", "Original layout", "Tactile feedback", "BIS approved"]),
  mk("p13", "Intel Core i7-10750H Mobile Processor", "Intel", "processors", cpu, 18999, 28999, 4.6, 167, "BGA1440 sockets only (re-ball)",
    ["6 cores / 12 threads", "Up to 5.0 GHz", "12MB cache", "45W TDP"]),
  mk("p14", "AMD Ryzen 5 4600H Mobile CPU", "AMD", "processors", cpu, 14499, 22999, 4.5, 122, "FP6 BGA",
    ["6C/12T Zen 2", "Boost 4.0 GHz", "7nm process", "45W"]),
  mk("p15", "Cooler Master Laptop Cooling Fan Module", "Cooler Master", "cooling", fan, 1199, 1999, 4.3, 712, "Universal 5V laptop fan",
    ["High airflow", "Low noise", "Copper bearing", "Easy install"]),
  mk("p16", "HP 65W Original Smart Pin Adapter", "HP", "chargers", charger, 1499, 2499, 4.7, 2103, "HP 4.5x3.0mm Blue Tip",
    ["65W output", "Smart pin", "Surge protected", "BIS certified"]),
  mk("p17", "Dell 90W Slim Tip Original Charger", "Dell", "chargers", charger, 1899, 2899, 4.6, 1467, "Dell 7.4mm slim tip",
    ["90W output", "Genuine OEM", "Auto voltage", "1 year warranty"]),
];

export function getProduct(id: string) {
  return products.find((p) => p.id === id);
}

export function discountPct(p: Product) {
  return Math.round(((p.mrp - p.price) / p.mrp) * 100);
}

export function formatINR(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}
