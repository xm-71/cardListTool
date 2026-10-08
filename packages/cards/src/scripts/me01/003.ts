import type { CardScript, EffectCtx, SlotRef } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, sameRef } from '../util.ts';

const grassOn = (ctx: EffectCtx, ref: SlotRef) =>
  ctx.slot(ref).energy.filter((u) => isBasicEnergy(ctx.def(u), 'Grass'));

export const name = 'Mega Venusaur ex';
export const script: CardScript = {
  abilities: {
    'Solar Transfer': {
      repeatable: true,
      canUse: (ctx) => {
        const refs = inPlayRefs(ctx, ctx.me);
        return refs.length > 1 && refs.some((ref) => grassOn(ctx, ref).length > 0);
      },
      use(ctx) {
        const refs = inPlayRefs(ctx, ctx.me);
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: refs.flatMap((ref) => grassOn(ctx, ref)),
          min: 1,
          max: 1,
          message: 'Choose a Basic {G} Energy to move',
        });
        const from = refs.find((ref) => ctx.slot(ref).energy.includes(uid!))!;
        const [to] = ctx.chooseSlot({
          player: ctx.me,
          among: refs.filter((ref) => !sameRef(ref, from)),
          min: 1,
          max: 1,
          message: 'Move it to which Pokémon?',
        });
        ctx.detachEnergy(from, [uid!], 'hand');
        ctx.attachEnergy(uid!, to!);
      },
    },
  },
  attacks: {
    // Jungle Dump
    0: { effect: (ctx) => ctx.heal({ player: ctx.me, zone: 'active' }, 30) },
  },
};
