import type { CardScript } from '@ptcg/engine';
import { abilityHolder } from '../util.ts';

const ABILITY = 'Run Errand';

export const name = 'Mega Kangaskhan ex';
export const script: CardScript = {
  abilities: {
    [ABILITY]: {
      canUse: (ctx) => abilityHolder(ctx).zone === 'active' && !ctx.usedAbilityNameThisTurn(ABILITY),
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        ctx.draw(ctx.me, 2);
      },
    },
  },
  attacks: {
    // Rapid-Fire Combo: flip until tails; 50 more for each heads.
    0: {
      damage(ctx) {
        let heads = 0;
        while (heads < 100 && ctx.flipCoin()) heads++;
        return 200 + 50 * heads;
      },
    },
  },
};
