import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, engine, game, giveCard, playTrainer, resolvePrompts } from './helpers.ts';

const CONVICTION = 'sv05-155';
const deck = GYM_DECKS.morty;
describe('Morty deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(deck));
});

describe("Morty's Conviction", () => {
  const spec = { [CONVICTION]: 4, 'me02-054': 10, 'mee-007': 30 };

  test("discards another card and draws a card for each of the opponent's Benched Pokémon", () => {
    const { s: s0, me, opp } = game(spec);
    const bench = s0.players[opp].bench.length;
    for (let i = 0; i < 3 - bench; i++) {
      const uid = s0.players[opp].deck.shift()!;
      s0.cards[uid]!.defId = 'me02-054';
      s0.players[opp].bench.push({
        stack: [uid],
        energy: [],
        tool: null,
        damage: 0,
        conditions: { rotation: 'none', poisoned: false, burned: false },
        enteredTurn: 0,
        evolvedTurn: null,
        abilityUsedTurn: {},
        cantAttackOnTurn: null,
        attackLocks: {},
        markers: [],
        becameActiveTurn: null,
      } as never);
    }
    const handBefore = s0.players[me].hand.length;
    const card = giveCard(s0, me, CONVICTION);
    let s = act(engine, s0, playTrainer(card));
    s = resolvePrompts(s);
    expect(s.players[opp].bench.length).toBe(3);
    // +1 for the played card, -1 played, -1 discarded, +3 drawn
    expect(s.players[me].hand.length).toBe(handBefore + 3 - 1);
    expect(s.players[me].discard.length).toBeGreaterThanOrEqual(2);
  });

  test('cannot be played with no other card in hand', () => {
    const { s: s0, me } = game(spec);
    s0.players[me].deck.push(...s0.players[me].hand.splice(0));
    const card = giveCard(s0, me, CONVICTION);
    expect(() => act(engine, s0, playTrainer(card))).toThrow();
  });
});
