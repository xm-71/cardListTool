import { describe, expect, test } from 'vitest';
import { CloudError, type CloudErrorCode } from '../src/cloud/cloudApi.ts';
import { cloudConfig } from '../src/cloud/config.ts';
import { friendlyMessage } from '../src/cloud/errors.ts';
import { createFakeCloud } from '../src/cloud/fakeApi.ts';
import { linkErrorFromHash } from '../src/cloud/linkError.ts';
import { createSupabaseApi, type SupabaseLike } from '../src/cloud/supabaseApi.ts';
import { newProfile } from '../src/profile/types.ts';

describe('cloudConfig', () => {
  test('is null unless both variables are set', () => {
    expect(cloudConfig({})).toBeNull();
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(cloudConfig({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(cloudConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(cloudConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({
      url: 'https://x.supabase.co',
      key: 'k',
    });
  });
});

describe('friendlyMessage', () => {
  test('has a sentence for every code', () => {
    const codes: CloudErrorCode[] = [
      'emailInUse',
      'invalidCredentials',
      'weakPassword',
      'invalidLink',
      'network',
      'unavailable',
      'unknown',
      'emailNotConfirmed',
    ];
    for (const c of codes) expect(friendlyMessage(c).length).toBeGreaterThan(10);
    expect(friendlyMessage('emailInUse')).toBe('That email is already in use.');
    expect(friendlyMessage('invalidCredentials')).toBe('Wrong email or password.');
  });
});

describe('the fake cloud', () => {
  test('sign up needs confirmation; signing in before confirming fails; after confirming it works', async () => {
    const { api, server } = createFakeCloud();
    expect(await api.signUp('ash@example.com', 'pikachu99')).toEqual({ needsConfirmation: true });
    await expect(api.signIn('ash@example.com', 'pikachu99')).rejects.toMatchObject({
      code: 'emailNotConfirmed',
    });
    await expect(api.signIn('ash@example.com', 'wrongwrong')).rejects.toMatchObject({
      code: 'invalidCredentials',
    });
    server.users.get('ash@example.com')!.confirmed = true;
    const user = await api.signIn('ash@example.com', 'pikachu99');
    expect(user.email).toBe('ash@example.com');
    expect(await api.getUser()).toEqual(user);
  });

  test('a taken email and a short password are rejected', async () => {
    const { api } = createFakeCloud();
    await api.signUp('a@b.co', 'longenough');
    await expect(api.signUp('a@b.co', 'longenough')).rejects.toMatchObject({ code: 'emailInUse' });
    await expect(api.signUp('c@d.co', 'short')).rejects.toMatchObject({ code: 'weakPassword' });
  });

  async function signedIn() {
    const fake = createFakeCloud();
    await fake.api.signUp('a@b.co', 'longenough');
    fake.server.users.get('a@b.co')!.confirmed = true;
    await fake.api.signIn('a@b.co', 'longenough');
    return fake;
  }

  test('saveSave with rev 0 inserts at rev 1, with the current rev bumps it, with a stale rev conflicts', async () => {
    const { api } = await signedIn();
    const p = newProfile();
    expect(await api.saveSave(p, 0)).toEqual({ ok: true, rev: 1 });
    expect(await api.saveSave({ ...p, credits: 7 }, 1)).toEqual({ ok: true, rev: 2 });
    expect(await api.saveSave({ ...p, credits: 9 }, 1)).toEqual({ ok: false });
    expect(await api.saveSave(p, 0)).toEqual({ ok: false });
    expect(((await api.loadSave())!.data as { credits: number }).credits).toBe(7);
  });

  test('loadSave is null without a row and never shows another user’s row', async () => {
    const a = await signedIn();
    expect(await a.api.loadSave()).toBeNull();
    await a.api.saveSave(newProfile(), 0);
    await a.api.signOut();
    await a.api.signUp('x@y.co', 'longenough');
    a.server.users.get('x@y.co')!.confirmed = true;
    await a.api.signIn('x@y.co', 'longenough');
    expect(await a.api.loadSave()).toBeNull();
  });

  test('offline throws network, unavailable throws unavailable', async () => {
    const { api, server } = await signedIn();
    server.offline = true;
    await expect(api.loadSave()).rejects.toMatchObject({ code: 'network' });
    await expect(api.saveSave(newProfile(), 0)).rejects.toBeInstanceOf(CloudError);
    server.offline = false;
    server.unavailable = true;
    await expect(api.loadSave()).rejects.toMatchObject({ code: 'unavailable' });
  });

  test('auth events reach listeners until they unsubscribe', async () => {
    const { api, emit } = createFakeCloud();
    const seen: string[] = [];
    const off = api.onAuthChange((e) => seen.push(e));
    emit('passwordRecovery');
    off();
    emit('signedOut');
    expect(seen).toEqual(['passwordRecovery']);
  });
});

type Err = { message: string; code?: string; status?: number } | null;

function stubClient(parts: {
  signUpUser?: { id: string; email?: string; identities?: unknown[] };
  signOutArgs?: unknown[];
  signUpError?: Err;
  signInError?: Err;
  updateRows?: unknown[];
  insertResult?: { data: unknown[] | null; error: Err };
  recorded?: string[];
}): SupabaseLike {
  const log = parts.recorded ?? [];
  const user = { id: 'u1', email: 'a@b.co' };
  return {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user } }, error: null }),
      signUp: () =>
        Promise.resolve({
          data: { user: parts.signUpUser ?? user, session: null },
          error: parts.signUpError ?? null,
        }),
      signInWithPassword: () => Promise.resolve({ data: { user }, error: parts.signInError ?? null }),
      signOut: (o?: unknown) => {
        parts.signOutArgs?.push(o);
        return Promise.resolve({ error: null });
      },
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      insert: (row: object) => {
        log.push(`insert ${JSON.stringify((row as { rev: number }).rev)}`);
        return {
          select: () => Promise.resolve(parts.insertResult ?? { data: [{ rev: 1 }], error: null }),
        };
      },
      update: (row: object) => ({
        eq: (c1: string, v1: unknown) => ({
          eq: (c2: string, v2: unknown) => ({
            select: () => {
              log.push(`update rev=${(row as { rev: number }).rev} ${c1}=${String(v1)} ${c2}=${String(v2)}`);
              return Promise.resolve({ data: parts.updateRows ?? [{ rev: 2 }], error: null });
            },
          }),
        }),
      }),
    }),
  };
}

