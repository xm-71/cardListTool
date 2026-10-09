import { expect, test } from 'vitest';
import type { CardDef, DeckList, PokemonDef, TrainerDef } from '@ptcg/engine';
import {
  buildRegistry,
  isPlayable,
  megaDiancieDeck,
  megaGengarDeck,
  megaLucarioDeck,
  setCards,
  SETS,
} from '../src/index.ts';

const registry = buildRegistry();
const def = (id: string): CardDef => {
  const d = registry.defs[id];
  if (!d) throw new Error(`missing ${id}`);
  return d;
};

test('a Pokémon whose attacks have no effect text is playable', () => {
  expect(isPlayable(def('me02-054'), registry)).toBe(true);
});

test('a scripted Pokémon ex is playable', () => {
  expect(isPlayable(def('me02-056'), registry)).toBe(true);
});

test('a Pokémon with an unscripted Ability is not playable', () => {
  const base = def('me02-054') as PokemonDef;
  const withAbility: PokemonDef = {
    ...base,
    id: 'test-ability',
    abilities: [{ name: 'Mystery', text: 'Does a thing.' }],
  };
  expect(isPlayable(withAbility, registry)).toBe(false);
});

test('a Pokémon with an unscripted attack effect is not playable', () => {
  const base = def('me02-054') as PokemonDef;
  const p: PokemonDef = {
    ...base,
    id: 'test-attack',
    attacks: [{ name: 'Odd', cost: [], damage: 10, damageSuffix: '', text: 'Flip a coin.' }],
  };
  expect(isPlayable(p, registry)).toBe(false);
});

test('an unscripted Trainer is not playable', () => {
  const t: TrainerDef = {
    id: 'test-trainer',
    name: 'Nonexistent Trainer',
    category: 'Trainer',
    trainerType: 'Item',
    text: 'Draw a card.',
    isAceSpec: false,
    regulationMark: 'I',
    rarity: 'Common',
    image: '',
  };
  expect(isPlayable(t, registry)).toBe(false);
});

test('Basic Energy is playable', () => {
  const basic = Object.values(registry.defs).find((d) => d.category === 'Energy' && d.energyKind === 'Basic');
  expect(basic).toBeDefined();
  expect(isPlayable(basic!, registry)).toBe(true);
});

test('setCards returns the whole set', () => {
  const me02 = setCards('me02');
  expect(me02).toHaveLength(130);
  for (const c of me02) expect(c.id.startsWith('me02-')).toBe(true);
  expect(setCards('me01')).toHaveLength(188);
  expect(SETS.map((s) => s.id).slice(0, 2)).toEqual(['me01', 'me02']);
});

test.each([megaGengarDeck, megaDiancieDeck, megaLucarioDeck] as DeckList[])(
  'every card in $name is playable',
  (deck) => {
    for (const c of deck.cards) expect(isPlayable(def(c.id), registry), c.id).toBe(true);
  },
);

test('every shop set has an era, classic sets included', () => {
  expect(SETS.map((s) => [s.id, s.era])).toEqual([
    ['me01', 'mega'],
    ['me02', 'mega'],
    ['base1', 'classic'],
    ['base2', 'classic'],
    ['base3', 'classic'],
    ['base4', 'classic'],
    ['base5', 'classic'],
    ['gym1', 'classic'],
    ['gym2', 'classic'],
    ['neo1', 'classic'],
    ['neo2', 'classic'],
    ['neo3', 'classic'],
    ['neo4', 'classic'],
    ['lc', 'classic'],
    ...['ecard1', 'ecard2', 'ecard3'].map((id) => [id, 'ecard']),
    ...Array.from({ length: 16 }, (_, i) => [`ex${i + 1}`, 'ex']),
    ['sv03.5', 'sv'],
  ]);
  expect(setCards('base1')).toHaveLength(102);
  expect(setCards('neo1')).toHaveLength(111);
  expect([setCards('neo2').length, setCards('neo3').length, setCards('neo4').length, setCards('lc').length]).toEqual([75, 66, 113, 110]);
});
