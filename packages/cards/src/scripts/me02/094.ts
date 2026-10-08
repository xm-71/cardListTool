import type { CardScript, EffectCtx } from '@ptcg/engine';
import { benchRefs, isBasicEnergy, topDef } from '../util.ts';

const energy = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((uid) => isBasicEnergy(ctx.def(uid), 'Psychic'));
const targets = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).types.includes('Psychic'));

export const name = 'Wondrous Patch';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => energy(ctx).length > 0 && targets(ctx).length > 0,
    play(ctx) {
      const [uid] = ctx.chooseCards({
        player: ctx.me,
        from: energy(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Basic {P} Energy',
      });
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: targets(ctx),
        min: 1,
        max: 1,
        message: 'Choose a Benched {P} Pokémon',
      });
      ctx.attachEnergy(uid!, ref!);
    },
  },
};
