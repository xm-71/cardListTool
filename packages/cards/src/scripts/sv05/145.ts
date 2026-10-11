import type { CardScript } from '@ptcg/engine';

export const name = "Ciphermaniac's Codebreaking";
export const script: CardScript = {
  // Search your deck for 2 cards, shuffle your deck, then put those cards on top of it in any order.
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.me].deck.length > 0,
    play(ctx) {
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: [...ctx.state.players[ctx.me].deck],
        min: 0,
        max: 2,
        message: 'Choose 2 cards',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      ctx.shuffleDeck(ctx.me);
      if (picks.length === 0) return;
      const [first] =
        picks.length === 1
          ? picks
          : ctx.chooseCards({
              player: ctx.me,
              from: picks,
              min: 1,
              max: 1,
              message: 'Which card goes on top?',
            });
      // The other card goes on first, so the chosen card ends up on top.
      for (const uid of picks.filter((u) => u !== first)) ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
      ctx.moveCard(first!, { player: ctx.me, zone: 'deck' });
    },
  },
};
