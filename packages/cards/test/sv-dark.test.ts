import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  defIdsOf,
  engine,
  game,
  giveCard,
  playTrainer,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const ROARING_MOON = 'sv04-124';
const OKIDOGI = 'sv06.5-036';
const FRIGIBAX = 'sv02-057'; // 60 HP, Water: no Weakness to Darkness
const ARTAZON = 'sv02-171'; // a Stadium
const DARK = 'mee-007';
const spec = {
  [ROARING_MOON]: 3,
  [OKIDOGI]: 3,
  [FRIGIBAX]: 5,
  [ARTAZON]: 1,
  [DARK]: 24,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, DARK);
};
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
/** The Defending Pokémon: Frigibax with `damage` on it (negative: lots of spare HP), and one Benched Frigibax to take over. */
const defender = (s: GameState, opp: PlayerId, damage: number) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = damage;
  benchFromHand(s, opp, giveCard(s, opp, FRIGIBAX));
};

describe('Roaring Moon ex', () => {
  test('Frenzied Gouging Knocks Out the Defending Pokémon whatever its HP, then does 200 to itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ROARING_MOON);
    attach(s0, me, 3);
    defender(s0, opp, -400);
    const old = s0.players[opp].active!.stack[0]!;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].discard).toContain(old);
    expect(s.players[opp].active!.stack[0]).not.toBe(old);
    expect(s.players[me].active!.damage).toBe(200);
    expect(s.players[me].prizes).toHaveLength(5); // 1 Prize for the Frigibax
  });

  test('Frenzied Gouging Knocks Out Roaring Moon ex too when it already has 30 damage: the opponent takes 2 Prizes', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ROARING_MOON);
    s0.players[me].active!.damage = 30;
    benchFromHand(s0, me, giveCard(s0, me, FRIGIBAX));
    attach(s0, me, 3);
    defender(s0, opp, 0);
    const moon = s0.players[me].active!.stack[0]!;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[me].discard).toContain(moon);
    expect(s.players[me].prizes).toHaveLength(5); // the Frigibax
    expect(s.players[opp].prizes).toHaveLength(4); // Roaring Moon ex is worth 2
  });

  test('Calamity Storm does 100, and 220 when a Stadium in play is discarded', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ROARING_MOON);
    attach(s0, me, 3);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    expect(attack(s0, 1).players[opp].active!.damage).toBe(-400 + 100); // no Stadium: nothing to ask
    const withStadium = act(engine, s0, playTrainer(giveCard(s0, me, ARTAZON)));
    expect(withStadium.stadium).not.toBeNull();
    let yes = attack(withStadium, 1);
    yes = act(engine, yes, { type: 'answer', optionId: yes.prompt!.options[0]!.id });
    expect(yes.stadium).toBeNull();
    expect(yes.players[opp].active!.damage).toBe(-400 + 220);
    let no = attack(withStadium, 1);
    no = act(engine, no, { type: 'answer', optionId: no.prompt!.options.at(-1)!.id });
    expect(no.stadium).not.toBeNull();
    expect(no.players[opp].active!.damage).toBe(-400 + 100);
  });
});

describe('Okidogi ex', () => {
  test('Poisonous Musculature attaches up to 2 Basic {D} Energy from the deck and Poisons Okidogi ex', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, OKIDOGI);
    attach(s0, me, 1); // Poisonous Musculature costs {C}
    emptyHand(s0, me);
    const s = resolvePrompts(attack(s0, 0));
    expect(defIdsOf(s, s.players[me].active!.energy)).toEqual([DARK, DARK, DARK]); // 1 + up to 2 more
    expect(s.players[me].active!.conditions.poisoned).toBe(true);
  });

  test('Poisonous Musculature does not Poison Okidogi ex when no Energy was attached', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, OKIDOGI);
    attach(s0, me, 1);
    const deck = s0.players[me].deck;
    const energy = deck.filter((u) => s0.cards[u]!.defId === DARK);
    for (const u of energy) {
      deck.splice(deck.indexOf(u), 1);
      s0.players[me].discard.push(u);
    }
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[me].active!.energy).toHaveLength(1); // nothing found, nothing attached
    expect(s.players[me].active!.conditions.poisoned).toBe(false);
  });

  test('Chain-Crazed does 130, and 260 while Okidogi ex is Poisoned', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, OKIDOGI);
    attach(s0, me, 3);
    swapActiveTo(s0, opp, FRIGIBAX);
    s0.players[opp].active!.damage = -400;
    expect(attack(s0, 1).players[opp].active!.damage).toBe(-400 + 130);
    s0.players[me].active!.conditions = { rotation: 'none', poisoned: true, burned: false };
    expect(attack(s0, 1).players[opp].active!.damage).toBe(-400 + 260);
  });
});
