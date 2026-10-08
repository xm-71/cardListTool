import type { CardScript } from '@ptcg/engine';

export const name = "Lillie's Determination";
export const script: CardScript = {
  trainer: {
    play(ctx) {
      const p = ctx.state.players[ctx.me];
      for (const uid of [...p.hand]) ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
      ctx.shuffleDeck(ctx.me);
      ctx.draw(ctx.me, p.prizes.length === 6 ? 8 : 6);
    },
  },
};
