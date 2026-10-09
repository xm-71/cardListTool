import { describe, expect, test } from 'vitest';
import { createEngine, type DeckList } from '@ptcg/engine';
import {
  GYM_DECKS,
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
/** The 3 starter decks and 6 theme decks every Gym deck is played against. */
const OPPONENTS: [string, DeckList][] = [
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
const GAMES_PER_SEAT = Number(process.env.GYM_FUZZ_GAMES ?? 2);
/** Lets the Vitest worker answer its RPC between long synchronous tests (see fuzz.test.ts). */
const yieldToWorker = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Gym decks play Easy-bot games to completion against the starter and theme decks', () => {
  test('there are 15 Gym decks', () => {
    expect(Object.keys(GYM_DECKS)).toHaveLength(15);
  });

  test.each(Object.entries(GYM_DECKS))(
    '%s finishes every game with no invariant violations',
    async (id, deck) => {
      await yieldToWorker();
      let seed = 1000 + Object.keys(GYM_DECKS).indexOf(id) * 1000;
      for (const [name, opp] of OPPONENTS)
        for (const seat of [0, 1] as const)
          for (let g = 0; g < GAMES_PER_SEAT; g++) {
            const decks = seat === 0 ? [deck, opp] : [opp, deck];
            const r = runMatch({
              engine,
              decks: decks as [DeckList, DeckList],
              seed: seed++,
              bots: [bot, bot],
            });
            if (r.violations.length || !r.result || r.result.reason === 'concede') {
              throw new Error(
                `${id} vs ${name} (seat ${seat}, seed ${seed - 1}): result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
              );
            }
          }
    },
    240_000,
  );
});
