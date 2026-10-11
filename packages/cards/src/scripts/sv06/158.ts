import type { CardScript } from '@ptcg/engine';

export const name = 'Lucky Helmet';
export const script: CardScript = {
  // When the Active Pokémon holding this is damaged by an opponent's attack, its owner draws 2 cards.
  afterDamagedInActive: (ctx, holder) => void ctx.draw(holder.player, 2),
};
