import { describe, expect, test } from 'vitest';
import { createEngine, type DeckList } from '@ptcg/engine';
import { attachFromDeck, finishSetup, giveCard, swapActiveTo, act } from '@ptcg/engine/testing';
import { buildRegistry, megaDiancieDeck, megaGengarDeck, megaLucarioDeck } from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { createMediumBot } from '../src/medium.ts';
import { runMatch } from '../src/runMatch.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const easy = createEasyBot(registry);
const DECKS: DeckList[] = [megaGengarDeck, megaDiancieDeck, megaLucarioDeck];

describe('medium bot', () => {
  test('takes a Knockout when one is available', () => {
    const decks: [DeckList, DeckList] = [megaGengarDeck, megaDiancieDeck];
    let s = finishSetup(engine, engine.createGame({ decks, seed: 4 }));
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const opp = me === 0 ? 1 : 0;
    if (me === 0) {
      swapActiveTo(s, 0, 'me02-056');
      attachFromDeck(s, 0, 'mee-007');
      attachFromDeck(s, 0, 'mee-007');
    } else {
      swapActiveTo(s, 1, 'me02-045'); // Zacian, Limit Break 50
      attachFromDeck(s, 1, 'mee-005');
      attachFromDeck(s, 1, 'mee-005');
    }
    const defender = s.players[opp].active!;
    defender.damage = (registry.defs[s.cards[defender.stack.at(-1)!]!.defId] as { hp: number }).hp - 10;
    giveCard(s, me, me === 0 ? 'mee-007' : 'mee-005');
    const bot = createMediumBot(registry, decks, me);
    let state = s;
    let rng = 11;
    // let the bot play its turn; it should Knock Out the Defending Pokémon before the turn ends
    for (let i = 0; i < 30 && state.current === me && !state.result; i++) {
      const p = state.prompt ? state.prompt.player : state.current;
      const legal = engine.getLegalActions(state, p);
      const r =
        p === me ? bot(engine.viewFor(state, p), legal, rng) : easy(engine.viewFor(state, p), legal, rng);
      rng = r.rng;
      state = engine.applyAction(state, p, r.action).state;
    }
    expect(state.players[me].prizes.length).toBeLessThan(6);
  });

  test('beats the Easy bot in most games across deck pairings', () => {
    const GAMES = Number(process.env.MEDIUM_GAMES ?? 36);
    let mediumWins = 0;
    let decisions = 0;
    let ms = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      const d0 = DECKS[seed % 3]!;
      const d1 = DECKS[Math.floor(seed / 3) % 3]!;
      const mediumSeat = (seed % 2) as 0 | 1;
      const decks: [DeckList, DeckList] = [d0, d1];
      const medium = createMediumBot(registry, decks, mediumSeat, 2);
      const timed: typeof medium = (v, l, r) => {
        const t = performance.now();
        const out = medium(v, l, r);
        ms += performance.now() - t;
        decisions++;
        return out;
      };
      const bots: [typeof easy, typeof easy] = mediumSeat === 0 ? [timed, easy] : [easy, timed];
      const r = runMatch({ engine, decks, seed: 1000 + seed, bots });
      expect(r.violations).toEqual([]);
      if (r.result?.winner === mediumSeat) mediumWins++;
    }
    console.log(`medium won ${mediumWins}/${GAMES}; ${(ms / decisions).toFixed(1)} ms per decision`);
    expect(mediumWins / GAMES).toBeGreaterThanOrEqual(0.6);
  }, 900_000);
});

describe('medium bot robustness', () => {
  test('falls back to the Easy move when its simulation fails (e.g. wrong decklists)', () => {
    const decks: [DeckList, DeckList] = [megaGengarDeck, megaDiancieDeck];
    let s = finishSetup(engine, engine.createGame({ decks, seed: 8 }));
    s = act(engine, s, { type: 'endTurn' });
    const me = s.current;
    const wrong: [DeckList, DeckList] = [megaLucarioDeck, megaLucarioDeck]; // can't match the visible cards
    const bot = createMediumBot(registry, wrong, me);
    const view = engine.viewFor(s, me);
    const legal = engine.getLegalActions(s, me);
    expect(bot(view, legal, 5)).toEqual(easy(view, legal, 5));
  });
});
