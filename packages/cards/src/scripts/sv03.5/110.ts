import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Weezing';
export const set = 'sv03.5';
export const script: CardScript = {
  // Let's Have a Blast: if this Pokémon is Knocked Out in the Active Spot by an attack, flip a coin; on heads the Attacking Pokémon is Knocked Out.
  afterKnockout(ctx, { holder, knocked, attacker }) {
    if (holder.zone !== 'active' || knocked.zone !== 'active') return;
    if (!ctx.flipCoin()) return;
    ctx.log("Let's Have a Blast Knocks the Attacking Pokémon Out");
    ctx.knockOut(attacker);
  },
  attacks: {
    // Spinning Fumes: 10 damage to each of the opponent's Benched Pokémon (no Weakness or Resistance).
    0: {
      effect(ctx) {
        for (const ref of benchRefs(ctx, ctx.opp)) dealAttackDamage(ctx, ref, 10);
      },
    },
  },
};
