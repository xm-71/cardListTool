import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs, slotAt } from '../util.ts';

export const name = 'Articuno';
export const set = 'sv03.5';
export const script: CardScript = {
  // Ice Float: with any {W} Energy attached, this Pokémon has no Retreat Cost.
  modifyRetreatCost(q) {
    const energy = slotAt(q.state, q.slot)?.energy ?? [];
    const water = energy.some((uid) => {
      const d = q.registry.defs[q.state.cards[uid]!.defId];
      return d?.category === 'Energy' && d.provides.includes('Water');
    });
    return water ? 0 : q.cost;
  },
  attacks: {
    // Blizzard: also 10 damage to each of the opponent's Benched Pokémon.
    0: {
      effect(ctx) {
        for (const ref of benchRefs(ctx, ctx.opp)) dealAttackDamage(ctx, ref, 10);
      },
    },
  },
};
