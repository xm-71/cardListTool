import type { DeckList } from '@ptcg/engine';
import brock from './decks/gym/brock.json';
import agatha from './decks/gym/agatha.json';
import blaine from './decks/gym/blaine.json';
import bruno from './decks/gym/bruno.json';
import blueFire from './decks/gym/blue-fire.json';
import blueGrass from './decks/gym/blue-grass.json';
import blueWater from './decks/gym/blue-water.json';
import erika from './decks/gym/erika.json';
import giovanni from './decks/gym/giovanni.json';
import koga from './decks/gym/koga.json';
import lorelei from './decks/gym/lorelei.json';
import lance from './decks/gym/lance.json';
import morty from './decks/gym/morty.json';
import misty from './decks/gym/misty.json';
import sabrina from './decks/gym/sabrina.json';
import whitney from './decks/gym/whitney.json';
import falkner from './decks/gym/falkner.json';
import bugsy from './decks/gym/bugsy.json';
import chuck from './decks/gym/chuck.json';
import jasmine from './decks/gym/jasmine.json';
import pryce from './decks/gym/pryce.json';
import clair from './decks/gym/clair.json';
import surge from './decks/gym/surge.json';
import will from './decks/gym/will.json';
import johtoKoga from './decks/gym/johto-koga.json';
import johtoBruno from './decks/gym/johto-bruno.json';
import karen from './decks/gym/karen.json';
import johtoLance from './decks/gym/johto-lance.json';
import red from './decks/gym/red.json';

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
  blaine,
  giovanni,
  lorelei,
  bruno,
  agatha,
  lance,
  morty,
  whitney,
  falkner,
  bugsy,
  chuck,
  jasmine,
  pryce,
  clair,
  will,
  'johto-koga': johtoKoga,
  'johto-bruno': johtoBruno,
  karen,
  'johto-lance': johtoLance,
  red,
  'blue-fire': blueFire,
  'blue-water': blueWater,
  'blue-grass': blueGrass,
} satisfies Record<string, DeckList>;

export type GymDeckId = keyof typeof GYM_DECKS;
