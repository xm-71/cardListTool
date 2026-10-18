import { describe, expect, test } from 'vitest';
import type { GameState, PlayerId } from '@ptcg/engine';
import { maxHp, standard2026 } from '@ptcg/engine';
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
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const RALTS = 'me01-058';
const KIRLIA = 'me01-059';
const GARDEVOIR = 'sv01-086';
const SCREAM_TAIL = 'sv04-086';
const MEW = 'sv03.5-151';
const COUNTER_CATCHER = 'sv04-160';
const CHARM = 'sv02-173';
const ARTAZON = 'sv02-171';
const MUNKIDORI = 'sv06-095';
const PSYCHIC = 'mee-005';
const spec = {
  [RALTS]: 4,
  [KIRLIA]: 3,
  [GARDEVOIR]: 2,
  [SCREAM_TAIL]: 1,
  [MEW]: 1,
  [MUNKIDORI]: 2,
  [COUNTER_CATCHER]: 2,
  [CHARM]: 2,
  [ARTAZON]: 2,
  [PSYCHIC]: 10,
};
const env = { registry, ruleset: standard2026 };
const ability = (p: PlayerId, name: string, zone: 'active' | 'bench' = 'active', index = 0) =>
  ({
    type: 'useAbility',
    slot: zone === 'active' ? { player: p, zone } : { player: p, zone, index },
    ability: name,
  }) as const;
const canUse = (s: GameState, p: PlayerId, name: string) =>
  engine.getLegalActions(s, p).some((a) => a.type === 'useAbility' && a.ability === name);
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
const toDiscard = (s: GameState, p: PlayerId, defId: string, n: number) => {
  for (let i = 0; i < n; i++) {
    const uid = s.players[p].deck.find((u) => s.cards[u]!.defId === defId)!;
    s.players[p].deck.splice(s.players[p].deck.indexOf(uid), 1);
    s.players[p].discard.push(uid);
  }
};
/** A tanky neutral Defending Pokémon. */
const buffer = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, MUNKIDORI);
  s.players[opp].active!.damage = -400;
};

describe('Ralts and Kirlia', () => {
  test('Collect draws a card', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, RALTS);
    attachFromDeck(s0, me, PSYCHIC);
    const hand = s0.players[me].hand.length;
    const s = attack(s0, 0);
    expect(s.players[me].hand).toHaveLength(hand + 1);
  });

  test('Call Sign puts up to 3 Pokémon from the deck into the hand', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, KIRLIA);
    attachFromDeck(s0, me, PSYCHIC);
    emptyHand(s0, me);
    let s = attack(s0, 0);
    s = answerCards(s, [GARDEVOIR, GARDEVOIR, MEW]);
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(defIdsOf(s, s.players[me].hand).sort()).toEqual([GARDEVOIR, GARDEVOIR, MEW].sort());
  });
});

describe('Gardevoir ex', () => {
  test('Psychic Embrace attaches Basic {P} Energy from the discard pile, 2 damage counters each, as often as you like', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, GARDEVOIR);
    benchFromHand(s0, me, giveCard(s0, me, RALTS));
    toDiscard(s0, me, PSYCHIC, 3);
    let s = s0;
    for (let i = 0; i < 3; i++) {
      expect(canUse(s, me, 'Psychic Embrace')).toBe(true);
      s = resolvePrompts(act(engine, s, ability(me, 'Psychic Embrace')));
    }
    const onBoard = s.players[me].active!.energy.length + s.players[me].bench[0]!.energy.length;
    expect(onBoard).toBe(3);
    const counters = s.players[me].active!.damage + s.players[me].bench[0]!.damage;
    expect(counters).toBe(60);
    expect(canUse(s, me, 'Psychic Embrace')).toBe(false); // the discard pile is empty
  });

  test('Psychic Embrace cannot be used on a Pokémon that would be Knocked Out', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, GARDEVOIR);
    benchFromHand(s, me, giveCard(s, me, RALTS));
    toDiscard(s, me, PSYCHIC, 1);
    s.players[me].active!.damage = 300; // 310 HP: 2 more damage counters would Knock it Out
    s.players[me].bench[0]!.damage = 60; // 70 HP: so would they
    expect(canUse(s, me, 'Psychic Embrace')).toBe(false);
    s.players[me].bench[0]!.damage = 40;
    expect(canUse(s, me, 'Psychic Embrace')).toBe(true);
  });

  test('Miracle Force does 190 and recovers the attacker from all Special Conditions', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, GARDEVOIR);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, PSYCHIC);
    buffer(s0, opp);
    s0.players[me].active!.conditions = { rotation: 'none', poisoned: true, burned: true };
    const s = attack(s0, 0);
    expect(s.players[opp].active!.damage).toBe(-400 + 190);
    expect(s.players[me].active!.conditions).toEqual({ rotation: 'none', poisoned: false, burned: false });
  });
});

