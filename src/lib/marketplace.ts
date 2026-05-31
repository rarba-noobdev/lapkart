import {
  BadgeCheck,
  BarChart3,
  Bot,
  Boxes,
  Camera,
  CreditCard,
  Headphones,
  MapPinned,
  PackageCheck,
  ShieldAlert,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

export const kpis = [
  { label: "Total revenue", value: "Rs. 42.8L", trend: "+18.4%", icon: BarChart3 },
  { label: "Orders", value: "3,284", trend: "+12.1%", icon: PackageCheck },
  { label: "Users", value: "24,910", trend: "+9.7%", icon: Users },
  { label: "Refund risk", value: "1.8%", trend: "-0.6%", icon: ShieldAlert },
];

export const commerceModules = [
  {
    title: "AI product recognition",
    body: "Image recognition, OCR, brand detection, compatibility checks, similar product search, and structured confidence output.",
    icon: Camera,
  },
  {
    title: "Razorpay checkout",
    body: "UPI, GPay, PhonePe, Paytm, cards, EMI, net banking, signature verification, invoices, refunds, and order webhooks.",
    icon: CreditCard,
  },
  {
    title: "Delivery command center",
    body: "Partner assignment, route optimization hooks, live status events, proof-of-delivery uploads, ETA, and earnings.",
    icon: Truck,
  },
  {
    title: "Repair services",
    body: "Laptop and issue image upload, AI damage triage, estimated cost, technician assignment, and repair lifecycle tracking.",
    icon: Wrench,
  },
  {
    title: "Vendor ecosystem",
    body: "Vendor onboarding, KYC documents, product approvals, stock controls, sales forecasting, and demand insights.",
    icon: Boxes,
  },
  {
    title: "AI support chatbot",
    body: "Product discovery, order tracking, refund support, repair advice, fraud escalation, and admin handoff.",
    icon: Bot,
  },
];

export const orderStatuses = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

export const deliveryEvents = [
  { label: "Order picked", location: "Vendor dock, Nehru Place", time: "09:10" },
  { label: "Reached hub", location: "Delhi NCR sort center", time: "11:35" },
  { label: "Out for delivery", location: "Route BLR-44", time: "15:20" },
  { label: "Delivered", location: "Customer proof pending", time: "ETA 18:40" },
];

export const aiPrediction = {
  product: "Samsung DDR4 RAM",
  category: "RAM",
  confidence: "98%",
  brand: "Samsung",
  compatibleWith: ["Dell Latitude 5420", "HP ProBook 440", "Lenovo ThinkPad E14"],
};

export const repairPrediction = {
  issue: "Screen damage",
  severity: "Medium",
  estimatedCost: "Rs. 3,500",
  turnaround: "2-3 days",
};

export const analyticsSeries = [
  { month: "Jan", revenue: 18, orders: 580 },
  { month: "Feb", revenue: 24, orders: 760 },
  { month: "Mar", revenue: 31, orders: 980 },
  { month: "Apr", revenue: 28, orders: 910 },
  { month: "May", revenue: 43, orders: 1280 },
];

export const rolePanels = [
  {
    role: "Customer",
    title: "Orders, wishlist, profile, repairs, AI recommendations",
    icon: Headphones,
    metrics: ["3 active orders", "12 wishlist items", "2 repair tickets"],
  },
  {
    role: "Vendor",
    title: "Products, stock, sales analytics, AI pricing insights",
    icon: BadgeCheck,
    metrics: ["248 SKUs", "94% fill rate", "Rs. 8.7L revenue"],
  },
  {
    role: "Delivery partner",
    title: "Assigned orders, optimized routes, earnings, proof uploads",
    icon: MapPinned,
    metrics: ["18 assigned", "96% on-time", "Rs. 2,840 today"],
  },
  {
    role: "Admin",
    title: "Users, vendors, products, refunds, reports, AI insights",
    icon: ShieldAlert,
    metrics: ["32 approvals", "7 disputes", "4 fraud alerts"],
  },
];
