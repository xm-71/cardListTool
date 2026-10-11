import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

const withEnergy = (ctx: EffectCtx) => inPlayRefs(ctx, ctx.opp).filter((r) => ctx.slot(r).energy.length > 0);

export const name = 'Crushing Hammer';
export const script: CardScript = {
  // Flip a coin. If heads, discard an Energy from 1 of your opponent's Pokémon.
  trainer: {
    play(ctx) {
      if (!ctx.flipCoin() || withEnergy(ctx).length === 0) return;
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: withEnergy(ctx),
        min: 1,
        max: 1,
        message: "Discard an Energy from which of your opponent's Pokémon?",
      });
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: [...ctx.slot(ref!).energy],
        min: 1,
        max: 1,
        message: 'Choose an Energy to discard',
      });
      ctx.discardEnergy(ref!, picks);
    },
  },
};
