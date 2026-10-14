import type { CardScript } from '@ptcg/engine';

export const name = 'Primeape';
export const set = 'sv08';
export const script: CardScript = {
  attacks: {
    // Sweep the Leg: flip a coin. If heads, discard an Energy from your opponent's Active Pokémon.
    0: {
      effect(ctx) {
        if (!ctx.flipCoin()) return;
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const energy = ctx.slot(ref).energy;
        if (energy.length === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: [...energy],
          min: 1,
          max: 1,
          message: "Choose an Energy to discard from your opponent's Active Pokémon",
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
