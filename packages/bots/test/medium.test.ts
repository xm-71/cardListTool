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

/**
 * Lets the Vitest worker answer its RPC between long synchronous tests. Without a macrotask turn, a test file
 * that runs over 60 s fails with "Timeout calling onTaskUpdate" even though every test passes.
 */
const yieldToWorker = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  const GAMES = Number(process.env.MEDIUM_GAMES ?? 36);
  const BATCH = 6;
  const tally = { mediumWins: 0, games: 0, decisions: 0, ms: 0 };
  const batches = Array.from({ length: Math.ceil(GAMES / BATCH) }, (_, i) => i * BATCH + 1);
  test.each(batches)(
    'plays Medium vs Easy games from seed %i without violations',
    async (first) => {
      await yieldToWorker();
      for (let seed = first; seed < first + BATCH && seed <= GAMES; seed++) {
        const d0 = DECKS[seed % 3]!;
        const d1 = DECKS[Math.floor(seed / 3) % 3]!;
        const mediumSeat = (seed % 2) as 0 | 1;
        const decks: [DeckList, DeckList] = [d0, d1];
        const medium = createMediumBot(registry, decks, mediumSeat, 2);
        const timed: typeof medium = (v, l, r) => {
          const t = performance.now();
          const out = medium(v, l, r);
          tally.ms += performance.now() - t;
          tally.decisions++;
          return out;
        };
        const bots: [typeof easy, typeof easy] = mediumSeat === 0 ? [timed, easy] : [easy, timed];
        const r = runMatch({ engine, decks, seed: 1000 + seed, bots });
        expect(r.violations).toEqual([]);
        expect(r.result?.reason).not.toBe('concede');
        if (r.result?.winner === mediumSeat) tally.mediumWins++;
        tally.games++;
      }
    },
    120_000,
  );

  test('beats the Easy bot in most games across deck pairings', () => {
    const { mediumWins, games, decisions, ms } = tally;
    expect(games).toBe(GAMES);
    console.log(`medium won ${mediumWins}/${games}; ${(ms / decisions).toFixed(1)} ms per decision`);
    if (!process.env.CI_SLOW) expect(ms / decisions).toBeLessThan(250);
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

describe('medium bot promotion', () => {
  test('promotes the Pokémon that is best afterwards, not just the one with the most Energy', () => {
    const decks: [DeckList, DeckList] = [megaLucarioDeck, megaGengarDeck];
    let s = finishSetup(engine, engine.createGame({ decks, seed: 12 }));
    while (!(s.current === 1 && s.turn >= 2)) s = act(engine, s, { type: 'endTurn' });
    // seat 1 (Gengar) attacks and Knocks Out seat 0's Active; seat 0 (Medium) must promote
    swapActiveTo(s, 1, 'me02-056');
    attachFromDeck(s, 1, 'mee-007');
    attachFromDeck(s, 1, 'mee-007');
    swapActiveTo(s, 0, 'me01-076');
    s.players[0].active!.damage = 70;
    const p0 = s.players[0];
    const take = (defId: string) => {
      const i = p0.deck.findIndex((u) => s.cards[u]!.defId === defId);
      return p0.deck.splice(i, 1)[0]!;
    };
    const slot = (uid: string, energy: string[], damage: number) => ({
      stack: [uid],
      energy,
      tool: null,
      damage,
      conditions: { rotation: 'none' as const, poisoned: false, burned: false },
      enteredTurn: 0,
      evolvedTurn: null,
      abilityUsedTurn: {},
      cantAttackOnTurn: null,
      attackLocks: {},
      markers: [],
      becameActiveTurn: null,
    });
    // bench 0: Riolu with 2 Energy but only 10 HP left; bench 1: healthy Mega Lucario ex with 1 Energy
    p0.bench = [
      slot(take('me01-076'), [take('mee-006'), take('mee-006')], 70),
      slot(take('me01-077'), [take('mee-006')], 0),
    ];
    s = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(s.prompt?.player).toBe(0);
    const view = engine.viewFor(s, 0);
    const legal = engine.getLegalActions(s, 0);
    const easyPick = easy(view, legal, 1).action;
    const mediumPick = createMediumBot(registry, decks, 0)(view, legal, 1).action;
    const benchOf = (a: typeof easyPick) =>
      s.prompt!.options.find((o) => a.type === 'answer' && o.id === a.optionId)?.slot;
    expect(benchOf(easyPick)).toEqual({ player: 0, zone: 'bench', index: 0 });
    expect(benchOf(mediumPick)).toEqual({ player: 0, zone: 'bench', index: 1 });
  });
});

describe('bots never concede', () => {
  test('the Easy bot refuses to pick concede even when it is the only option', () => {
    const s = finishSetup(engine, engine.createGame({ decks: [megaGengarDeck, megaDiancieDeck], seed: 3 }));
    expect(() => easy(engine.viewFor(s, s.current), [{ type: 'concede' }], 1)).toThrow(/concede/);
  });
});
