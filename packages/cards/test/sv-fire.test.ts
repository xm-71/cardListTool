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

const CHARMANDER = 'sv03-026';
const CHARMELEON = 'sv03-027';
const CHARIZARD = 'sv03-125';
const PIDGEY = 'sv03-162';
const PIDGEOT = 'sv03-164';
const FIRE = 'mee-002';
const FRIGIBAX = 'sv02-057';
const ARTAZON = 'sv02-171';
const spec = {
  [CHARMANDER]: 4,
  [CHARMELEON]: 3,
  [CHARIZARD]: 3,
  [PIDGEY]: 3,
  [PIDGEOT]: 3,
  [FRIGIBAX]: 2,
  [ARTAZON]: 1,
  [FIRE]: 20,
};
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const attach = (s: GameState, p: PlayerId, n: number) => {
  for (let i = 0; i < n; i++) attachFromDeck(s, p, FIRE);
};
const emptyHand = (s: GameState, p: PlayerId) => s.players[p].deck.push(...s.players[p].hand.splice(0));
/** A tanky neutral Defending Pokémon (no Weakness to Fire or Colorless). */
const buffer = (s: GameState, opp: PlayerId) => {
  swapActiveTo(s, opp, FRIGIBAX);
  s.players[opp].active!.damage = -400;
};
const ability = (p: PlayerId, name: string, zone: 'active' | 'bench' = 'active', index = 0) =>
  ({
    type: 'useAbility',
    slot: zone === 'active' ? { player: p, zone } : { player: p, zone, index },
    ability: name,
  }) as const;
const canUse = (s: GameState, p: PlayerId, name: string, zone: 'active' | 'bench' = 'active', index = 0) =>
  engine
    .getLegalActions(s, p)
    .some((a) => JSON.stringify(a) === JSON.stringify(ability(p, name, zone, index)));

describe('Charmander and Charmeleon', () => {
  test('Charmander’s Heat Tackle does 30 and 10 to itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CHARMANDER);
    attach(s0, me, 1);
    buffer(s0, opp);
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(-400 + 30);
    expect(s.players[me].active!.damage).toBe(10);
  });

  test('Charmeleon’s Heat Tackle does 70 and 20 to itself', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CHARMELEON);
    attach(s0, me, 2);
    buffer(s0, opp);
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(-400 + 70);
    expect(s.players[me].active!.damage).toBe(20);
  });
});

describe('Charizard ex', () => {
  test('Burning Darkness does 180 and 30 more for each Prize card the opponent has taken', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, CHARIZARD);
    attach(s0, me, 2);
    buffer(s0, opp);
    expect(attack(s0).players[opp].active!.damage).toBe(-400 + 180);
    for (let i = 0; i < 2; i++) s0.players[opp].hand.push(s0.players[opp].prizes.pop()!); // the opponent took 2
    expect(attack(s0).players[opp].active!.damage).toBe(-400 + 240);
  });

  test('Infernal Reign attaches up to 3 Basic {R} Energy from the deck in any split when it evolves from the hand', () => {
    const { s: s0, me } = game(spec, spec, { turn: 3 });
    swapActiveTo(s0, me, CHARMELEON);
    benchFromHand(s0, me, giveCard(s0, me, CHARMANDER));
    const uid = giveCard(s0, me, CHARIZARD);
    const deckFire = s0.players[me].deck.filter((u) => s0.cards[u]!.defId === FIRE).length;
    let s = act(engine, s0, { type: 'evolve', uid, target: { player: me, zone: 'active' } });
    expect(s.prompt).not.toBeNull();
    s = resolvePrompts(s);
    const attached = s.players[me].active!.energy.length + s.players[me].bench[0]!.energy.length;
    expect(attached).toBe(3);
    expect(s.players[me].deck.filter((u) => s.cards[u]!.defId === FIRE)).toHaveLength(deckFire - 3);
  });

  test('Infernal Reign can be declined', () => {
    const { s: s0, me } = game(spec, spec, { turn: 3 });
    swapActiveTo(s0, me, CHARMELEON);
    const uid = giveCard(s0, me, CHARIZARD);
    let s = act(engine, s0, { type: 'evolve', uid, target: { player: me, zone: 'active' } });
    const no = s.prompt!.options.at(-1)!;
    s = act(engine, s, { type: 'answer', optionId: no.id });
    expect(s.players[me].active!.energy).toHaveLength(0);
  });
});

describe('Pidgeot ex', () => {
  test('Quick Search puts any 1 card from the deck into the hand', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, PIDGEOT);
    emptyHand(s0, me);
    let s = act(engine, s0, ability(me, 'Quick Search'));
    const offered = new Set(defIdsOf(s, s.prompt!.options.map((o) => o.uid!)));
    for (const any of [ARTAZON, FIRE, CHARIZARD]) expect(offered.has(any), any).toBe(true); // Trainer, Energy, Pokémon
    s = answerCards(s, [ARTAZON]);
    expect(defIdsOf(s, s.players[me].hand)).toEqual([ARTAZON]);
  });

  test('Quick Search can be used once a turn across all your Pidgeot ex', () => {
    const { s: s0, me } = game(spec);
    swapActiveTo(s0, me, PIDGEOT);
    benchFromHand(s0, me, giveCard(s0, me, PIDGEOT));
    const s = resolvePrompts(act(engine, s0, ability(me, 'Quick Search')));
    expect(canUse(s, me, 'Quick Search')).toBe(false);
    expect(canUse(s, me, 'Quick Search', 'bench', 0)).toBe(false);
  });

  test('Blustery Wind does 120 and may discard a Stadium in play', () => {
    const { s: s0, me, opp } = game(spec);
    swapActiveTo(s0, me, PIDGEOT);
    attach(s0, me, 2);
    buffer(s0, opp);
    const stadium = act(engine, s0, playTrainer(giveCard(s0, me, ARTAZON)));
    expect(stadium.stadium).not.toBeNull();
    let s = attack(stadium);
    s = act(engine, s, { type: 'answer', optionId: s.prompt!.options[0]!.id }); // yes
    expect(s.stadium).toBeNull();
    expect(s.players[opp].active!.damage).toBe(-400 + 120);

    let kept = attack(stadium);
    kept = act(engine, kept, { type: 'answer', optionId: kept.prompt!.options.at(-1)!.id }); // no
    expect(kept.stadium).not.toBeNull();
  });
});
