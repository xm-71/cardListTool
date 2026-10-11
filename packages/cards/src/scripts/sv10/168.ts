import type { CardScript, EffectCtx } from '@ptcg/engine';

const pokemon = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].discard.filter((u) => ctx.def(u).category === 'Pokemon');

export const name = 'Sacred Ash';
export const script: CardScript = {
  // Shuffle up to 5 Pokémon from your discard pile into your deck.
  trainer: {
    canPlay: (ctx) => pokemon(ctx).length > 0,
    play(ctx) {
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: pokemon(ctx),
        min: 1,
        max: 5,
        message: 'Choose up to 5 Pokémon',
      });
      for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'deck' });
      ctx.shuffleDeck(ctx.me);
    },
  },
};
