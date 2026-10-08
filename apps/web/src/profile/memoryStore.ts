import { newProfile, type Profile, type ProfileStore } from './types.ts';

/** A profile kept only in memory: used in tests and when IndexedDB is unavailable. */
export function createMemoryStore(initial?: Profile): ProfileStore {
  let current = structuredClone(initial ?? newProfile());
  return {
    load: () => Promise.resolve(structuredClone(current)),
    save(p) {
      current = structuredClone(p);
      return Promise.resolve();
    },
  };
}
