import type { CardScript } from '@ptcg/engine';

export const name = 'Hitmontop';
export const set = 'me02.5';
export const script: CardScript = {
  attacks: {
    // Spin and Draw: shuffle your hand into your deck, then draw 6 cards.
    0: {
      effect(ctx) {
        for (const uid of [...ctx.state.players[ctx.me].hand])
          ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
        ctx.shuffleDeck(ctx.me);
        ctx.draw(ctx.me, 6);
      },
    },
  },
};
