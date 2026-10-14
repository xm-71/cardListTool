import type { Profile } from '../profile/types.ts';
import { CloudError, type AuthEvent, type CloudApi, type CloudSave, type CloudUser } from './cloudApi.ts';

export interface FakeServer {
  users: Map<string, { id: string; password: string; confirmed: boolean }>;
  saves: Map<string, CloudSave>;
  /** Every call fails as if the network were down. */
  offline: boolean;
  /** Every save call fails as if the project were paused. */
  unavailable: boolean;
}

/** An in-memory account service with the same rev rules as the real table. Used by unit tests and the e2e. */
export function createFakeCloud(): { api: CloudApi; server: FakeServer; emit(e: AuthEvent): void } {
  const server: FakeServer = { users: new Map(), saves: new Map(), offline: false, unavailable: false };
  const listeners = new Set<(e: AuthEvent, user: CloudUser | null) => void>();
  let session: CloudUser | null = null;
  let nextId = 1;

  const reachable = () => {
    if (server.offline) throw new CloudError('network');
  };
  const dataAvailable = () => {
    reachable();
    if (server.unavailable) throw new CloudError('unavailable');
  };
  const emit = (e: AuthEvent) => listeners.forEach((cb) => cb(e, session));

  const api: CloudApi = {
    getUser: () => Promise.resolve(session),
    async signUp(email, password) {
      reachable();
      if (server.users.has(email)) throw new CloudError('emailInUse');
      if (password.length < 8) throw new CloudError('weakPassword');
      server.users.set(email, { id: `user-${nextId++}`, password, confirmed: false });
      return { needsConfirmation: true };
    },
    async signIn(email, password) {
      reachable();
      const u = server.users.get(email);
      if (!u || u.password !== password || !u.confirmed) {
        throw new CloudError('invalidCredentials');
      }
      session = { id: u.id, email };
      emit('signedIn');
      return session;
    },
    async signOut() {
      session = null;
      emit('signedOut');
    },
    async requestPasswordReset() {
      reachable();
      return;
    },
    async updatePassword(password) {
      reachable();
      if (!session) throw new CloudError('invalidLink');
      if (password.length < 8) throw new CloudError('weakPassword');
      server.users.get(session.email)!.password = password;
      return;
    },
    onAuthChange(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    async loadSave() {
      dataAvailable();
      return session ? (server.saves.get(session.id) ?? null) : null;
    },
    async saveSave(data: Profile, expectedRev) {
      dataAvailable();
      if (!session) throw new CloudError('invalidCredentials');
      const row = server.saves.get(session.id);
      if (expectedRev === 0) {
        if (row) return { ok: false };
        server.saves.set(session.id, { data: structuredClone(data), rev: 1 });
        return { ok: true, rev: 1 };
      }
      if (!row || row.rev !== expectedRev) return { ok: false };
      server.saves.set(session.id, { data: structuredClone(data), rev: expectedRev + 1 });
      return { ok: true, rev: expectedRev + 1 };
    },
  };
  return { api, server, emit };
}
