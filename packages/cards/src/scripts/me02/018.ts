import type { CardScript, EffectCtx } from '@ptcg/engine';
import { benchRefs, inPlayRefs, isBasicEnergy, topDef } from '../util.ts';

const fireBench = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).types.includes('Fire'));
const fireInHand = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].hand.filter((u) => isBasicEnergy(ctx.def(u), 'Fire'));
const hasFireMegaEx = (ctx: EffectCtx) =>
  inPlayRefs(ctx, ctx.me).some((ref) => {
    const d = topDef(ctx, ref);
    return d.isMega && d.isEx && d.types.includes('Fire');
  });

export const name = 'Oricorio ex';
export const script: CardScript = {
  abilities: {
    'Excited Turbo': {
      repeatable: true,
      canUse: (ctx) => hasFireMegaEx(ctx) && fireInHand(ctx).length > 0 && fireBench(ctx).length > 0,
      use(ctx) {
        const [energy] = ctx.chooseCards({
          player: ctx.me,
          from: fireInHand(ctx),
          min: 1,
          max: 1,
          message: 'Choose a Basic {R} Energy to attach',
        });
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: fireBench(ctx),
          min: 1,
          max: 1,
          message: 'Choose a Benched {R} Pokémon',
        });
        ctx.attachEnergy(energy!, ref!);
      },
    },
  },
};
