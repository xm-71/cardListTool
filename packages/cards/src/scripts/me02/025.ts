import type { CardScript } from '@ptcg/engine';
import { discardOwnEnergy } from '../util.ts';

export const name = 'Mamoswine';
export const script: CardScript = {
  attacks: {
    // Wreck: if a Stadium is in play, this attack does 120 more damage. Then, discard that Stadium.
    0: {
      damage(ctx) {
        if (!ctx.state.stadium) return 120;
        ctx.discardStadium();
        return 240;
      },
    },
    // Blizzard Edge: discard 2 Energy from this Pokémon.
    1: { effect: (ctx) => discardOwnEnergy(ctx, 2) },
  },
};
