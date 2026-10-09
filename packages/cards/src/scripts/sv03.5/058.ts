import type { CardScript } from '@ptcg/engine';

export const name = 'Growlithe';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Vaporize: discard a {W} Energy from the Defending Pokémon.
    0: {
      effect(ctx) {
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const water = ctx.slot(ref).energy.filter((uid) => {
          const d = ctx.def(uid);
          return d.category === 'Energy' && d.provides.includes('Water');
        });
        if (water.length === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: water,
          min: 1,
          max: 1,
          message: "Choose a {W} Energy to discard from your opponent's Active Pokémon",
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
