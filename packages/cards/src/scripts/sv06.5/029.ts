import type { CardScript } from '@ptcg/engine';

export const name = 'Crobat';
export const set = 'sv06.5';
export const script: CardScript = {
  // Shadowy Envoy needs Janine's Secret Art, which no deck of this game contains, so it can never be used.
  abilities: { 'Shadowy Envoy': { canUse: () => false, use: () => undefined } },
  attacks: {
    // Poison Fang: the Defending Pokémon is now Poisoned. (The engine's Poison is always 1 damage counter, so the
    // card's "2 damage counters instead of 1" is not applied.)
    0: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'poisoned') },
  },
};
