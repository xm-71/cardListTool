import { CREDITS } from '@ptcg/economy';

export interface CustomDeck {
  id: string;
  name: string;
  cards: { id: string; count: number }[];
}

export interface Profile {
  version: 1;
  credits: number;
  /** Owned copies by card id. */
  collection: Record<string, number>;
  decks: CustomDeck[];
  /** Seeds of bot games that already paid credits (most recent last). */
  awardedGames: number[];
  /** Set by the first-launch intro. */
  playerName: string | null;
  /** Starter deck picked in the intro: the default "Your deck" in Duel. */
  starterDeck: string | null;
  introDone: boolean;
}

/** Where a profile lives. IndexedDB today; a server once accounts exist. */
export interface ProfileStore {
  load(): Promise<Profile>;
  save(p: Profile): Promise<void>;
}

export function newProfile(): Profile {
  return {
    version: 1,
    credits: CREDITS.start,
    collection: {},
    decks: [],
    awardedGames: [],
    playerName: null,
    starterDeck: null,
    introDone: false,
  };
}

/** Fills fields that older saved profiles (M4) don't have. */
export function normalizeProfile(raw: Partial<Profile> & { version: 1 }): Profile {
  return { ...newProfile(), ...raw };
}
