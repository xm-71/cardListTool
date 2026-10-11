import type { CardScript } from '@ptcg/engine';

export const name = 'Academy at Night';
export const script: CardScript = {
  // Once during each player's turn, that player may put a card from their hand on top of their deck.
  stadium: {
    canUse: (ctx) => ctx.state.players[ctx.me].hand.length > 0,
    use(ctx) {
      const [uid] = ctx.chooseCards({
        player: ctx.me,
        from: [...ctx.state.players[ctx.me].hand],
        min: 1,
        max: 1,
        message: 'Put which card on top of your deck?',
      });
      ctx.moveCard(uid!, { player: ctx.me, zone: 'deck' });
    },
  },
};
