import type { CardScript } from '@ptcg/engine';

export const name = 'Enriching Energy';
export const script: CardScript = {
  // When attached from your hand to a Pokémon, draw 4 cards.
  onAttachFromHand: (ctx) => void ctx.draw(ctx.me, 4),
};
