import type { CardScript } from '@ptcg/engine';
import { energyOfType } from '../util.ts';

export const name = 'Volcanion';
export const script: CardScript = {
  attacks: {
    // Singe
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'burned') },
    // Backfire: put 2 {R} Energy attached to this Pokémon into your hand.
    1: {
      effect(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const fire = energyOfType(ctx, self, 'Fire');
        const n = Math.min(2, fire.length);
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: fire,
          min: n,
          max: n,
          message: 'Put 2 {R} Energy into your hand',
        });
        ctx.detachEnergy(self, picks, 'hand');
      },
    },
  },
};
