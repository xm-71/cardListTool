import type { CardScript, EffectCtx } from '@ptcg/engine';
import { abilityHolder, energyOfType, inPlayRefs } from '../util.ts';

const damaged = (ctx: EffectCtx) => inPlayRefs(ctx, ctx.me).filter((ref) => ctx.slot(ref).damage > 0);

export const name = 'Shuckle';
export const script: CardScript = {
  abilities: {
    'Fermented Juice': {
      canUse: (ctx) => energyOfType(ctx, abilityHolder(ctx), 'Grass').length > 0 && damaged(ctx).length > 0,
      use(ctx) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: damaged(ctx),
          min: 1,
          max: 1,
          message: 'Heal 30 damage from which Pokémon?',
        });
        ctx.heal(ref!, 30);
      },
    },
  },
};
