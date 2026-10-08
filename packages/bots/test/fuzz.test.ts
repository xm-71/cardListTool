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
} from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
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
];
/** Every unordered pairing, mirrors included: 45 for 9 decks. */
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
