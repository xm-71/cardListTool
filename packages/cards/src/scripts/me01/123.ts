import type { CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Pokémon Center Lady';
export const script: CardScript = {
  // Heal 60 damage from 1 of your Pokémon, and it recovers from all Special Conditions.
  trainer: {
    play(ctx) {
      const [ref] = ctx.chooseSlot({
        player: ctx.me,
        among: inPlayRefs(ctx, ctx.me),
        min: 1,
        max: 1,
        message: 'Choose 1 of your Pokémon',
      });
      ctx.heal(ref!, 60);
      ctx.slot(ref!).conditions = { rotation: 'none', poisoned: false, burned: false };
    },
  },
};
