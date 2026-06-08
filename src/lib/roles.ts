export const staffRoles = ['owner', 'admin'] as const;

export const appRoles = [...staffRoles, 'user'] as const;

export type StaffRole = (typeof staffRoles)[number];
export type AppRole = (typeof appRoles)[number];

const staffRoleSet = new Set<string>(staffRoles);
const appRoleSet = new Set<string>(appRoles);

export function normalizeAppRole(value: unknown): AppRole {
	return typeof value === 'string' && appRoleSet.has(value) ? (value as AppRole) : 'user';
}

export function isStaffRole(value: unknown): value is StaffRole {
	return typeof value === 'string' && staffRoleSet.has(value);
}

export function isOwnerOrAdmin(value: unknown): value is 'owner' | 'admin' {
	return value === 'owner' || value === 'admin';
}

export function roleLabel(value: AppRole | null | undefined) {
	switch (value) {
		case 'owner':
			return 'Owner';
		case 'admin':
			return 'Admin';
		default:
			return 'Customer';
	}
}
