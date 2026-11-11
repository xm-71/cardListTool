import type { CardScript } from '@ptcg/engine';
import { benchSpace, isBasicPokemonCard, searchDeck } from '../util.ts';

export const name = 'Miraidon ex';
export const set = 'sv01';
export const script: CardScript = {
  abilities: {
    // Tandem Unit: once during your turn, search your deck for up to 2 Basic {L} Pokémon and put them onto your Bench.
    'Tandem Unit': {
      canUse: (ctx) => benchSpace(ctx, ctx.me) > 0,
      use(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicPokemonCard(d) && d.category === 'Pokemon' && d.types.includes('Lightning'),
          max: Math.min(2, benchSpace(ctx, ctx.me)),
          message: 'Choose up to 2 Basic {L} Pokémon to put on your Bench',
        });
        for (const uid of picks) ctx.putOnBench(ctx.me, uid);
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
  attacks: {
    // Photon Blaster: during your next turn, this Pokémon can't attack.
    0: {
      effect(ctx) {
        ctx.slot({ player: ctx.me, zone: 'active' }).cantAttackOnTurn = ctx.state.turn + 2;
        ctx.log("Miraidon ex can't attack during its owner's next turn");
      },
    },
  },
};