describe('Scream Tail', () => {
  test('Roaring Scream does 20 for each damage counter on it, to a chosen Pokémon without Weakness on the Bench', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, SCREAM_TAIL);
    for (let i = 0; i < 2; i++) attachFromDeck(s0, me, PSYCHIC);
    s0.players[me].active!.damage = 30;
    buffer(s0, opp);
    benchFromHand(s0, opp, giveCard(s0, opp, RALTS)); // Psychic: weak to Darkness only
    let s = attack(s0, 1);
    const target = s.prompt!.options.find((o) => o.slot?.zone === 'bench')!;
    s = act(engine, s, { type: 'answer', optionId: target.id });
    expect(s.players[opp].bench[0]!.damage).toBe(60);
  });
});

describe('Mew ex', () => {
  test('Restart draws until there are 3 cards in the hand, once per turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, MEW);
    emptyHand(s0, me);
    giveCard(s0, me, RALTS);
    const s = act(engine, s0, ability(me, 'Restart'));
    expect(s.players[me].hand).toHaveLength(3);
    expect(canUse(s, me, 'Restart')).toBe(false);
  });

  test('Genome Hacking uses an attack of the opponent’s Active Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MEW);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, PSYCHIC);
    swapActiveTo(s0, opp, GARDEVOIR); // Miracle Force: 190
    s0.players[opp].active!.damage = 0;
    const s = resolvePrompts(attack(s0, 0));
    expect(s.players[opp].active!.damage).toBe(190);
  });
});

describe('Counter Catcher', () => {
  test('is playable only while you have more Prize cards remaining than the opponent', () => {
    const { s, me, opp } = game(spec);
    benchFromHand(s, opp, giveCard(s, opp, RALTS));
    const uid = giveCard(s, me, COUNTER_CATCHER);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(uid)); // 6 against 6
    const taken = s.players[opp].prizes.pop()!;
    s.players[opp].hand.push(taken);
    expect(engine.getLegalActions(s, me)).toContainEqual(playTrainer(uid)); // 6 against 5
  });

  test('switches in a chosen Benched Pokémon of the opponent', () => {
    const { s: s0, me, opp } = game(spec);
    const benched = giveCard(s0, opp, RALTS);
    benchFromHand(s0, opp, benched);
    s0.players[opp].hand.push(s0.players[opp].prizes.pop()!);
    const s = resolvePrompts(act(engine, s0, playTrainer(giveCard(s0, me, COUNTER_CATCHER))));
    expect(s.players[opp].active!.stack[0]).toBe(benched);
  });
});

describe('Bravery Charm', () => {
  const attach = (s: GameState, p: PlayerId) => {
    const uid = giveCard(s, p, CHARM);
    s.players[p].hand.splice(s.players[p].hand.indexOf(uid), 1);
    s.players[p].active!.tool = uid;
  };

  test('gives a Basic Pokémon +50 HP', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, RALTS);
    const before = maxHp(env, s, { player: me, zone: 'active' });
    attach(s, me);
    expect(maxHp(env, s, { player: me, zone: 'active' })).toBe(before + 50);
  });

  test('gives an evolved Pokémon nothing', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, KIRLIA);
    const before = maxHp(env, s, { player: me, zone: 'active' });
    attach(s, me);
    expect(maxHp(env, s, { player: me, zone: 'active' })).toBe(before);
  });
});

describe('Artazon', () => {
  test('each player may once a turn put a Basic Pokémon without a Rule Box from the deck onto the Bench', () => {
    const { s: s0, me } = game(spec);
    emptyHand(s0, me);
    let s = act(engine, s0, playTrainer(giveCard(s0, me, ARTAZON)));
    const use = { type: 'useStadium' } as const;
    expect(engine.getLegalActions(s, me)).toContainEqual(use);
    s = act(engine, s, use);
    const offered = new Set(defIdsOf(s, s.prompt!.options.map((o) => o.uid!)));
    expect(offered.has(GARDEVOIR) || offered.has(MEW)).toBe(false); // Rule Box Pokémon are not offered
    expect(offered.has(RALTS)).toBe(true);
    s = answerCards(s, [RALTS]);
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: 'done' });
    expect(defIdsOf(s, s.players[me].bench.map((b) => b.stack[0]!))).toEqual([RALTS]);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(use);
  });

  test('cannot be used when the deck has no Basic Pokémon without a Rule Box', () => {
    const { s: s0, me } = game({ [GARDEVOIR]: 2, [MEW]: 1, [ARTAZON]: 1, [PSYCHIC]: 10 });
    emptyHand(s0, me);
    const s = act(engine, s0, playTrainer(giveCard(s0, me, ARTAZON)));
    expect(engine.getLegalActions(s, me)).not.toContainEqual({ type: 'useStadium' });
  });
});
