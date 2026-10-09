import type { DeckList } from '@ptcg/engine';

/** The Scarlet & Violet 151 set: the only non-Standard cards the Gym format allows. */
export const GYM_SET = 'sv03.5';

/** The Kanto leader decks, by id. Each deck task adds its own entry. */
export const GYM_DECKS = {} satisfies Record<string, DeckList>;

export type GymDeckId = keyof typeof GYM_DECKS;
