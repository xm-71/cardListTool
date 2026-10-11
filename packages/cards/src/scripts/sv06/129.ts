import type { CardScript } from '@ptcg/engine';

export const name = 'Drakloak';
export const set = 'sv06';
export const script: CardScript = {
  abilities: {
    // Look at the top 2 cards of your deck, put 1 into your hand and the other on the bottom.
    'Recon Directive': {
      canUse: (ctx) => ctx.state.players[ctx.me].deck.length > 0,
      use(ctx) {
        const p = ctx.state.players[ctx.me];
        const top = p.deck.slice(0, 2);
        const [keep] = ctx.chooseCards({
          player: ctx.me,
          from: top,
          min: 1,
          max: 1,
          message: 'Choose a card to put into your hand',
        });
        ctx.moveCard(keep!, { player: ctx.me, zone: 'hand' });
        for (const uid of top.filter((u) => u !== keep))
          ctx.moveCard(uid, { player: ctx.me, zone: 'deckBottom' });
      },
    },
  },
};
