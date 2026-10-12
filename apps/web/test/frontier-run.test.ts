import { describe, expect, test } from 'vitest';
import { DECKS, registry } from '../src/game/catalog.ts';
import { autoCut, runDeckProblems } from '../src/game/frontier/deck.ts';
import {
  abandon,
  beginFight,
  chooseStarter,
  keepableCards,
  newRun,
  payout,
  recordResult,
  skipOffer,
  takeOffer,
  type FrontierRun,
} from '../src/game/frontier/run.ts';

const size = (cards: { count: number }[]) => cards.reduce((n, c) => n + c.count, 0);
const started = (seed = 3): FrontierRun => chooseStarter(newRun(seed), newRun(seed).starterChoices[0]!);
const win = (r: FrontierRun) => recordResult(beginFight(r), 'win');
/** Win the current fight and skip the reward, `n` times. */
const advance = (r: FrontierRun, n: number) => {
  for (let i = 0; i < n; i++) r = skipOffer(win(r));
  return r;
};

describe('Frontier run', () => {
  test('newRun lists the 3 starter decks in a seeded order', () => {
    const r = newRun(1);
    expect(r.phase).toBe('starter');
    expect([...r.starterChoices].sort()).toEqual(
      DECKS.filter((d) => d.kind === 'starter')
        .map((d) => d.id)
        .sort(),
    );
    expect(newRun(1)).toEqual(r);
  });

  test('choosing a starter makes it the run deck, draws 8 opponents and enters the hub', () => {
    const r = started();
    const deck = DECKS.find((d) => d.id === r.starterId)!;
    expect(r.phase).toBe('hub');
    expect(r.deck).toEqual(deck.list.cards);
    expect(r.cover).toBe(deck.cover);
    expect(r.opponents).toHaveLength(8);
    expect(r).toMatchObject({ fight: 0, lives: 2, wins: 0 });
    expect(() => chooseStarter(r, r.starterId!)).toThrow();
  });

  test('a win on fights 1-7 opens the reward phase with 3 offers; a win on fight 8 clears the run (phase over, cleared)', () => {
    const r = win(started());
    expect(r.phase).toBe('reward');
    expect(r.offers).toHaveLength(3);
    expect(r.wins).toBe(1);
    const last = win(advance(started(), 7));
    expect(last).toMatchObject({ phase: 'over', cleared: true, wins: 8 });
  });

  test('a loss costs a life and replays the same fight; the second loss ends the run', () => {
    let r = advance(started(), 2);
    r = recordResult(beginFight(r), 'loss');
    expect(r).toMatchObject({ phase: 'hub', fight: 2, lives: 1 });
    r = recordResult(beginFight(r), 'loss');
    expect(r).toMatchObject({ phase: 'over', lives: 0, wins: 2 });
    expect(r.cleared).toBeFalsy();
  });

  test('a draw replays the fight with no life lost', () => {
    const r = recordResult(beginFight(started()), 'draw');
    expect(r).toMatchObject({ phase: 'hub', fight: 0, lives: 2, wins: 0 });
  });

  test('beginFight sets inMatch and recordResult clears it', () => {
    const r = beginFight(started());
    expect(r.inMatch).toBe(true);
    expect(recordResult(r, 'draw').inMatch).toBeFalsy();
  });

  test('takeOffer adds the package, cuts exactly N cards, keeps the deck legal and moves to the next fight', () => {
    const r = win(started());
    const i = r.offers!.findIndex((o) => o.kind === 'package');
    const pkg = (r.offers![i] as { pkg: { cards: { id: string; count: number }[] } }).pkg;
    const cut = autoCut(r.deck, pkg.cards, size(pkg.cards), registry, true)!;
    const next = takeOffer(r, i, cut);
    expect(next).toMatchObject({ phase: 'hub', fight: 1, offers: null });
    expect(size(next.deck)).toBe(60);
    expect(runDeckProblems(next.deck, registry)).toEqual([]);
    for (const c of pkg.cards)
      expect(next.deck.find((d) => d.id === c.id)!.count).toBe(
        (r.deck.find((d) => d.id === c.id)?.count ?? 0) + c.count,
      );
  });

  test('takeOffer throws for a wrong cut size, an illegal deck, and the wrong phase', () => {
    const r = win(started());
    const i = r.offers!.findIndex((o) => o.kind === 'package');
    expect(() => takeOffer(r, i, [])).toThrow();
    const basic = r.deck.find((c) => {
      const d = registry.defs[c.id]!;
      return d.category === 'Pokemon' && d.stage === 'Basic';
    })!;
    const pkgSize = size((r.offers![i] as { pkg: { cards: { count: number }[] } }).pkg.cards);
    // Cutting more copies than the deck has is never allowed.
    expect(() => takeOffer(r, i, [{ id: basic.id, count: pkgSize + 99 }])).toThrow();
    expect(() => takeOffer(started(), 0, [])).toThrow();
  });

  test('a Tune-up replaces 0-3 cut cards with the chosen basic Energy (mee-00x)', () => {
    let r = win(advance(started(), 1)); // won fight 2 (index 1): a Tune-up is offered
    const i = r.offers!.findIndex((o) => o.kind === 'tuneup');
    expect(i).toBeGreaterThanOrEqual(0);
    const trainer = r.deck.find((c) => registry.defs[c.id]!.category === 'Trainer' && c.count >= 2)!;
    const water = r.deck.find((c) => c.id === 'mee-003')?.count ?? 0;
    r = takeOffer(r, i, [{ id: trainer.id, count: 2 }], ['Water', 'Water']);
    expect(r.deck.find((c) => c.id === 'mee-003')!.count).toBe(water + 2);
    expect(size(r.deck)).toBe(60);
    expect(r.fight).toBe(2);
  });

  test('skipOffer moves to the next fight with the deck unchanged', () => {
    const r = win(started());
    const next = skipOffer(r);
    expect(next).toMatchObject({ phase: 'hub', fight: 1, offers: null });
    expect(next.deck).toEqual(r.deck);
  });

  test('payout: Easy 60, Medium 120, Hard 200, boss +300; a full clear is 1240; fights not won pay nothing', () => {
    expect(payout(started())).toBe(0);
    expect(payout(advance(started(), 3))).toBe(180);
    expect(payout(advance(started(), 6))).toBe(540);
    expect(payout(win(advance(started(), 7)))).toBe(1240);
  });

  test('abandon pays for fights already won', () => {
    const r = abandon(advance(started(), 4));
    expect(r).toMatchObject({ phase: 'over', wins: 4 });
    expect(r.cleared).toBeFalsy();
    expect(payout(r)).toBe(300);
  });

  test('keepableCards excludes basic Energy', () => {
    const ids = keepableCards(started());
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const d = registry.defs[id]!;
      expect(d.category === 'Energy' && d.energyKind === 'Basic').toBe(false);
    }
  });
});
