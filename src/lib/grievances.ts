export type GrievanceCategory =
	| 'order'
	| 'delivery'
	| 'payment'
	| 'refund'
	| 'product'
	| 'privacy'
	| 'other';

export type GrievanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export const GRIEVANCE_CATEGORIES: { value: GrievanceCategory; label: string }[] = [
	{ value: 'order', label: 'Order issue' },
	{ value: 'delivery', label: 'Delivery / shipping' },
	{ value: 'payment', label: 'Payment' },
	{ value: 'refund', label: 'Refund' },
	{ value: 'product', label: 'Product quality' },
	{ value: 'privacy', label: 'Privacy / data' },
	{ value: 'other', label: 'Something else' }
];

export const GRIEVANCE_CATEGORY_SET = new Set<GrievanceCategory>(
	GRIEVANCE_CATEGORIES.map((c) => c.value)
);

export const GRIEVANCE_STATUS_LABEL: Record<GrievanceStatus, string> = {
	open: 'Open',
	in_progress: 'In progress',
	resolved: 'Resolved',
	closed: 'Closed'
};
