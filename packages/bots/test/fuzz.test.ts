import { describe, expect, test } from 'vitest';
import { createEngine, type DeckList } from '@ptcg/engine';
import {
  buildRegistry,
  megaAbomasnowDeck,
  megaCharizardXDeck,
  megaDiancieDeck,
  megaGengarDeck,
  megaKangaskhanDeck,
  megaLopunnyDeck,
  megaLucarioDeck,
  megaManectricDeck,
  megaVenusaurDeck,
  metaAlakazamDeck,
  metaCrustleDeck,
  metaDragapultDeck,
  metaNsZoroarkDeck,
  metaOgerponBoxDeck,
  metaSlowkingDeck,
} from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { createHardBot } from '../src/hard.ts';
import { runMatch } from '../src/runMatch.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);
const DECKS: [string, DeckList][] = [
  ['gengar', megaGengarDeck],
  ['diancie', megaDiancieDeck],
  ['lucario', megaLucarioDeck],
  ['charizard', megaCharizardXDeck],
  ['venusaur', megaVenusaurDeck],
  ['abomasnow', megaAbomasnowDeck],
  ['manectric', megaManectricDeck],
  ['kangaskhan', megaKangaskhanDeck],
  ['lopunny', megaLopunnyDeck],
  ['dragapult', metaDragapultDeck],
  ['alakazam', metaAlakazamDeck],
  ['ogerpon-box', metaOgerponBoxDeck],
  ['ns-zoroark', metaNsZoroarkDeck],
  ['slowking', metaSlowkingDeck],
  ['crustle', metaCrustleDeck],
];
/** Every unordered pairing, mirrors included: 120 for 15 decks. */
const PAIRINGS = DECKS.flatMap((a, i) => DECKS.slice(i).map((b) => [a, b] as const));
const GAMES = Number(process.env.FUZZ_GAMES ?? 540);
const PER_PAIRING = Math.max(1, Math.round(GAMES / PAIRINGS.length));
/**
 * Lets the Vitest worker answer its RPC between long synchronous tests. Without a macrotask turn, a test file
 * that runs over 60 s fails with "Timeout calling onTaskUpdate" even though every test passes.
 */
const yieldToWorker = () => new Promise((resolve) => setTimeout(resolve, 0));
const wins: Record<string, number> = { ...Object.fromEntries(DECKS.map(([n]) => [n, 0])), draw: 0 };

describe(`${PER_PAIRING * PAIRINGS.length} seeded Easy-bot games across all deck pairings`, () => {
  test.each(PAIRINGS.map(([a, b], i) => [a[0], b[0], i] as const))(
    '%s vs %s finish with no invariant violations',
    async (n0, n1, i) => {
      await yieldToWorker();
      const [[, d0], [, d1]] = PAIRINGS[i]!;
      for (let g = 0; g < PER_PAIRING; g++) {
        const seed = i * PER_PAIRING + g + 1;
        const r = runMatch({ engine, decks: [d0, d1], seed, bots: [bot, bot] });
        if (r.violations.length || !r.result || r.result.reason === 'concede') {
          throw new Error(
            `seed ${seed} (${n0} vs ${n1}): result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
          );
        }
        if (r.result.winner === 'draw') wins.draw!++;
        else wins[r.result.winner === 0 ? n0 : n1]!++;
      }
    },
    120_000,
  );

  test('every deck wins some games', () => {
    console.log('fuzz results', wins);
    for (const [name] of DECKS) expect(wins[name]).toBeGreaterThan(0);
  });
});

describe('Hard-bot games across the decks', () => {
  test.each(DECKS.map(([n], i) => [n, i] as const))(
    'Hard piloting %s finishes a game against Easy with no invariant violations',
    async (name, i) => {
      await yieldToWorker();
      const hardSeat = (i % 2) as 0 | 1;
      const mine = DECKS[i]![1];
      const theirs = DECKS[(i + 1) % DECKS.length]![1];
      const decks = (hardSeat === 0 ? [mine, theirs] : [theirs, mine]) as [DeckList, DeckList];
      const hard = createHardBot(registry, decks, hardSeat, { maxRounds: 1, now: () => 0 });
      const bots = hardSeat === 0 ? ([hard, bot] as const) : ([bot, hard] as const);
      const r = runMatch({ engine, decks, seed: 5000 + i, bots: [bots[0], bots[1]] });
      if (r.violations.length || !r.result || r.result.reason === 'concede') {
        throw new Error(
          `Hard with ${name} (seat ${hardSeat}): result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
        );
      }
    },
    120_000,
  );
});
