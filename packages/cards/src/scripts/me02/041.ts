import type { CardScript } from '@ptcg/engine';
import { sameRef } from '../util.ts';

export const name = 'Mega Diancie ex';
export const script: CardScript = {
  // Diamond Coat
  modifyIncomingDamage: (q) => (sameRef(q.holder, q.defender) ? q.amount - 30 : q.amount),
  attacks: {
    // Garland Ray
    0: {
      damage(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: [...ctx.slot(self).energy],
          min: 0,
          max: 2,
          message: 'Discard up to 2 Energy (120 damage each)',
        });
        ctx.discardEnergy(self, picks);
        return 120 * picks.length;
      },
    },
  },
};
