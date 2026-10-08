import type { CardScript } from '@ptcg/engine';

export const name = "Professor's Research";
export const script: CardScript = {
  trainer: {
    play(ctx) {
      for (const uid of [...ctx.state.players[ctx.me].hand])
        ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
      ctx.draw(ctx.me, 7);
    },
  },
};
