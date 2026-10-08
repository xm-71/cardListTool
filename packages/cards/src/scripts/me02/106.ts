import type { CardScript } from '@ptcg/engine';
import { countHeads } from '../util.ts';

export const name = 'Meowth';
export const script: CardScript = {
  attacks: {
    // Fury Swipes
    0: { damage: (ctx) => 20 * countHeads(ctx, 3) },
  },
};
