import type { CardScript } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

export const name = 'Sableye';
export const script: CardScript = {
  attacks: {
    // Cocky Claw
    0: {
      damage(ctx) {
        const stage2Dark = benchRefs(ctx, ctx.me).some((ref) => {
          const d = topDef(ctx, ref);
          return d.stage === 'Stage2' && d.types.includes('Darkness');
        });
        return 20 + (stage2Dark ? 70 : 0);
      },
    },
  },
};
