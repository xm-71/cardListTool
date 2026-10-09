import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Golbat';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Skill Dive: 40 damage to 1 of your opponent's Pokémon (Weakness and Resistance only for the Active Pokémon).
    0: {
      damage(ctx) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Pokémon to do 40 damage to",
        });
        if (ref!.zone === 'active') return 40;
        dealAttackDamage(ctx, ref!, 40);
        return 0;
      },
    },
  },
};
