import { describe, expect, test } from 'vitest';
import { createEngine } from '../src/engine.ts';
import { runEffect, type EffectFn } from '../src/effects.ts';
import type { Env } from '../src/env.ts';
import { standard2026 } from '../src/ruleset.ts';
import type { GameState } from '../src/types.ts';
import type { CardDef } from '../src/cards.ts';
import { ITEM, benchFromHand, giveCard, miniRegistry, started } from './fixtures.ts';

const registry = miniRegistry();
const engine = createEngine(registry);
const env: Env = { registry, ruleset: standard2026 };
const origin = { type: 'endTurn' } as const; // any origin; these tests drive runEffect directly

function start(fn: EffectFn, s: GameState = started(engine)): GameState {
  return runEffect(env, s, origin, s.current, fn);
}
function answer(s: GameState, fn: EffectFn, optionId: string): GameState {
  const p = s.pending!;
  return runEffect(env, p.snapshot, p.origin, p.player, fn, [...p.answers, optionId]);
}

const discardTwo: EffectFn = (ctx) => {
  const hand = ctx.state.players[ctx.me].hand;
  const picked = ctx.chooseCards({ player: ctx.me, from: [...hand], min: 2, max: 2, message: 'Discard 2' });
  for (const uid of picked) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
};

describe('prompts and replay', () => {
  test('a pick-2 choice offers one answer per card and no "done" until two are chosen', () => {
    const s0 = started(engine);
    const me = s0.current;
    let s = start(discardTwo, s0);
    expect(s.prompt?.player).toBe(me);
    // card options carry their definition id so the chooser's UI can render them
    expect(s.prompt!.options.map((o) => o.defId)).toEqual(s0.players[me].hand.map((u) => s0.cards[u]!.defId));
    let legal = engine.getLegalActions(s, me);
    expect(legal).toHaveLength(s0.players[me].hand.length);
    expect(legal).not.toContainEqual({ type: 'answer', optionId: 'done' });
    const [a, b] = s0.players[me].hand;
    s = answer(s, discardTwo, a!);
    expect(s.prompt?.selected).toEqual([a]);
    legal = engine.getLegalActions(s, me);
    expect(legal).not.toContainEqual({ type: 'answer', optionId: 'done' });
    s = answer(s, discardTwo, b!);
    expect(s.prompt).toBeNull();
    expect(s.pending).toBeNull();
    expect(s.players[me].discard).toEqual([a, b]);
    expect(s.players[me].hand).toHaveLength(s0.players[me].hand.length - 2);
  });

  test('an "up to 2" choice can be finished immediately with nothing chosen', () => {
    const upTo2: EffectFn = (ctx) => {
      const picked = ctx.chooseCards({
        player: ctx.me,
        from: [...ctx.state.players[ctx.me].hand],
        min: 0,
        max: 2,
        message: 'Up to 2',
      });
      ctx.log(`picked ${picked.length}`);
    };
    let s = start(upTo2);
    expect(engine.getLegalActions(s, s.current)).toContainEqual({ type: 'answer', optionId: 'done' });
    s = answer(s, upTo2, 'done');
    expect(s.prompt).toBeNull();
    expect(s.log.at(-1)!.text).toBe('picked 0');
  });

  test('a coin flip before a choice gives the same result on replay', () => {
    const flipThenChoose: EffectFn = (ctx) => {
      const heads = ctx.flipCoin();
      const [picked] = ctx.chooseCards({
        player: ctx.me,
        from: [...ctx.state.players[ctx.me].hand],
        min: 1,
        max: 1,
        message: 'pick',
      });
      ctx.log(`${heads ? 'heads' : 'tails'} ${picked}`);
    };
    let s = start(flipThenChoose);
    // the paused state already shows the flip, so the player sees it before choosing
    expect(s.log.at(-1)!.type).toBe('coinFlip');
    const first = s.prompt!.options[0]!.id;
    s = answer(s, flipThenChoose, first);
    const again = answer(start(flipThenChoose), flipThenChoose, first);
    expect(s.log.at(-1)).toEqual(again.log.at(-1));
    expect(s.log.filter((e) => e.type === 'coinFlip')).toHaveLength(
      started(engine).log.filter((e) => e.type === 'coinFlip').length + 1,
    );
  });

  test('a paused effect survives a JSON round trip and can still be answered', () => {
    const paused = JSON.parse(JSON.stringify(start(discardTwo))) as GameState;
    const opts = paused.prompt!.options;
    const done = answer(answer(paused, discardTwo, opts[0]!.id), discardTwo, opts[1]!.id);
    expect(done.prompt).toBeNull();
    expect(done.players[done.current].discard).toEqual([opts[0]!.id, opts[1]!.id]);
  });
});

