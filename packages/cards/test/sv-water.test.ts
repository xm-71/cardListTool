import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import {
  act,
  answerCards,
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

const CHIEN_PAO = 'sv02-061';
const FRIGIBAX = 'sv02-057';
const BAXCALIBUR = 'sv02-060';
const SQUAWKABILLY = 'sv02-169';
const SER = 'sv02-189';
const SUPER_ROD = 'sv02-188';
const VESSEL = 'sv04-163';
const WATER = 'mee-003';
const FIRE = 'mee-002';
const spec = {
  [CHIEN_PAO]: 2,
  [FRIGIBAX]: 4,
  [BAXCALIBUR]: 2,
  [SQUAWKABILLY]: 1,
  [SER]: 2,
  [SUPER_ROD]: 1,
  [VESSEL]: 2,
  [WATER]: 20,
  [FIRE]: 4,
};
const ability = (p: PlayerId, name: string, zone: 'active' | 'bench' = 'active') =>
  ({
    type: 'useAbility',
    slot: zone === 'active' ? { player: p, zone } : { player: p, zone, index: 0 },
    ability: name,
  }) as const;
const canUse = (s: GameState, p: PlayerId, name: string) =>
  engine.getLegalActions(s, p).some((a) => a.type === 'useAbility' && a.ability === name);
const handIds = (s: GameState, p: PlayerId) => defIdsOf(s, s.players[p].hand);
/** A tanky neutral Defending Pokémon. */
const buffer = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = -400;
};

describe('Baxcalibur', () => {
  test('Super Cold attaches any number of Basic {W} Energy from the hand, one at a time', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, BAXCALIBUR);
    s0.players[me].deck.push(...s0.players[me].hand.splice(0));
    for (let i = 0; i < 3; i++) giveCard(s0, me, WATER);
    giveCard(s0, me, FIRE);
    let s = s0;
    for (let i = 0; i < 3; i++) {
      expect(canUse(s, me, 'Super Cold')).toBe(true);
      s = resolvePrompts(act(engine, s, ability(me, 'Super Cold')));
    }
    expect(defIdsOf(s, s.players[me].active!.energy)).toEqual([WATER, WATER, WATER]);
    expect(handIds(s, me)).toEqual([FIRE]);
    expect(canUse(s, me, 'Super Cold')).toBe(false); // no Basic {W} Energy left in hand
  });
});

describe('Chien-Pao ex', () => {
  test('Hail Blade does 60 for each {W} Energy discarded from your Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CHIEN_PAO);
    for (let i = 0; i < 4; i++) attachFromDeck(s0, me, WATER);
    buffer(s0, opp);
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    s = answerCards(s, [WATER, WATER]);
    if (s.prompt) s = resolvePrompts(act(engine, s, { type: 'answer', optionId: 'done' }));
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
    expect(s.players[me].active!.energy).toHaveLength(2);
    expect(s.players[me].discard.filter((u) => s.cards[u]!.defId === WATER)).toHaveLength(2);
  });

  test('Hail Blade may discard nothing, for no damage', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CHIEN_PAO);
    for (let i = 0; i < 2; i++) attachFromDeck(s0, me, WATER);
    buffer(s0, opp);
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(s.players[opp].active!.damage).toBe(-400);
    expect(s.players[me].active!.energy).toHaveLength(2);
  });

  test('Shivery Chill finds up to 2 Basic {W} Energy while Active, once per turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, CHIEN_PAO);
    const hand = s0.players[me].hand.length;
    let s = act(engine, s0, ability(me, 'Shivery Chill'));
    s = answerCards(s, [WATER, WATER]);
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(s.players[me].hand).toHaveLength(hand + 2);
    expect(handIds(s, me).filter((d) => d === WATER).length).toBeGreaterThanOrEqual(2);
    expect(canUse(s, me, 'Shivery Chill')).toBe(false);
  });

  test('Shivery Chill is not available from the Bench', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, FRIGIBAX);
    benchFromHand(s, me, giveCard(s, me, CHIEN_PAO));
    expect(canUse(s, me, 'Shivery Chill')).toBe(false);
  });
});

describe('Squawkabilly ex', () => {
  test('Squawk and Seize discards the hand and draws 6, only on your first turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, SQUAWKABILLY);
    const before = [...s0.players[me].hand];
    const s = act(engine, s0, ability(me, 'Squawk and Seize'));
    expect(s.players[me].hand).toHaveLength(6);
    for (const uid of before) expect(s.players[me].discard).toContain(uid);

    const { s: later, me: me2 } = game(spec, spec, { turn: 3 });
    swapActiveTo(later, me2, SQUAWKABILLY);
    expect(canUse(later, me2, 'Squawk and Seize')).toBe(false);
  });

  test('Motivate attaches up to 2 Basic Energy from the discard pile to a Benched Pokémon', () => {
    const { s: s0, me } = game(spec, spec, { turn: 3 });
    swapActiveTo(s0, me, SQUAWKABILLY);
    benchFromHand(s0, me, giveCard(s0, me, FRIGIBAX));
    attachFromDeck(s0, me, WATER);
    const discard = s0.players[me].discard;
    for (let i = 0; i < 3; i++) {
      const uid = s0.players[me].deck.find((u) => s0.cards[u]!.defId === WATER)!;
      s0.players[me].deck.splice(s0.players[me].deck.indexOf(uid), 1);
      discard.push(uid);
    }
    const s = resolvePrompts(act(engine, s0, { type: 'attack', attackIndex: 0 }));
    expect(s.players[me].bench[0]!.energy).toHaveLength(2);
    expect(s.players[me].discard.filter((u) => s.cards[u]!.defId === WATER)).toHaveLength(1);
  });
});

