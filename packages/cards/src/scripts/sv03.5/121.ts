import type { CardScript } from '@ptcg/engine';
import { abilityHolder, inPlayRefs } from '../util.ts';

export const name = 'Starmie';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Mysterious Comet: put 2 damage counters on 1 of the opponent's Pokémon, then discard this Pokémon and all attached cards.
    'Mysterious Comet': {
      // Never offered when Starmie is your only Pokémon in play: discarding it would lose the game.
      canUse: (ctx) => inPlayRefs(ctx, ctx.me).length > 1,
      use(ctx) {
        const holder = abilityHolder(ctx);
        const [target] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: 'Put 2 damage counters on 1 of your opponent’s Pokémon',
        });
        ctx.placeCounters(target!, 2);
        ctx.discardSlot(holder);
      },
    },
  },
};
