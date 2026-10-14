import type { CardScript } from '@ptcg/engine';
import { countHeads } from '../util.ts';

export const name = 'Mankey';
export const set = 'sv08';
export const script: CardScript = {
  attacks: {
    // Dual Chop: flip 2 coins. This attack does 10 damage for each heads.
    0: { damage: (ctx) => countHeads(ctx, 2) * 10 },
  },
};
