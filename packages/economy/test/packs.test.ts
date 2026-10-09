import { describe, expect, test } from 'vitest';
import type { GameResult } from '@ptcg/engine';
import { setCards } from '@ptcg/cards';
import {
  CREDITS,
  PACKS,
  PACK_PRICES,
  SLOT10_RATES,
  SV_SLOT10_RATES,
  creditsFor,
  layoutRarities,
  openPack,
  packPrice,
  packSize,
} from '../src/index.ts';

const me01 = setCards('me01');
const rarityOf = new Map(me01.map((c) => [c.id, c.rarity]));

describe('openPack', () => {
  test('a pack has 10 cards from its set', () => {
    const { cards } = openPack('me01', me01, 1);
    expect(cards).toHaveLength(10);
    for (const id of cards) expect(rarityOf.has(id), id).toBe(true);
  });

  test('slots 1–4 are Common and slots 5–7 are Uncommon', () => {
    let rng = 7;
    for (let i = 0; i < 200; i++) {
      const pack = openPack('me01', me01, rng);
      rng = pack.rng;
      expect(pack.cards.slice(0, 4).map((id) => rarityOf.get(id))).toEqual([
        'Common',
        'Common',
        'Common',
        'Common',
      ]);
      expect(pack.cards.slice(4, 7).map((id) => rarityOf.get(id))).toEqual([
        'Uncommon',
        'Uncommon',
        'Uncommon',
      ]);
      expect(['Common', 'Uncommon', 'Rare']).toContain(rarityOf.get(pack.cards[7]!));
    }
  });

  test('slot 10 and slot 9 rarity frequencies match the configured rates', () => {
    const n = 20000;
    const slot10 = new Map<string, number>();
    let ir9 = 0;
    let rng = 12345;
    for (let i = 0; i < n; i++) {
      const pack = openPack('me01', me01, rng);
      rng = pack.rng;
      const r = rarityOf.get(pack.cards[9]!)!;
      slot10.set(r, (slot10.get(r) ?? 0) + 1);
      if (rarityOf.get(pack.cards[8]!) === 'Illustration rare') ir9++;
    }
    for (const [rarity, rate] of Object.entries(SLOT10_RATES)) {
      expect(Math.abs((slot10.get(rarity) ?? 0) / n - rate), rarity).toBeLessThanOrEqual(0.015);
    }
    expect(Math.abs(ir9 / n - 0.12)).toBeLessThanOrEqual(0.01);
  });

  test('a rarity tier missing from the set falls back to Rare', () => {
    const noHyper = me01.filter((c) => c.rarity !== 'Mega Hyper Rare');
    let rng = 99;
    for (let i = 0; i < 2000; i++) {
      const pack = openPack('me01', noHyper, rng);
      rng = pack.rng;
      expect(rarityOf.get(pack.cards[9]!)).not.toBe('Mega Hyper Rare');
    }
  });

  test('the same rng gives the same pack', () => {
    expect(openPack('me02', setCards('me02'), 42)).toEqual(openPack('me02', setCards('me02'), 42));
    expect(openPack('me02', setCards('me02'), 42).cards).not.toEqual(
      openPack('me02', setCards('me02'), 43).cards,
    );
  });
});

test('both sets are on sale at the configured price', () => {
  expect(PACKS.filter((p) => p.era === 'mega').map((p) => [p.setId, p.price])).toEqual([
    ['me01', 150],
    ['me02', 150],
  ]);
  expect(CREDITS.start).toBe(500);
});

describe('creditsFor', () => {
  const r = (winner: GameResult['winner'], reason: GameResult['reason'] = 'prizes'): GameResult => ({
    winner,
    reason,
  });
  test.each([
    ['win vs Easy', r(0), 'easy', 100],
    ['win vs Medium', r(0), 'medium', 200],
    ['loss vs Easy', r(1), 'easy', 30],
    ['loss vs Medium', r(1), 'medium', 50],
    ['draw counts as a loss', r('draw', 'noPokemon'), 'medium', 50],
    ['human concede', r(1, 'concede'), 'medium', 0],
    ['bot concede counts as a win', r(0, 'concede'), 'easy', 100],
  ] as const)('%s', (_name, result, difficulty, expected) => {
    expect(creditsFor(result, 0, difficulty)).toBe(expected);
  });
  test('uses the human seat', () => {
    expect(creditsFor(r(1), 1, 'easy')).toBe(100);
  });
});

