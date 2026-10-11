import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Abra';
export const set = 'me01';
export const script: CardScript = {
  attacks: {
    // Teleportation Attack: switch this Pokémon with 1 of your Benched Pokémon.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.me);
        if (among.length === 0 || !ctx.state.players[ctx.me].active) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: 'Switch with which Benched Pokémon?',
        });
        ctx.switchActive(ctx.me, (ref as { index: number }).index);
      },
    },
  },
};
