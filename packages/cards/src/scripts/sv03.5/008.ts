import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

export const name = 'Wartortle';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Free Diving: put up to 3 Basic {W} Energy from your discard pile into your hand.
    0: {
      effect(ctx) {
        const from = ctx.state.players[ctx.me].discard.filter((uid) => isBasicEnergy(ctx.def(uid), 'Water'));
        const picks = ctx.chooseCards({
          player: ctx.me,
          from,
          min: 0,
          max: 3,
          message: 'Choose up to 3 Basic {W} Energy',
        });
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      },
    },
  },
};
