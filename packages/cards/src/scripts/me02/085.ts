import type { CardScript } from '@ptcg/engine';

export const name = 'Battle Cage';
export const script: CardScript = {
  // Prevent damage counters being placed on Benched Pokémon by effects of the opponent's attacks and Abilities.
  stadium: { protectsBench: true },
};
