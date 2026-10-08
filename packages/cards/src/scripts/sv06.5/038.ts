import type { CardScript } from '@ptcg/engine';
import { dealAttackDamage } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

const ABILITY = 'Flip the Script';

export const name = 'Fezandipiti ex';
export const script: CardScript = {
  abilities: {
    [ABILITY]: {
      canUse: (ctx) => !ctx.usedAbilityNameThisTurn(ABILITY) && ctx.wasKnockedOutLastOpponentTurn(ctx.me),
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        ctx.draw(ctx.me, 3);
      },
    },
  },
  attacks: {
    // Cruel Arrow: 100 to 1 of the opponent's Pokémon (no W/R for Benched Pokémon).
    0: {
      effect(ctx) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Pokémon",
        });
        if (ref) dealAttackDamage(ctx, ref, 100);
      },
    },
  },
};
