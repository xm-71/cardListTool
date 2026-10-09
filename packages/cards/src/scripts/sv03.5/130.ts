import type { CardScript } from '@ptcg/engine';

export const name = 'Gyarados';
export const set = 'sv03.5';
export const script: CardScript = {
  // Untamed One: when you play this Pokémon from your hand to evolve, you must discard the top 5 cards of your deck.
  onEvolveFromHand: {
    mandatory: true,
    use(ctx) {
      const p = ctx.state.players[ctx.me];
      const milled = p.deck.splice(0, 5);
      p.discard.push(...milled);
      ctx.log(`Untamed One discards ${milled.length} card(s) from the top of the deck`);
    },
  },
  attacks: {
    // Hyper Beam: discard an Energy from your opponent's Active Pokémon.
    0: {
      effect(ctx) {
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const energy = ctx.slot(ref).energy;
        if (energy.length === 0) return;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: [...energy],
          min: 1,
          max: 1,
          message: "Choose an Energy to discard from your opponent's Active Pokémon",
        });
        ctx.discardEnergy(ref, picks);
      },
    },
  },
};
