import type { CardScript } from '@ptcg/engine';

export const name = 'Mega Absol ex';
export const set = 'me01';
export const script: CardScript = {
  attacks: {
    // Terminal Period: if your opponent's Active Pokémon has exactly 6 damage counters on it, that Pokémon is Knocked Out.
    0: {
      effect(ctx) {
        const slot = ctx.state.players[ctx.opp].active;
        if (slot && slot.damage === 60) ctx.knockOut({ player: ctx.opp, zone: 'active' });
      },
    },
    // Claw of Darkness: your opponent reveals their hand, and you discard a card you find there.
    1: {
      effect(ctx) {
        const hand = [...ctx.state.players[ctx.opp].hand];
        if (hand.length === 0) return;
        ctx.reveal(hand);
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: hand,
          min: 1,
          max: 1,
          message: "Choose a card to discard from your opponent's hand",
        });
        if (uid) ctx.moveCard(uid, { player: ctx.opp, zone: 'discard' });
      },
    },
  },
};
