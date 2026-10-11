import type { CardScript } from '@ptcg/engine';

export const name = 'Eri';
export const script: CardScript = {
  // Your opponent reveals their hand, and you discard up to 2 Item cards you find there.
  trainer: {
    play(ctx) {
      const hand = ctx.state.players[ctx.opp].hand;
      if (hand.length === 0) return;
      ctx.reveal([...hand]);
      const items = hand.filter((u) => {
        const d = ctx.def(u);
        return d.category === 'Trainer' && d.trainerType === 'Item';
      });
      if (items.length === 0) return;
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: items,
        min: 0,
        max: 2,
        message: 'Discard up to 2 Items',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.opp, zone: 'discard' });
    },
  },
};
