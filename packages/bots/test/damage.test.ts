import { describe, expect, test } from 'vitest';
import { createEngine, type GameState, type SlotRef } from '@ptcg/engine';
import { DARK, attachFromDeck, miniRegistry, pokemon, started, swapActiveTo } from '@ptcg/engine/testing';
import { DamageCache, estimateDamage } from '../src/damage.ts';

/** How many times the scaler's damage script has run: proves the cache avoids replaying. */
let plays = 0;
const scaler = pokemon('scaler', {
  hp: 100,
  attacks: [{ name: 'Surge', cost: ['Colorless'], damage: 10, damageSuffix: '+', text: 'more per Energy' }],
});
const pauser = pokemon('pauser', {
  hp: 100,
  attacks: [{ name: 'Pick', cost: ['Colorless'], damage: 30, damageSuffix: '', text: 'choose' }],
});
const brave = pokemon('brave', {
  hp: 100,
  attacks: [
    { name: 'Brave Wing', cost: ['Colorless'], damage: 60, damageSuffix: '', text: 'more if damaged' },
  ],
});
const fierce = pokemon('fierce', {
  hp: 100,
  attacks: [{ name: 'Blaze', cost: ['Fire', 'Fire'], damage: 10, damageSuffix: '', text: 'strong' }],
});
const fire = { ...DARK, id: 't-fire', name: 'Fire Energy', provides: ['Fire'] } as typeof DARK;
const registry = miniRegistry([scaler, pauser, brave, fierce, fire], {
  brave: {
    attacks: { 0: { damage: (ctx) => (ctx.slot({ player: ctx.me, zone: 'active' }).damage > 0 ? 160 : 60) } },
  },
  fierce: { attacks: { 0: { damage: () => 100 } } },
  scaler: {
    attacks: {
      0: {
        damage: (ctx) => {
          plays++;
          return 10 + 50 * ctx.slot({ player: ctx.me, zone: 'active' }).energy.length;
        },
      },
    },
  },
  pauser: {
    attacks: {
      0: {
        effect(ctx) {
          ctx.chooseCards({
            player: ctx.me,
            from: [...ctx.state.players[ctx.me].hand],
            min: 1,
            max: 1,
            message: 'Choose a card',
          });
        },
      },
    },
  },
});
const engine = createEngine(registry);
const spec = { scaler: 4, pauser: 4, brave: 4, fierce: 4, 't-basic': 8, 't-dark': 26, 't-fire': 10 };

/** A turn-2 position where `defId` is the current player's Active with `energy` Darkness Energy attached. */
function activeWith(defId: string, energy: number): { s: GameState; ref: SlotRef } {
  let s = started(engine, spec, spec, 5);
  s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
  const me = s.current;
  swapActiveTo(s, me, defId);
  for (let i = 0; i < energy; i++) attachFromDeck(s, me, 't-dark');
  return { s, ref: { player: me, zone: 'active' } };
}

describe('estimateDamage', () => {
  test('a scaling attack is estimated above its printed damage', () => {
    const { s, ref } = activeWith('scaler', 3);
    expect(estimateDamage(engine, s, ref, 0, new DamageCache())).toBe(160);
  });
  test('extra Energy is counted', () => {
    const { s, ref } = activeWith('scaler', 3);
    expect(estimateDamage(engine, s, ref, 0, new DamageCache(), 1)).toBe(210);
  });
  test('the cache returns the same value without replaying the attack', () => {
    const cache = new DamageCache();
    const { s, ref } = activeWith('scaler', 3);
    plays = 0;
    expect(estimateDamage(engine, s, ref, 0, cache)).toBe(160);
    expect(estimateDamage(engine, s, ref, 0, cache)).toBe(160);
    expect(plays).toBe(1);
  });
  test('an attack that pauses on a prompt falls back to printed damage', () => {
    const { s, ref } = activeWith('pauser', 1);
    expect(estimateDamage(engine, s, ref, 0, new DamageCache())).toBe(30);
  });
  test('the real state is not changed', () => {
    const { s, ref } = activeWith('scaler', 3);
    const before = JSON.stringify(s);
    estimateDamage(engine, s, ref, 0, new DamageCache());
    expect(JSON.stringify(s)).toBe(before);
  });
  test('a Benched attacker is estimated too', () => {
    const { s } = activeWith('scaler', 3);
    const me = s.current;
    const p = s.players[me];
    // move the Active to the Bench and put a plain Basic in front
    const moved = structuredClone(p.active!);
    swapActiveTo(s, me, 't-basic');
    p.bench.push(moved);
    expect(estimateDamage(engine, s, { player: me, zone: 'bench', index: 0 }, 0, new DamageCache())).toBe(
      160,
    );
  });

  test('a damage that depends on the board is not frozen by the first position', () => {
    const cache = new DamageCache();
    const first = activeWith('brave', 1);
    expect(estimateDamage(engine, first.s, first.ref, 0, cache)).toBe(60);
    const hurt = activeWith('brave', 1);
    hurt.s.players[hurt.ref.player].active!.damage = 50;
    expect(estimateDamage(engine, hurt.s, hurt.ref, 0, cache)).toBe(160);
  });

  test('an attack that could not be paid in the sandbox is not remembered', () => {
    const cache = new DamageCache();
    // One Darkness Energy plus the sandbox's extra Fire cannot pay [Fire, Fire]: only the printed damage is known.
    const unpaid = activeWith('fierce', 1);
    expect(estimateDamage(engine, unpaid.s, unpaid.ref, 0, cache, 1)).toBe(10);
    // Two Fire Energy attached for real: the same Energy count must now be worked out, not read back as 10.
    const paid = activeWith('fierce', 0);
    attachFromDeck(paid.s, paid.ref.player, 't-fire');
    attachFromDeck(paid.s, paid.ref.player, 't-fire');
    expect(estimateDamage(engine, paid.s, paid.ref, 0, cache)).toBe(100);
  });
});
