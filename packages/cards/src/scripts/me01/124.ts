import type { CardScript } from '@ptcg/engine';
import { defAt } from '../util.ts';

export const name = 'Premium Power Pro';
export const script: CardScript = {
  trainer: { play: (ctx) => ctx.addLingering(ctx.def((ctx.source as { uid: string }).uid).id) },
  // While lingering this turn: {F} attacks do 30 more to the opponent's Active.
  modifyOutgoingDamage(q) {
    const attacker = defAt(q.state, q.registry, q.attacker);
    return q.defender.zone === 'active' && attacker?.types.includes('Fighting') ? q.amount + 30 : q.amount;
  },
};
