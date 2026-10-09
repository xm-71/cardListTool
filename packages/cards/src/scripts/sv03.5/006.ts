import type { CardScript } from '@ptcg/engine';
import { discardOwnEnergy } from '../util.ts';

export const name = 'Charizard ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Brave Wing: 100 more damage if this Pokémon has any damage counters on it.
    0: { damage: (ctx) => (ctx.slot({ player: ctx.me, zone: 'active' }).damage > 0 ? 160 : 60) },
    // Explosive Vortex: discard 3 Energy from this Pokémon.
    1: { effect: (ctx) => discardOwnEnergy(ctx, 3) },
  },
};
