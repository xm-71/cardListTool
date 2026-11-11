import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Mega Starmie ex';
export const script: CardScript = {
  attacks: {
    // Jetting Blow: this attack also does 50 damage to 1 of your opponent's Benched Pokémon (no Weakness or Resistance).
    0: {
      effect(ctx) {
        const among = benchRefs(ctx, ctx.opp);
        if (among.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Benched Pokémon",
        });
        if (ref) dealAttackDamage(ctx, ref, 50);
      },
    },
    // Nebula Beam: this attack's damage isn't affected by Weakness or Resistance, or by any effects on the Defending Pokémon.
    1: { damage: () => ({ amount: 210, ignoreWR: true, ignoreDefenderEffects: true }) },
  },
};
