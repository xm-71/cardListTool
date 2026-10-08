import { expect, test } from 'vitest';
import type { DeckList } from '@ptcg/engine';
import {
  buildRegistry,
  megaKangaskhanDeck,
  megaManectricDeck,
  megaAbomasnowDeck,
  megaVenusaurDeck,
  megaCharizardXDeck,
} from '@ptcg/cards';
import { validateCustomDeck } from '../src/index.ts';

const registry = buildRegistry();
const ownAll = Object.fromEntries(Object.keys(registry.defs).map((id) => [id, 99]));

test.each([
  ['Mega Charizard X ex', megaCharizardXDeck],
  ['Mega Venusaur ex Theme Deck', megaVenusaurDeck],
  ,
  ['Mega Abomasnow ex Theme Deck', megaAbomasnowDeck],
  ,
  ['Mega Manectric ex Theme Deck', megaManectricDeck],
  ,
  ['Mega Kangaskhan ex Theme Deck', megaKangaskhanDeck],
] as [string, DeckList][])('%s theme deck passes the Standard format checks', (_name, deck) => {
  expect(validateCustomDeck(deck, registry, ownAll)).toEqual([]);
});
