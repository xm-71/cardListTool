import type { Profile } from '../profile/types.ts';
import { CloudError, type AuthEvent, type CloudApi, type CloudUser, type SaveResult } from './cloudApi.ts';

interface SbError {
  message: string;
  code?: string;
  status?: number;
}
interface SbUser {
  id: string;
  email?: string;
  /** Empty for the obfuscated user Supabase returns when the email already has an account. */
  identities?: unknown[];
}

/** The small part of the Supabase client this file uses, so tests can pass a stub. */
export interface SupabaseLike {
  auth: {
    getSession(): Promise<{ data: { session: { user: SbUser } | null }; error: SbError | null }>;
    signUp(c: { email: string; password: string; options?: { emailRedirectTo?: string } }): Promise<{
      data: { user: SbUser | null; session: unknown };
      error: SbError | null;
    }>;
    signInWithPassword(c: { email: string; password: string }): Promise<{
      data: { user: SbUser | null };
      error: SbError | null;
    }>;
    signOut(o?: { scope: 'local' | 'global' | 'others' }): Promise<{ error: SbError | null }>;
    resetPasswordForEmail(email: string, o?: { redirectTo?: string }): Promise<{ error: SbError | null }>;
    updateUser(a: { password: string }): Promise<{ error: SbError | null }>;
    onAuthStateChange(cb: (event: string, session: { user: SbUser } | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
  from(table: string): {
    select(cols: string): {
      maybeSingle(): Promise<{ data: { data: unknown; rev: number } | null; error: SbError | null }>;
    };
    insert(row: object): { select(cols: string): Promise<{ data: unknown[] | null; error: SbError | null }> };
    update(row: object): {
      eq(
        col: string,
        v: unknown,
      ): {
        eq(
          col: string,
          v: unknown,
        ): { select(cols: string): Promise<{ data: unknown[] | null; error: SbError | null }> };
      };
    };
  };
}

/** Turns anything Supabase (or fetch) throws or returns into a CloudError. */
export function mapError(e: unknown): CloudError {
  if (e instanceof CloudError) return e;
  const err = (e ?? {}) as Partial<SbError> & { name?: string };
  const m = (err.message ?? '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered'))
    return new CloudError('emailInUse');
  if (m.includes('email not confirmed')) return new CloudError('emailNotConfirmed');
  if (m.includes('invalid login credentials')) return new CloudError('invalidCredentials');
  if (m.includes('password should be') || m.includes('weak password')) return new CloudError('weakPassword');
  if (m.includes('session missing') || m.includes('expired') || m.includes('invalid token')) {
    return new CloudError('invalidLink');
  }
  if (e instanceof TypeError || m.includes('failed to fetch') || m.includes('network')) {
    return new CloudError('network');
  }
  if ((err.status ?? 0) >= 500 || m.includes('paused')) return new CloudError('unavailable');
  return new CloudError('unknown');
}

const toUser = (u: SbUser | null | undefined): CloudUser | null =>
  u ? { id: u.id, email: u.email ?? '' } : null;

const EVENTS: Record<string, AuthEvent | undefined> = {
  SIGNED_IN: 'signedIn',
  SIGNED_OUT: 'signedOut',
  PASSWORD_RECOVERY: 'passwordRecovery',
};

const TABLE = 'player_saves';

/** An account service backed by a Supabase project (table `player_saves`, see supabase/migrations). */
export function createSupabaseApi(client: SupabaseLike): CloudApi {
  const guard = async <T>(run: () => Promise<{ error: SbError | null } & T>): Promise<T> => {
    let result;
    try {
      result = await run();
    } catch (e) {
      throw mapError(e);
    }
    if (result.error) throw mapError(result.error);
    return result;
  };
  const sessionUser = async () => {
    const { data } = await guard(() => client.auth.getSession());
    return toUser(data.session?.user);
  };
  const redirect = typeof location === 'undefined' ? undefined : location.origin;

  return {
    getUser: sessionUser,
    async signUp(email, password) {
      const { data } = await guard(() =>
        client.auth.signUp({ email, password, options: { emailRedirectTo: redirect } }),
      );
      // With email confirmation on, Supabase answers a sign-up for an existing account with no error and an
      // obfuscated user that has no identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new CloudError('emailInUse');
      }
      return { needsConfirmation: data.session == null };
    },
    async signIn(email, password) {
      const { data } = await guard(() => client.auth.signInWithPassword({ email, password }));
      const user = toUser(data.user);
      if (!user) throw new CloudError('unknown');
      return user;
    },
    async signOut() {
      await guard(() => client.auth.signOut({ scope: 'local' }));
    },
    async requestPasswordReset(email) {
      await guard(() => client.auth.resetPasswordForEmail(email, { redirectTo: redirect }));
    },
    async updatePassword(password) {
      await guard(() => client.auth.updateUser({ password }));
    },
    onAuthChange(cb) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const mapped = EVENTS[event];
        if (mapped) cb(mapped, toUser(session?.user));
      });
      return () => data.subscription.unsubscribe();
    },
    async loadSave() {
      const { data } = await guard(() => client.from(TABLE).select('data, rev').maybeSingle());
      return data ? { data: data.data, rev: data.rev } : null;
    },
    async saveSave(data: Profile, expectedRev): Promise<SaveResult> {
      const user = await sessionUser();
      if (!user) throw new CloudError('invalidCredentials');
      const now = new Date().toISOString();
      if (expectedRev === 0) {
        try {
          const res = await client
            .from(TABLE)
            .insert({ user_id: user.id, data, rev: 1, updated_at: now })
            .select('rev');
          if (res.error?.code === '23505') return { ok: false };
          if (res.error) throw mapError(res.error);
          return { ok: true, rev: 1 };
        } catch (e) {
          throw mapError(e);
        }
      }
      const res = await guard(() =>
        client
          .from(TABLE)
          .update({ data, rev: expectedRev + 1, updated_at: now })
          .eq('user_id', user.id)
          .eq('rev', expectedRev)
          .select('rev'),
      );
      return (res.data ?? []).length === 0 ? { ok: false } : { ok: true, rev: expectedRev + 1 };
    },
  };
}

/** Loads the Supabase client on demand (it stays out of the main bundle) and wraps it. */
export async function loadSupabaseApi(cfg: { url: string; key: string }): Promise<CloudApi> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
  });
  return createSupabaseApi(client as unknown as SupabaseLike);
}
