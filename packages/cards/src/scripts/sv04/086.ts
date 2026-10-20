import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Scream Tail';
export const script: CardScript = {
  attacks: {
    // Roaring Scream: 20 damage to 1 of your opponent's Pokémon for each damage counter on this Pokémon.
    1: {
      effect(ctx) {
        const counters = Math.floor(ctx.slot({ player: ctx.me, zone: 'active' }).damage / 10);
        if (counters <= 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Pokémon",
        });
        if (ref) dealAttackDamage(ctx, ref, 20 * counters);
      },
    },
  },
};
