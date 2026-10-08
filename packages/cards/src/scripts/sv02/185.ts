import type { CardScript, PlayerId } from '@ptcg/engine';

export const name = 'Iono';
export const script: CardScript = {
  trainer: {
    play(ctx) {
      let moved = false;
      for (const player of [ctx.me, ctx.opp] as PlayerId[]) {
        for (const uid of ctx.shuffled(ctx.state.players[player].hand)) {
          ctx.moveCard(uid, { player, zone: 'deckBottom' });
          moved = true;
        }
      }
      if (!moved) return;
      for (const player of [ctx.me, ctx.opp] as PlayerId[]) {
        ctx.draw(player, ctx.state.players[player].prizes.length);
      }
    },
  },
};
