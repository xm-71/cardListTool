import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine.ts';
import { viewFor } from '../src/view.ts';
import { act, deckOf, miniRegistry, started } from './fixtures.ts';

const engine = createEngine(miniRegistry());

describe('viewFor', () => {
  test("never reveals the opponent's hand, either deck, prize cards, the RNG or the pending effect", () => {
    const s = started(engine);
    const v = viewFor(s, 0);
    const json = JSON.stringify(v);
    const hidden = [
      ...s.players[1].hand,
      ...s.players[1].deck,
      ...s.players[0].deck,
      ...s.players[0].prizes,
      ...s.players[1].prizes,
    ];
    for (const uid of hidden) expect(json).not.toContain(`"${uid}"`);
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"pending"');
    expect(v.you.hand.map((c) => c.uid)).toEqual(s.players[0].hand);
    expect(v.opponent.handCount).toBe(s.players[1].hand.length);
    expect(v.you.deckCount).toBe(s.players[0].deck.length);
    expect(v.opponent.prizeCount).toBe(6);
  });

  test("a player waiting on the opponent's choice sees no prompt and who they are waiting on", () => {
    const s = engine.createGame({
      decks: [deckOf({ 't-basic': 20, 't-dark': 40 }), deckOf({ 't-basic': 20, 't-dark': 40 })],
      seed: 1,
    });
    expect(s.prompt?.player).toBe(0);
    expect(viewFor(s, 1).prompt).toBeNull();
    expect(viewFor(s, 1).waitingOn).toBe(0);
    expect(viewFor(s, 0).prompt).toEqual(s.prompt);
    expect(viewFor(s, 0).waitingOn).toBeNull();
  });

  test("during setup the opponent's Active and Bench are hidden", () => {
    let s = engine.createGame({
      decks: [deckOf({ 't-basic': 20, 't-dark': 40 }), deckOf({ 't-basic': 20, 't-dark': 40 })],
      seed: 1,
    });
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id }); // player 0 picks an Active
    expect(s.phase).toBe('setup');
    expect(s.players[0].active).not.toBeNull();
    expect(viewFor(s, 1).opponent.active).toBeNull();
    expect(viewFor(s, 1).opponent.bench).toEqual([]);
    expect(viewFor(s, 0).you.active).not.toBeNull();
  });

  test('slots resolve card uids into card instances', () => {
    const s = started(engine);
    const v = viewFor(s, 0);
    expect(v.you.active!.stack[0]).toEqual(s.cards[s.players[0].active!.stack[0]!]);
    expect(v.opponent.active!.stack[0]).toEqual(s.cards[s.players[1].active!.stack[0]!]);
  });
});
