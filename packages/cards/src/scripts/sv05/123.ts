import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy } from '../util.ts';

export const name = 'Raging Bolt ex';
export const set = 'sv05';
export const script: CardScript = {
  attacks: {
    // Burst Roar: discard your hand and draw 6 cards.
    0: {
      effect(ctx) {
        for (const uid of [...ctx.state.players[ctx.me].hand]) ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
        ctx.draw(ctx.me, 6);
      },
    },
    // Bellowing Thunder: you may discard any amount of Basic Energy from your Pokémon. 70 damage for each card discarded.
    // (The bots read "N damage each" from the prompt text to pay for a Knock Out and no more.)
    1: {
      damage(ctx) {
        const refs = inPlayRefs(ctx, ctx.me);
        const basic = refs.flatMap((ref) => ctx.slot(ref).energy.filter((u) => isBasicEnergy(ctx.def(u))));
        if (basic.length === 0) return 0;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: basic,
          min: 0,
          max: basic.length,
          message: 'Discard any amount of Basic Energy from your Pokémon (70 damage each)',
        });
        for (const ref of refs) {
          const mine = ctx.slot(ref).energy.filter((u) => picks.includes(u));
          if (mine.length) ctx.discardEnergy(ref, mine);
        }
        return 70 * picks.length;
      },
    },
  },
};
