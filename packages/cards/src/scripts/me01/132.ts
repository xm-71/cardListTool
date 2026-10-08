import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, topDef } from '../util.ts';

const targets = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).isMega && ctx.slot(ref).damage > 0);

export const name = "Wally's Compassion";
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: targets(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Mega Evolution Pokémon ex to heal',
      });
      const slot = ctx.slot(ref!);
      ctx.heal(ref!, slot.damage);
      ctx.detachEnergy(ref!, [...slot.energy], 'hand');
    },
  },
};
