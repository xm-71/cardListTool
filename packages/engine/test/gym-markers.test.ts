import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { EffectCtx } from '../src/effects.ts';
import { createEngine } from '../src/engine.ts';
import { getRetreatCost } from '../src/energy.ts';
import { standard2026 } from '../src/ruleset.ts';
import type { GameState, PlayerId } from '../src/types.ts';
import {
  ITEM,
  act,
  attachFromDeck,
  benchFromHand,
  giveCard,
  has,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from './fixtures.ts';

const atk = (name: string, damage: number) => ({
  name,
  cost: ['Colorless' as const],
  damage,
  damageSuffix: '' as const,
  text: 'x',
});
const supporter: CardDef = {
  ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
  id: 'sup',
  name: 'Sup',
  trainerType: 'Supporter',
};
const defs: CardDef[] = [
  pokemon('dasher', { hp: 300, attacks: [atk('Dash', 10)] }),
  pokemon('hitter', { hp: 300, attacks: [atk('Hit', 60)] }),
  pokemon('fragile', { hp: 300, weakness: 'Darkness' }),
  pokemon('darkhit', { hp: 300, types: ['Darkness'], attacks: [atk('Poke', 10)] }),
  pokemon('hopper', { hp: 300, attacks: [atk('Hop', 60)] }),
  pokemon('tough', { hp: 300, weakness: 'Darkness', resistance: 'Fighting' }),
  pokemon('dual', {
    hp: 300,
    types: ['Darkness', 'Fighting'],
    attacks: [atk('Plain', 30), atk('NoResist', 30)],
  }),
  supporter,
];
const scripts: Record<string, CardScript> = {
  hopper: {
    attacks: { 0: { damage: () => ({ amount: 60, ignoreWR: false, ignoreDefenderEffects: true }) } },
  },
  dual: {
    attacks: {
      0: { damage: () => ({ amount: 30, ignoreWR: false }) },
      1: { damage: () => ({ amount: 30, ignoreWR: false, ignoreResistance: true }) },
    },
  },
  sup: { trainer: { play: () => {} } },
};
const engine = createEngine(miniRegistry(defs, scripts));
const env = { registry: engine.registry, ruleset: standard2026 };
const each = Object.fromEntries(defs.map((d) => [d.id, 2]));
const deck = { ...each, 't-basic': 6, 't-dark': 38 };

/** Turn 2: `me` to act; both Actives get one Darkness Energy, both have a Benched Basic. */
function setup(mine: string, theirs: string): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, 4);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  const opp: PlayerId = me === 0 ? 1 : 0;
  swapActiveTo(s, me, mine);
  swapActiveTo(s, opp, theirs);
  attachFromDeck(s, me, 't-dark');
  attachFromDeck(s, opp, 't-dark');
  benchFromHand(s, me, giveCard(s, me, 't-basic'));
  benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
  return { s, me, opp };
}
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
const endTurn = (s: GameState) => act(engine, s, { type: 'endTurn' });
const ctxFor = (s: GameState, me: PlayerId) => new EffectCtx(s, env, me, []);
const active = (me: PlayerId) => ({ player: me, zone: 'active' }) as const;

describe('increaseOutgoing', () => {
  test('addMarker with turns = 2 lasts through the owner’s next turn and no longer', () => {
    const { s: s0, me, opp } = setup('dasher', 'hitter');
    ctxFor(s0, me).addMarker(active(me), 'increaseOutgoing', 120, 2);
    let s = attack(s0); // turn T: 10 + 120
    expect(s.players[opp].active!.damage).toBe(130);
    s = endTurn(s); // the opponent's turn
    s = attack(s); // turn T + 2: still active
    expect(s.players[opp].active!.damage).toBe(260);
    s = endTurn(s);
    s = attack(s); // turn T + 4: gone
    expect(s.players[opp].active!.damage).toBe(270);
  });

  test('is added before Weakness: (10 + 20) × 2', () => {
    const { s: s0, me, opp } = setup('darkhit', 'fragile');
    ctxFor(s0, me).addMarker(active(me), 'increaseOutgoing', 20);
    expect(attack(s0).players[opp].active!.damage).toBe(60);
  });
});

