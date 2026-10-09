import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Dewgong';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Dual Splash: 50 damage to 2 of your opponent's Pokémon (Weakness and Resistance only for the Active Pokémon).
    0: {
      damage(ctx) {
        const among = inPlayRefs(ctx, ctx.opp);
        const n = Math.min(2, among.length);
        const picks = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: n,
          max: n,
          message: "Choose 2 of your opponent's Pokémon to do 50 damage to",
        });
        let activeHit = false;
        for (const ref of picks) {
          if (ref.zone === 'active') activeHit = true;
          else dealAttackDamage(ctx, ref, 50);
        }
        return activeHit ? 50 : 0;
      },
    },
  },
};
