import type { Profile } from '../profile/types.ts';

/** Everything the app needs from an account service; the real one is Supabase, tests and e2e use a fake. */

export interface CloudUser {
  id: string;
  email: string;
}

export type CloudErrorCode =
  | 'emailInUse'
  | 'invalidCredentials'
  | 'weakPassword'
  | 'invalidLink'
  | 'network'
  | 'unavailable'
  | 'unknown';

export class CloudError extends Error {
  constructor(readonly code: CloudErrorCode) {
    super(code);
    this.name = 'CloudError';
  }
}

export type AuthEvent = 'signedIn' | 'signedOut' | 'passwordRecovery';

export interface CloudSave {
  data: unknown;
  rev: number;
}

/** `ok: false` means another device saved in between (a rev conflict). */
export type SaveResult = { ok: true; rev: number } | { ok: false };

export interface CloudApi {
  getUser(): Promise<CloudUser | null>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<CloudUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  onAuthChange(cb: (e: AuthEvent, user: CloudUser | null) => void): () => void;
  loadSave(): Promise<CloudSave | null>;
  saveSave(data: Profile, expectedRev: number): Promise<SaveResult>;
}
