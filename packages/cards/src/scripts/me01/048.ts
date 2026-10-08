import type { CardScript } from '@ptcg/engine';
import { energyOfType, inPlayRefs } from '../util.ts';

export const name = 'Raikou';
export const script: CardScript = {
  attacks: {
    // Electro Fall: 90 more with at least 4 {L} Energy in play.
    0: {
      damage: (ctx) =>
        inPlayRefs(ctx, ctx.me).reduce((n, ref) => n + energyOfType(ctx, ref, 'Lightning').length, 0) >= 4
          ? 120
          : 30,
    },
  },
};
