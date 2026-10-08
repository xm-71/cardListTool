import type { CardScript } from '@ptcg/engine';
import { defAt, refsOf, sameRef } from '../util.ts';

export const name = 'Seviper';
export const script: CardScript = {
  // Excited Power
  modifyOutgoingDamage(q) {
    if (!sameRef(q.holder, q.attacker)) return q.amount;
    const megaDark = refsOf(q.state, q.holder.player).some((r) => {
      const d = defAt(q.state, q.registry, r);
      return !!d?.isMega && d.types.includes('Darkness');
    });
    return megaDark ? q.amount + 120 : q.amount;
  },
};
