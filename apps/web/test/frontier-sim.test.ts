// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { nextRandom, type DeckList, type EnergyType } from '@ptcg/engine';
import { createEasyBot, createHardBot, createMediumBot, runMatch, type Bot } from '@ptcg/bots';
import { engine, registry } from '../src/game/catalog.ts';
import { autoCut, runDeckProblems } from '../src/game/frontier/deck.ts';
import { opponentDeck } from '../src/game/frontier/opponents.ts';
import {
  BASIC_ENERGY,
  beginFight,
  chooseStarter,
  newRun,
  recordResult,
  skipOffer,
  takeOffer,
  type FrontierRun,
} from '../src/game/frontier/run.ts';

const size = (cards: { count: number }[]) => cards.reduce((n, c) => n + c.count, 0);
const TYPES = Object.keys(BASIC_ENERGY) as EnergyType[];

/** A tiny seeded random source for the test's own choices. */
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    const [v, next] = nextRandom(s);
    s = next;
    return v;
  };
};

/** Takes a random reward (a package with a legal cut, a random Tune-up, or a skip). */
function reward(r: FrontierRun, rand: () => number, taken: Set<string>): FrontierRun {
  if (rand() < 0.1) return skipOffer(r);
  const index = Math.floor(rand() * r.offers!.length);
  const offer = r.offers![index]!;
  if (offer.kind === 'tuneup') {
    const types = Array.from(
      { length: Math.floor(rand() * 4) },
      () => TYPES[Math.floor(rand() * TYPES.length)]!,
    );
    const add = types.map((t) => ({ id: BASIC_ENERGY[t]!, count: 1 }));
    const cut = autoCut(r.deck, add, types.length, registry)!;
    taken.add('tuneup');
    return takeOffer(r, index, cut, types);
  }
  const cut = autoCut(r.deck, offer.pkg.cards, size(offer.pkg.cards), registry)!;
  expect(cut, offer.pkg.id).not.toBeNull();
  taken.add(offer.pkg.tier);
  return takeOffer(r, index, cut);
}

describe('simulated Frontier runs', () => {
  const played = new Set<string>();
  test('rules-only: 300 seeded runs with random outcomes reach every fight, every offer kind and every tier, and the deck is always legal', () => {
    const reached = new Set<number>();
    const taken = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const rand = rng(seed * 7919);
      let r = newRun(seed);
      r = chooseStarter(r, r.starterChoices[Math.floor(rand() * 3)]!);
      for (let steps = 0; r.phase !== 'over' && steps < 100; steps++) {
        if (r.phase === 'hub') {
          reached.add(r.fight);
          const roll = rand();
          r = recordResult(beginFight(r), roll < 0.7 ? 'win' : roll < 0.9 ? 'loss' : 'draw');
        } else if (r.phase === 'reward') r = reward(r, rand, taken);
        expect(runDeckProblems(r.deck, registry), `seed ${seed}`).toEqual([]);
        expect(size(r.deck)).toBe(60);
      }
      expect(r.phase).toBe('over');
    }
    expect([...reached].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(taken).toEqual(new Set(['tuneup', 'plain', 'ex', 'ace']));
  }, 60_000);

  test.each([1, 2, 3, 4])(
    'games: run %i played with bots finishes with no engine violations',
    (seed) => {
      const rand = rng(seed * 104729);
      const easy = createEasyBot(registry);
      let r = newRun(seed);
      r = chooseStarter(r, r.starterChoices[0]!);
      // Later runs start further in (earlier fights won without playing), so Medium and Hard opponents get played.
      for (let i = 0; i < [0, 3, 6, 6][seed - 1]!; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
      let draws = 0;
      for (let steps = 0; r.phase !== 'over' && steps < 40; steps++) {
        if (r.phase === 'reward') {
          r = reward(r, rand, new Set());
          continue;
        }
        const opp = r.opponents[r.fight]!;
        const decks: [DeckList, DeckList] = [{ name: 'run', cards: r.deck }, opponentDeck(opp)];
        const bot: Bot =
          opp.difficulty === 'hard'
            ? createHardBot(registry, decks, 1, { maxRounds: 1, now: () => 0 })
            : opp.difficulty === 'medium'
              ? createMediumBot(registry, decks, 1, 2)
              : easy;
        const m = runMatch({ engine, decks, seed: seed * 1000 + steps, bots: [easy, bot] });
        expect(m.violations).toEqual([]);
        played.add(opp.difficulty);
        // A game that hits the action cap counts as a draw; three draws in a row on one fight count as a loss.
        const outcome =
          !m.result || m.result.winner === 'draw' ? 'draw' : m.result.winner === 0 ? 'win' : 'loss';
        draws = outcome === 'draw' ? draws + 1 : 0;
        r = recordResult(beginFight(r), draws >= 3 ? 'loss' : outcome);
        if (draws >= 3) draws = 0;
        expect(runDeckProblems(r.deck, registry)).toEqual([]);
      }
      expect(r.phase).toBe('over');
    },
    120_000,
  );

  test('the game runs played Easy, Medium and Hard opponents', () => {
    expect(played).toEqual(new Set(['easy', 'medium', 'hard']));
  });
});
