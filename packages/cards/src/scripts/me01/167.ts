import type { CardScript } from '@ptcg/engine';
import { benchSpace, searchDeck } from '../util.ts';

export const name = 'Buddy-Buddy Poffin';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => benchSpace(ctx, ctx.me) > 0,
    play(ctx) {
      const picks = searchDeck(ctx, {
        filter: (d) => d.category === 'Pokemon' && d.stage === 'Basic' && d.hp <= 70,
        max: Math.min(2, benchSpace(ctx, ctx.me)),
        message: 'Choose up to 2 Basic Pokémon with 70 HP or less',
      });
      for (const uid of picks) ctx.putOnBench(ctx.me, uid);
      ctx.shuffleDeck(ctx.me);
    },
  },
};
