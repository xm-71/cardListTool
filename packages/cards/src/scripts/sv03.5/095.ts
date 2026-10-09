import type { CardScript } from '@ptcg/engine';
import { pokemonDef } from '../util.ts';

export const name = 'Onix';
export const script: CardScript = {
  attacks: {
    // Thumpalanche: discard the top 5 cards; 80 for each Pokémon with a Retreat Cost of exactly 4.
    0: {
      damage(ctx) {
        const p = ctx.state.players[ctx.me];
        const milled = p.deck.splice(0, 5);
        p.discard.push(...milled);
        ctx.log(`${milled.length} cards are discarded from the top of the deck`);
        return 80 * milled.filter((u) => pokemonDef(ctx, u)?.retreat === 4).length;
      },
    },
  },
};
