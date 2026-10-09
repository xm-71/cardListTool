import type { DeckList } from '@ptcg/engine';
import brock from './decks/gym/brock.json';
import erika from './decks/gym/erika.json';
import koga from './decks/gym/koga.json';
import misty from './decks/gym/misty.json';
import sabrina from './decks/gym/sabrina.json';
import surge from './decks/gym/surge.json';

/** The Scarlet & Violet 151 set: the only non-Standard cards the Gym format allows. */
export const GYM_SET = 'sv03.5';

/** The Kanto leader decks, by id. Each deck task adds its own entry. */
export const GYM_DECKS = {
  brock,
  surge,
  misty,
  erika,
  koga,
  sabrina,
} satisfies Record<string, DeckList>;

export type GymDeckId = keyof typeof GYM_DECKS;
