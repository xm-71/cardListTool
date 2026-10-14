import { create } from 'zustand';
import { CloudError, type CloudApi, type CloudUser } from './cloudApi.ts';
import { cloudConfig } from './config.ts';
import { friendlyMessage } from './errors.ts';
import { linkErrorFromHash } from './linkError.ts';
import { loadSupabaseApi } from './supabaseApi.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plain sentence about what is wrong with the typed email or password, or null when both are fine. */
export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return 'Enter a valid email.';
  if (password.length < 8) return 'Use at least 8 characters.';
  return null;
}

interface CloudState {
  /** An account service is configured and reachable code-wise (the Account section shows). */
  enabled: boolean;
  ready: boolean;
  user: CloudUser | null;
  /** The player followed a password-reset link and must choose a new password. */
  recovering: boolean;
  /** The password was just changed from the reset-link dialog, which still shows the success message. */
  recoverySaved: boolean;
  busy: boolean;
  /** A confirmation or reset link in the address bar was expired or invalid (the plain sentence to show). */
  linkProblem: string | null;
  error: string | null;
  notice: string | null;
  /** Starts the store with `api`, or with the configured Supabase project when omitted; `null` means no accounts. */
  init(api?: CloudApi | null): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestReset(email: string): Promise<void>;
  setNewPassword(password: string): Promise<void>;
  /** Leaves the reset-link dialog without choosing a password (signs out of the link's session). */
  cancelRecovery(): Promise<void>;
  acknowledgeRecovery(): void;
  dismissLinkProblem(): void;
  clearMessages(): void;
  reset(): void;
}

const initial = {
  enabled: false,
  ready: false,
  user: null,
  recovering: false,
  recoverySaved: false,
  busy: false,
  linkProblem: null,
  error: null,
  notice: null,
} as const;

export const useCloud = create<CloudState>((set) => {
  let api: CloudApi | null = null;
  let unsubscribe: (() => void) | null = null;

  /** Runs one account call: busy while it runs, a CloudError becomes a plain sentence. */
  const run = async (task: (api: CloudApi) => Promise<void>) => {
    if (!api) return;
    set({ busy: true, error: null, notice: null });
    try {
      await task(api);
    } catch (e) {
      set({ error: friendlyMessage(e instanceof CloudError ? e.code : 'unknown') });
    } finally {
      set({ busy: false });
    }
  };

  return {
    ...initial,
    async init(given) {
      unsubscribe?.();
      unsubscribe = null;
      if (given === undefined) {
        const cfg = cloudConfig();
        try {
          api = cfg ? await loadSupabaseApi(cfg) : null;
        } catch {
          api = null;
        }
      } else {
        api = given;
      }
      if (!api) {
        set({ ...initial, ready: true });
        return;
      }
      unsubscribe = api.onAuthChange((event, user) => {
        if (event === 'signedOut') set({ user: null, recovering: false });
        else {
          set({
            user,
            ...(event === 'passwordRecovery'
              ? { recovering: true, recoverySaved: false, error: null, notice: null }
              : {}),
          });
        }
      });
      let user: CloudUser | null = null;
      try {
        user = await api.getUser();
      } catch {
        user = null;
      }
      const problem = linkErrorFromHash(location.hash);
      set({ enabled: true, ready: true, user, linkProblem: problem ? friendlyMessage(problem) : null });
    },
    signUp: (email, password) => {
      const problem = validateCredentials(email, password);
      if (problem) {
        set({ error: problem, notice: null });
        return Promise.resolve();
      }
      return run(async (a) => {
        const { needsConfirmation } = await a.signUp(email.trim(), password);
        set({ notice: needsConfirmation ? 'Check your email to confirm your account.' : 'Account created.' });
      });
    },
    signIn: (email, password) => {
      if (!EMAIL.test(email.trim())) {
        set({ error: 'Enter a valid email.', notice: null });
        return Promise.resolve();
      }
      if (!password) {
        set({ error: 'Enter your password.', notice: null });
        return Promise.resolve();
      }
      return run(async (a) => set({ user: await a.signIn(email.trim(), password) }));
    },
    signOut: () =>
      run(async (a) => {
        await a.signOut();
        set({ user: null });
      }),
    requestReset: (email) => {
      if (!EMAIL.test(email.trim())) {
        set({ error: 'Enter a valid email.', notice: null });
        return Promise.resolve();
      }
      return run(async (a) => {
        await a.requestPasswordReset(email.trim());
        set({ notice: 'If that email has an account, a reset link is on its way.' });
      });
    },
    setNewPassword: (password) => {
      if (password.length < 8) {
        set({ error: 'Use at least 8 characters.', notice: null });
        return Promise.resolve();
      }
      return run(async (a) => {
        await a.updatePassword(password);
        set({ recovering: false, recoverySaved: true, notice: 'Password updated. You are signed in.' });
      });
    },
    async cancelRecovery() {
      await run((a) => a.signOut());
      set({ user: null, recovering: false, error: null });
    },
    acknowledgeRecovery: () => set({ recoverySaved: false }),
    dismissLinkProblem() {
      history.replaceState(null, '', location.pathname + location.search);
      set({ linkProblem: null });
    },
    clearMessages: () => set({ error: null, notice: null }),
    reset() {
      unsubscribe?.();
      unsubscribe = null;
      api = null;
      set({ ...initial });
    },
  };
});
