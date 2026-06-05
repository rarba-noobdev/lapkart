import { createContext } from 'svelte';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

export type AppRole = 'admin' | 'user' | null;

export type AuthClaims = {
	exp?: number;
	email?: string;
	sub?: string;
} | null;

export type AuthContextValue = {
	supabase: SupabaseClient<Database>;
	session: Session | null;
	user: User | null;
	role: AppRole;
	claims: AuthClaims;
};

export const [getAuthContext, setAuthContext] = createContext<AuthContextValue>();
