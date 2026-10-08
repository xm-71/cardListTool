import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { EffectCtx } from '../src/effects.ts';
import { createEngine } from '../src/engine.ts';
import { standard2026 } from '../src/ruleset.ts';
import { REPEATABLE_CAP } from '../src/index.ts';
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
const stadium: CardDef = {
  ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
  id: 'arena',
  name: 'Arena',
  trainerType: 'Stadium',
};
const defs: CardDef[] = [
  pokemon('guard', { hp: 300, attacks: [atk('Guard', 10)] }),
  pokemon('flash', { hp: 300, attacks: [atk('Flash', 10)] }),
  pokemon('charm', { hp: 300, attacks: [atk('Charm', 10)] }),
  pokemon('bind', { hp: 300, attacks: [atk('Bind', 10)] }),
  pokemon('locker', { hp: 300, attacks: [atk('Lock', 10)] }),
  pokemon('hitter', { hp: 300, attacks: [atk('Hit', 60)] }),
  pokemon('bigger', { hp: 300, stage: 'Stage1', evolvesFrom: 'hitter', attacks: [atk('Hit', 60)] }),
  pokemon('weak', { hp: 300, types: ['Fighting'], weakness: 'Darkness', attacks: [atk('Poke', 30)] }),
  pokemon('poker', { hp: 300, types: ['Darkness'], attacks: [atk('Poke', 30)] }),
  pokemon('hopper', { hp: 300, attacks: [atk('Hop', 60)] }),
  pokemon('repeater', { hp: 300 }),
  pokemon('once', { hp: 300 }),
  stadium,
];
const scripts: Record<string, CardScript> = {
  guard: {
    attacks: {
      0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
    },
  },
  flash: {
    attacks: {
      0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'preventFromBasic') },
    },
  },
  charm: {
    attacks: {
      0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'reduceOutgoing', 20) },
    },
  },
  bind: {
    attacks: { 0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'cantRetreat') } },
  },
  locker: { attacks: { 0: { effect: (ctx) => ctx.lockStadium(ctx.opp) } } },
  hopper: {
    attacks: { 0: { damage: () => ({ amount: 60, ignoreWR: false, ignoreDefenderEffects: true }) } },
  },
  repeater: { abilities: { Again: { repeatable: true, canUse: () => true, use: () => {} } } },
  once: { abilities: { Once: { canUse: () => true, use: () => {} } } },
};
const engine = createEngine(miniRegistry(defs, scripts));
const each = Object.fromEntries(defs.map((d) => [d.id, 2]));
const deck = { ...each, 't-basic': 6, 't-dark': 28 };

/** Turn 2: `me` to act; both Actives get one Darkness Energy, `me` has a Benched Basic. */
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
const attack = (s: GameState) => act(engine, s, { type: 'attack', attackIndex: 0 });
const endTurn = (s: GameState) => act(engine, s, { type: 'endTurn' });

describe('timed markers', () => {
  test('reduceIncoming cuts damage through the opponent next turn, then expires', () => {
    const { s: s0, me } = setup('guard', 'hitter');
    let s = attack(s0); // me: Guard (marker), opponent's turn begins
    s = attack(s); // opponent hits for 60 - 30
    expect(s.players[me].active!.damage).toBe(30);
    s = endTurn(s); // my turn passes
    s = attack(s); // opponent hits again: marker expired
    expect(s.players[me].active!.damage).toBe(90);
  });

  test('preventFromBasic stops Basic attackers but not evolved ones', () => {
    const { s: s0, me, opp } = setup('flash', 'hitter');
    let s = attack(s0);
    s = attack(s);
    expect(s.players[me].active!.damage).toBe(0);
    const t = setup('flash', 'bigger');
    s = attack(t.s);
    s = attack(s);
    expect(s.players[t.me].active!.damage).toBe(60);
    expect(opp).not.toBe(me);
  });

  test('reduceOutgoing applies before Weakness', () => {
    const { s: s0, me } = setup('weak', 'poker');
    // opponent's poker (Darkness, 30) will hit my weak (Weakness Darkness) after Charm-like marker on it
    s0.players[me === 0 ? 1 : 0].active!.markers.push({
      kind: 'reduceOutgoing',
      amount: 20,
      untilTurn: s0.turn + 1,
    });
    let s = endTurn(s0);
    s = attack(s);
    expect(s.players[me].active!.damage).toBe(20);
  });

  test('Charm puts reduceOutgoing on the Defending Pokémon', () => {
    const { s: s0, opp } = setup('charm', 'hitter');
    const s = attack(s0);
    expect(s.players[opp].active!.markers).toEqual([
      { kind: 'reduceOutgoing', amount: 20, untilTurn: s0.turn + 1 },
    ]);
  });

  test('cantRetreat blocks retreat until it expires', () => {
    const { s: s0 } = setup('bind', 'hitter');
    let s = attack(s0);
    expect(has(engine.getLegalActions(s, s.current), 'retreat')).toBe(false);
    s = endTurn(s);
    s = endTurn(s);
    expect(has(engine.getLegalActions(s, s.current), 'retreat')).toBe(true);
  });

  test('markers end when the Pokémon retreats or evolves', () => {
    const { s: s0, me } = setup('guard', 'hitter');
    s0.players[me].active!.markers.push({ kind: 'reduceIncoming', amount: 30, untilTurn: s0.turn + 1 });
    let s = act(engine, s0, { type: 'retreat', benchIndex: 0 });
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: s.prompt.options[0]!.id });
    expect(s.players[me].bench[0]!.markers).toEqual([]);
    const t = setup('hitter', 'hitter');
    const u = endTurn(endTurn(t.s)); // `me` again, no longer on their first turn
    u.players[t.me].active!.markers.push({ kind: 'reduceIncoming', amount: 30, untilTurn: u.turn + 1 });
    const evo = giveCard(u, t.me, 'bigger');
    s = act(engine, u, { type: 'evolve', uid: evo, target: { player: t.me, zone: 'active' } });
    expect(s.players[t.me].active!.markers).toEqual([]);
  });
});

