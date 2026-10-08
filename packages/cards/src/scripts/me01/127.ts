import type { CardScript } from '@ptcg/engine';
import { topDef } from '../util.ts';

export const name = 'Risky Ruins';
export const script: CardScript = {
  stadium: {
    onBenchFromHand(ctx, ref) {
      const def = topDef(ctx, ref);
      if (def.stage === 'Basic' && !def.types.includes('Darkness')) {
        ctx.placeCounters(ref, 2);
        ctx.log(`Risky Ruins places 2 damage counters on ${def.name}`);
      }
    },
  },
};
