import type { CardScript } from '@ptcg/engine';

export const name = 'Unfair Stamp';
export const script: CardScript = {
  // Only if any of your Pokémon were Knocked Out during your opponent's last turn: both hands go into the decks,
  // then you draw 5 and your opponent draws 2.
  trainer: {
    canPlay: (ctx) => ctx.wasKnockedOutLastOpponentTurn(ctx.me),
    play(ctx) {
      for (const player of [ctx.me, ctx.opp]) {
        for (const uid of [...ctx.state.players[player].hand]) ctx.moveCard(uid, { player, zone: 'deck' });
        ctx.shuffleDeck(player);
      }
      ctx.draw(ctx.me, 5);
      ctx.draw(ctx.opp, 2);
    },
  },
};
