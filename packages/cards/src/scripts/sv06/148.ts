import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

const special = (ctx: EffectCtx, uid: string) => {
  const d = ctx.def(uid);
  return d.category === 'Energy' && d.energyKind === 'Special';
};
const targets = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.opp).filter((r) => ctx.slot(r).energy.some((u) => special(ctx, u)));

export const name = 'Enhanced Hammer';
export const script: CardScript = {
  // Discard a Special Energy from 1 of your opponent's Pokémon.
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: targets(ctx),
        min: 1,
        max: 1,
        message: "Choose 1 of your opponent's Pokémon",
      });
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: ctx.slot(ref!).energy.filter((u) => special(ctx, u)),
        min: 1,
        max: 1,
        message: 'Choose a Special Energy to discard',
      });
      ctx.discardEnergy(ref!, picks);
    },
  },
};
