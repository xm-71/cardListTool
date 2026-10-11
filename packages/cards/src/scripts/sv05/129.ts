import type { CardScript } from '@ptcg/engine';
import { abilityHolder } from '../util.ts';

export const name = 'Dudunsparce';
export const set = 'sv05';
export const script: CardScript = {
  abilities: {
    // Run Away Draw: draw 3 cards, then shuffle this Pokémon and all attached cards into your deck.
    'Run Away Draw': {
      canUse(ctx) {
        const p = ctx.state.players[ctx.me];
        // From the Active Spot it needs a Benched Pokémon to take its place.
        return p.deck.length > 0 && (abilityHolder(ctx).zone === 'bench' || p.bench.length > 0);
      },
      use(ctx) {
        const holder = abilityHolder(ctx);
        if (ctx.draw(ctx.me, 3).length > 0) ctx.shuffleSlotIntoDeck(holder);
      },
    },
  },
};