describe('preventDamage', () => {
  test('makes an attack do nothing', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    ctxFor(s0, me).addMarker(active(s0.current === 0 ? 1 : 0), 'preventDamage');
    expect(attack(s0).players[s0.current === 0 ? 1 : 0].active!.damage).toBe(0);
  });

  test('is ignored by an attack that ignores effects on the Defending Pokémon', () => {
    const { s: s0, me, opp } = setup('hopper', 'hitter');
    ctxFor(s0, me).addMarker(active(opp), 'preventDamage');
    expect(attack(s0).players[opp].active!.damage).toBe(60);
  });
});

describe('attackCostMore and retreatCostMore', () => {
  test('attackCostMore makes a 1-Energy attack need 2, and expires', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    ctxFor(s0, me).addMarker(active(me), 'attackCostMore', 1);
    expect(has(engine.getLegalActions(s0, me), 'attack')).toBe(false);
    attachFromDeck(s0, me, 't-dark');
    expect(has(engine.getLegalActions(s0, me), 'attack')).toBe(true);
    // the marker lasts through the next opponent turn only: gone two turns later
    const { s: s1, me: me1 } = setup('hitter', 'hitter');
    s1.players[me1].active!.markers.push({ kind: 'attackCostMore', amount: 1, untilTurn: s1.turn });
    expect(has(engine.getLegalActions(s1, me1), 'attack')).toBe(false);
    const later = endTurn(endTurn(s1));
    expect(has(engine.getLegalActions(later, me1), 'attack')).toBe(true);
  });

  test('retreatCostMore adds 1 to the retreat cost', () => {
    const { s, me } = setup('hitter', 'hitter');
    const base = getRetreatCost(s, active(me), engine.registry);
    ctxFor(s, me).addMarker(active(me), 'retreatCostMore', 1);
    expect(getRetreatCost(s, active(me), engine.registry)).toBe(base + 1);
    expect(has(engine.getLegalActions(s, me), 'retreat')).toBe(false); // 1 Energy, cost 2
  });
});

describe('ignoreResistance', () => {
  const damageDealt = (attackIndex: number) => {
    const { s: s0, me, opp } = setup('dual', 'tough');
    attachFromDeck(s0, me, 't-dark');
    return attack(s0, attackIndex).players[opp].active!.damage;
  };
  test('an ordinary attack: Weakness doubles, Resistance takes 30 off', () => {
    expect(damageDealt(0)).toBe(30); // 30 × 2 − 30
  });
  test('with ignoreResistance only Weakness applies', () => {
    expect(damageDealt(1)).toBe(60);
  });
});

describe('addMarker', () => {
  test('drops markers that already expired and keeps live ones', () => {
    const { s, me } = setup('hitter', 'hitter');
    const slot = s.players[me].active!;
    slot.markers = [
      { kind: 'reduceIncoming', amount: 30, untilTurn: s.turn - 1 },
      { kind: 'reduceIncoming', amount: 10, untilTurn: s.turn },
    ];
    ctxFor(s, me).addMarker(active(me), 'cantRetreat');
    expect(slot.markers.map((m) => [m.kind, m.amount])).toEqual([
      ['reduceIncoming', 10],
      ['cantRetreat', 0],
    ]);
  });
});

describe('supporter memory', () => {
  test('playing a Supporter is remembered for that turn only', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    expect(ctxFor(s0, me).playedSupporterThisTurn('Sup')).toBe(false);
    const s = act(engine, s0, { type: 'playTrainer', uid: giveCard(s0, me, 'sup') });
    expect(s.players[me].supporterPlayed).toEqual({ turn: s0.turn, name: 'Sup' });
    expect(ctxFor(s, me).playedSupporterThisTurn('Sup')).toBe(true);
    expect(ctxFor(s, me).playedSupporterThisTurn('Other')).toBe(false);
    const next = endTurn(endTurn(s)); // my next turn
    expect(ctxFor(next, me).playedSupporterThisTurn('Sup')).toBe(false);
  });

  test('the view shows your own Supporter memory', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    const s = act(engine, s0, { type: 'playTrainer', uid: giveCard(s0, me, 'sup') });
    expect(engine.viewFor(s, me).you.supporterPlayed).toEqual({ turn: s0.turn, name: 'Sup' });
  });
});
