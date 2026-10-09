import type { CardScript } from '@ptcg/engine';

export const name = 'Arbok ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Bind Down: the Defending Pokémon can't retreat during the opponent's next turn.
    0: { effect: (ctx) => ctx.addMarker({ player: ctx.opp, zone: 'active' }, 'cantRetreat') },
    // Menacing Fangs: the opponent discards 2 cards from their hand (their choice).
    1: {
      effect(ctx) {
        const hand = ctx.state.players[ctx.opp].hand;
        const n = Math.min(2, hand.length);
        if (n === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.opp,
          from: [...hand],
          min: n,
          max: n,
          message: 'Discard 2 cards from your hand',
        });
        for (const uid of picks) ctx.moveCard(uid, { player: ctx.opp, zone: 'discard' });
        ctx.log(`${picks.length} card(s) are discarded from the opponent's hand`);
      },
    },
  },
};
