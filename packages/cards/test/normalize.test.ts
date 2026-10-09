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
    ['240-', 240, '-'],
    ['?', 0, '?'],
    [230, 230, ''],
    [undefined, 0, ''],
  ] as const)('%s → %s %s', (raw, damage, suffix) => {
    expect(parseDamage(raw)).toEqual({ damage, damageSuffix: suffix });
  });
});

test('an Energy TCGdex labels Normal but without a basic type name is Special', () => {
  const def = normalizeTcgdexCard({
    id: 'me02-124',
    name: 'Ignition Energy',
    category: 'Energy',
    energyType: 'Normal',
    effect: 'As long as this card is attached to a Pokémon, it provides {C} Energy.',
    regulationMark: 'I',
    rarity: 'Ultra Rare',
  });
  expect(def).toMatchObject({ category: 'Energy', energyKind: 'Special', provides: ['Colorless'] });
});

test('a classic Trainer without a trainer type is an Item', () => {
  const def = normalizeTcgdexCard({
    id: 'base1-70',
    name: 'Clefairy Doll',
    category: 'Trainer',
    effect: 'Play Clefairy Doll as if it were a Basic Pokémon.',
    rarity: 'Rare',
  });
  expect(def).toMatchObject({ category: 'Trainer', trainerType: 'Item', regulationMark: null });
});

test('a Basic Energy without an image borrows the Crown Zenith picture of its type', () => {
  const card = normalizeTcgdexCard({ ...darkness, image: undefined });
  expect(card.image).toBe('https://assets.tcgdex.net/en/swsh/swsh12.5/158');
  const withImage = normalizeTcgdexCard({ ...darkness, image: 'https://example.test/x' });
  expect(withImage.image).toBe('https://example.test/x');
});

describe('stages from the vintage eras', () => {
  const pokemon = (stage?: string) =>
    normalizeTcgdexCard({ id: 'ecard1-1', name: 'Pichu', category: 'Pokemon', hp: 30, types: ['Lightning'], stage });

  test.each([
    ['Baby', 'Basic'],
    ['Restored', 'Basic'],
    ['LEGEND', 'Basic'],
    ['Level-Up', 'Stage1'],
    ['BREAK', 'Stage2'],
    [undefined, 'Basic'],
  ])('%s is stored as %s', (stage, expected) => {
    expect(pokemon(stage)).toMatchObject({ category: 'Pokemon', stage: expected });
  });

  test('a stage nobody knows still fails loudly', () => {
    expect(() => pokemon('Mystery')).toThrow(/Unsupported stage/);
  });
});

test.each([
  ["Rocket's Secret Machine", 'Tool'],
  ['Technical Machine', 'Tool'],
])('the old Trainer sub-type %s is a %s', (trainerType, expected) => {
  expect(
    normalizeTcgdexCard({ id: 'ex7-80', name: 'Machine', category: 'Trainer', trainerType, rarity: 'Rare' }),
  ).toMatchObject({ category: 'Trainer', trainerType: expected });
});

test('an Ability TCGdex gives only a type (old Pokémon Powers) is named after that type', () => {
  const def = normalizeTcgdexCard({
    id: 'neo2-49',
    name: 'Unown [M]',
    category: 'Pokemon',
    hp: 40,
    types: ['Psychic'],
    abilities: [{ type: 'Pokemon Power' }],
  });
  expect(def).toMatchObject({ abilities: [{ name: 'Pokemon Power', text: '' }] });
});

test('an attack TCGdex has no name for is called "Attack"', () => {
  const def = normalizeTcgdexCard({
    id: 'neo4-113',
    name: 'Shining Tyranitar',
    category: 'Pokemon',
    hp: 80,
    types: ['Darkness'],
    attacks: [{ cost: ['Darkness'], damage: 30 }],
  });
  expect(def).toMatchObject({ attacks: [{ name: 'Attack', damage: 30 }] });
});
