import {
  BarChart3,
  Boxes,
  CreditCard,
  PackageCheck,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Users,
} from "lucide-react";

export const kpis = [
  { label: "Total revenue", value: "Rs. 42.8L", trend: "+18.4%", icon: BarChart3 },
  { label: "Orders", value: "3,284", trend: "+12.1%", icon: PackageCheck },
  { label: "Users", value: "24,910", trend: "+9.7%", icon: Users },
  { label: "Refund risk", value: "1.8%", trend: "-0.6%", icon: ShieldAlert },
];

export const commerceModules = [
  {
    title: "Product catalog",
    body: "Create, edit, price, stock, and publish laptop parts across RAM, SSDs, batteries, displays, chargers, and accessories.",
    icon: ShoppingBag,
  },
  {
    title: "Razorpay checkout",
    body: "UPI, GPay, PhonePe, Paytm, cards, EMI, net banking, signature verification, refunds, and order webhooks.",
    icon: CreditCard,
  },
  {
    title: "Order operations",
    body: "Track order states, payment status, Shiprocket shipping details, delivery estimates, returns, refunds, and customer support follow-up.",
    icon: PackageCheck,
  },
  {
    title: "Inventory controls",
    body: "Monitor stock health, low inventory, pricing, product availability, and category coverage from one admin workspace.",
    icon: Boxes,
  },
  {
    title: "Customer accounts",
    body: "Review user profiles, addresses, order history, payment status, and account support requests.",
    icon: Users,
  },
  {
    title: "Role policy",
    body: "Accounts have exactly one role: user or admin. New signups default to user; admin promotion is a direct database update.",
    icon: Settings,
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

export const analyticsSeries = [
  { month: "Jan", revenue: 18, orders: 580 },
  { month: "Feb", revenue: 24, orders: 760 },
  { month: "Mar", revenue: 31, orders: 980 },
  { month: "Apr", revenue: 28, orders: 910 },
  { month: "May", revenue: 43, orders: 1280 },
];

export const rolePanels = [
  {
    role: "User",
    title: "Shop products, manage cart, checkout, orders, addresses, payments, and profile",
    icon: Users,
    metrics: ["default signup role", "self-service account", "no admin access"],
  },
  {
    role: "Admin",
    title: "Manage products, orders, users, payments, refunds, and reports",
    icon: ShieldAlert,
    metrics: ["manual database role", "restricted dashboard", "catalog control"],
  },
];
