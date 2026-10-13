import type { CardScript } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

export const name = 'Ledian';
export const set = 'sv07';
export const script: CardScript = {
  // Glittering Star Pattern: when you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn,
  // you may switch in 1 of your opponent's Benched Pokémon that has 90 HP or less remaining to the Active Spot.
  onEvolveFromHand: {
    use(ctx) {
      const among = benchRefs(ctx, ctx.opp).filter((ref) => topDef(ctx, ref).hp - ctx.slot(ref).damage <= 90);
      if (among.length === 0) return;
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among,
        min: 1,
        max: 1,
        message: "Choose one of your opponent's Benched Pokémon to switch in",
      });
      if (ref) ctx.switchActive(ctx.opp, (ref as { index: number }).index);
    },
  },
  attacks: {
    // Swift: this attack's damage isn't affected by Weakness or Resistance, or by any effects on the Defending Pokémon.
    0: { damage: () => ({ amount: 70, ignoreWR: true, ignoreDefenderEffects: true }) },
  },
};
