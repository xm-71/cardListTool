import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Houndoom';
export const set = 'sv08.5';
export const script: CardScript = {
  attacks: {
    // Call to Muster: search your deck for up to 2 Basic Energy cards and attach them to your Pokémon in any way.
    0: {
      effect(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d),
          max: 2,
          message: 'Choose up to 2 Basic Energy cards',
        });
        for (const uid of picks) {
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among: inPlayRefs(ctx, ctx.me),
            min: 1,
            max: 1,
            message: 'Attach it to which Pokémon?',
          });
          ctx.attachEnergy(uid, ref!);
        }
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
