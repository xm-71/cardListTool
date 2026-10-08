import type { CardScript, EffectCtx } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

const waterInDiscard = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((u) => isBasicEnergy(ctx.def(u), 'Water'));

export const name = 'Kyogre';
export const script: CardScript = {
  attacks: {
    // Riptide: 20 for each Basic {W} Energy in your discard pile, then shuffle them into your deck.
    0: {
      damage: (ctx) => 20 * waterInDiscard(ctx).length,
      effect(ctx) {
        for (const uid of waterInDiscard(ctx)) ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
        ctx.shuffleDeck(ctx.me);
      },
    },
    // Swirling Waves: discard 2 Energy from this Pokémon.
    1: {
      effect(ctx) {
        const self = { player: ctx.me, zone: 'active' } as const;
        const energy = ctx.slot(self).energy;
        const n = Math.min(2, energy.length);
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: [...energy],
          min: n,
          max: n,
          message: 'Discard 2 Energy',
        });
        ctx.discardEnergy(self, picks);
      },
    },
  },
};
