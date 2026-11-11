import type { CardScript, EffectCtx } from '@ptcg/engine';
import { benchRefs, isBasicEnergy, topDef } from '../util.ts';

const lightningBench = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).types.includes('Lightning'));

export const name = 'Electric Generator';
export const script: CardScript = {
  trainer: {
    // The card has no condition, but with no Benched {L} Pokémon it does nothing, so it is only offered with one.
    canPlay: (ctx) => lightningBench(ctx).length > 0,
    // Look at the top 5 cards of your deck and attach up to 2 Basic {L} Energy cards you find there to your Benched {L}
    // Pokémon in any way you like. Shuffle the other cards back into your deck.
    play(ctx) {
      const found = ctx.state.players[ctx.me].deck
        .slice(0, 5)
        .filter((uid) => isBasicEnergy(ctx.def(uid), 'Lightning'));
      const picks = ctx.chooseCards({
        player: ctx.me,
        from: found,
        min: 0,
        max: 2,
        message: 'Choose up to 2 Basic {L} Energy cards to attach',
      });
      for (const uid of picks) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: lightningBench(ctx),
          min: 1,
          max: 1,
          message: 'Attach it to which Benched {L} Pokémon?',
        });
        if (ref) ctx.attachEnergy(uid, ref);
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
