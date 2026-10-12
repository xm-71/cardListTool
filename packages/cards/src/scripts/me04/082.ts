import type { CardScript } from '@ptcg/engine';

export const name = 'Special Red Card';
export const script: CardScript = {
  // Only if your opponent has 3 or fewer Prize cards left: their hand goes to the bottom of their deck; then
  // they draw 3 cards.
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.opp].prizes.length <= 3,
    play(ctx) {
      // Shuffled first, so the order on the bottom of the deck is hidden.
      const hand = ctx.shuffled(ctx.state.players[ctx.opp].hand);
      if (hand.length === 0) return;
      for (const uid of hand) ctx.moveCard(uid, { player: ctx.opp, zone: 'deckBottom' });
      ctx.draw(ctx.opp, 3);
    },
  },
};
