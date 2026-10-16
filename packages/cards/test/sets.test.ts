import { describe, expect, test } from 'vitest';
import cards from '../src/data/cards.json';
import setIds from '../src/sets.json';
import { registry } from './helpers.ts';

/** Cards per set as TCGdex counts them: the sets imported whole for the leader meta decks. */
const SIZES: Record<string, number> = {
  sv01: 258,
  sv02: 279,
  sv04: 266,
  sv05: 218,
  sv06: 226,
  'sv06.5': 99,
  sv07: 175,
  sv09: 190,
  'me02.5': 295,
  me03: 124,
};

const idsOf = (set: string) => Object.keys(cards).filter((id) => id.startsWith(`${set}-`));

describe('whole-set imports', () => {
  test('the new sets are imported whole', () => {
    for (const [set, n] of Object.entries(SIZES)) expect(idsOf(set).length, set).toBe(n);
  });
  test('every card of the new sets becomes a card definition', () => {
    for (const set of Object.keys(SIZES)) for (const id of idsOf(set)) expect(registry.defs[id], id).toBeDefined();
  });
  test('the new sets are shop sets', () => {
    for (const set of Object.keys(SIZES)) expect(setIds, set).toContain(set);
  });
});
