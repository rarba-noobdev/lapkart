export const MANUAL_DELIVERY_MIN_CHARGE = 50;
export const MANUAL_DELIVERY_RATE_PER_KG = 40;
export const DEFAULT_PACKAGE_WEIGHT_KG = 0.5;

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
	const chargeableKg = Math.max(1, Math.ceil(normalizedPackageWeightKg(weightKg)));
	return Math.max(MANUAL_DELIVERY_MIN_CHARGE, chargeableKg * MANUAL_DELIVERY_RATE_PER_KG);
}

export function calculateCartWeightKg(rows: WeightedCartRow[]) {
	return rows.reduce(
		(sum, row) =>
			sum + normalizedPackageWeightKg(row.product.weight_kg) * Math.max(1, row.item.qty),
		0
	);
}
