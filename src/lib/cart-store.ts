import { useEffect, useSyncExternalStore } from "react";

type CartItem = { id: string; qty: number };
type CartSnapshot = { items: CartItem[]; hydrated: boolean };

const KEY = "lapkart_cart_v1";
const EMPTY_ITEMS: CartItem[] = [];
const EMPTY_SNAPSHOT: CartSnapshot = { items: EMPTY_ITEMS, hydrated: false };

let snapshot: CartSnapshot = EMPTY_SNAPSHOT;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeCartItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const qty = Number(item.qty);
    if (!id || !Number.isFinite(qty) || qty <= 0) return [];
    return [{ id, qty: Math.max(1, Math.floor(qty)) }];
  });
}

function readStoredItems(): CartItem[] {
  if (typeof window === "undefined") return EMPTY_ITEMS;
  try {
    const raw = window.localStorage.getItem(KEY);
    return normalizeCartItems(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function persist(nextItems: CartItem[]) {
  snapshot = { items: nextItems, hydrated: true };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(nextItems));
  }
  emitChange();
}

function hydrateCart() {
  if (typeof window === "undefined") return;
  const nextItems = readStoredItems();
  const nextSnapshot = { items: nextItems, hydrated: true };
  if (
    snapshot.hydrated &&
    snapshot.items.length === nextItems.length &&
    snapshot.items.every(
      (item, index) => item.id === nextItems[index]?.id && item.qty === nextItems[index]?.qty,
    )
  ) {
    return;
  }
  snapshot = nextSnapshot;
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

export const cart = {
  subscribe,
  snapshot: () => snapshot.items,
  add(id: string, qty = 1) {
    hydrateCart();
    const normalizedId = id.trim();
    const normalizedQty = Math.max(1, Math.floor(qty));
    if (!normalizedId) return;
    const existing = snapshot.items.find((item) => item.id === normalizedId);
    const nextItems = existing
      ? snapshot.items.map((item) =>
          item.id === normalizedId ? { ...item, qty: item.qty + normalizedQty } : item,
        )
      : [...snapshot.items, { id: normalizedId, qty: normalizedQty }];
    persist(nextItems);
  },
  remove(id: string) {
    hydrateCart();
    persist(snapshot.items.filter((item) => item.id !== id));
  },
  setQty(id: string, qty: number) {
    hydrateCart();
    const normalizedQty = Math.floor(qty);
    if (normalizedQty <= 0) {
      cart.remove(id);
      return;
    }
    persist(
      snapshot.items.map((item) => (item.id === id ? { ...item, qty: normalizedQty } : item)),
    );
  },
  clear() {
    hydrateCart();
    persist([]);
  },
};

export function useCart() {
  return useCartState().items;
}

export function useCartState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hydrateCart();
    if (typeof window === "undefined") return undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) hydrateCart();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { items: state.items, isHydrated: state.hydrated };
}