describe('classic packs', () => {
  const classicIds = [
    'base1',
    'base2',
    'base3',
    'base4',
    'base5',
    'gym1',
    'gym2',
    'neo1',
    'neo2',
    'neo3',
    'neo4',
    'lc',
  ];

  test('every classic set is on sale, cheaper than the modern packs', () => {
    expect(PACKS.filter((p) => p.era === 'classic').map((p) => p.setId)).toEqual(classicIds);
    for (const p of PACKS.filter((p) => p.era === 'classic')) expect(p.price).toBe(PACK_PRICES.classic);
    expect(PACK_PRICES.classic).toBeLessThan(PACK_PRICES.mega);
    expect(packPrice('base1')).toBe(PACK_PRICES.classic);
    expect(packPrice('me01')).toBe(150);
  });

  test('every card of every pack set can be pulled', () => {
    for (const p of PACKS) {
      const rarities = new Set(layoutRarities(p.era));
      for (const c of setCards(p.setId)) expect(rarities, `${c.id} ${c.rarity}`).toContain(c.rarity);
    }
  });

  test.each(classicIds)('%s packs have 7 commons, 3 uncommons and a rare', (setId) => {
    const cards = setCards(setId);
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    let rng = 3;
    for (let i = 0; i < 100; i++) {
      const pack = openPack(setId, cards, rng);
      rng = pack.rng;
      expect(pack.cards).toHaveLength(11);
      expect(pack.cards.slice(0, 7).map((id) => rarity.get(id))).toEqual(Array(7).fill('Common'));
      expect(pack.cards.slice(7, 10).map((id) => rarity.get(id))).toEqual(Array(3).fill('Uncommon'));
      expect(['Rare', 'Holo Rare']).toContain(rarity.get(pack.cards[10]!));
    }
  });

  test('Gym Heroes rare slots include Holo Rares', () => {
    const cards = setCards('gym1');
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    let rng = 9;
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pack = openPack('gym1', cards, rng);
      rng = pack.rng;
      seen.add(rarity.get(pack.cards[10]!)!);
    }
    expect(seen).toEqual(new Set(['Rare', 'Holo Rare']));
  });
});

