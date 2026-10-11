import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Dragapult ex';
export const set = 'sv06';
export const script: CardScript = {
  attacks: {
    // Phantom Dive: 200 damage, and put 6 damage counters on your opponent's Benched Pokémon in any way you like.
    1: {
      effect(ctx) {
        for (let i = 0; i < 6; i++) {
          const among = benchRefs(ctx, ctx.opp);
          if (among.length === 0) return;
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among,
            min: 1,
            max: 1,
            message: `Put a damage counter on a Benched Pokémon (${6 - i} left)`,
          });
          ctx.placeCounters(ref!, 1);
        }
      },
    },
  },
};
