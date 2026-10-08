import type { CardScript, EffectCtx } from '@ptcg/engine';
import { benchRefs, isBasicEnergy, searchDeck, topDef } from '../util.ts';

const darkBench = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).types.includes('Darkness'));

export const name = 'Toxtricity';
export const script: CardScript = {
  abilities: {
    'Sinister Surge': {
      canUse: (ctx) => darkBench(ctx).length > 0,
      use(ctx) {
        const [energy] = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Darkness'),
          max: 1,
          message: 'Choose a Basic {D} Energy',
        });
        if (energy) {
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among: darkBench(ctx),
            min: 1,
            max: 1,
            message: 'Choose a Benched {D} Pokémon',
          });
          ctx.attachEnergy(energy, ref!);
          ctx.placeCounters(ref!, 2);
        }
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
