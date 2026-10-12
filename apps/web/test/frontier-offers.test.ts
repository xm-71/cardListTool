import { describe, expect, test } from 'vitest';
import { DECKS, registry } from '../src/game/catalog.ts';
import { applyChange, autoCut, runDeckProblems, type RunCards } from '../src/game/frontier/deck.ts';
import { hasTuneup, offersFor, type Offer } from '../src/game/frontier/offers.ts';
import { frontierPool, type FrontierPackage } from '../src/game/frontier/pool.ts';

const starters = DECKS.filter((d) => d.kind === 'starter');
const cardsOf = (id: string): RunCards => DECKS.find((d) => d.id === id)!.list.cards.map((c) => ({ ...c }));
const size = (cards: RunCards) => cards.reduce((n, c) => n + c.count, 0);
const pool = frontierPool();
const packages = (offers: Offer[]): FrontierPackage[] =>
  offers.flatMap((o) => (o.kind === 'package' ? [o.pkg] : []));

describe('run deck rules', () => {
  test('runDeckProblems accepts all three starter decks', () => {
    expect(starters).toHaveLength(3);
    for (const d of starters) expect(runDeckProblems(cardsOf(d.id), registry), d.id).toEqual([]);
  });

  test('applyChange adds, cuts, and removes cards that reach zero', () => {
    const out = applyChange(
      [
        { id: 'a', count: 2 },
        { id: 'b', count: 1 },
      ],
      [
        { id: 'a', count: 1 },
        { id: 'c', count: 2 },
      ],
      [{ id: 'b', count: 1 }],
    );
    expect(out).toEqual([
      { id: 'a', count: 3 },
      { id: 'c', count: 2 },
    ]);
  });

  test('autoCut keeps the deck legal; with keepAdded it never cuts the added cards; without it, it falls back to them', () => {
    const deck = cardsOf('mega-gengar');
    const full = deck.find((c) => c.count === 4 && registry.defs[c.id]!.category === 'Trainer')!;
    const extra = [{ id: full.id, count: 2 }];
    // Two more copies of a card already at 4 can't be kept whole...
    expect(autoCut(deck, extra, 2, registry, true)).toBeNull();
    // ...but cutting them (or other copies of the same name) is a legal way to decline them.
    const cut = autoCut(deck, extra, 2, registry)!;
    expect(size(cut)).toBe(2);
    expect(runDeckProblems(applyChange(deck, extra, cut), registry)).toEqual([]);

    const pkg = pool.find((p) => p.kind === 'trainers' && !deck.some((c) => c.id === p.cards[0]!.id))!;
    const kept = autoCut(deck, pkg.cards, size(pkg.cards), registry, true)!;
    expect(kept.some((c) => pkg.cards.some((a) => a.id === c.id))).toBe(false);
    expect(runDeckProblems(applyChange(deck, pkg.cards, kept), registry)).toEqual([]);
  });
});

describe('offers', () => {
  test('offersFor returns exactly 3 different offers after every fight 0..6 for 200 seeds across all three starter decks', () => {
    for (const d of starters)
      for (let seed = 1; seed <= 200; seed++)
        for (let fight = 0; fight <= 6; fight++) {
          const offers = offersFor({ seed, fight, deck: cardsOf(d.id) }, pool, registry);
          expect(offers).toHaveLength(3);
          const keys = offers.map((o) => (o.kind === 'package' ? o.pkg.id : 'tuneup'));
          expect(new Set(keys).size).toBe(3);
        }
  });

  test('every package offer can be kept whole (autoCut with keepAdded succeeds); no 5th copy of a name, no 2nd ACE SPEC', () => {
    for (const d of starters) {
      const deck = cardsOf(d.id);
      for (let seed = 1; seed <= 60; seed++)
        for (const pkg of packages(offersFor({ seed, fight: 6, deck }, pool, registry))) {
          const cut = autoCut(deck, pkg.cards, size(pkg.cards), registry, true);
          expect(cut, pkg.id).not.toBeNull();
          const after = applyChange(deck, pkg.cards, cut!);
          expect(runDeckProblems(after, registry), pkg.id).toEqual([]);
          for (const a of pkg.cards) {
            const before = deck.find((c) => c.id === a.id)?.count ?? 0;
            expect(after.find((c) => c.id === a.id)?.count, `${pkg.id} keeps ${a.id}`).toBe(before + a.count);
          }
        }
    }
  });

  test('a Tune-up is among the 3 only after fights 1, 3 and 5', () => {
    expect([0, 1, 2, 3, 4, 5, 6].filter(hasTuneup)).toEqual([1, 3, 5]);
    const deck = cardsOf('mega-lucario');
    for (let fight = 0; fight <= 6; fight++) {
      const tune = offersFor({ seed: 7, fight, deck }, pool, registry).filter((o) => o.kind === 'tuneup');
      expect(tune, `fight ${fight}`).toHaveLength(hasTuneup(fight) ? 1 : 0);
    }
  });

  test('same seed, fight and deck give the same offers', () => {
    const deck = cardsOf('mega-diancie');
    expect(offersFor({ seed: 42, fight: 4, deck }, pool, registry)).toEqual(
      offersFor({ seed: 42, fight: 4, deck }, pool, registry),
    );
    expect(offersFor({ seed: 42, fight: 4, deck }, pool, registry)).not.toEqual(
      offersFor({ seed: 43, fight: 4, deck }, pool, registry),
    );
  });

  test('tier odds follow the table (over 3000 draws per band, within 4 points, falling back a tier when none fits)', () => {
    const deck = cardsOf('mega-lucario');
    const bands: [number, Record<string, number>][] = [
      [0, { plain: 80, ex: 20, ace: 0 }],
      [2, { plain: 55, ex: 40, ace: 5 }],
      [6, { plain: 35, ex: 55, ace: 10 }],
    ];
    for (const [fight, want] of bands) {
      const tally: Record<string, number> = { plain: 0, ex: 0, ace: 0 };
      let n = 0;
      for (let seed = 1; n < 3000; seed++)
        for (const pkg of packages(offersFor({ seed, fight, deck }, pool, registry))) {
          tally[pkg.tier]!++;
          n++;
        }
      for (const tier of ['plain', 'ex', 'ace'])
        expect(
          Math.abs((100 * tally[tier]!) / n - want[tier]!),
          `fight ${fight} ${tier}`,
        ).toBeLessThanOrEqual(4);
    }
  });
});

describe('autoCut and Energy', () => {
  test('autoCut keeps at least 10 basic Energy while other cards can be cut', () => {
    const basicEnergy = (cards: RunCards) =>
      cards.reduce((n, c) => {
        const d = registry.defs[c.id]!;
        return n + (d.category === 'Energy' && d.energyKind === 'Basic' ? c.count : 0);
      }, 0);
    for (const d of starters) {
      let deck = cardsOf(d.id);
      const start = basicEnergy(deck);
      // Seven package takes in a row, each with the automatic cut.
      for (let seed = 1; seed <= 7; seed++) {
        const pkg = packages(offersFor({ seed, fight: seed - 1, deck }, pool, registry))[0]!;
        const cut = autoCut(deck, pkg.cards, size(pkg.cards), registry, true)!;
        deck = applyChange(deck, pkg.cards, cut);
      }
      expect(basicEnergy(deck), d.id).toBeGreaterThanOrEqual(Math.min(start, 10));
    }
  });
});
