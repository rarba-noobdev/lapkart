function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function deriveApiBase() {
  const explicit = import.meta.env.VITE_API_BASE_URL;
  if (explicit) return trimTrailingSlash(explicit);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) return `${trimTrailingSlash(supabaseUrl)}/functions/v1/api`;

  return "http://127.0.0.1:8080";
}

export const apiBase = deriveApiBase();
