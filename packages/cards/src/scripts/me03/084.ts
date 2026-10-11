import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, topDef } from '../util.ts';

const stage2 = (ctx: EffectCtx) => inPlayRefs(ctx, ctx.me).filter((r) => topDef(ctx, r).stage === 'Stage2');
const energy = (ctx: EffectCtx) => ctx.state.players[ctx.me].discard.filter((u) => isBasicEnergy(ctx.def(u)));

export const name = "Rosa's Encouragement";
export const script: CardScript = {
  // Only with more Prize cards left than your opponent: attach up to 2 Basic Energy from your discard to a Stage 2.
  trainer: {
    canPlay: (ctx) =>
      ctx.state.players[ctx.me].prizes.length > ctx.state.players[ctx.opp].prizes.length &&
      stage2(ctx).length > 0 &&
      energy(ctx).length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: stage2(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Stage 2 Pokémon',
      });
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: energy(ctx),
        min: 1,
        max: 2,
        message: 'Choose up to 2 Basic Energy to attach',
      });
      for (const uid of picks) ctx.attachEnergy(uid, ref!);
    },
  },
};
