import { describe, expect, test } from 'vitest';
import { getRetreatCost, type GameState, type PlayerId } from '@ptcg/engine';
import {
  act,
  attachFromDeck,
  benchFromHand,
  engine,
  game,
  giveCard,
  playTrainer,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const MIRAIDON = 'sv01-081';
const IRON_HANDS = 'sv04-070';
const ZAPDOS = 'sv03.5-145';
const GENERATOR = 'sv01-170';
const FROAKIE = 'me04-020'; // 70 HP, weak to Lightning
const FRIGIBAX = 'sv02-057'; // 60 HP, Water
const STARMIE = 'me03-021'; // 330 HP, weak to Lightning
const LIGHTNING = 'mee-004';
const spec = {
  [MIRAIDON]: 4,
  [IRON_HANDS]: 3,
  [ZAPDOS]: 2,
  [GENERATOR]: 3,
  [FROAKIE]: 2,
  [STARMIE]: 1,
  [FRIGIBAX]: 3,
  [LIGHTNING]: 24,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, LIGHTNING);
};
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
/** A tanky neutral Defending Pokémon (Water-type: no Weakness to Lightning). */
const buffer = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = -400;
};
const tandem = (p: PlayerId) =>
  ({ type: 'useAbility', slot: { player: p, zone: 'active' }, ability: 'Tandem Unit' }) as const;
const canTandem = (s: GameState, p: PlayerId) =>
  engine.getLegalActions(s, p).some((a) => JSON.stringify(a) === JSON.stringify(tandem(p)));
const canAttack = (s: GameState, p: PlayerId) =>
  engine.getLegalActions(s, p).some((a) => a.type === 'attack' && a.attackIndex === 0);

describe('Miraidon ex', () => {
  test('Tandem Unit puts up to 2 Basic {L} Pokémon from the deck onto the Bench, once a turn', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, MIRAIDON);
    const s = resolvePrompts(act(engine, s0, tandem(me)));
    expect(s.players[me].bench).toHaveLength(2);
    for (const slot of s.players[me].bench)
      expect(registry.defs[s.cards[slot.stack[0]!]!.defId]).toMatchObject({ types: ['Lightning'], stage: 'Basic' });
    expect(canTandem(s, me)).toBe(false);
  });

  test('Tandem Unit only fills the Bench places that are free', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, MIRAIDON);
    for (const id of [FRIGIBAX, FRIGIBAX, FRIGIBAX, FROAKIE]) benchFromHand(s0, me, giveCard(s0, me, id)); // 4 of 5 places
    const s = resolvePrompts(act(engine, s0, tandem(me)));
    expect(s.players[me].bench).toHaveLength(5);
  });

  test('Photon Blaster does 220, then the Pokémon cannot attack during your next turn', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, MIRAIDON);
    attach(s0, me, 3);
    buffer(s0, opp);
    let s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(-400 + 220);
    s = act(engine, s, { type: 'endTurn' }); // the opponent's turn
    expect(s.current).toBe(me);
    expect(canAttack(s, me)).toBe(false);
    s = act(engine, s, { type: 'endTurn' });
    s = act(engine, s, { type: 'endTurn' });
    expect(canAttack(s, me)).toBe(true); // the turn after that
  });
});

describe('Iron Hands ex', () => {
  test('Amp You Very Much takes 1 more Prize card when it Knocks Out the Defending Pokémon', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, IRON_HANDS);
    attach(s0, me, 4);
    swapActiveTo(s0, opp, FRIGIBAX); // 60 HP: 120 Knocks it Out
    benchFromHand(s0, opp, giveCard(s0, opp, FRIGIBAX));
    const s = resolvePrompts(attack(s0, 1));
    expect(s.players[me].prizes).toHaveLength(6 - 2); // 1 for the Knock Out and 1 more
  });

  test('Amp You Very Much takes only the usual Prize card when nothing is Knocked Out', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, IRON_HANDS);
    attach(s0, me, 4);
    buffer(s0, opp);
    const s = attack(s0, 1);
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
    expect(s.players[me].prizes).toHaveLength(6);
  });
});

