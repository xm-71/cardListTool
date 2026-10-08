import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, topDef } from '../util.ts';

const energyInHand = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].hand.filter((uid) => ctx.def(uid).category === 'Energy');

export const name = 'Mystery Garden';
export const script: CardScript = {
  stadium: {
    canUse: (ctx) => energyInHand(ctx).length > 0,
    use(ctx) {
      const [energy] = ctx.chooseCards({
        player: ctx.me,
        from: energyInHand(ctx),
        min: 1,
        max: 1,
        message: 'Choose an Energy card to discard',
      });
      ctx.moveCard(energy!, { player: ctx.me, zone: 'discard' });
      const psychic = inPlayRefs(ctx, ctx.me).filter((ref) =>
        topDef(ctx, ref).types.includes('Psychic'),
      ).length;
      ctx.draw(ctx.me, psychic - ctx.state.players[ctx.me].hand.length);
    },
  },
};
