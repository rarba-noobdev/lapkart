function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackUrl(value: string) {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(value);
}

function deriveApiBase() {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();

  if (
    explicit &&
    !(import.meta.env.PROD && isLoopbackUrl(explicit) && supabaseUrl)
  ) {
    return trimTrailingSlash(explicit);
  }

  if (supabaseUrl) return `${trimTrailingSlash(supabaseUrl)}/functions/v1/api`;

  return "http://127.0.0.1:8080";
}

export const apiBase = deriveApiBase();
