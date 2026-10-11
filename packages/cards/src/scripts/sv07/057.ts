import type { CardScript } from '@ptcg/engine';

export const name = 'Slowpoke';
export const set = 'sv07';
export const script: CardScript = {
  attacks: {
    // Dangle Tail: put a Pokémon from your discard pile into your hand.
    0: {
      effect(ctx) {
        const from = ctx.state.players[ctx.me].discard.filter((u) => ctx.def(u).category === 'Pokemon');
        const [uid] = ctx.chooseCards({ player: ctx.me, from, min: 0, max: 1, message: 'Choose a Pokémon' });
        if (uid) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
      },
    },
  },
};
