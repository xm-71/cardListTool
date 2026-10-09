import { CREDITS } from '@ptcg/economy';
import { emptyGym, normalizeGym, type GymProgress } from '../game/gym.ts';
import { MAX_BINDERS, normalizeBinder } from './binders.ts';

export interface CustomDeck {
  id: string;
  name: string;
  cards: { id: string; count: number }[];
}

export const BINDER_COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'ink', 'cream', 'pink'] as const;
export const BINDER_BACKGROUNDS = ['plain', 'pokeball', 'stripes', 'stars', 'grid', 'energy'] as const;
export const STICKER_SPOTS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;
export const STICKERS = ['pokeball', 'star', 'heart', 'crown', 'flame', 'leaf', 'drop', 'bolt'] as const;
export type BinderColor = (typeof BINDER_COLORS)[number];
export type BinderBackground = (typeof BINDER_BACKGROUNDS)[number];
export type StickerSpot = (typeof STICKER_SPOTS)[number];
export type StickerId = (typeof STICKERS)[number];

/** A player-made binder: 9-pocket pages of owned cards, with a decorated cover. */
export interface CustomBinder {
  id: string;
  name: string;
  coverColor: BinderColor;
  pageColor: BinderColor;
  background: BinderBackground;
  /** Up to 4 stickers in fixed spots on the cover. */
  stickers: Partial<Record<StickerSpot, StickerId>>;
  /** Each page has exactly 9 slots holding a card id or null; there is always at least 1 page. */
  pages: (string | null)[][];
  /** When it was last saved (ms since epoch); the newest binder is shown in Collector mode's menu. */
  updatedAt: number;
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
  binders: CustomBinder[];
  /** Free packs; battling hidden. */
  collectorMode: boolean;
  /** Kanto Gym Challenge progress. */
  gym: GymProgress;
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
    binders: [],
    collectorMode: false,
    gym: emptyGym(),
  };
}

/** Fills fields that older saved profiles (M4) don't have. */
export function normalizeProfile(raw: Partial<Profile> & { version: 1 }): Profile {
  const binders = Array.isArray(raw.binders)
    ? raw.binders
        .map(normalizeBinder)
        .filter((b): b is CustomBinder => b !== null)
        .slice(0, MAX_BINDERS)
    : [];
  return {
    ...newProfile(),
    ...raw,
    binders,
    collectorMode: raw.collectorMode === true,
    gym: normalizeGym(raw.gym),
  };
}
