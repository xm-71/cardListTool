import type { CardScript, EffectCtx, SlotRef } from '@ptcg/engine';
import { inPlayRefs, pokemonDef, topDef } from '../util.ts';

/** Stage 2 cards in hand that can evolve the Basic at `ref` through some Stage 1. */
function candidates(ctx: EffectCtx, ref: SlotRef): string[] {
  const basic = topDef(ctx, ref);
  if (basic.stage !== 'Basic') return [];
  const stage1Names = new Set(
    Object.values(ctx.env.registry.defs)
      .filter((d) => d.category === 'Pokemon' && d.stage === 'Stage1' && d.evolvesFrom === basic.name)
      .map((d) => d.name),
  );
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
