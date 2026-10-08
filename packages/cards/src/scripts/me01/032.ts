import type { CardScript } from '@ptcg/engine';
import { callForFamily } from '../util.ts';

export const name = 'Mantine';
export const script: CardScript = {
  attacks: {
    // Call for Family
    0: { effect: (ctx) => callForFamily(ctx, 2) },
  },
};
