/** The Supabase project URL and public anon key, or null when the build has no account service configured. */
export function cloudConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
