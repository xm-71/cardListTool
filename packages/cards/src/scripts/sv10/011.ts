import type { CardScript } from '@ptcg/engine';

export const name = 'Dwebble';
export const set = 'sv10';
export const script: CardScript = {
  attacks: {
    // Ascension: search your deck for a card that evolves from this Pokémon and evolve it.
    0: {
      effect(ctx) {
        const from = ctx.state.players[ctx.me].deck.filter((u) => {
          const d = ctx.def(u);
          return d.category === 'Pokemon' && d.evolvesFrom === 'Dwebble';
        });
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from,
          min: 0,
          max: 1,
          message: 'Choose a Pokémon to evolve into',
        });
        if (uid && ctx.state.players[ctx.me].active) ctx.evolve({ player: ctx.me, zone: 'active' }, uid);
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
};
