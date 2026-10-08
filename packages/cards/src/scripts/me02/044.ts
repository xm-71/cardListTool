import type { CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Alcremie';
export const script: CardScript = {
  attacks: {
    // Sweet Circle
    0: { damage: (ctx) => 20 * inPlayRefs(ctx, ctx.me).length },
  },
};
