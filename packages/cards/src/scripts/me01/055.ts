import type { CardScript } from '@ptcg/engine';

export const name = 'Kadabra';
export const set = 'me01';
export const script: CardScript = {
  // Psychic Draw: when played from your hand to evolve, you may draw 2 cards.
  onEvolveFromHand: { use: (ctx) => void ctx.draw(ctx.me, 2) },
};
