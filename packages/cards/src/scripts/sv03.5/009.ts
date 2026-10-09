import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy, sameRef } from '../util.ts';

export const name = 'Blastoise ex';
export const set = 'sv03.5';
export const script: CardScript = {
  // Solid Shell: takes 30 less damage from attacks (after Weakness and Resistance).
  modifyIncomingDamage: (q) => (sameRef(q.holder, q.defender) ? Math.max(0, q.amount - 30) : q.amount),
  attacks: {
    // Twin Cannons: discard up to 2 Basic {W} Energy from your hand; 140 damage for each.
    0: {
      damage(ctx) {
        const from = ctx.state.players[ctx.me].hand.filter((uid) => isBasicEnergy(ctx.def(uid), 'Water'));
        const picks = ctx.chooseCards({
          player: ctx.me,
          from,
          min: 0,
          max: Math.min(2, from.length),
          message: 'Discard up to 2 Basic {W} Energy (140 damage each)',
        });
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
        return 140 * picks.length;
      },
    },
  },
};
