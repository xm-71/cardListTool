import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Hitmonlee';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Twister Kick: 10 damage to each of your opponent's Pokémon (Weakness and Resistance only for the Active Pokémon), then switch with a Benched Pokémon.
    0: {
      damage: () => 10,
      effect(ctx) {
        for (const ref of benchRefs(ctx, ctx.opp)) ctx.placeCounters(ref, 1);
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
