import type { CardScript } from '@ptcg/engine';
import { energyOfType } from '../util.ts';

export const name = 'Exeggutor';
export const script: CardScript = {
  attacks: {
    // Guard Press
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
    // Stomping Wood
    1: { damage: (ctx) => 60 + 30 * energyOfType(ctx, { player: ctx.me, zone: 'active' }, 'Grass').length },
  },
};
