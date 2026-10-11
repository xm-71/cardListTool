import type { CardScript } from '@ptcg/engine';

export const name = 'Alakazam';
export const set = 'me01';
export const script: CardScript = {
  // Psychic Draw: when played from your hand to evolve, you may draw 3 cards.
  onEvolveFromHand: { use: (ctx) => void ctx.draw(ctx.me, 3) },
  attacks: {
    // Powerful Hand: place 2 damage counters on your opponent's Active Pokémon for each card in your hand.
    0: {
      effect(ctx) {
        const n = 2 * ctx.state.players[ctx.me].hand.length;
        if (n > 0 && ctx.state.players[ctx.opp].active)
          ctx.placeCounters({ player: ctx.opp, zone: 'active' }, n);
      },
    },
  },
};
