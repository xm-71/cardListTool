import { create } from 'zustand';
import { setCards } from '@ptcg/cards';
import { CREDITS, openPack } from '@ptcg/economy';
import { openIndexedDbStore } from './indexedDbStore.ts';
import { createMemoryStore } from './memoryStore.ts';
import { newProfile, type CustomDeck, type Profile, type ProfileStore } from './types.ts';

/** How many awarded game seeds to remember. */
const AWARD_HISTORY = 200;

/** Opens IndexedDB, falling back to an in-memory store that won't survive a reload. */
export async function connectProfileStore(
  open: () => Promise<ProfileStore> = () => openIndexedDbStore(),
): Promise<{ store: ProfileStore; persistent: boolean }> {
  try {
    const store = await open();
    await store.load();
    return { store, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}

export const MAX_NAME = 10;

/** Trimmed, at most 10 characters, and "PLAYER" when empty. */
function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME) || 'PLAYER';
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

interface ProfileState {
  profile: Profile;
  persistent: boolean;
  ready: boolean;
  store: ProfileStore;
  init(store: ProfileStore, persistent: boolean): Promise<void>;
  /** Adds credits for a finished bot game, once per game seed. */
  award(seed: number, amount: number): Promise<void>;
  /** Pays for and opens a pack; the cards are saved before this resolves. */
  buyPack(setId: string): Promise<string[]>;
  saveDeck(deck: CustomDeck): Promise<void>;
  deleteDeck(id: string): Promise<void>;
  /** Ends the intro. An empty name or a null deck keeps what the profile already has (else PLAYER / Mega Gengar). */
  finishIntro(name: string, deck: string | null): Promise<void>;
  setName(name: string): Promise<void>;
  replayIntro(): Promise<void>;
  reset(): void;
}

/** Resolves once `init` has loaded the real profile; recreated by `reset`. */
function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

export const useProfile = create<ProfileState>()((set, get) => {
  let loaded = deferred();
  let queue: Promise<unknown> = Promise.resolve();
  /**
   * Runs one change at a time: waits for the profile to load, re-reads the stored profile (another tab may
   * have changed it), saves the result, and only then shows it. A change that throws or fails to save
   * leaves both storage and the screen as they were.
   */
  const change = <T>(fn: (p: Profile) => { next: Profile; result: T } | null): Promise<T | undefined> => {
    const run = queue.then(async () => {
      await loaded.promise;
      const { store } = get();
      const outcome = fn(await store.load());
      if (!outcome) return undefined;
      await store.save(outcome.next);
      set({ profile: outcome.next });
      return outcome.result;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    profile: newProfile(),
    persistent: false,
    ready: false,
    store: createMemoryStore(),
    async init(store, persistent) {
      const profile = await store.load();
      set({ store, persistent, profile, ready: true });
      loaded.resolve();
    },
    async award(seed, amount) {
      await change((p) =>
        p.awardedGames.includes(seed)
          ? null
          : {
              next: {
                ...p,
                credits: p.credits + amount,
                awardedGames: [...p.awardedGames, seed].slice(-AWARD_HISTORY),
              },
              result: undefined,
            },
      );
    },
    async buyPack(setId) {
      const cards = await change((p) => {
        if (p.credits < CREDITS.packPrice) throw new Error('Not enough credits');
        const { cards } = openPack(setId, setCards(setId), randomSeed());
        const collection = { ...p.collection };
        for (const id of cards) collection[id] = (collection[id] ?? 0) + 1;
        return { next: { ...p, credits: p.credits - CREDITS.packPrice, collection }, result: cards };
      });
      return cards!;
    },
    async saveDeck(deck) {
      await change((p) => {
        const exists = p.decks.some((d) => d.id === deck.id);
        const decks = exists ? p.decks.map((d) => (d.id === deck.id ? deck : d)) : [...p.decks, deck];
        return { next: { ...p, decks }, result: undefined };
      });
    },
    async deleteDeck(id) {
      await change((p) => ({ next: { ...p, decks: p.decks.filter((d) => d.id !== id) }, result: undefined }));
    },
    async finishIntro(name, deck) {
      await change((p) => ({
        next: {
          ...p,
          playerName: name.trim() ? cleanName(name) : (p.playerName ?? 'PLAYER'),
          starterDeck: deck ?? p.starterDeck ?? 'mega-gengar',
          introDone: true,
        },
        result: undefined,
      }));
    },
    async setName(name) {
      await change((p) => ({ next: { ...p, playerName: cleanName(name) }, result: undefined }));
    },
    async replayIntro() {
      await change((p) => ({ next: { ...p, introDone: false }, result: undefined }));
    },
    reset() {
      loaded = deferred();
      queue = Promise.resolve();
      set({ profile: newProfile(), persistent: false, ready: false, store: createMemoryStore() });
    },
  };
});
