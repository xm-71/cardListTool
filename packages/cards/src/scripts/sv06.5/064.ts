import type { CardScript } from '@ptcg/engine';

export const name = "Xerosic's Machinations";
export const script: CardScript = {
  // Your opponent discards cards from their hand until they have 3 cards in their hand.
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.opp].hand.length > 3,
    play(ctx) {
      const hand = ctx.state.players[ctx.opp].hand;
      const n = hand.length - 3;
      if (n <= 0) return;
      const picks = ctx.chooseCards({
        player: ctx.opp,
        from: [...hand],
        min: n,
        max: n,
        message: `Discard ${n} cards`,
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.opp, zone: 'discard' });
    },
  },
};
