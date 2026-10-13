import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '../src/gym.ts';
import { act, assertGymDeck, attachFromDeck, engine, game, giveCard, swapActiveTo } from './helpers.ts';

const SNORLAX = 'sv03.5-143';
const MILTANK = 'me01-106';
const FIGHTING = 'mee-006';
const LEFTOVERS = 'sv03.5-163';
const spec = { [SNORLAX]: 4, [MILTANK]: 8, [FIGHTING]: 20, [LEFTOVERS]: 4 };

describe('Whitney deck', () => {
  test('60 playable, Gym-legal cards within the deck rules', () => assertGymDeck(GYM_DECKS.whitney));
});

describe('Snorlax', () => {
  test('Thudding Press does 130 and 30 damage to itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SNORLAX);
    swapActiveTo(s0, opp, MILTANK);
    s0.players[opp].active!.damage = -400;
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, FIGHTING);
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[me].active!.damage).toBe(30);
    expect(s.players[opp].active!.damage).toBe(-400 + 130);
  });

  test('Voraciousness puts up to 2 Leftovers from the discard pile into the hand, once per turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, SNORLAX);
    const p = s0.players[me];
    for (let i = 0; i < 3; i++) {
      const uid = giveCard(s0, me, LEFTOVERS);
      p.hand.splice(p.hand.indexOf(uid), 1);
      p.discard.push(uid);
    }
    const ability = {
      type: 'useAbility',
      slot: { player: me, zone: 'active' },
      ability: 'Voraciousness',
    } as const;
    expect(engine.getLegalActions(s0, me)).toContainEqual(ability);
    let s = act(engine, s0, ability);
    while (s.prompt) {
      const pr = s.prompt;
      s = act(engine, s, {
        type: 'answer',
        optionId: pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id,
      });
    }
    const inHand = s.players[me].hand.filter((u) => s.cards[u]!.defId === LEFTOVERS);
    expect(inHand.length).toBeGreaterThanOrEqual(1);
    expect(inHand.length).toBeLessThanOrEqual(2);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(ability);
  });

  test('Voraciousness cannot be used with no Leftovers in the discard pile', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, SNORLAX);
    expect(engine.getLegalActions(s, me).some((a) => a.type === 'useAbility')).toBe(false);
  });
});
