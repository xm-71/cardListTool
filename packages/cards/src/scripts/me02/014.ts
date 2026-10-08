import type { CardScript } from '@ptcg/engine';
import { topDef } from '../util.ts';

export const name = 'Moltres';
export const script: CardScript = {
  attacks: {
    // Fighting Wings: 90 more against a Pokémon ex.
    0: { damage: (ctx) => (topDef(ctx, { player: ctx.opp, zone: 'active' }).isEx ? 110 : 20) },
  },
};
