import type { CardScript } from '@ptcg/engine';

export const name = 'Bloodmoon Ursaluna ex';
export const script: CardScript = {
  // Seasoned Skill: Blood Moon costs {C} less for each Prize card the opponent has taken.
  modifyAttackCost(q) {
    if (q.attackIndex !== 0) return q.cost;
    const opp = q.state.players[q.holder.player === 0 ? 1 : 0];
    const taken = 6 - opp.prizes.length;
    const cost = [...q.cost];
    for (let i = 0; i < taken; i++) {
      const c = cost.lastIndexOf('Colorless');
      if (c < 0) break;
      cost.splice(c, 1);
    }
    return cost;
  },
  attacks: {
    // Blood Moon
    0: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
      },
    },
  },
};
