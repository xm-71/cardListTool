import type { CardScript } from '@ptcg/engine';

export const name = 'Ekans';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Acid Spray: flip a coin; on heads discard an Energy from the Defending Pokémon.
    0: {
      effect(ctx) {
        if (!ctx.flipCoin()) return;
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const energy = ctx.slot(ref).energy;
        if (energy.length === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: energy,
          min: 1,
          max: 1,
          message: "Choose an Energy to discard from your opponent's Active Pokémon",
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
