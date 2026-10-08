import { describe, expect, test } from 'vitest';
import { normalizeTcgdexCard, parseDamage } from '../src/normalize.ts';
import gengar from './fixtures/me02-056.json';
import patch from './fixtures/me02-094.json';
import darkness from './fixtures/mee-007.json';

describe('normalizeTcgdexCard', () => {
  test('normalizes a Mega Pokémon ex', () => {
    const def = normalizeTcgdexCard(gengar);
    expect(def).toMatchObject({
      id: 'me02-056',
      category: 'Pokemon',
      name: 'Mega Gengar ex',
      stage: 'Stage2',
      hp: 350,
      types: ['Darkness'],
      evolvesFrom: 'Haunter',
      weakness: 'Fighting',
      resistance: null,
      retreat: 2,
      isEx: true,
      isMega: true,
      regulationMark: 'I',
      image: 'https://assets.tcgdex.net/en/me/me02/056',
    });
    if (def.category !== 'Pokemon') throw new Error('expected Pokemon');
    expect(def.attacks[0]).toMatchObject({
      name: 'Void Gale',
      cost: ['Darkness', 'Darkness'],
      damage: 230,
      damageSuffix: '',
    });
    expect(def.abilities[0]?.name).toBe('Shadowy Concealment');
  });

  test('normalizes an Item', () => {
    expect(normalizeTcgdexCard(patch)).toMatchObject({
      category: 'Trainer',
      trainerType: 'Item',
      name: 'Wondrous Patch',
      isAceSpec: false,
    });
  });

  test('normalizes a basic Energy', () => {
    expect(normalizeTcgdexCard(darkness)).toMatchObject({
      category: 'Energy',
      energyKind: 'Basic',
      provides: ['Darkness'],
    });
  });

  test('rejects unknown categories', () => {
    expect(() => normalizeTcgdexCard({ ...patch, category: 'Mystery' })).toThrow();
  });
});

describe('parseDamage', () => {
  test.each([
    ['20+', 20, '+'],
    ['120×', 120, '×'],
    [230, 230, ''],
    [undefined, 0, ''],
  ] as const)('%s → %s %s', (raw, damage, suffix) => {
    expect(parseDamage(raw)).toEqual({ damage, damageSuffix: suffix });
  });
});
