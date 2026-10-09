import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Rhyhorn';
export const script: CardScript = {
  attacks: {
    // Push Down: switch out the opponent's Active Pokémon; the opponent chooses the new one.
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