describe('Superior Energy Retrieval', () => {
  const setup = () => {
    const { s, me } = game(spec);
    s.players[me].deck.push(...s.players[me].hand.splice(0));
    const discard = s.players[me].discard;
    for (let i = 0; i < 5; i++) {
      const uid = s.players[me].deck.find((u) => s.cards[u]!.defId === WATER)!;
      s.players[me].deck.splice(s.players[me].deck.indexOf(uid), 1);
      discard.push(uid);
    }
    return { s, me };
  };

  test('needs 2 other cards to discard', () => {
    const { s, me } = setup();
    const uid = giveCard(s, me, SER);
    giveCard(s, me, FIRE);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(uid));
  });

  test('discards 2 other cards, then puts up to 4 Basic Energy from the discard pile into the hand', () => {
    const { s: s0, me } = setup();
    const uid = giveCard(s0, me, SER);
    giveCard(s0, me, FIRE);
    giveCard(s0, me, FIRE);
    giveCard(s0, me, FRIGIBAX); // a third choice, so the discard is asked about
    let s = act(engine, s0, playTrainer(uid));
    s = answerCards(s, [FIRE, FIRE]);
    if (s.prompt) s = answerCards(s, [WATER, WATER, WATER, WATER]);
    if (s.prompt) s = resolvePrompts(act(engine, s, { type: 'answer', optionId: 'done' }));
    // 4 of the 5 Water Energy came back; the 2 Fire Energy discarded for the cost may not
    expect(handIds(s, me).filter((d) => d === WATER)).toHaveLength(4);
    expect(handIds(s, me).filter((d) => d === FIRE)).toHaveLength(0);
    expect(s.players[me].discard.filter((u) => s.cards[u]!.defId === FIRE)).toHaveLength(2);
  });
});

describe('Earthen Vessel', () => {
  test('discards another card, then finds up to 2 Basic Energy', () => {
    const { s: s0, me } = game(spec);
    s0.players[me].deck.push(...s0.players[me].hand.splice(0));
    const uid = giveCard(s0, me, VESSEL);
    giveCard(s0, me, FIRE);
    giveCard(s0, me, FRIGIBAX); // a second choice, so the discard is asked about
    let s = act(engine, s0, playTrainer(uid));
    s = answerCards(s, [FIRE]);
    if (s.prompt) s = answerCards(s, [WATER, WATER]);
    if (s.prompt) s = resolvePrompts(act(engine, s, { type: 'answer', optionId: 'done' }));
    expect(handIds(s, me).sort()).toEqual([WATER, WATER, FRIGIBAX]);
    expect(defIdsOf(s, s.players[me].discard).sort()).toEqual([FIRE, VESSEL]);
  });

  test('needs another card to discard', () => {
    const { s, me } = game(spec);
    s.players[me].deck.push(...s.players[me].hand.splice(0));
    const uid = giveCard(s, me, VESSEL);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(uid));
  });
});

describe('Super Rod', () => {
  test('shuffles up to 3 Pokémon and Basic Energy from the discard pile into the deck', () => {
    const { s: s0, me } = game(spec);
    s0.players[me].deck.push(...s0.players[me].hand.splice(0));
    const discard = s0.players[me].discard;
    for (const def of [FRIGIBAX, WATER, CHIEN_PAO, FIRE]) {
      const uid = s0.players[me].deck.find((u) => s0.cards[u]!.defId === def)!;
      s0.players[me].deck.splice(s0.players[me].deck.indexOf(uid), 1);
      discard.push(uid);
    }
    const uid = giveCard(s0, me, SUPER_ROD);
    const deckBefore = s0.players[me].deck.length;
    let s = act(engine, s0, playTrainer(uid));
    s = answerCards(s, [FRIGIBAX, WATER, CHIEN_PAO]);
    if (s.prompt) s = resolvePrompts(act(engine, s, { type: 'answer', optionId: 'done' }));
    expect(s.players[me].deck).toHaveLength(deckBefore + 3);
    expect(defIdsOf(s, s.players[me].discard).filter((d) => d === FIRE)).toHaveLength(1); // the fourth stays
    expect(s.players[me].discard.map((u) => s.cards[u]!.defId)).toContain(SUPER_ROD);
  });
});
