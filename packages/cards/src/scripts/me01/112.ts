import type { CardScript } from '@ptcg/engine';
import { countHeads } from '../util.ts';

export const name = 'Bewear';
export const script: CardScript = {
  attacks: {
    // Hyper Lariat: 100 more if both coins are heads.
    1: { damage: (ctx) => (countHeads(ctx, 2) === 2 ? 200 : 100) },
  },
};
