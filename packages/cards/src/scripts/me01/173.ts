import type { CardScript, EffectCtx } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

const targets = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((uid) => {
    const d = ctx.def(uid);
    return d.category === 'Pokemon' || isBasicEnergy(d);
  });

export const name = 'Night Stretcher';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => targets(ctx).length > 0,
    play(ctx) {
      const [uid] = ctx.chooseCards({
        player: ctx.me,
        from: targets(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Pokémon or Basic Energy card',
      });
      ctx.moveCard(uid!, { player: ctx.me, zone: 'hand' });
    },
  },
};
