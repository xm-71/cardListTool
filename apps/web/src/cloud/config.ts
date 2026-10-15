/**
 * The Supabase project URL and public key, or null when the build has no account service configured.
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` win; the names the Vercel Supabase integration adds
 * (`NEXT_PUBLIC_SUPABASE_URL` with its anon or publishable key) work too. Only these public values are
 * exposed to the browser (see `envPrefix` in vite.config.ts); service-role keys and database URLs never are.
 */
export function cloudConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>,
): { url: string; key: string } | null {
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
