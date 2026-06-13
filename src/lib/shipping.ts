export const MANUAL_DELIVERY_MIN_CHARGE = 50;
export const MANUAL_DELIVERY_RATE_PER_KG = 40;
export const MANUAL_DELIVERY_FREE_SUBTOTAL = 2000;
export const MANUAL_DELIVERY_REGION = 'Tamil Nadu';
export const COD_HANDLING_FEE = 40;
export const DEFAULT_PACKAGE_WEIGHT_KG = 0.5;
// Mirrors app_settings.manual_cutoff_hour_ist (24h, IST). Orders placed before
// this hour ship same day; the PDP countdown is driven entirely by this real
// value — no fabricated timer.
export const MANUAL_DISPATCH_CUTOFF_HOUR_IST = 17;

export type WeightedCartRow = {
	item: { qty: number };
	product: { weight_kg?: number | null };
};

export function normalizedPackageWeightKg(weightKg: number | null | undefined) {
	return Number.isFinite(weightKg) && Number(weightKg) > 0
		? Number(weightKg)
		: DEFAULT_PACKAGE_WEIGHT_KG;
}

export function calculateManualDeliveryCharge(weightKg: number, subtotal: number) {
	if (subtotal <= 0) return 0;
	if (subtotal >= MANUAL_DELIVERY_FREE_SUBTOTAL) return 0;
	const chargeableKg = Math.max(1, Math.ceil(normalizedPackageWeightKg(weightKg)));
	return Math.max(MANUAL_DELIVERY_MIN_CHARGE, chargeableKg * MANUAL_DELIVERY_RATE_PER_KG);
}

export function isTamilNaduState(state: string | null | undefined) {
	const normalized = String(state ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z]/g, '');
	return normalized === 'tamilnadu' || normalized === 'tn';
}

export function calculateCartWeightKg(rows: WeightedCartRow[]) {
	return rows.reduce(
		(sum, row) =>
			sum + normalizedPackageWeightKg(row.product.weight_kg) * Math.max(1, row.item.qty),
		0
	);
}
