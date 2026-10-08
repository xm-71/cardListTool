import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy } from '../util.ts';

export const name = 'Grumpig';
export const script: CardScript = {
  // Energized Steps
  onEvolveFromHand: {
    use(ctx) {
      const top = ctx.state.players[ctx.me].deck.slice(0, 4);
      const remaining = top.filter((uid) => isBasicEnergy(ctx.def(uid)));
      for (;;) {
        const [energy] = ctx.chooseCards({
          player: ctx.me,
          from: remaining,
          min: 0,
          max: 1,
          message: 'Choose a Basic Energy to attach (or finish)',
        });
        if (!energy) break;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Attach it to which Pokémon?',
        });
        ctx.attachEnergy(energy, ref!);
        remaining.splice(remaining.indexOf(energy), 1);
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
};
