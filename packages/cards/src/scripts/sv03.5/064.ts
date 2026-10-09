import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Kadabra';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Teleportation Attack: switch this Pokémon with 1 of your Benched Pokémon.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.me);
        if (among.length === 0) return;
        const [pick] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: 'Choose a Benched Pokémon to switch in',
        });
        if (pick?.zone === 'bench') ctx.switchActive(ctx.me, pick.index);
      },
    },
  },
};
