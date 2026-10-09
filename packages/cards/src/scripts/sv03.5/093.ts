import type { CardScript } from '@ptcg/engine';

export const name = 'Haunter';
export const set = 'sv03.5';
export const script: CardScript = {
  // Spirit Return: you may put a Supporter card from your opponent's discard pile into their hand.
  onEvolveFromHand: {
    use(ctx) {
      const supporters = ctx.state.players[ctx.opp].discard.filter((uid) => {
        const d = ctx.def(uid);
        return d.category === 'Trainer' && d.trainerType === 'Supporter';
      });
      if (supporters.length === 0) return;
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: supporters,
        min: 0,
        max: 1,
        message: "Choose a Supporter from your opponent's discard pile",
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.opp, zone: 'hand' });
    },
  },
};
