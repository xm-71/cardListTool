import type { CardScript } from '@ptcg/engine';
import { energyOfType, inPlayRefs } from '../util.ts';

export const name = 'Mega Charizard X ex';
export const script: CardScript = {
  attacks: {
    // Inferno X: discard any amount of {R} Energy from your Pokémon; 90 damage for each.
    0: {
      damage(ctx) {
        const refs = inPlayRefs(ctx, ctx.me);
        const fire = refs.flatMap((ref) => energyOfType(ctx, ref, 'Fire'));
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: fire,
          min: 0,
          max: fire.length,
          message: 'Discard any amount of {R} Energy (90 damage each)',
        });
        for (const ref of refs) {
          const mine = ctx.slot(ref).energy.filter((u) => picks.includes(u));
          if (mine.length) ctx.discardEnergy(ref, mine);
        }
        return 90 * picks.length;
      },
    },
  },
};
