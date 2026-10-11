import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy } from '../util.ts';

const sources = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.me).filter((r) => ctx.slot(r).energy.some((u) => isBasicEnergy(ctx.def(u))));

export const name = 'Energy Switch';
export const script: CardScript = {
  // Move a Basic Energy from 1 of your Pokémon to another of your Pokémon.
  trainer: {
    canPlay: (ctx) => sources(ctx).length > 0 && inPlayRefs(ctx, ctx.me).length > 1,
    play(ctx) {
      const [from] = ctx.chooseSlot({
        player: ctx.me,
        among: sources(ctx),
        min: 1,
        max: 1,
        message: 'Move Energy from which Pokémon?',
      });
      const [uid] = ctx.chooseCards({
        player: ctx.me,
        from: ctx.slot(from!).energy.filter((u) => isBasicEnergy(ctx.def(u))),
        min: 1,
        max: 1,
        message: 'Choose a Basic Energy',
      });
      const fromKey = JSON.stringify(from);
      const [to] = ctx.chooseSlot({
        player: ctx.me,
        among: inPlayRefs(ctx, ctx.me).filter((r) => JSON.stringify(r) !== fromKey),
        min: 1,
        max: 1,
        message: 'Move it to which Pokémon?',
      });
      ctx.detachEnergy(from!, [uid!], 'hand');
      ctx.attachEnergy(uid!, to!);
    },
  },
};
