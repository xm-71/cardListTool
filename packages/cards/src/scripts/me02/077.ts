import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, topDef } from '../util.ts';

export const name = 'Wigglytuff';
export const script: CardScript = {
  attacks: {
    // Round: 40 for each of your Pokémon in play with the Round attack.
    0: {
      damage: (ctx) =>
        40 *
        inPlayRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).attacks.some((a) => a.name === 'Round'))
          .length,
    },
  },
};
