import { newProfile, type Profile, type ProfileStore } from './types.ts';

const STORE = 'profile';
const KEY = 'me';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** Opens the browser profile database. Rejects when IndexedDB is unavailable (e.g. private browsing). */
export async function openIndexedDbStore(dbName = 'ptcg'): Promise<ProfileStore> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable');
  const open = indexedDB.open(dbName, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE);
  const db = await request(open);
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  return {
    async load() {
      const stored = (await request(tx('readonly').get(KEY))) as Profile | undefined;
      return stored?.version === 1 ? stored : newProfile();
    },
    async save(p) {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(p, KEY);
      await new Promise<void>((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error ?? new Error('IndexedDB write failed'));
        t.onabort = () => reject(t.error ?? new Error('IndexedDB write aborted'));
      });
    },
  };
}
