import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { EffectCtx } from '../src/effects.ts';
import { createEngine } from '../src/engine.ts';
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

const trainer = (id: string, trainerType: 'Item' | 'Stadium'): CardDef => ({
  ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
  id,
  name: id,
  trainerType,
});
const defs: CardDef[] = [
  pokemon('locker', {
    hp: 200,
    attacks: [{ name: 'Big Hit', cost: ['Colorless'], damage: 30, damageSuffix: '', text: '' }],
  }),
  pokemon('reckless', {
    hp: 30,
    attacks: [{ name: 'Reckless', cost: ['Colorless'], damage: 50, damageSuffix: '', text: '' }],
  }),
  pokemon('puncher', {
    types: ['Fighting'],
    hp: 100,
    attacks: [{ name: 'Pure', cost: ['Colorless'], damage: 40, damageSuffix: '', text: '' }],
  }),
  pokemon('weakling', { types: ['Darkness'], hp: 300, weakness: 'Fighting' }),
  pokemon('thrifty', {
    hp: 100,
    attacks: [{ name: 'Cheap', cost: ['Colorless', 'Colorless'], damage: 40, damageSuffix: '', text: '' }],
  }),
  trainer('booster', 'Item'),
  trainer('heavy', 'Stadium'),
];
const scripts: Record<string, CardScript> = {
  locker: {
    attacks: { 0: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Big Hit') } },
  },
  reckless: { attacks: { 0: { effect: (ctx) => ctx.damageSelf(30) } } },
  puncher: { attacks: { 0: { damage: () => ({ amount: 40, ignoreWR: true }) } } },
  thrifty: { modifyAttackCost: (q) => q.cost.slice(1) },
  booster: {
    trainer: { play: (ctx) => ctx.addLingering('booster') },
    modifyOutgoingDamage: (q) => (q.defender.zone === 'active' ? q.amount + 30 : q.amount),
  },
  heavy: {
    modifyMaxHp: (q) => {
      const p = q.state.players[q.slot.player];
      const slot = q.slot.zone === 'active' ? p.active! : p.bench[q.slot.index]!;
      const def = q.registry.defs[q.state.cards[slot.stack[slot.stack.length - 1]!]!.defId]!;
      return def.category === 'Pokemon' && def.stage === 'Stage1' ? q.hp - 30 : q.hp;
    },
  },
};
const engine = createEngine(miniRegistry(defs, scripts));
const deck = {
  't-basic': 8,
  't-evo': 4,
  locker: 4,
  reckless: 4,
  puncher: 4,
  weakling: 4,
  thrifty: 4,
  booster: 4,
  heavy: 4,
  't-dark': 20,
};

function turn2(): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, 9);
  s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

describe('attack locks', () => {
  test('a locked attack is unavailable on the next turn and the lock ends when the Pokémon retreats', () => {
    const { s: s0, me } = turn2();
    swapActiveTo(s0, me, 'locker');
    attachFromDeck(s0, me, 't-dark');
    attachFromDeck(s0, me, 't-dark');
    benchFromHand(s0, me, giveCard(s0, me, 't-basic'));
    let s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    s = act(engine, s, { type: 'endTurn' }); // opponent's turn ends
    expect(has(engine.getLegalActions(s, me), 'attack')).toBe(false);
    s = act(engine, s, { type: 'retreat', benchIndex: 0 });
    if (s.prompt) s = act(engine, s, { type: 'answer', optionId: s.prompt.options[0]!.id });
    expect(s.players[me].bench[0]!.attackLocks).toEqual({});
  });
});

describe('self damage', () => {
  test('an attacker can Knock itself Out, giving the opponent a Prize', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, me, 'reckless');
    attachFromDeck(s0, me, 't-dark');
    swapActiveTo(s0, opp, 'weakling');
    benchFromHand(s0, me, giveCard(s0, me, 't-basic'));
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].prizes).toHaveLength(5);
    expect(s.players[opp].active!.damage).toBe(50);
  });
});

describe('damage ignoring Weakness and Resistance', () => {
  test('does its printed damage into Weakness', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, me, 'puncher');
    attachFromDeck(s0, me, 't-dark');
    swapActiveTo(s0, opp, 'weakling');
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(40);
  });
});

describe('lingering "this turn" effects', () => {
  test('apply only during the turn they were played and only to their owner', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, me, 'locker');
    attachFromDeck(s0, me, 't-dark');
    swapActiveTo(s0, opp, 'locker');
    attachFromDeck(s0, opp, 't-dark');
    let s = act(engine, s0, { type: 'playTrainer', uid: giveCard(s0, me, 'booster') });
    s = act(engine, s, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].active!.damage).toBe(60);
    s = act(engine, s, { type: 'attack', attackIndex: 0 }); // opponent attacks back: no bonus
    expect(s.players[me].active!.damage).toBe(30);
    expect(s.lingering).toEqual([]);
  });
});

describe('attack cost modifiers', () => {
  test('a cheaper cost makes an attack usable with fewer Energy', () => {
    const { s, me } = turn2();
    swapActiveTo(s, me, 'thrifty');
    attachFromDeck(s, me, 't-dark');
    expect(engine.getLegalActions(s, me)).toContainEqual({ type: 'attack', attackIndex: 0 });
  });
});

describe('max HP modifiers', () => {
  test('a Stadium lowering HP Knocks Out a Pokémon whose remaining HP drops to 0', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, opp, 't-evo'); // Stage 1, 90 HP
    s0.players[opp].active!.damage = 60;
    benchFromHand(s0, opp, giveCard(s0, opp, 't-basic'));
    const s = act(engine, s0, { type: 'playTrainer', uid: giveCard(s0, me, 'heavy') });
    expect(s.players[me].prizes).toHaveLength(5);
    expect(engine.viewFor(s, me).opponent.active?.stack[0]?.defId).toBe('t-basic');
  });

  test('the view reports the effective max HP', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, opp, 't-evo');
    const s = act(engine, s0, { type: 'playTrainer', uid: giveCard(s0, me, 'heavy') });
    expect(engine.viewFor(s, me).opponent.active!.hp).toBe(60);
  });
});

describe('turn memory for abilities', () => {
  test('Knockouts during the opponent’s last turn and once-per-turn ability names', () => {
    const { s, me } = turn2();
    const ctx = new EffectCtx(s, { registry: engine.registry, ruleset: standard2026 }, me, []);
    s.players[me].lastKnockedOutTurn = s.turn - 1;
    expect(ctx.wasKnockedOutLastOpponentTurn(me)).toBe(true);
    s.players[me].lastKnockedOutTurn = s.turn - 3;
    expect(ctx.wasKnockedOutLastOpponentTurn(me)).toBe(false);
    expect(ctx.usedAbilityNameThisTurn('Lunar Cycle')).toBe(false);
    ctx.markAbilityName('Lunar Cycle');
    expect(ctx.usedAbilityNameThisTurn('Lunar Cycle')).toBe(true);
  });

  test('a Knockout records the turn on its owner', () => {
    const { s: s0, me, opp } = turn2();
    swapActiveTo(s0, me, 'locker');
    attachFromDeck(s0, me, 't-dark');
    s0.players[opp].active!.damage = 1000 - 30;
    swapActiveTo(s0, opp, 'weakling');
    s0.players[opp].active!.damage = 280;
    benchFromHand(s0, opp, giveCard(s0, opp, 't-basic'));
    const s = act(engine, s0, { type: 'attack', attackIndex: 0 });
    expect(s.players[opp].lastKnockedOutTurn).toBe(s0.turn);
  });
});
