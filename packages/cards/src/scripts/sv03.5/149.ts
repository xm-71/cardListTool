import type { CardScript } from '@ptcg/engine';

export const name = 'Dragonite';
export const set = 'sv03.5';
export const script: CardScript = {
  // Jet Cruise: your Pokémon in play have no Retreat Cost.
  modifyAllRetreatCosts: () => 0,
  attacks: {
    // Dragon Pulse: discard the top 2 cards of your deck.
    0: {
      effect(ctx) {
        const p = ctx.state.players[ctx.me];
        const milled = p.deck.splice(0, 2);
        p.discard.push(...milled);
        if (milled.length > 0) ctx.log(`${milled.length} card(s) are discarded from the top of the deck`);
      },
    },
  },
};
