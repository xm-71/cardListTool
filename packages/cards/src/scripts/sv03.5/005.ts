import type { CardScript } from '@ptcg/engine';
import { discardOwnEnergy } from '../util.ts';

export const name = 'Charmeleon';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Fire Blast: discard an Energy from this Pokémon.
    1: { effect: (ctx) => discardOwnEnergy(ctx, 1) },
  },
};
