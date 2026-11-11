import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs, slotAt } from '../util.ts';

export const name = 'Zapdos ex';
export const set = 'sv03.5';
export const script: CardScript = {
  // Voltaic Float: if this Pokémon has any {L} Energy attached, it has no Retreat Cost.
  modifyRetreatCost: (q) => {
    const energy = slotAt(q.state, q.slot)?.energy ?? [];
    const hasLightning = energy.some((uid) => {
      const d = q.registry.defs[q.state.cards[uid]!.defId];
      return d?.category === 'Energy' && d.provides.includes('Lightning');
    });
    return hasLightning ? 0 : q.cost;
  },
  attacks: {
    // Multishot Lightning: also 90 damage to 1 of your opponent's Benched Pokémon that has any damage counters on it.
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.opp).filter((ref) => ctx.slot(ref).damage > 0);
        if (among.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's damaged Benched Pokémon",
        });
        if (ref) dealAttackDamage(ctx, ref, 90);
      },
    },
  },
};
