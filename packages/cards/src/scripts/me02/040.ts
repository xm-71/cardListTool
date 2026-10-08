import type { CardScript } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

export const name = 'Meloetta';
export const script: CardScript = {
  attacks: {
    // Soothing Melody
    0: {
      effect(ctx) {
        const targets = benchRefs(ctx, ctx.me).filter((ref) => topDef(ctx, ref).types.includes('Psychic'));
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: targets,
          min: 1,
          max: 1,
          message: 'Choose a Benched {P} Pokémon to heal',
        });
        if (ref) ctx.heal(ref, 120);
      },
    },
  },
};
