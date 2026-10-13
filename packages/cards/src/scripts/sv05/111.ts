import type { CardScript } from '@ptcg/engine';
import { energyOfType } from '../util.ts';

export const name = 'Scizor ex';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Steel Wing: during your opponent's next turn, this Pokémon takes 50 less damage from attacks.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 50) },
    // Cross Breaker: discard up to 2 {M} Energy from this Pokémon; 120 damage for each card discarded.
    1: {
      damage(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const metal = energyOfType(ctx, self, 'Metal');
        if (metal.length === 0) return 0;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: metal,
          min: 0,
          max: Math.min(2, metal.length),
          message: 'Choose up to 2 {M} Energy to discard',
        });
        ctx.discardEnergy(self, picks);
        return 120 * picks.length;
      },
    },
  },
};
