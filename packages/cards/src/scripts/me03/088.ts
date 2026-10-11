import type { CardScript } from '@ptcg/engine';
import { benchSpace, searchDeck, topDef } from '../util.ts';

export const name = 'Telepathic Psychic Energy';
export const script: CardScript = {
  // When attached from your hand to a {P} Pokémon, put up to 2 Basic {P} Pokémon from your deck onto your Bench.
  onAttachFromHand(ctx, slot) {
    if (!topDef(ctx, slot).types.includes('Psychic')) return;
    const space = benchSpace(ctx, ctx.me);
    if (space > 0) {
      const picks = searchDeck(ctx, {
        filter: (d) => d.category === 'Pokemon' && d.stage === 'Basic' && d.types.includes('Psychic'),
        max: Math.min(2, space),
        message: 'Choose up to 2 Basic Psychic Pokémon',
      });
      for (const uid of picks) ctx.putOnBench(ctx.me, uid);
    }
    ctx.shuffleDeck(ctx.me);
  },
};
