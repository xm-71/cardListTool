import type { CardScript } from '@ptcg/engine';
import { abilityHolder, hasMegaEx } from '../util.ts';

export const name = 'Linoone';
export const script: CardScript = {
  abilities: {
    // Excited Dash: from the Bench, with a Mega Evolution Pokémon ex in play, switch with your Active Pokémon.
    'Excited Dash': {
      canUse: (ctx) => abilityHolder(ctx).zone === 'bench' && hasMegaEx(ctx, ctx.me),
      use(ctx) {
        const holder = abilityHolder(ctx) as { index: number };
        ctx.switchActive(ctx.me, holder.index);
      },
    },
  },
};