describe('Zapdos ex', () => {
  test('Multishot Lightning does 120 and 90 to a Benched Pokémon that has damage counters, without Weakness', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, ZAPDOS);
    attach(s0, me, 3);
    buffer(s0, opp);
    emptyHand(s0, opp); // so every card below is in the deck to give
    benchFromHand(s0, opp, giveCard(s0, opp, STARMIE)); // weak to Lightning: the Bench ignores it
    s0.players[opp].bench[0]!.damage = 50;
    benchFromHand(s0, opp, giveCard(s0, opp, FROAKIE)); // no damage counters: not a target
    const s = resolvePrompts(attack(s0));
    expect(s.players[opp].active!.damage).toBe(-400 + 120);
    expect(s.players[opp].bench[0]!.damage).toBe(50 + 90);
    expect(s.players[opp].bench[1]!.damage).toBe(0);
  });

  test('Voltaic Float gives no Retreat Cost while it has a {L} Energy attached', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, ZAPDOS);
    expect(getRetreatCost(s, { player: me, zone: 'active' }, registry)).toBe(2);
    attach(s, me, 1);
    expect(getRetreatCost(s, { player: me, zone: 'active' }, registry)).toBe(0);
  });
});

describe('Electric Generator', () => {
  /** The top 5 cards of the deck: `n` Basic {L} Energy first, then other cards. */
  const stack = (s: GameState, p: PlayerId, n: number) => {
    const deck = s.players[p].deck;
    const energy = deck.filter((u) => s.cards[u]!.defId === LIGHTNING).slice(0, n);
    for (const u of energy) deck.splice(deck.indexOf(u), 1);
    deck.unshift(...energy);
  };

  test('attaches up to 2 Basic {L} Energy from the top 5 cards to Benched {L} Pokémon and shuffles the rest', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, FRIGIBAX);
    benchFromHand(s0, me, giveCard(s0, me, MIRAIDON));
    benchFromHand(s0, me, giveCard(s0, me, FRIGIBAX)); // a {W} Pokémon: not a target
    emptyHand(s0, me);
    stack(s0, me, 3);
    const deckSize = s0.players[me].deck.length;
    const uid = giveCard(s0, me, GENERATOR);
    const s = resolvePrompts(act(engine, s0, playTrainer(uid)));
    expect(s.players[me].bench[0]!.energy).toHaveLength(2);
    expect(s.players[me].bench[1]!.energy).toHaveLength(0);
    expect(s.players[me].deck).toHaveLength(deckSize - 1 - 2); // the card itself is no longer in the deck, 2 Energy attached
  });

  test('only looks at the top 5 cards of the deck', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, FRIGIBAX);
    benchFromHand(s0, me, giveCard(s0, me, MIRAIDON));
    emptyHand(s0, me);
    const uid = giveCard(s0, me, GENERATOR);
    const deck = s0.players[me].deck;
    const energy = deck.filter((u) => s0.cards[u]!.defId === LIGHTNING).slice(0, 2);
    for (const u of energy) deck.splice(deck.indexOf(u), 1);
    const others = deck.filter((u) => s0.cards[u]!.defId !== LIGHTNING).slice(0, 5);
    for (const u of others) deck.splice(deck.indexOf(u), 1);
    deck.unshift(...others, ...energy); // five other cards on top, the Energy right below them
    const s = resolvePrompts(act(engine, s0, playTrainer(uid)));
    expect(s.players[me].bench[0]!.energy).toHaveLength(0);
  });

  test('is only played with a Benched {L} Pokémon', () => {
    const { s, me } = game(spec);
    swapActiveTo(s, me, MIRAIDON); // Active, not Benched
    const uid = giveCard(s, me, GENERATOR);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(playTrainer(uid));
    benchFromHand(s, me, giveCard(s, me, MIRAIDON));
    expect(engine.getLegalActions(s, me)).toContainEqual(playTrainer(uid));
  });
});

