import { describe, expect, test } from 'vitest';
import {
  createEngine,
  type CardInstance,
  type DeckList,
  type GameState,
  type PlayerView,
} from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck } from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { determinize } from '../src/determinize.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const easy = createEasyBot(registry);
const decks: [DeckList, DeckList] = [megaGengarDeck, megaDiancieDeck];

/** Play `n` actions of an Easy-vs-Easy game to get a mid-game position. */
function midGame(n: number, seed = 5): GameState {
  let s = engine.createGame({ decks, seed });
  let rng = seed;
  for (let i = 0; i < n && !s.result; i++) {
    const p = s.prompt ? s.prompt.player : s.current;
    const r = easy(engine.viewFor(s, p), engine.getLegalActions(s, p), rng);
    rng = r.rng;
    s = engine.applyAction(s, p, r.action).state;
  }
  return s;
}

const visibleUids = (v: PlayerView) => {
  const out: CardInstance[] = [
    ...v.you.hand,
    ...v.you.discard,
    ...v.opponent.discard,
    ...(v.stadium ? [v.stadium.card] : []),
  ];
  for (const slot of [v.you.active, ...v.you.bench, v.opponent.active, ...v.opponent.bench]) {
    if (slot) out.push(...slot.stack, ...slot.energy, ...(slot.tool ? [slot.tool] : []));
  }
  return out;
};

describe('determinize', () => {
  test('keeps every visible card in place and fills hidden zones to the right sizes', () => {
    const real = midGame(60);
    const me = real.current;
    const view = engine.viewFor(real, me);
    const { state } = determinize(view, decks, registry, 42);
    expect(engine.viewFor(state, me).you).toEqual(view.you);
    const opp = me === 0 ? 1 : 0;
    expect(state.players[opp].hand).toHaveLength(view.opponent.handCount);
    expect(state.players[opp].deck).toHaveLength(view.opponent.deckCount);
    expect(state.players[opp].prizes).toHaveLength(view.opponent.prizeCount);
    expect(state.players[me].deck).toHaveLength(view.you.deckCount);
    for (const c of visibleUids(view)) expect(state.cards[c.uid]).toEqual(c);
  });

  test('each player still owns exactly their 60-card decklist', () => {
    const real = midGame(80);
    const { state } = determinize(engine.viewFor(real, real.current), decks, registry, 7);
    for (const p of [0, 1] as const) {
      const counts: Record<string, number> = {};
      for (const c of Object.values(state.cards))
        if (c.owner === p) counts[c.defId] = (counts[c.defId] ?? 0) + 1;
      const expected = Object.fromEntries(decks[p].cards.map((c) => [c.id, c.count]));
      expect(counts).toEqual(expected);
    }
  });

  test('never uses the real hidden cards and is deterministic for a given rng', () => {
    const real = midGame(40);
    const me = real.current;
    const opp = me === 0 ? 1 : 0;
    const view = engine.viewFor(real, me);
    const a = determinize(view, decks, registry, 99).state;
    const b = determinize(view, decks, registry, 99).state;
    expect(a).toEqual(b);
    const hidden = new Set([
      ...real.players[opp].hand,
      ...real.players[opp].deck,
      ...real.players[opp].prizes,
      ...real.players[me].deck,
      ...real.players[me].prizes,
    ]);
    for (const uid of [...a.players[opp].hand, ...a.players[opp].deck, ...a.players[opp].prizes])
      expect(hidden.has(uid)).toBe(false);
  });

  test('the rebuilt state is playable: the same legal actions as the real one for the acting player', () => {
    const real = midGame(50);
    const me = real.prompt ? real.prompt.player : real.current;
    if (real.prompt) return; // prompts can't be rebuilt (no paused effect); the bot handles them heuristically
    const { state } = determinize(engine.viewFor(real, me), decks, registry, 3);
    const norm = (acts: unknown[]) => acts.map((a) => JSON.stringify(a)).sort();
    expect(norm(engine.getLegalActions(state, me))).toEqual(norm(engine.getLegalActions(real, me)));
  });

  test('carries the newer timed markers and Supporter memory into the simulated state', () => {
    const real = midGame(60);
    const me = real.current;
    real.players[me].active!.markers.push(
      { kind: 'increaseOutgoing', amount: 120, untilTurn: real.turn + 2 },
      { kind: 'preventDamage', amount: 0, untilTurn: real.turn + 1 },
      { kind: 'attackCostMore', amount: 1, untilTurn: real.turn + 1 },
      { kind: 'retreatCostMore', amount: 1, untilTurn: real.turn + 1 },
    );
    real.players[me].supporterPlayed = { turn: real.turn, name: "Giovanni's Charisma" };
    const view = engine.viewFor(real, me);
    expect(view.you.supporterPlayed).toEqual({ turn: real.turn, name: "Giovanni's Charisma" });
    const { state } = determinize(view, decks, registry, 42);
    const again = engine.viewFor(state, me);
    expect(again.you.active!.markers).toEqual(view.you.active!.markers);
    expect(again.you.supporterPlayed).toEqual(view.you.supporterPlayed);
  });
});