describe('Scarlet & Violet 151 pack', () => {
  const sv = setCards('sv03.5');
  const rarity = new Map(sv.map((c) => [c.id, c.rarity]));

  test('is on sale in its own era at the usual price', () => {
    const pack = PACKS.find((p) => p.setId === 'sv03.5');
    expect(pack).toMatchObject({ name: 'Scarlet & Violet 151', era: 'sv', price: 150 });
  });

  test('a pack has 10 cards from the set: 4 Common, 3 Uncommon, then the reverse slot, slot 9 and slot 10', () => {
    let rng = 5;
    for (let i = 0; i < 200; i++) {
      const pack = openPack('sv03.5', sv, rng);
      rng = pack.rng;
      expect(pack.cards).toHaveLength(10);
      for (const id of pack.cards) expect(rarity.has(id), id).toBe(true);
      expect(pack.cards.slice(0, 4).map((id) => rarity.get(id))).toEqual(Array(4).fill('Common'));
      expect(pack.cards.slice(4, 7).map((id) => rarity.get(id))).toEqual(Array(3).fill('Uncommon'));
    }
  });

  test('slot 10 follows the 151 rates, including Hyper rare', () => {
    const n = 20000;
    const slot10 = new Map<string, number>();
    let rng = 777;
    for (let i = 0; i < n; i++) {
      const pack = openPack('sv03.5', sv, rng);
      rng = pack.rng;
      const r = rarity.get(pack.cards[9]!)!;
      slot10.set(r, (slot10.get(r) ?? 0) + 1);
    }
    expect(Object.values(SV_SLOT10_RATES).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    for (const [name, rate] of Object.entries(SV_SLOT10_RATES)) {
      expect(Math.abs((slot10.get(name) ?? 0) / n - rate), name).toBeLessThanOrEqual(0.015);
    }
    expect(slot10.get('Hyper rare')).toBeGreaterThan(0);
  });

  test('the Mega Evolution rates are unchanged', () => {
    expect(SLOT10_RATES).toEqual({
      Rare: 0.7,
      'Double rare': 0.18,
      'Ultra Rare': 0.07,
      'Special illustration rare': 0.03,
      'Mega Hyper Rare': 0.02,
    });
  });
});

test('packSize is the number of cards a pack opens', () => {
  expect(packSize('me01')).toBe(10);
  expect(packSize('sv03.5')).toBe(10);
  for (const p of PACKS)
    expect(openPack(p.setId, setCards(p.setId), 1).cards, p.setId).toHaveLength(packSize(p.setId));
});

describe('e-Card and EX packs', () => {
  const ids = [...['ecard1', 'ecard2', 'ecard3'], ...Array.from({ length: 16 }, (_, i) => `ex${i + 1}`)];

  test('all 19 sets are on sale in their own eras at their own prices', () => {
    expect(PACKS.filter((p) => p.era === 'ecard').map((p) => p.setId)).toEqual(ids.slice(0, 3));
    expect(PACKS.filter((p) => p.era === 'ex').map((p) => p.setId)).toEqual(ids.slice(3));
    expect(packPrice('ecard2')).toBe(PACK_PRICES.ecard);
    expect(packPrice('ex9')).toBe(PACK_PRICES.ex);
    expect(PACKS.find((p) => p.setId === 'ex9')?.name).toBe('Emerald');
  });

  test.each(ids)(
    '%s packs have 9 cards: 4 Common, 3 Uncommon, a reverse slot and a Rare or Holo Rare',
    (setId) => {
      const cards = setCards(setId);
      const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
      expect(packSize(setId)).toBe(9);
      let rng = 11;
      for (let i = 0; i < 100; i++) {
        const pack = openPack(setId, cards, rng);
        rng = pack.rng;
        expect(pack.cards).toHaveLength(9);
        for (const id of pack.cards) expect(rarity.has(id), id).toBe(true);
        expect(pack.cards.slice(0, 4).map((id) => rarity.get(id))).toEqual(Array(4).fill('Common'));
        expect(pack.cards.slice(4, 7).map((id) => rarity.get(id))).toEqual(Array(3).fill('Uncommon'));
        expect(['Common', 'Uncommon', 'Rare']).toContain(rarity.get(pack.cards[7]!));
        expect(['Rare', 'Holo Rare']).toContain(rarity.get(pack.cards[8]!));
      }
    },
  );

  test('Holo Rares show up in the rare slot of Ruby & Sapphire at about the configured rate', () => {
    const cards = setCards('ex1');
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    const n = 5000;
    let holo = 0;
    let rng = 21;
    for (let i = 0; i < n; i++) {
      const pack = openPack('ex1', cards, rng);
      rng = pack.rng;
      if (rarity.get(pack.cards[8]!) === 'Holo Rare') holo++;
    }
    expect(Math.abs(holo / n - 0.33)).toBeLessThanOrEqual(0.03);
  });
});

describe('Diamond & Pearl, Platinum and HeartGold SoulSilver packs', () => {
  const dp = Array.from({ length: 7 }, (_, i) => `dp${i + 1}`);
  const pt = Array.from({ length: 4 }, (_, i) => `pl${i + 1}`);
  const hgss = ['hgss1', 'hgss2', 'hgss3', 'hgss4', 'col1'];
  const rareSlot: Record<string, string[]> = {
    dp: ['Rare', 'Rare Holo', 'Rare Holo LV.X'],
    pt: ['Rare', 'Holo Rare', 'Rare Holo LV.X'],
    hgss: ['Rare', 'Holo Rare', 'Rare PRIME', 'LEGEND', 'Ultra Rare'],
  };

  test('every set is on sale in its own era at its own price', () => {
    expect(PACKS.filter((p) => p.era === 'dp').map((p) => p.setId)).toEqual(dp);
    expect(PACKS.filter((p) => p.era === 'pt').map((p) => p.setId)).toEqual(pt);
    expect(PACKS.filter((p) => p.era === 'hgss').map((p) => p.setId)).toEqual(hgss);
    expect([packPrice('dp3'), packPrice('pl2'), packPrice('hgss1')]).toEqual([
      PACK_PRICES.dp,
      PACK_PRICES.pt,
      PACK_PRICES.hgss,
    ]);
    expect(PACKS.find((p) => p.setId === 'col1')?.name).toBe('Call of Legends');
  });

  test.each([
    ...dp.map((id) => [id, 'dp'] as const),
    ...pt.map((id) => [id, 'pt'] as const),
    ...hgss.map((id) => [id, 'hgss'] as const),
  ])('%s packs (%s) have 10 cards: 5 Common, 3 Uncommon, a reverse slot and a rare slot', (setId, era) => {
    const cards = setCards(setId);
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    expect(packSize(setId)).toBe(10);
    let rng = 31;
    for (let i = 0; i < 100; i++) {
      const pack = openPack(setId, cards, rng);
      rng = pack.rng;
      expect(pack.cards).toHaveLength(10);
      expect(pack.cards.slice(0, 5).map((id) => rarity.get(id))).toEqual(Array(5).fill('Common'));
      expect(pack.cards.slice(5, 8).map((id) => rarity.get(id))).toEqual(Array(3).fill('Uncommon'));
      expect(['Common', 'Uncommon', 'Rare']).toContain(rarity.get(pack.cards[8]!));
      expect(rareSlot[era]).toContain(rarity.get(pack.cards[9]!));
    }
  });

  test('a rarity the set lacks is never rolled, and the others share its chance', () => {
    // Call of Legends has no LEGEND or PRIME cards; its rare slot is Rare or Holo Rare only, about 3 in 10 Rare.
    const cards = setCards('col1');
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    const n = 6000;
    const seen = new Map<string, number>();
    let rng = 41;
    for (let i = 0; i < n; i++) {
      const pack = openPack('col1', cards, rng);
      rng = pack.rng;
      const r = rarity.get(pack.cards[9]!)!;
      seen.set(r, (seen.get(r) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['Holo Rare', 'Rare']);
    expect(Math.abs((seen.get('Rare') ?? 0) / n - 0.7)).toBeLessThanOrEqual(0.03);
  });

  test('Triumphant packs can hold a Rare PRIME and a LEGEND half', () => {
    const cards = setCards('hgss4');
    const rarity = new Map(cards.map((c) => [c.id, c.rarity]));
    const seen = new Set<string>();
    let rng = 51;
    for (let i = 0; i < 2000; i++) {
      const pack = openPack('hgss4', cards, rng);
      rng = pack.rng;
      seen.add(rarity.get(pack.cards[9]!)!);
    }
    expect(seen.has('Rare PRIME')).toBe(true);
    expect(seen.has('LEGEND')).toBe(true);
  });
});
