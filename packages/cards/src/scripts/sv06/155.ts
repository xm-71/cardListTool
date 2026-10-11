import type { CardScript, EffectCtx } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

const targets = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((u) => {
    const d = ctx.def(u);
    return (d.category === 'Pokemon' && !d.isEx) || isBasicEnergy(d);
  });

export const name = "Lana's Aid";
export const script: CardScript = {
  // Put up to 3 Pokémon without a Rule Box and Basic Energy cards from your discard pile into your hand.
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: targets(ctx),
        min: 1,
        max: 3,
        message: 'Choose up to 3 cards',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
    },
  },
};
