import { describe, expect, test } from 'vitest';
import { createEngine, type GameState, type SlotRef } from '@ptcg/engine';
import { attachFromDeck, deckOf, miniRegistry, pokemon, started, swapActiveTo } from '@ptcg/engine/testing';
import { DamageCache, estimateDamage } from '../src/damage.ts';

const scaler = pokemon('scaler', {
  hp: 100,
  attacks: [{ name: 'Surge', cost: ['Colorless'], damage: 10, damageSuffix: '+', text: 'more per Energy' }],
});
const pauser = pokemon('pauser', {
  hp: 100,
  attacks: [{ name: 'Pick', cost: ['Colorless'], damage: 30, damageSuffix: '', text: 'choose' }],
});
const registry = miniRegistry([scaler, pauser], {
  scaler: {
    attacks: {
      0: { damage: (ctx) => 10 + 50 * ctx.slot({ player: ctx.me, zone: 'active' }).energy.length },
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
const spec = { scaler: 4, pauser: 4, 't-basic': 12, 't-dark': 40 };

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
  test('the cache returns the same value without replaying', () => {
    const cache = new DamageCache();
    const { s, ref } = activeWith('scaler', 3);
    estimateDamage(engine, s, ref, 0, cache);
    expect(cache.get('scaler', 0, 3)).toBe(160);
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
    expect(estimateDamage(engine, s, { player: me, zone: 'bench', index: 0 }, 0, new DamageCache())).toBe(160);
  });
});
