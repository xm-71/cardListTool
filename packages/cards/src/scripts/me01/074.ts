import type { CardScript, EffectCtx } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, topDef } from '../util.ts';

const ABILITY = 'Lunar Cycle';
const energy = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].hand.filter((u) => isBasicEnergy(ctx.def(u), 'Fighting'));

export const name = 'Lunatone';
export const script: CardScript = {
  abilities: {
    [ABILITY]: {
      canUse: (ctx) =>
        !ctx.usedAbilityNameThisTurn(ABILITY) &&
        energy(ctx).length > 0 &&
        inPlayRefs(ctx, ctx.me).some((ref) => topDef(ctx, ref).name === 'Solrock'),
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: energy(ctx),
          min: 1,
          max: 1,
          message: 'Discard a Basic {F} Energy',
        });
        ctx.moveCard(uid!, { player: ctx.me, zone: 'discard' });
        ctx.draw(ctx.me, 3);
      },
    },
  },
};