describe('ctx operations', () => {
  test('drawing more cards than the deck holds draws what is there and does not lose', () => {
    const s0 = started(engine);
    const me = s0.current;
    s0.players[me].discard.push(...s0.players[me].deck.splice(3));
    const hand = s0.players[me].hand.length;
    const s = start((ctx) => ctx.draw(ctx.me, 6), s0);
    expect(s.players[me].hand).toHaveLength(hand + 3);
    expect(s.players[me].deck).toHaveLength(0);
    expect(s.result).toBeNull();
  });

  test('heal, placeCounters and switchActive change the right slots', () => {
    const s0 = started(engine);
    const me = s0.current;
    benchFromHand(s0, me, giveCard(s0, me, 't-basic'));
    const oldActive = s0.players[me].active!.stack[0];
    const benched = s0.players[me].bench[0]!.stack[0];
    s0.players[me].active!.damage = 50;
    const s = start((ctx) => {
      ctx.heal({ player: ctx.me, zone: 'active' }, 30);
      ctx.placeCounters({ player: ctx.opp, zone: 'active' }, 2);
      ctx.switchActive(ctx.me, 0);
    }, s0);
    expect(s.players[me].active!.stack[0]).toBe(benched);
    expect(s.players[me].bench[0]!.stack[0]).toBe(oldActive);
    expect(s.players[me].bench[0]!.damage).toBe(20);
    expect(s.players[me === 0 ? 1 : 0].active!.damage).toBe(20);
  });

  test('heal never takes damage below 0', () => {
    const s0 = started(engine);
    s0.players[s0.current].active!.damage = 10;
    const s = start((ctx) => ctx.heal({ player: ctx.me, zone: 'active' }, 120), s0);
    expect(s.players[s.current].active!.damage).toBe(0);
  });

  test('chooseSlot prompts with slot options and returns slot refs', () => {
    const pick: EffectFn = (ctx) => {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: [
          { player: ctx.me, zone: 'active' },
          { player: ctx.opp, zone: 'active' },
        ],
        min: 1,
        max: 1,
        message: 'pick a slot',
      });
      ctx.placeCounters(ref!, 1);
    };
    let s = start(pick);
    expect(s.prompt?.kind).toBe('slot');
    expect(s.prompt?.options[1]?.slot).toEqual({ player: s.current === 0 ? 1 : 0, zone: 'active' });
    s = answer(s, pick, s.prompt!.options[1]!.id);
    expect(s.players[s.current === 0 ? 1 : 0].active!.damage).toBe(10);
  });

  test('chooseOption returns the chosen option id', () => {
    const yesNo: EffectFn = (ctx) => {
      const choice = ctx.chooseOption({
        player: ctx.me,
        options: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
        message: 'Use it?',
      });
      ctx.log(choice);
    };
    const s = answer(start(yesNo), yesNo, 'no');
    expect(s.log.at(-1)!.text).toBe('no');
  });
});

describe('events returned by applyAction', () => {
  test('a paused action and its answer return each event exactly once', () => {
    const picker: CardDef = {
      ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
      id: 'picker',
      name: 'Picker',
    };
    const eng = createEngine(
      miniRegistry([picker], {
        picker: {
          trainer: {
            play(ctx) {
              ctx.log('before choice');
              ctx.chooseCards({
                player: ctx.me,
                from: [...ctx.state.players[ctx.me].hand],
                min: 1,
                max: 1,
                message: 'pick',
              });
              ctx.log('after choice');
            },
          },
        },
      }),
    );
    let s = started(eng, { 't-basic': 20, 't-dark': 36, picker: 4 });
    const me = s.current;
    const uid = s.players[me].hand.find((u) => s.cards[u]!.defId === 'picker') ?? giveCard(s, me, 'picker');
    const start = s.log.length;
    const first = eng.applyAction(s, me, { type: 'playTrainer', uid });
    s = first.state;
    const second = eng.applyAction(s, me, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    const seen = [...first.events, ...second.events].map((e) => e.text);
    expect(seen).toEqual(second.state.log.slice(start).map((e) => e.text));
    expect(seen.filter((t) => t === 'before choice')).toHaveLength(1);
  });
});
