import type { CardScript, EffectCtx } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

const targets = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((uid) => {
    const d = ctx.def(uid);
    return d.category === 'Pokemon' || isBasicEnergy(d);
  });

export const name = 'Super Rod';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: targets(ctx),
        min: 0,
        max: 3,
        message: 'Choose up to 3 Pokémon and Basic Energy cards to shuffle into your deck',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
      ctx.shuffleDeck(ctx.me);
    },
  },
};
