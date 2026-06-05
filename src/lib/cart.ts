import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type CartItem = { id: string; qty: number };
type CartState = { items: CartItem[]; hydrated: boolean };

const storageKey = 'lapkart_cart_v1';
const state = writable<CartState>({ items: [], hydrated: false });

function normalize(items: unknown): CartItem[] {
	if (!Array.isArray(items)) return [];

	return items.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const id = typeof item.id === 'string' ? item.id.trim() : '';
		const qty = Number(item.qty);
		if (!id || !Number.isFinite(qty) || qty <= 0) return [];
		return [{ id, qty: Math.max(1, Math.floor(qty)) }];
	});
}

function persist(items: CartItem[]) {
	state.set({ items, hydrated: true });
	if (browser) localStorage.setItem(storageKey, JSON.stringify(items));
}

export function hydrateCart() {
	if (!browser) return;
	try {
		const raw = localStorage.getItem(storageKey);
		state.set({ items: normalize(raw ? JSON.parse(raw) : []), hydrated: true });
	} catch {
		state.set({ items: [], hydrated: true });
	}
}

export function addToCart(id: string, qty = 1) {
	state.update((current) => {
		const items = current.hydrated ? current.items : [];
		const normalizedId = id.trim();
		const normalizedQty = Math.max(1, Math.floor(qty));
		const existing = items.find((item) => item.id === normalizedId);
		const next = existing
			? items.map((item) =>
					item.id === normalizedId ? { ...item, qty: item.qty + normalizedQty } : item
				)
			: [...items, { id: normalizedId, qty: normalizedQty }];
		if (browser) localStorage.setItem(storageKey, JSON.stringify(next));
		return { items: next, hydrated: true };
	});
}

export function setCartQty(id: string, qty: number) {
	if (qty <= 0) {
		removeFromCart(id);
		return;
	}

	state.update((current) => {
		const next = current.items.map((item) =>
			item.id === id ? { ...item, qty: Math.max(1, Math.floor(qty)) } : item
		);
		if (browser) localStorage.setItem(storageKey, JSON.stringify(next));
		return { items: next, hydrated: true };
	});
}

export function removeFromCart(id: string) {
	state.update((current) => {
		const next = current.items.filter((item) => item.id !== id);
		if (browser) localStorage.setItem(storageKey, JSON.stringify(next));
		return { items: next, hydrated: true };
	});
}

export function clearCart() {
	persist([]);
}

export const cartState = {
	subscribe: state.subscribe
};
