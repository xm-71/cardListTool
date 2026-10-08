import type { CardRegistry, CardScript, EffectCtx, SlotRef } from '@ptcg/engine';
import { inPlayRefs, pokemonDef, topDef } from '../util.ts';

/** Stage 1 names by the Basic they evolve from, built once per registry (it holds 1000+ cards). */
const stage1ByBasic = new WeakMap<CardRegistry, Map<string, Set<string>>>();

function stage1NamesFrom(registry: CardRegistry, basicName: string): Set<string> {
  let index = stage1ByBasic.get(registry);
  if (!index) {
    index = new Map();
    for (const d of Object.values(registry.defs)) {
      if (d.category !== 'Pokemon' || d.stage !== 'Stage1' || d.evolvesFrom === null) continue;
      const names = index.get(d.evolvesFrom) ?? new Set<string>();
      names.add(d.name);
      index.set(d.evolvesFrom, names);
    }
    stage1ByBasic.set(registry, index);
  }
  return index.get(basicName) ?? new Set();
}

/** Stage 2 cards in hand that can evolve the Basic at `ref` through some Stage 1. */
function candidates(ctx: EffectCtx, ref: SlotRef): string[] {
  const basic = topDef(ctx, ref);
  if (basic.stage !== 'Basic') return [];
  const stage1Names = stage1NamesFrom(ctx.env.registry, basic.name);
  return ctx.state.players[ctx.me].hand.filter((uid) => {
    const d = pokemonDef(ctx, uid);
    return d?.stage === 'Stage2' && d.evolvesFrom !== null && stage1Names.has(d.evolvesFrom);
  });
}

function targets(ctx: EffectCtx): SlotRef[] {
  const s = ctx.state;
  const firstTurn = s.turn === (ctx.me === s.first ? 1 : 2);
  if (firstTurn) return [];
  return inPlayRefs(ctx, ctx.me).filter(
    (ref) => ctx.slot(ref).enteredTurn < s.turn && candidates(ctx, ref).length > 0,
  );
}

export const name = 'Rare Candy';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: targets(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Basic Pokémon',
      });
      const [stage2] = ctx.chooseCards({
        player: ctx.me,
        from: candidates(ctx, ref!),
        min: 1,
        max: 1,
        message: 'Choose a Stage 2 Pokémon',
      });
      ctx.evolve(ref!, stage2!);
    },
  },
};
