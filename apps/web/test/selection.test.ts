import { beforeEach, describe, expect, test } from 'vitest';
import type { Action, PlayerView } from '@ptcg/engine';
import { engine } from '../src/game/catalog.ts';
import { topDef } from '../src/game/view.ts';
import { useGame } from '../src/game/store.ts';
import { defaultSelection, panelModel, sameSelection } from '../src/game/selection.ts';
import { botCfg, finishSetupInStore, mutate, turnOf } from './helpers.ts';
import { benchFromHand, giveCard } from '@ptcg/engine/testing';

let view: PlayerView;
beforeEach(() => {
  useGame.getState().reset();
  useGame.getState().start(botCfg(1));
  finishSetupInStore();
  turnOf(0);
});
const fresh = () => {
  view = engine.viewFor(useGame.getState().state!, 0);
  return view;
};
const active = { kind: 'slot', ref: { player: 0, zone: 'active' } } as const;

describe('defaultSelection', () => {
  test('is your Active Pokémon', () => {
    expect(defaultSelection(fresh(), 0)).toEqual(active);
  });

  test('is nothing without an Active Pokémon', () => {
    fresh();
    expect(defaultSelection({ ...view, you: { ...view.you, active: null } }, 0)).toBeNull();
  });
});

describe('sameSelection', () => {
  test('compares hand cards by uid and slots by ref', () => {
    expect(sameSelection({ kind: 'hand', uid: 'a' }, { kind: 'hand', uid: 'a' })).toBe(true);
    expect(sameSelection({ kind: 'hand', uid: 'a' }, { kind: 'hand', uid: 'b' })).toBe(false);
    expect(sameSelection(active, { kind: 'slot', ref: { player: 0, zone: 'active' } })).toBe(true);
    expect(sameSelection(active, { kind: 'slot', ref: { player: 0, zone: 'bench', index: 0 } })).toBe(false);
    expect(sameSelection(active, { kind: 'hand', uid: 'a' })).toBe(false);
    expect(sameSelection(active, null)).toBe(false);
  });
});

describe('panelModel', () => {
  test('a hand card lists the actions that play it, no attacks', () => {
    let uid = '';
    mutate((s) => {
      uid = giveCard(s, 0, 'me02-062'); // Seviper, a Basic
    });
    const v = fresh();
    const legal = engine.getLegalActions(useGame.getState().state!, 0);
    const model = panelModel(v, legal, { kind: 'hand', uid }, 0)!;
    expect(model.card.uid).toBe(uid);
    expect(model.slot).toBeNull();
    expect(model.attacks).toEqual([]);
    expect(model.actions).toEqual(legal.filter((a) => 'uid' in a && a.uid === uid));
    expect(model.actions.some((a) => a.type === 'playBasic')).toBe(true);
  });

  test('a hand card that has left the hand gives nothing', () => {
    expect(panelModel(fresh(), [], { kind: 'hand', uid: 'nope' }, 0)).toBeNull();
  });

  test('your Active lists every attack, enabled only when legal', () => {
    const v = fresh();
    const model0 = panelModel(v, [{ type: 'attack', attackIndex: 1 } as Action], active, 0)!;
    expect(model0.slot).toBe(v.you.active);
    expect(model0.attacks.length).toBeGreaterThan(0);
    model0.attacks.forEach((a, i) => {
      expect(a.index).toBe(i);
      if (i === 1) expect(a.action).toEqual({ type: 'attack', attackIndex: 1 });
      else expect(a.action).toBeNull();
    });
    expect(model0.actions.every((a) => a.type !== 'attack')).toBe(true);
  });

  test('an attack carries its cost and damage text', () => {
    const v = fresh();
    const model = panelModel(v, [], active, 0)!;
    const printed = topDef(v.you.active!).attacks[0]!;
    expect(model.attacks[0]).toMatchObject({
      name: printed.name,
      cost: printed.cost,
      damage: printed.damage > 0 ? `${printed.damage}${printed.damageSuffix}` : '',
    });
  });

  test('a benched Pokémon lists its own attack when it can attack from the Bench', () => {
    mutate((s) => void benchFromHand(s, 0, giveCard(s, 0, 'me02-062')));
    const v = fresh();
    const ref = { player: 0, zone: 'bench', index: 0 } as const;
    const model = panelModel(
      v,
      [{ type: 'attack', attackIndex: 0, benchIndex: 0 }],
      { kind: 'slot', ref },
      0,
    )!;
    expect(model.attacks[0]!.action).toEqual({ type: 'attack', attackIndex: 0, benchIndex: 0 });
    // the Active's attack of the same index is a different action
    const activeModel = panelModel(v, [{ type: 'attack', attackIndex: 0, benchIndex: 0 }], active, 0)!;
    expect(activeModel.attacks[0]!.action).toBeNull();
  });

  test("the opponent's Pokémon shows its attacks but none can be used", () => {
    const v = fresh();
    const model = panelModel(
      v,
      [{ type: 'attack', attackIndex: 0 }],
      { kind: 'slot', ref: { player: 1, zone: 'active' } },
      0,
    )!;
    expect(model.slot).toBe(v.opponent.active);
    expect(model.attacks.every((a) => a.action === null)).toBe(true);
    expect(model.actions).toEqual([]);
  });

  test('actions aimed at the Pokémon (attach, evolve, Ability) are listed after the attacks', () => {
    const v = fresh();
    const attach: Action = { type: 'attachEnergy', uid: 'x', target: { player: 0, zone: 'active' } };
    const model = panelModel(
      v,
      [attach, { type: 'attack', attackIndex: 0 }, { type: 'endTurn' }],
      active,
      0,
    )!;
    expect(model.actions).toEqual([attach]);
  });

  test('while a prompt is open nothing can be done', () => {
    const v = {
      ...fresh(),
      prompt: { message: 'm', min: 0, max: 1, selected: [], options: [] },
    } as unknown as PlayerView;
    const model = panelModel(v, [{ type: 'attack', attackIndex: 0 }], active, 0)!;
    expect(model.actions).toEqual([]);
    expect(model.attacks.every((a) => a.action === null)).toBe(true);
  });

  test('a slot that has emptied gives nothing', () => {
    expect(
      panelModel(fresh(), [], { kind: 'slot', ref: { player: 0, zone: 'bench', index: 4 } }, 0),
    ).toBeNull();
  });
});
