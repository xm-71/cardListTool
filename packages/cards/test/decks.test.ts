import { expect, test } from 'vitest';
import type { CardDef, DeckList } from '@ptcg/engine';
import cards from '../src/data/cards.json';
import gengar from '../src/decks/mega-gengar.json';
import diancie from '../src/decks/mega-diancie.json';

const defs = cards as Record<string, CardDef>;

test.each([
  ['Mega Gengar ex', gengar],
  ['Mega Diancie ex', diancie],
] as [string, DeckList][])('%s deck totals 60 and every card exists in cards.json', (_name, deck) => {
  expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
  for (const c of deck.cards) expect(defs[c.id], c.id).toBeDefined();
});
