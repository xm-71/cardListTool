import type { CardScript } from '@ptcg/engine';

export const name = 'Eevee';
export const set = 'sv08.5';
export const script: CardScript = {
  // Boosted Evolution (evolving on the turn it is played) needs an engine rule that does not exist, so Eevee
  // evolves under the normal rules.
  abilities: { 'Boosted Evolution': { canUse: () => false, use: () => undefined } },
  attacks: {
    // Reckless Charge: this Pokémon also does 10 damage to itself.
    0: { effect: (ctx) => ctx.damageSelf(10) },
  },
};
