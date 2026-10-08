import { expect, test } from 'vitest';
import { createEngine, type DeckList } from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck, megaLucarioDeck } from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { runMatch } from '../src/runMatch.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);
const DECKS: [string, DeckList][] = [
  ['gengar', megaGengarDeck],
  ['diancie', megaDiancieDeck],
  ['lucario', megaLucarioDeck],
];
const PAIRINGS = DECKS.flatMap((a) => DECKS.map((b) => [a, b] as const));
const GAMES = Number(process.env.FUZZ_GAMES ?? 540);

test(`${GAMES} seeded Easy-bot games across all deck pairings finish with no invariant violations`, () => {
  const wins: Record<string, number> = { gengar: 0, diancie: 0, lucario: 0, draw: 0 };
  for (let seed = 1; seed <= GAMES; seed++) {
    const [[n0, d0], [n1, d1]] = PAIRINGS[seed % PAIRINGS.length]!;
    const r = runMatch({ engine, decks: [d0, d1], seed, bots: [bot, bot] });
    if (r.violations.length || !r.result || r.result.reason === 'concede') {
      throw new Error(
        `seed ${seed} (${n0} vs ${n1}): result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
      );
    }
    if (r.result.winner === 'draw') wins.draw!++;
    else wins[r.result.winner === 0 ? n0 : n1]!++;
  }
  console.log('fuzz results', wins);
  for (const [name] of DECKS) expect(wins[name]).toBeGreaterThan(0);
}, 900_000);
