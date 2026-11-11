import { describe, expect, test } from 'vitest';
import cards from '../src/data/cards.json';
import setIds from '../src/sets.json';
import { SETS } from '../src/sets.ts';
import { registry } from './helpers.ts';

/** Cards per set as TCGdex counts them: the sets imported whole for the leader meta decks. */
const SIZES: Record<string, number> = {
  sv01: 258,
  sv02: 279,
  sv03: 230,
  sv04: 266,
  sv05: 218,
  sv06: 226,
  'sv06.5': 99,
  sv07: 175,
  sv09: 190,
  'me02.5': 295,
  me03: 124,
  me04: 122,
};

const idsOf = (set: string) => Object.keys(cards).filter((id) => id.startsWith(`${set}-`));

describe('whole-set imports', () => {
  test('the new sets are imported whole', () => {
    for (const [set, n] of Object.entries(SIZES)) expect(idsOf(set).length, set).toBe(n);
  });
  test('every card of the new sets is structurally complete', () => {
    for (const set of Object.keys(SIZES))
      for (const id of idsOf(set)) {
        const d = registry.defs[id]!;
        expect(d.name, id).toBeTruthy();
        if (d.category === 'Pokemon') {
          expect(d.hp, id).toBeGreaterThan(0);
          expect(['Basic', 'Stage1', 'Stage2'], id).toContain(d.stage);
          expect(d.types.length, id).toBeGreaterThan(0);
        } else if (d.category === 'Trainer') {
          expect(['Item', 'Supporter', 'Stadium', 'Tool'], id).toContain(d.trainerType);
        } else {
          expect(['Basic', 'Special'], id).toContain(d.energyKind);
          expect(d.provides.length, id).toBeGreaterThan(0);
        }
      }
  });
  test('the new sets are shop sets', () => {
    for (const set of Object.keys(SIZES)) expect(setIds, set).toContain(set);
  });
  test('sv03 is Scarlet & Violet era and me04 is Mega era', () => {
    expect(SETS.find((x) => x.id === 'sv03')?.era).toBe('sv');
    expect(SETS.find((x) => x.id === 'me04')?.era).toBe('mega');
  });
});
