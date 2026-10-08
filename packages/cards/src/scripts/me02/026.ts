import type { CardScript } from '@ptcg/engine';
import { energyOfType, inPlayRefs } from '../util.ts';

export const name = 'Suicune';
export const script: CardScript = {
  attacks: {
    // Crystal Fall: 90 more with at least 4 {W} Energy in play.
    0: {
      damage: (ctx) =>
        inPlayRefs(ctx, ctx.me).reduce((n, ref) => n + energyOfType(ctx, ref, 'Water').length, 0) >= 4
          ? 120
          : 30,
    },
  },
};
