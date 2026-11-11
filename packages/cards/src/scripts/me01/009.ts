import type { CardScript } from '@ptcg/engine';
import { benchRefs, wildGrowthCost } from '../util.ts';

export const name = 'Bayleef';
export const script: CardScript = {
  modifyAttackCost: wildGrowthCost,
  attacks: {
    // Push Down: switch out your opponent's Active Pokémon to the Bench; your opponent chooses the new Active Pokémon.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.opp);
        if (among.length === 0) return;
        const [pick] = ctx.chooseSlot({
          player: ctx.opp,
          among,
          min: 1,
          max: 1,
          message: 'Choose your new Active Pokémon',
        });
        if (pick?.zone === 'bench') ctx.switchActive(ctx.opp, pick.index);
      },
    },
  },
};
