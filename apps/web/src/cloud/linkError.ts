import type { CloudErrorCode } from './cloudApi.ts';

/**
 * Supabase sends a player whose confirmation or reset link has expired back to the app with the problem in the
 * URL hash (`#error=access_denied&error_code=otp_expired…`) and no event, so the app has to look for it.
 */
export function linkErrorFromHash(hash: string): CloudErrorCode | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.has('error_code') || params.has('error') ? 'invalidLink' : null;
}
