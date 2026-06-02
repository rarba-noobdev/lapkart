import { useEffect, useState, useSyncExternalStore } from "react";

type CartItem = { id: string; qty: number };
const KEY = "lapkart_cart_v1";
const EMPTY_CART: CartItem[] = [];

let items: CartItem[] = [];
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    items = raw ? JSON.parse(raw) : [];
  } catch {
    items = [];
  }
}
load();

function save() {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export const cart = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  snapshot: () => items,
  add(id: string, qty = 1) {
    const ex = items.find((i) => i.id === id);
    if (ex) ex.qty += qty;
    else items = [...items, { id, qty }];
    save();
  },
  remove(id: string) {
    items = items.filter((i) => i.id !== id);
    save();
  },
  setQty(id: string, qty: number) {
    if (qty <= 0) return cart.remove(id);
    items = items.map((i) => (i.id === id ? { ...i, qty } : i));
    save();
  },
  clear() {
    items = [];
    save();
  },
};

export function useCart() {
  return useCartState().items;
}

export function useCartState() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const snap = useSyncExternalStore(
    cart.subscribe,
    () => items,
    () => EMPTY_CART,
  );
  return { items: hydrated ? snap : EMPTY_CART, isHydrated: hydrated };
}
