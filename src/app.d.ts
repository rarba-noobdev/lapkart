import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import type { AuthClaims } from '$lib/auth-context';
import type { AppRole } from '$lib/roles';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			getRole: () => Promise<AppRole | null>;
		}
		interface PageData {
			cookies?: { name: string; value: string }[];
			claims?: AuthClaims;
			session?: Session | null;
			supabase?: SupabaseClient<Database>;
			user?: User | null;
			role?: AppRole | null;
		}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		dataLayer: unknown[];
		gtag?: (...args: unknown[]) => void;
		Razorpay?: new (options: {
			key: string;
			amount: number;
			currency: string;
			name: string;
			description: string;
			order_id: string;
			prefill: { name: string; email: string; contact: string };
			config?: Record<string, unknown>;
			theme: { color: string };
			modal?: { ondismiss?: () => void };
			handler: (response: {
				razorpay_order_id: string;
				razorpay_payment_id: string;
				razorpay_signature: string;
			}) => void;
		}) => {
			open: () => void;
			on?: (
				event: 'payment.failed',
				handler: (response: { error?: { description?: string; reason?: string } }) => void
			) => void;
		};
	}
}

export {};
