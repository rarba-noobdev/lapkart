import { supabase } from "@/integrations/supabase/client";

export async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.access_token) return data.session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error) throw refreshed.error;
  return refreshed.data.session?.access_token ?? null;
}

export async function getAuthorizationHeaders() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
