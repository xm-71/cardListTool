import { expect, test } from 'vitest';
import { createEngine, type DeckList } from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck } from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { runMatch } from '../src/runMatch.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);
const GAMES = Number(process.env.FUZZ_GAMES ?? 500);

test(`${GAMES} seeded Easy-bot games finish with no invariant violations`, () => {
  const wins: Record<string, number> = { gengar: 0, diancie: 0, draw: 0 };
  for (let seed = 1; seed <= GAMES; seed++) {
    const gengarFirstSeat = seed % 2 === 0;
    const decks: [DeckList, DeckList] = gengarFirstSeat
      ? [megaGengarDeck, megaDiancieDeck]
      : [megaDiancieDeck, megaGengarDeck];
    const r = runMatch({ engine, decks, seed, bots: [bot, bot] });
    if (r.violations.length || !r.result) {
      throw new Error(
        `seed ${seed}: result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
      );
    }
    if (r.result.winner === 'draw') wins.draw!++;
    else wins[(r.result.winner === 0) === gengarFirstSeat ? 'gengar' : 'diancie']!++;
  }
  console.log('fuzz results', wins);
  expect(wins.gengar).toBeGreaterThan(0);
  expect(wins.diancie).toBeGreaterThan(0);
}, 600_000);
