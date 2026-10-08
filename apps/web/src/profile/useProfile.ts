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
  reset(): void;
}

export const useProfile = create<ProfileState>()((set, get) => {
  /** Applies a change synchronously (so checks can't race) and then persists it. */
  const commit = (next: Profile): Promise<void> => {
    set({ profile: next });
    return get().store.save(next);
  };
  return {
    profile: newProfile(),
    persistent: false,
    ready: false,
    store: createMemoryStore(),
    async init(store, persistent) {
      const profile = await store.load();
      set({ store, persistent, profile, ready: true });
    },
    award(seed, amount) {
      const p = get().profile;
      if (p.awardedGames.includes(seed)) return Promise.resolve();
      return commit({
        ...p,
        credits: p.credits + amount,
        awardedGames: [...p.awardedGames, seed].slice(-AWARD_HISTORY),
      });
    },
    async buyPack(setId) {
      const p = get().profile;
      if (p.credits < CREDITS.packPrice) throw new Error('Not enough credits');
      const { cards } = openPack(setId, setCards(setId), randomSeed());
      const collection = { ...p.collection };
      for (const id of cards) collection[id] = (collection[id] ?? 0) + 1;
      await commit({ ...p, credits: p.credits - CREDITS.packPrice, collection });
      return cards;
    },
    saveDeck(deck) {
      const p = get().profile;
      const exists = p.decks.some((d) => d.id === deck.id);
      return commit({
        ...p,
        decks: exists ? p.decks.map((d) => (d.id === deck.id ? deck : d)) : [...p.decks, deck],
      });
    },
    deleteDeck(id) {
      const p = get().profile;
      return commit({ ...p, decks: p.decks.filter((d) => d.id !== id) });
    },
    reset() {
      set({ profile: newProfile(), persistent: false, ready: false, store: createMemoryStore() });
    },
  };
});
