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
/** The starter, theme and meta decks every Gym deck is played against. */
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
  ['dragapult', metaDragapultDeck],
  ['alakazam', metaAlakazamDeck],
  ['ogerpon-box', metaOgerponBoxDeck],
  ['ns-zoroark', metaNsZoroarkDeck],
  ['slowking', metaSlowkingDeck],
  ['crustle', metaCrustleDeck],
];
const GAMES_PER_SEAT = Number(process.env.GYM_FUZZ_GAMES ?? 2);
/** Lets the Vitest worker answer its RPC between long synchronous tests (see fuzz.test.ts). */
const yieldToWorker = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Gym decks play Easy-bot games to completion against the starter and theme decks', () => {
  test('there are 21 Gym decks', () => {
    expect(Object.keys(GYM_DECKS)).toHaveLength(21);
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

describe('Hard-piloted Gym decks play to completion', () => {
  test.each(Object.entries(GYM_DECKS).map(([id, deck], i) => [id, deck, i] as const))(
    '%s piloted by Hard finishes a game with no invariant violations',
    async (id, deck, i) => {
      await yieldToWorker();
      const [name, opp] = OPPONENTS[i % OPPONENTS.length]!;
      const seat = (i % 2) as 0 | 1;
      const decks = (seat === 0 ? [deck, opp] : [opp, deck]) as [DeckList, DeckList];
      const hard = createHardBot(registry, decks, seat, { maxRounds: 1, now: () => 0 });
      const bots: [typeof bot, typeof bot] = seat === 0 ? [hard, bot] : [bot, hard];
      const r = runMatch({ engine, decks, seed: 9000 + i, bots });
      if (r.violations.length || !r.result || r.result.reason === 'concede') {
        throw new Error(
          `Hard with ${id} vs ${name} (seat ${seat}): result=${JSON.stringify(r.result)} actions=${r.actions} violations=${r.violations.slice(0, 3).join('; ')}`,
        );
      }
    },
    240_000,
  );
});
