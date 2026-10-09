import type { CardScript } from '@ptcg/engine';

export const name = 'Staryu';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Swift: not affected by Weakness, Resistance or effects on the Defending Pokémon.
    0: { damage: () => ({ amount: 30, ignoreWR: true, ignoreDefenderEffects: true }) },
  },
};
