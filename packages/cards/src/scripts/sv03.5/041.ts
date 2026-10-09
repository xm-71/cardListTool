import type { CardScript } from '@ptcg/engine';
import { abilityHolder } from '../util.ts';

export const name = 'Zubat';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Revealing Echo: once during your turn, if this Pokémon is in the Active Spot, your opponent reveals their hand.
    'Revealing Echo': {
      canUse: (ctx) => abilityHolder(ctx).zone === 'active',
      use: (ctx) => ctx.reveal(ctx.state.players[ctx.opp].hand),
    },
  },
};