describe('becameActiveTurn', () => {
  test('retreating sets it on the incoming Pokémon to the current turn', () => {
    const { s: s0, me } = setup('hitter', 'hitter');
    let s = act(engine, s0, { type: 'retreat', benchIndex: 0 });
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: s.prompt.options[0]!.id });
    expect(s.players[me].active!.becameActiveTurn).toBe(s0.turn);
  });

  test('a promotion after a Knock Out records that turn, which is not the next turn', () => {
    const { s: s0, opp } = setup('hitter', 'hitter');
    s0.players[opp].active!.damage = 290;
    const s = attack(s0); // KO; opponent promotes
    const promoted = s.prompt ? act(engine, s, { type: 'answer', optionId: s.prompt.options[0]!.id }) : s;
    expect(promoted.players[opp].active!.becameActiveTurn).toBe(s0.turn);
    expect(promoted.turn).toBe(s0.turn + 1);
  });
});

test('ignoreDefenderEffects skips the defender reduceIncoming marker', () => {
  const { s: s0, opp } = setup('hopper', 'hitter');
  s0.players[opp].active!.markers.push({ kind: 'reduceIncoming', amount: 30, untilTurn: s0.turn + 1 });
  const s = attack(s0);
  expect(s.players[opp].active!.damage).toBe(60);
});

test('a locked player cannot play a Stadium on their next turn', () => {
  const { s: s0, opp } = setup('locker', 'hitter');
  let s = attack(s0); // opponent's turn now, locked
  const arena = giveCard(s, opp, 'arena');
  expect(engine.getLegalActions(s, opp).some((a) => a.type === 'playTrainer' && a.uid === arena)).toBe(false);
  s = endTurn(s);
  s = endTurn(s);
  expect(engine.getLegalActions(s, opp).some((a) => a.type === 'playTrainer' && a.uid === arena)).toBe(true);
});

test('repeatable Abilities can be used up to the cap; normal ones once', () => {
  const { s: s0, me } = setup('repeater', 'hitter');
  benchFromHand(s0, me, giveCard(s0, me, 'once'));
  let s = s0;
  const uses = (st: GameState, ability: string) =>
    engine.getLegalActions(st, me).filter((a) => a.type === 'useAbility' && a.ability === ability);
  s = act(engine, s, uses(s, 'Once')[0]!);
  expect(uses(s, 'Once')).toHaveLength(0);
  for (let i = 0; i < REPEATABLE_CAP; i++) {
    expect(uses(s, 'Again')).toHaveLength(1);
    s = act(engine, s, uses(s, 'Again')[0]!);
  }
  expect(uses(s, 'Again')).toHaveLength(0);
  expect(REPEATABLE_CAP).toBe(10);
});

test('a switch (Switch or the opponent’s Boss’s Orders) ends markers and sets becameActiveTurn on the incoming Pokémon', () => {
  const { s, opp } = setup('hitter', 'hitter');
  benchFromHand(s, opp, giveCard(s, opp, 't-basic'));
  s.players[opp].active!.markers.push({ kind: 'cantRetreat', amount: 0, untilTurn: s.turn + 1 });
  const ctx = new EffectCtx(s, { registry: engine.registry, ruleset: standard2026 }, s.current, []);
  ctx.switchActive(opp, s.players[opp].bench.length - 1);
  expect(s.players[opp].bench.at(-1)!.markers).toEqual([]);
  expect(s.players[opp].active!.becameActiveTurn).toBe(s.turn);
});
