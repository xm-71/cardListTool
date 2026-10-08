import type { CardScript } from '@ptcg/engine';
import { topDef } from '../util.ts';

export const name = 'Punk Helmet';
export const script: CardScript = {
  afterDamagedInActive(ctx, holder, attacker) {
    if (!topDef(ctx, holder).types.includes('Darkness')) return;
    ctx.placeCounters(attacker, 4);
    ctx.log('Punk Helmet places 4 damage counters on the Attacking Pokémon');
  },
};
