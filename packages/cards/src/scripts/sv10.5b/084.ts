import type { CardScript } from '@ptcg/engine';

export const name = 'Pokégear 3.0';
export const script: CardScript = {
  // Look at the top 7 cards of your deck; you may put a Supporter you find there into your hand.
  trainer: {
    canPlay: (ctx) => ctx.state.players[ctx.me].deck.length > 0,
    play(ctx) {
      const top = ctx.state.players[ctx.me].deck.slice(0, 7);
      const supporters = top.filter((u) => {
        const d = ctx.def(u);
        return d.category === 'Trainer' && d.trainerType === 'Supporter';
      });
      const [uid] = ctx.chooseCards({
        player: ctx.me,
        from: supporters,
        min: 0,
        max: 1,
        message: 'Choose a Supporter',
      });
      if (uid) {
        ctx.reveal([uid]);
        ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
