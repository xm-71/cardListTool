import { describe, expect, test } from 'vitest';
import { createEngine, type GameState, type PlayerId } from '@ptcg/engine';
import {
  attachFromDeck,
  benchFromHand,
  giveCard,
  miniRegistry,
  pokemon,
  started,
  swapActiveTo,
} from '@ptcg/engine/testing';
import { DamageCache } from '../src/damage.ts';
import { evaluate, evaluateLegacy, type EvalContext } from '../src/evaluate.ts';
import type { DeckPlan } from '../src/plan.ts';
import { createEasyBot } from '../src/easy.ts';
import { runMatch } from '../src/runMatch.ts';

const scaler = pokemon('scaler', {
  hp: 100,
  attacks: [{ name: 'Surge', cost: ['Colorless'], damage: 10, damageSuffix: '+', text: 'more per Energy' }],
});
const wall = pokemon('wall', { hp: 150, attacks: [] });
const exmon = pokemon('exmon', { hp: 60, isEx: true, attacks: [] });
const registry = miniRegistry([scaler, wall, exmon], {
  scaler: {
    attacks: { 0: { damage: (ctx) => 10 + 50 * ctx.slot({ player: ctx.me, zone: 'active' }).energy.length } },
  },
});
const engine = createEngine(registry);
const spec = { scaler: 4, wall: 4, exmon: 4, 't-basic': 8, 't-dark': 40 };

const plan = (attackers: string[]): DeckPlan => ({
  attackers,
  lines: Object.fromEntries(attackers.map((a) => [a, [a]])),
  support: [],
  priority: attackers,
});
const ctxFor = (mine: DeckPlan = plan(['scaler'])): EvalContext => ({
  engine,
  damage: new DamageCache(),
  plans: [mine, plan(['wall'])],
});

/** Player 0 to evaluate; both hands empty so the hand term cannot differ. */
function position(): { s: GameState; me: PlayerId; opp: PlayerId } {
  const s = started(engine, spec, spec, 11);
  for (const p of [0, 1] as const) {
    s.players[p].deck.push(...s.players[p].hand);
    s.players[p].hand = [];
  }
  return { s, me: 0, opp: 1 };
}

describe('evaluate with context', () => {
  test('a scaled attack reads as a Knock Out threat', () => {
    const { s, me, opp } = position();
    swapActiveTo(s, me, 'scaler');
    for (let i = 0; i < 3; i++) attachFromDeck(s, me, 't-dark'); // 10 + 50 × 3 = 160 ≥ 150
    swapActiveTo(s, opp, 'wall');
    const legacy = evaluateLegacy(s, me, registry);
    const smart = evaluate(s, me, registry, ctxFor());
    expect(smart - legacy).toBeGreaterThanOrEqual(40);
  });

  test('fewer Knock Outs needed scores higher', () => {
    const base = position();
    swapActiveTo(base.s, base.opp, 'wall');
    const withEx = structuredClone(base.s);
    const withBasic = structuredClone(base.s);
    // Same HP and damage are not required: only the Prize value of the Benched Pokémon differs.
    benchFromHand(withEx, base.opp, giveCard(withEx, base.opp, 'exmon'));
    benchFromHand(withBasic, base.opp, giveCard(withBasic, base.opp, 't-basic'));
    const ctx = ctxFor();
    const diff = evaluate(withEx, base.me, registry, ctx) - evaluate(withBasic, base.me, registry, ctx);
    expect(diff).toBeGreaterThanOrEqual(30);
  });

  test('an extra off-plan ex on my Bench is a penalty', () => {
    const { s, me } = position();
    swapActiveTo(s, me, 'scaler');
    benchFromHand(s, me, giveCard(s, me, 'exmon'));
    const offPlan = evaluate(s, me, registry, ctxFor(plan(['scaler'])));
    const inPlan = evaluate(s, me, registry, ctxFor(plan(['scaler', 'exmon'])));
    expect(inPlan - offPlan).toBe(15);
  });

  test('without a context evaluate is the legacy score', () => {
    const easy = createEasyBot(registry);
    const decks = [
      { name: 'a', cards: Object.entries(spec).map(([id, count]) => ({ id, count })) },
      { name: 'b', cards: Object.entries(spec).map(([id, count]) => ({ id, count })) },
    ] as const;
    const r = runMatch({ engine, decks: [decks[0], decks[1]], seed: 3, bots: [easy, easy] });
    for (const me of [0, 1] as const) {
      expect(evaluate(r.final, me, registry)).toBe(evaluateLegacy(r.final, me, registry));
    }
    const s = position().s;
    expect(evaluate(s, 0, registry)).toBe(evaluateLegacy(s, 0, registry));
  });
});
