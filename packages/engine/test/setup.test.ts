import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine.ts';
import { checkInvariants } from '../src/invariants.ts';
import { act, deckOf, finishSetup, miniRegistry } from './fixtures.ts';

const engine = createEngine(miniRegistry());
const deck = deckOf({ 't-basic': 20, 't-dark': 40 });

describe('createGame', () => {
  test('starts in setup with player 0 choosing an Active from the Basics in hand', () => {
    const s = engine.createGame({ decks: [deck, deck], seed: 1 });
    expect(s.phase).toBe('setup');
    expect(s.prompt?.player).toBe(0);
    expect(s.prompt?.kind).toBe('cards');
    const basicsInHand = s.players[0].hand.filter((u) => s.cards[u]!.defId === 't-basic');
    expect(basicsInHand.length).toBeGreaterThan(1);
    expect(s.prompt!.options.map((o) => o.uid).sort()).toEqual([...basicsInHand].sort());
    expect(s.players[0].hand).toHaveLength(7);
  });

  test('finishing both setups starts turn 1 with prizes dealt and the first player drawing', () => {
    let s = engine.createGame({ decks: [deck, deck], seed: 1 });
    // player 0: Active + one Bench Pokémon; player 1: Active only
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    if (s.prompt?.player === 0) s = act(engine, s, { type: 'answer', optionId: 'done' });
    s = finishSetup(engine, s);
    expect(s.phase).toBe('main');
    expect(s.turn).toBe(1);
    expect(s.current).toBe(s.first);
    expect(s.prompt).toBeNull();
    expect(s.pending).toBeNull();
    for (const p of [0, 1] as const) {
      expect(s.players[p].prizes).toHaveLength(6);
      expect(s.players[p].active).not.toBeNull();
    }
    expect(s.players[0].bench).toHaveLength(1);
    const f = s.first;
    const benched = s.players[f].bench.length;
    const bonus = s.players[f === 0 ? 1 : 0].mulligans;
    expect(s.players[f].hand).toHaveLength(7 - 1 - benched + 1 + bonus);
    expect(checkInvariants(s, engine.registry)).toEqual([]);
  });

  test('a deck with a single Basic still reaches a legal start, counting mulligans', () => {
    const thin = deckOf({ 't-basic': 1, 't-dark': 59 });
    const s = finishSetup(engine, engine.createGame({ decks: [thin, deck], seed: 42 }));
    expect(s.phase).toBe('main');
    expect(s.players[0].mulligans).toBeGreaterThan(0);
    expect(checkInvariants(s, engine.registry)).toEqual([]);
  });

  test('state survives a JSON round trip, including mid-setup', () => {
    const s = engine.createGame({ decks: [deck, deck], seed: 3 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const done = finishSetup(engine, JSON.parse(JSON.stringify(s)));
    expect(done).toEqual(finishSetup(engine, s));
  });

  test('rejects decks that are not 60 cards or have no Basic Pokémon', () => {
    expect(() => engine.createGame({ decks: [deckOf({ 't-basic': 10 }), deck], seed: 1 })).toThrow(/60/);
    expect(() => engine.createGame({ decks: [deckOf({ 't-dark': 60 }), deck], seed: 1 })).toThrow(/Basic/);
  });
});
