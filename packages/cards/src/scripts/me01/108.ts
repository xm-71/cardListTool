import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Lopunny';
export const script: CardScript = {
  attacks: {
    // Dashing Kick: 50 damage to 1 of the opponent's Benched Pokémon.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.opp);
        if (among.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: 'Choose a Benched Pokémon for 50 damage',
        });
        dealAttackDamage(ctx, ref!, 50);
      },
    },
  },
};
