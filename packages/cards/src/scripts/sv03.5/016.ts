import type { CardScript } from '@ptcg/engine';
import { callForFamily } from '../util.ts';

export const name = 'Pidgey';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Call for Family: search your deck for up to 2 Basic Pokémon and put them onto your Bench.
    0: { effect: (ctx) => callForFamily(ctx, 2) },
  },
};
