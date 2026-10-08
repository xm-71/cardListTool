import type { CardScript } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

export const name = 'Solrock';
export const script: CardScript = {
  attacks: {
    // Cosmic Beam
    0: {
      damage(ctx) {
        const lunatone = benchRefs(ctx, ctx.me).some((ref) => topDef(ctx, ref).name === 'Lunatone');
        return { amount: lunatone ? 70 : 0, ignoreWR: true };
      },
    },
  },
};
