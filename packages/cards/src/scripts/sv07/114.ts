import type { CardScript } from '@ptcg/engine';
import { countHeads } from '../util.ts';

export const name = 'Hoothoot';
export const set = 'sv07';
export const script: CardScript = {
  attacks: {
    // Triple Stab: flip 3 coins. This attack does 10 damage for each heads.
    0: { damage: (ctx) => countHeads(ctx, 3) * 10 },
  },
};