describe('createSupabaseApi', () => {
  test('maps Supabase errors to codes', async () => {
    const taken = createSupabaseApi(stubClient({ signUpError: { message: 'User already registered' } }));
    await expect(taken.signUp('a@b.co', 'longenough')).rejects.toMatchObject({ code: 'emailInUse' });
    const bad = createSupabaseApi(stubClient({ signInError: { message: 'Invalid login credentials' } }));
    await expect(bad.signIn('a@b.co', 'x')).rejects.toMatchObject({ code: 'invalidCredentials' });
    const weak = createSupabaseApi(
      stubClient({ signUpError: { message: 'Password should be at least 8 characters.' } }),
    );
    await expect(weak.signUp('a@b.co', 'x')).rejects.toMatchObject({ code: 'weakPassword' });
    const offline = createSupabaseApi({
      ...stubClient({}),
      auth: {
        ...stubClient({}).auth,
        signInWithPassword: () => Promise.reject(new TypeError('Failed to fetch')),
      },
    });
    await expect(offline.signIn('a@b.co', 'x')).rejects.toMatchObject({ code: 'network' });
  });

  test('sign up reports whether the email must be confirmed', async () => {
    const api = createSupabaseApi(stubClient({}));
    expect(await api.signUp('a@b.co', 'longenough')).toEqual({ needsConfirmation: true });
  });

  test('saveSave updates with the user and rev conditions and treats zero rows as a conflict', async () => {
    const recorded: string[] = [];
    const ok = createSupabaseApi(stubClient({ recorded }));
    expect(await ok.saveSave(newProfile(), 1)).toEqual({ ok: true, rev: 2 });
    expect(recorded).toEqual(['update rev=2 user_id=u1 rev=1']);
    const stale = createSupabaseApi(stubClient({ updateRows: [] }));
    expect(await stale.saveSave(newProfile(), 1)).toEqual({ ok: false });
  });

  test('saveSave with rev 0 inserts at rev 1, and a unique violation is a conflict', async () => {
    const recorded: string[] = [];
    const api = createSupabaseApi(stubClient({ recorded }));
    expect(await api.saveSave(newProfile(), 0)).toEqual({ ok: true, rev: 1 });
    expect(recorded).toEqual(['insert 1']);
    const dup = createSupabaseApi(
      stubClient({ insertResult: { data: null, error: { message: 'duplicate key', code: '23505' } } }),
    );
    expect(await dup.saveSave(newProfile(), 0)).toEqual({ ok: false });
  });
});

describe('what real Supabase does that the first version missed', () => {
  test('signing up with an email that already has an account (an obfuscated user) is emailInUse', async () => {
    const api = createSupabaseApi(stubClient({ signUpUser: { id: 'u9', email: 'a@b.co', identities: [] } }));
    await expect(api.signUp('a@b.co', 'longenough')).rejects.toMatchObject({ code: 'emailInUse' });
    const fresh = createSupabaseApi(
      stubClient({ signUpUser: { id: 'u9', email: 'a@b.co', identities: [{}] } }),
    );
    expect(await fresh.signUp('a@b.co', 'longenough')).toEqual({ needsConfirmation: true });
  });

  test('"Email not confirmed" is its own code, not wrong credentials', async () => {
    const api = createSupabaseApi(stubClient({ signInError: { message: 'Email not confirmed' } }));
    await expect(api.signIn('a@b.co', 'longenough')).rejects.toMatchObject({ code: 'emailNotConfirmed' });
    expect(friendlyMessage('emailNotConfirmed')).toBe('Confirm your email first (check your inbox).');
  });

  test('signing out only signs out this device', async () => {
    const signOutArgs: unknown[] = [];
    await createSupabaseApi(stubClient({ signOutArgs })).signOut();
    expect(signOutArgs).toEqual([{ scope: 'local' }]);
  });
});

describe('linkErrorFromHash', () => {
  test('an expired or invalid link in the URL hash is invalidLink', () => {
    expect(
      linkErrorFromHash(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toBe('invalidLink');
    expect(linkErrorFromHash('#error_code=otp_expired')).toBe('invalidLink');
    expect(linkErrorFromHash('#error=access_denied')).toBe('invalidLink');
  });

  test('anything else is null', () => {
    expect(linkErrorFromHash('')).toBeNull();
    expect(linkErrorFromHash('#access_token=abc&type=recovery')).toBeNull();
    expect(linkErrorFromHash('#/gym')).toBeNull();
  });
});
